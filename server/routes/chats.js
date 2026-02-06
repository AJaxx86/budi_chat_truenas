import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

// Get all chats for user
router.get('/', (req, res) => {
  try {
    const chats = db.prepare(`
      SELECT c.*, COUNT(m.id) as message_count
      FROM chats c
      LEFT JOIN messages m ON c.id = m.chat_id
      WHERE c.user_id = ?
      GROUP BY c.id
      ORDER BY c.updated_at DESC
    `).all(req.user.id);

    res.json(chats);
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Get single chat with messages
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const chat = db.prepare(`
      SELECT * FROM chats WHERE id = ? AND user_id = ?
    `).get(id, req.user.id);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const messages = db.prepare(`
      SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC
    `).all(id);

    // Fetch steps for all messages in this chat
    const messageSteps = db.prepare(`
      SELECT * FROM message_steps WHERE chat_id = ? ORDER BY message_id, step_index ASC
    `).all(id);

    // Group steps by message_id, adding isComplete flag for loaded steps
    const stepsByMessage = {};
    for (const step of messageSteps) {
      if (!stepsByMessage[step.message_id]) {
        stepsByMessage[step.message_id] = [];
      }
      // All steps from DB are complete (they were saved after completion)
      stepsByMessage[step.message_id].push({ ...step, isComplete: true });
    }

    // Attach steps to messages
    const messagesWithSteps = messages.map(msg => ({
      ...msg,
      steps: stepsByMessage[msg.id] || []
    }));

    res.json({ ...chat, messages: messagesWithSteps });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// Create new chat
router.post('/', (req, res) => {
  try {
    const { title, model, system_prompt, temperature, agent_mode, workspace_id, depth, tone } = req.body;
    const id = uuidv4();

    // If workspace_id provided, get workspace defaults
    let finalModel = model || 'moonshotai/kimi-k2-thinking';
    let finalSystemPrompt = system_prompt || null;
    let finalTemperature = temperature !== undefined ? temperature : 0.7;

    if (workspace_id) {
      const workspace = db.prepare(`
        SELECT default_model, default_system_prompt, default_temperature 
        FROM workspaces WHERE id = ? AND user_id = ?
      `).get(workspace_id, req.user.id);

      if (workspace) {
        // Inherit from workspace if not explicitly provided
        if (!model && workspace.default_model) {
          finalModel = workspace.default_model;
        }
        if (!system_prompt && workspace.default_system_prompt) {
          finalSystemPrompt = workspace.default_system_prompt;
        }
        if (temperature === undefined && workspace.default_temperature !== null) {
          finalTemperature = workspace.default_temperature;
        }
      }
    }

    db.prepare(`
      INSERT INTO chats(id, user_id, title, model, system_prompt, temperature, depth, tone, agent_mode, workspace_id, thinking_mode)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
      id,
      req.user.id,
      title || 'New Chat',
      finalModel,
      finalSystemPrompt,
      finalTemperature,
      depth || 'standard',
      tone || 'professional',
      agent_mode ? 1 : 0,
      workspace_id || null,
      req.body.thinking_mode || 'medium'
    );

    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(id);
    res.json(chat);
  } catch (error) {
    console.error('Create chat error:', error);
    // Log specific SQL errors if available
    if (error.code) {
      console.error('SQL Error Code:', error.code);
    }
    if (error.message) {
      console.error('Error Message:', error.message);
    }
    res.status(500).json({ error: 'Failed to create chat', details: error.message });
  }
});

// Update chat
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, model, system_prompt, temperature, agent_mode, depth, tone } = req.body;

    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }

    if (model !== undefined) {
      updates.push('model = ?');
      values.push(model);
    }

    if (system_prompt !== undefined) {
      updates.push('system_prompt = ?');
      values.push(system_prompt);
    }

    if (temperature !== undefined) {
      updates.push('temperature = ?');
      values.push(temperature);
    }

    if (agent_mode !== undefined) {
      updates.push('agent_mode = ?');
      values.push(agent_mode ? 1 : 0);
    }

    if (depth !== undefined) {
      updates.push('depth = ?');
      values.push(depth);
    }

    if (tone !== undefined) {
      updates.push('tone = ?');
      values.push(tone);
    }

    if (req.body.thinking_mode !== undefined) {
      updates.push('thinking_mode = ?');
      values.push(req.body.thinking_mode);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id, req.user.id);

    db.prepare(`
      UPDATE chats SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
      `).run(...values);

    res.json({ message: 'Chat updated successfully' });
  } catch (error) {
    console.error('Update chat error:', error);
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

// Delete chat
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM chats WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// Fork chat from specific message
router.post('/:id/fork', (req, res) => {
  try {
    const { id } = req.params;
    const { message_id, title, model } = req.body;

    // Get original chat
    const originalChat = db.prepare(`
      SELECT * FROM chats WHERE id = ? AND user_id = ?
      `).get(id, req.user.id);

    if (!originalChat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Create new chat (use provided model or fall back to original)
    const newChatId = uuidv4();
    db.prepare(`
      INSERT INTO chats(id, user_id, title, parent_chat_id, fork_point_message_id,
        model, system_prompt, temperature, depth, tone, agent_mode, thinking_mode)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
      newChatId,
      req.user.id,
      title || `${originalChat.title}(Fork)`,
      id,
      message_id,
      model || originalChat.model,
      originalChat.system_prompt,
      originalChat.temperature,
      originalChat.depth,
      originalChat.tone,
      originalChat.agent_mode,
      originalChat.thinking_mode || 'medium'
    );

    // Copy messages up to fork point
    const messages = db.prepare(`
      SELECT * FROM messages 
      WHERE chat_id = ? AND created_at <= (SELECT created_at FROM messages WHERE id = ?)
      ORDER BY created_at ASC
      `).all(id, message_id);

    const insertMessage = db.prepare(`
      INSERT INTO messages(id, chat_id, role, content, tool_calls, tool_call_id, name, created_at, prompt_tokens, completion_tokens, response_time_ms, model, cost, response_group_id)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

    // Map old response_group_ids to new UUIDs so groups stay linked in the fork
    const groupIdMap = {};
    for (const msg of messages) {
      let newGroupId = null;
      if (msg.response_group_id) {
        if (!groupIdMap[msg.response_group_id]) {
          groupIdMap[msg.response_group_id] = uuidv4();
        }
        newGroupId = groupIdMap[msg.response_group_id];
      }

      insertMessage.run(
        uuidv4(),
        newChatId,
        msg.role,
        msg.content,
        msg.tool_calls,
        msg.tool_call_id,
        msg.name,
        msg.created_at,
        msg.prompt_tokens,
        msg.completion_tokens,
        msg.response_time_ms,
        msg.model,
        msg.cost,
        newGroupId
      );
    }

    const newChat = db.prepare('SELECT * FROM chats WHERE id = ?').get(newChatId);
    res.json(newChat);
  } catch (error) {
    console.error('Fork chat error:', error);
    res.status(500).json({ error: 'Failed to fork chat' });
  }
});

export default router;
