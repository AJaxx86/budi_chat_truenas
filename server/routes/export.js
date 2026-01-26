import express from 'express';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Get chat data for export
// GET /api/chats/:id/export?format=json|markdown
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;
    const userId = req.user.id;

    // Get chat
    const chat = db.prepare(`
      SELECT * FROM chats WHERE id = ? AND user_id = ?
    `).get(id, userId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Get messages
    const messages = db.prepare(`
      SELECT id, role, content, reasoning_content, created_at, prompt_tokens, completion_tokens, model, cost
      FROM messages
      WHERE chat_id = ?
      ORDER BY created_at ASC
    `).all(id);

    const exportData = {
      chat: {
        id: chat.id,
        title: chat.title,
        model: chat.model,
        system_prompt: chat.system_prompt,
        temperature: chat.temperature,
        created_at: chat.created_at,
        updated_at: chat.updated_at
      },
      messages: messages,
      exported_at: new Date().toISOString(),
      exported_by: req.user.name
    };

    if (format === 'markdown') {
      const markdown = generateMarkdown(exportData);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(chat.title)}.md"`);
      return res.send(markdown);
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(chat.title)}.json"`);
      return res.json(exportData);
    }

    // Default: return raw data for client-side processing
    res.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

function sanitizeFilename(name) {
  return name
    .replace(/[^a-z0-9\s\-_]/gi, '')
    .replace(/\s+/g, '_')
    .substring(0, 50) || 'chat_export';
}

function generateMarkdown(data) {
  const { chat, messages, exported_at, exported_by } = data;

  let md = `# ${chat.title}\n\n`;
  md += `> Exported on ${new Date(exported_at).toLocaleString()} by ${exported_by}\n\n`;
  md += `---\n\n`;

  // Metadata
  md += `## Chat Details\n\n`;
  md += `- **Model:** ${chat.model}\n`;
  md += `- **Temperature:** ${chat.temperature}\n`;
  md += `- **Created:** ${new Date(chat.created_at).toLocaleString()}\n`;

  if (chat.system_prompt) {
    md += `\n### System Prompt\n\n`;
    md += `> ${chat.system_prompt.replace(/\n/g, '\n> ')}\n`;
  }

  md += `\n---\n\n`;
  md += `## Conversation\n\n`;

  // Messages
  for (const msg of messages) {
    const timestamp = new Date(msg.created_at).toLocaleString();
    const role = msg.role === 'user' ? '**You**' : '**Assistant**';

    md += `### ${role} - ${timestamp}\n\n`;

    // Include reasoning if present
    if (msg.reasoning_content) {
      md += `<details>\n<summary>Thinking Process</summary>\n\n`;
      md += `${msg.reasoning_content}\n\n`;
      md += `</details>\n\n`;
    }

    md += `${msg.content}\n\n`;

    // Token info for assistant messages
    if (msg.role === 'assistant' && (msg.prompt_tokens || msg.completion_tokens)) {
      md += `*Tokens: ${(msg.prompt_tokens || 0) + (msg.completion_tokens || 0)} | Cost: $${(msg.cost || 0).toFixed(4)}*\n\n`;
    }

    md += `---\n\n`;
  }

  // Summary
  const totalTokens = messages.reduce((sum, m) => sum + (m.prompt_tokens || 0) + (m.completion_tokens || 0), 0);
  const totalCost = messages.reduce((sum, m) => sum + (m.cost || 0), 0);

  md += `## Summary\n\n`;
  md += `- **Total Messages:** ${messages.length}\n`;
  md += `- **Total Tokens:** ${totalTokens.toLocaleString()}\n`;
  md += `- **Total Cost:** $${totalCost.toFixed(4)}\n`;

  return md;
}

export default router;
