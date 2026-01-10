import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { getApiKey, executeToolCall, generateChatTitle } from '../services/ai.js';

const router = express.Router();
router.use(authMiddleware);

// Send message and get AI response
router.post('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;

    // Verify chat ownership and get message count
    const chat = db.prepare(`
      SELECT c.*, COUNT(m.id) as message_count
      FROM chats c
      LEFT JOIN messages m ON c.id = m.chat_id
      WHERE c.id = ? AND c.user_id = ?
      GROUP BY c.id
    `).get(chatId, req.user.id);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Get API key
    const apiKey = await getApiKey(req.user.id);
    if (!apiKey) {
      return res.status(400).json({
        error: 'No API key configured. Please set your OpenRouter API key in settings or ask an admin to enable the default key for you.'
      });
    }

    // Generate title if chat still has default name and this is the first message
    // Do this BEFORE saving the user message so message_count is still 0
    if (chat.title === 'New Chat' && chat.message_count === 0) {
      const generatedTitle = await generateChatTitle(content, req.user.id);
      if (generatedTitle) {
        db.prepare(`
          UPDATE chats SET title = ? WHERE id = ?
        `).run(generatedTitle, chatId);
        chat.title = generatedTitle; // Update local reference
      }
    }

    // Save user message
    const userMessageId = uuidv4();
    db.prepare(`
      INSERT INTO messages (id, chat_id, role, content)
      VALUES (?, ?, 'user', ?)
    `).run(userMessageId, chatId, content);

    // Get conversation history
    const messages = db.prepare(`
      SELECT role, content, reasoning_content, tool_calls, tool_call_id, name
      FROM messages 
      WHERE chat_id = ? 
      ORDER BY created_at ASC
    `).all(chatId);

    // Build OpenAI messages array
    const openaiMessages = [];

    if (chat.system_prompt) {
      openaiMessages.push({
        role: 'system',
        content: chat.system_prompt
      });
    }

    // Get user memories for context
    const memories = db.prepare(`
      SELECT content FROM memories 
      WHERE user_id = ? 
      ORDER BY importance DESC, updated_at DESC 
      LIMIT 5
    `).all(req.user.id);

    if (memories.length > 0) {
      const memoryContext = memories.map(m => m.content).join('\n');
      openaiMessages.push({
        role: 'system',
        content: `Previous context about the user:\n${memoryContext}`
      });
    }

    for (const msg of messages) {
      const openaiMsg = {
        role: msg.role,
        content: msg.content
      };

      if (msg.reasoning_content) {
        // Some models support pre-filled reasoning, but standard API doesn't usually
        // We'll skip adding it to history for now unless the model supports it via specific fields
      }

      if (msg.tool_calls) {
        openaiMsg.tool_calls = JSON.parse(msg.tool_calls);
      }

      if (msg.tool_call_id) {
        openaiMsg.tool_call_id = msg.tool_call_id;
      }

      if (msg.name) {
        openaiMsg.name = msg.name;
      }

      openaiMessages.push(openaiMsg);
    }

    const openai = new OpenAI({ 
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1'
    });

    // Prepare request options
    const requestOptions = {
      model: chat.model,
      messages: openaiMessages,
      temperature: chat.temperature,
      stream: true,
      stream_options: { include_usage: true }
    };

    // Add tools if agent mode is enabled
    if (chat.agent_mode) {
      const tools = db.prepare(`
        SELECT name, description, parameters 
        FROM tools 
        WHERE enabled = 1
      `).all();

      if (tools.length > 0) {
        requestOptions.tools = tools.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: JSON.parse(t.parameters)
          }
        }));
      }
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let assistantMessage = '';
    let assistantReasoning = '';
    let toolCalls = [];
    let usageData = null;
    const assistantMessageId = uuidv4();

    console.log(`Starting stream for model: ${chat.model}`);
    const stream = await openai.chat.completions.create(requestOptions);

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      // Capture usage data if present (usually in final chunk)
      if (chunk.usage) {
        usageData = chunk.usage;
      }

      if (!delta) continue;

      // Detect reasoning in various possible fields
      const reasoning = delta.reasoning_content || delta.reasoning || delta.thought;

      if (reasoning) {
        assistantReasoning += reasoning;
        res.write(`data: ${JSON.stringify({ type: 'reasoning', content: reasoning })}\n\n`);
      }

      if (delta.content) {
        assistantMessage += delta.content;
        res.write(`data: ${JSON.stringify({ type: 'content', content: delta.content })}\n\n`);
      }

      if (delta.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (!toolCalls[toolCall.index]) {
            toolCalls[toolCall.index] = {
              id: toolCall.id,
              type: 'function',
              function: { name: '', arguments: '' }
            };
          }

          if (toolCall.function?.name) {
            toolCalls[toolCall.index].function.name = toolCall.function.name;
          }

          if (toolCall.function?.arguments) {
            toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
          }
        }
      }

      if (chunk.choices[0]?.finish_reason) {
        break;
      }
    }

    console.log(`Stream complete. Captured ${assistantReasoning.length} reasoning chars and ${assistantMessage.length} content chars.`);
    if (usageData) {
      console.log(`Usage: ${JSON.stringify(usageData)}`);
    }

    // Save assistant message
    db.prepare(`
      INSERT INTO messages (id, chat_id, role, content, reasoning_content, tool_calls)
      VALUES (?, ?, 'assistant', ?, ?, ?)
    `).run(
      assistantMessageId,
      chatId,
      assistantMessage,
      assistantReasoning || null,
      toolCalls.length > 0 ? JSON.stringify(toolCalls) : null
    );

    // Handle tool calls if any
    if (toolCalls.length > 0) {
      res.write(`data: ${JSON.stringify({ type: 'tool_calls', tool_calls: toolCalls })}\n\n`);

      for (const toolCall of toolCalls) {
        const result = await executeToolCall(toolCall);
        
        // Save tool response
        const toolMessageId = uuidv4();
        db.prepare(`
          INSERT INTO messages (id, chat_id, role, content, tool_call_id, name)
          VALUES (?, ?, 'tool', ?, ?, ?)
        `).run(
          toolMessageId,
          chatId,
          result,
          toolCall.id,
          toolCall.function.name
        );

        res.write(`data: ${JSON.stringify({ 
          type: 'tool_result', 
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          result 
        })}\n\n`);
      }
    }

    // Update chat timestamp
    db.prepare(`
      UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(chatId);

    res.write(`data: ${JSON.stringify({
      type: 'done',
      message_id: assistantMessageId,
      usage: usageData || null,
      model: chat.model
    })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Message error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to process message' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});

// Get messages for a chat
router.get('/:chatId', (req, res) => {
  try {
    const { chatId } = req.params;

    // Verify chat ownership
    const chat = db.prepare(`
      SELECT id FROM chats WHERE id = ? AND user_id = ?
    `).get(chatId, req.user.id);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const messages = db.prepare(`
      SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC
    `).all(chatId);

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Delete message and all subsequent messages (branch)
router.delete('/:messageId/branch', async (req, res) => {
  try {
    const { messageId } = req.params;

    // Get the message to find its chat_id and created_at
    const message = db.prepare(`
      SELECT m.* FROM messages m
      JOIN chats c ON m.chat_id = c.id
      WHERE m.id = ? AND c.user_id = ?
    `).get(messageId, req.user.id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Delete this message and all subsequent messages in the same chat
    db.prepare(`
      DELETE FROM messages 
      WHERE chat_id = ? AND created_at >= ?
    `).run(message.chat_id, message.created_at);

    // Update chat timestamp
    db.prepare(`
      UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(message.chat_id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete branch error:', error);
    res.status(500).json({ error: 'Failed to delete message branch' });
  }
});

export default router;
