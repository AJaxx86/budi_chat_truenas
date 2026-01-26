import express from "express";
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";
import { readFileSync, existsSync } from "fs";
import db from "../database.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  getApiKeyInfo,
  executeToolCall,
  generateChatTitle,
} from "../services/ai.js";

// Helper to convert file to base64 data URL
function getFileAsDataUrl(filePath, mimetype) {
  if (!existsSync(filePath)) return null;
  const buffer = readFileSync(filePath);
  const base64 = buffer.toString("base64");
  return `data:${mimetype};base64,${base64}`;
}

const router = express.Router();
router.use(authMiddleware);

// Send message and get AI response
router.post("/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;
<<<<<<< HEAD
    const { content, thinking } = req.body;
=======
    const { content, attachment_ids = [] } = req.body;

    // Fetch attachments if provided
    let attachments = [];
    if (attachment_ids.length > 0) {
      attachments = db
        .prepare(
          `SELECT * FROM file_uploads WHERE id IN (${attachment_ids.map(() => "?").join(",")}) AND user_id = ?`
        )
        .all(...attachment_ids, req.user.id);
    }
>>>>>>> 44479451eaa4db5ff6ebcbf18375f307e12258f0

    // Verify chat ownership and get message count
    const chat = db
      .prepare(
        `
      SELECT c.*, COUNT(m.id) as message_count
      FROM chats c
      LEFT JOIN messages m ON c.id = m.chat_id
      WHERE c.id = ? AND c.user_id = ?
      GROUP BY c.id
    `,
      )
      .get(chatId, req.user.id);

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Get API key info
    const apiKeyInfo = await getApiKeyInfo(req.user.id);
    if (!apiKeyInfo) {
      return res.status(400).json({
        error:
          "No API key configured. Please set your OpenRouter API key in settings or ask an admin to enable the default key for you.",
      });
    }
    const { key: apiKey, isDefault: usedDefaultKey } = apiKeyInfo;

    // Generate title concurrently if chat has default name and this is the first message
    // Fire and forget - but we want to send the result down the stream
    if (chat.title === "New Chat" && chat.message_count === 0) {
      generateChatTitle(content, req.user.id)
        .then((generatedTitle) => {
          if (generatedTitle) {
            try {
              db.prepare(
                `
              UPDATE chats SET title = ? WHERE id = ?
            `,
              ).run(generatedTitle, chatId);

              // Send title update event if stream is still open
              if (!res.writableEnded) {
                res.write(
                  `data: ${JSON.stringify({ type: "title", content: generatedTitle })}\n\n`,
                );
              }
            } catch (err) {
              console.error("Failed to update chat title:", err);
            }
          }
        })
        .catch((err) => {
          console.error("Failed to generate chat title:", err);
        });
    }

    // Save user message
    const userMessageId = uuidv4();
    db.prepare(
      `
      INSERT INTO messages (id, chat_id, role, content)
      VALUES (?, ?, 'user', ?)
    `,
    ).run(userMessageId, chatId, content);

    // Link attachments to the user message
    if (attachments.length > 0) {
      const updateStmt = db.prepare(
        `UPDATE file_uploads SET message_id = ?, chat_id = ? WHERE id = ?`
      );
      for (const attachment of attachments) {
        updateStmt.run(userMessageId, chatId, attachment.id);
      }
    }

    // Get conversation history
    const messages = db
      .prepare(
        `
      SELECT role, content, reasoning_content, tool_calls, tool_call_id, name
      FROM messages
      WHERE chat_id = ?
      ORDER BY created_at ASC
    `,
      )
      .all(chatId);

    // Build OpenAI messages array
    const openaiMessages = [];

    if (chat.system_prompt) {
      openaiMessages.push({
        role: "system",
        content: chat.system_prompt,
      });
    }

    // Get user memories for context
    const memories = db
      .prepare(
        `
      SELECT content FROM memories
      WHERE user_id = ?
      ORDER BY importance DESC, updated_at DESC
      LIMIT 5
    `,
      )
      .all(req.user.id);

    if (memories.length > 0) {
      const memoryContext = memories.map((m) => m.content).join("\n");
      openaiMessages.push({
        role: "system",
        content: `Previous context about the user:\n${memoryContext}`,
      });
    }

    // Get all attachments for this chat's messages
    const chatAttachments = db
      .prepare(
        `SELECT * FROM file_uploads WHERE chat_id = ? AND message_id IS NOT NULL`
      )
      .all(chatId);

    // Group attachments by message_id
    const attachmentsByMessage = {};
    for (const att of chatAttachments) {
      if (!attachmentsByMessage[att.message_id]) {
        attachmentsByMessage[att.message_id] = [];
      }
      attachmentsByMessage[att.message_id].push(att);
    }

    // Inject document context from current attachments
    if (attachments.length > 0) {
      const documentContextParts = [];
      for (const att of attachments) {
        if (att.extracted_text && att.extraction_status === "completed") {
          documentContextParts.push(
            `--- Document: ${att.original_name} ---\n${att.extracted_text}\n--- End of ${att.original_name} ---`
          );
        }
      }

      if (documentContextParts.length > 0) {
        openaiMessages.push({
          role: "system",
          content: `The user has attached the following document(s) for analysis:\n\n${documentContextParts.join("\n\n")}`,
        });
      }
    }

    for (const msg of messages) {
      const msgAttachments = attachmentsByMessage[msg.id] || [];

      // Build message content - use multi-modal format if attachments exist
      let messageContent;
      if (msgAttachments.length > 0 && msg.role === "user") {
        // Multi-modal content with images
        messageContent = [{ type: "text", text: msg.content }];

        for (const att of msgAttachments) {
          if (att.mimetype.startsWith("image/")) {
            const dataUrl = getFileAsDataUrl(att.storage_path, att.mimetype);
            if (dataUrl) {
              messageContent.push({
                type: "image_url",
                image_url: { url: dataUrl },
              });
            }
          }
        }
      } else {
        messageContent = msg.content;
      }

      const openaiMsg = {
        role: msg.role,
        content: messageContent,
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

    // Add current message attachments to the last message if not already included
    if (attachments.length > 0) {
      const lastMsg = openaiMessages[openaiMessages.length - 1];
      if (lastMsg && lastMsg.role === "user") {
        // Convert to multi-modal if not already
        if (typeof lastMsg.content === "string") {
          lastMsg.content = [{ type: "text", text: lastMsg.content }];
        }

        for (const att of attachments) {
          if (att.mimetype.startsWith("image/")) {
            const dataUrl = getFileAsDataUrl(att.storage_path, att.mimetype);
            if (dataUrl) {
              lastMsg.content.push({
                type: "image_url",
                image_url: { url: dataUrl },
              });
            }
          }
        }
      }
    }

    const openai = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });

    // Prepare request options
    const requestOptions = {
      model: chat.model,
      messages: openaiMessages,
      temperature: chat.temperature,
      stream: true,
      usage: { include: true },
    };

    // Add thinking configuration if enabled
    if (thinking) {
      requestOptions.extra_body = {
        include_reasoning: true,
        thinking,
      };

      // Some models (like newer Claude) require max_tokens to be set when using thinking
      // OpenRouter usually handles defaults, but we might want to ensure a high limit
      if (!requestOptions.max_tokens) {
        // Optionally set max_tokens based on budget if needed, but let's leave it to server default for now or add if strictly required
      }
    }

    // Add tools if agent mode is enabled
    if (chat.agent_mode) {
      const tools = db
        .prepare(
          `
        SELECT name, description, parameters
        FROM tools
        WHERE enabled = 1
      `,
        )
        .all();

      if (tools.length > 0) {
        requestOptions.tools = tools.map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: JSON.parse(t.parameters),
          },
        }));
      }
    }

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let assistantMessage = "";
    let assistantReasoning = "";
    let toolCalls = [];
    let usageData = null;
    const assistantMessageId = uuidv4();

    console.log(`Starting stream for model: ${chat.model}`);
    const requestStartTime = Date.now();
    const stream = await openai.chat.completions.create(requestOptions);

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      // Capture usage data if present (usually in final chunk)
      if (chunk.usage) {
        usageData = chunk.usage;
      }

      if (!delta) continue;

      // Detect reasoning in various possible fields
      const reasoning =
        delta.reasoning_content || delta.reasoning || delta.thought;

      if (reasoning) {
        assistantReasoning += reasoning;
        res.write(
          `data: ${JSON.stringify({ type: "reasoning", content: reasoning })}\n\n`,
        );
      }

      if (delta.content) {
        assistantMessage += delta.content;
        res.write(
          `data: ${JSON.stringify({ type: "content", content: delta.content })}\n\n`,
        );
      }

      if (delta.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (!toolCalls[toolCall.index]) {
            toolCalls[toolCall.index] = {
              id: toolCall.id,
              type: "function",
              function: { name: "", arguments: "" },
            };
          }

          if (toolCall.function?.name) {
            toolCalls[toolCall.index].function.name = toolCall.function.name;
          }

          if (toolCall.function?.arguments) {
            toolCalls[toolCall.index].function.arguments +=
              toolCall.function.arguments;
          }
        }
      }
    }

    const responseTimeMs = Date.now() - requestStartTime;
    console.log(
      `Stream complete. Captured ${assistantReasoning.length} reasoning chars and ${assistantMessage.length} content chars. Time: ${responseTimeMs}ms`,
    );
    if (usageData) {
      console.log(`Usage: ${JSON.stringify(usageData)}`);
    }

    // Save assistant message with usage stats
    db.prepare(
      `
      INSERT INTO messages (id, chat_id, role, content, reasoning_content, tool_calls, prompt_tokens, completion_tokens, response_time_ms, model, cost, used_default_key)
      VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      assistantMessageId,
      chatId,
      assistantMessage,
      assistantReasoning || null,
      toolCalls.length > 0 ? JSON.stringify(toolCalls) : null,
      usageData?.prompt_tokens || null,
      usageData?.completion_tokens || null,
      responseTimeMs,
      chat.model,
      usageData?.cost || 0,
      usedDefaultKey ? 1 : 0,
    );

    // Update persistent user stats (survives message/chat deletion)
    db.prepare(
      `
      INSERT INTO user_stats (user_id, total_messages, total_prompt_tokens, total_completion_tokens, total_cost, total_reasoning_chars, updated_at)
      VALUES (?, 1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        total_messages = total_messages + 1,
        total_prompt_tokens = total_prompt_tokens + ?,
        total_completion_tokens = total_completion_tokens + ?,
        total_cost = total_cost + ?,
        total_reasoning_chars = total_reasoning_chars + ?,
        updated_at = CURRENT_TIMESTAMP
    `,
    ).run(
      req.user.id,
      usageData?.prompt_tokens || 0,
      usageData?.completion_tokens || 0,
      usageData?.cost || 0,
      assistantReasoning?.length || 0,
      usageData?.prompt_tokens || 0,
      usageData?.completion_tokens || 0,
      usageData?.cost || 0,
      assistantReasoning?.length || 0,
    );

    // Update persistent per-model stats (survives message/chat deletion)
    if (chat.model) {
      db.prepare(
        `
        INSERT INTO user_model_stats (user_id, model, usage_count, total_prompt_tokens, total_completion_tokens, total_cost, updated_at)
        VALUES (?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, model) DO UPDATE SET
          usage_count = usage_count + 1,
          total_prompt_tokens = total_prompt_tokens + ?,
          total_completion_tokens = total_completion_tokens + ?,
          total_cost = total_cost + ?,
          updated_at = CURRENT_TIMESTAMP
      `,
      ).run(
        req.user.id,
        chat.model,
        usageData?.prompt_tokens || 0,
        usageData?.completion_tokens || 0,
        usageData?.cost || 0,
        usageData?.prompt_tokens || 0,
        usageData?.completion_tokens || 0,
        usageData?.cost || 0,
      );
    }

    // Handle tool calls if any
    if (toolCalls.length > 0) {
      res.write(
        `data: ${JSON.stringify({ type: "tool_calls", tool_calls: toolCalls })}\n\n`,
      );

      for (const toolCall of toolCalls) {
        const result = await executeToolCall(toolCall);

        // Save tool response
        const toolMessageId = uuidv4();
        db.prepare(
          `
          INSERT INTO messages (id, chat_id, role, content, tool_call_id, name)
          VALUES (?, ?, 'tool', ?, ?, ?)
        `,
        ).run(
          toolMessageId,
          chatId,
          result,
          toolCall.id,
          toolCall.function.name,
        );

        res.write(
          `data: ${JSON.stringify({
            type: "tool_result",
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            result,
          })}\n\n`,
        );
      }
    }

    // Update chat timestamp
    db.prepare(
      `
      UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `,
    ).run(chatId);

    res.write(
      `data: ${JSON.stringify({
        type: "done",
        message_id: assistantMessageId,
        usage: usageData || null,
        model: chat.model,
        cost: usageData?.cost || 0,
      })}\n\n`,
    );
    res.end();
  } catch (error) {
    console.error("Message error:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: error.message || "Failed to process message" });
    } else {
      res.write(
        `data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`,
      );
      res.end();
    }
  }
});

// Get messages for a chat
router.get("/:chatId", (req, res) => {
  try {
    const { chatId } = req.params;

    // Verify chat ownership
    const chat = db
      .prepare(
        `
      SELECT id FROM chats WHERE id = ? AND user_id = ?
    `,
      )
      .get(chatId, req.user.id);

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    const messages = db
      .prepare(
        `
      SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC
    `,
      )
      .all(chatId);

    res.json(messages);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Delete message and all subsequent messages (branch)
router.delete("/:messageId/branch", async (req, res) => {
  try {
    const { messageId } = req.params;

    // Get the message to find its chat_id and created_at
    const message = db
      .prepare(
        `
      SELECT m.* FROM messages m
      JOIN chats c ON m.chat_id = c.id
      WHERE m.id = ? AND c.user_id = ?
    `,
      )
      .get(messageId, req.user.id);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Delete this message and all subsequent messages in the same chat
    db.prepare(
      `
      DELETE FROM messages
      WHERE chat_id = ? AND created_at >= ?
    `,
    ).run(message.chat_id, message.created_at);

    // Update chat timestamp
    db.prepare(
      `
      UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `,
    ).run(message.chat_id);

    res.json({ success: true });
  } catch (error) {
    console.error("Delete branch error:", error);
    res.status(500).json({ error: "Failed to delete message branch" });
  }
});

export default router;
