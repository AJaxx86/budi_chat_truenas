import express from 'express';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Search across chats and messages
// GET /api/search?q=<query>&type=all|chats|messages&limit=20&offset=0
router.get('/', authMiddleware, (req, res) => {
  try {
    const { q, type = 'all', limit = 20, offset = 0 } = req.query;
    const userId = req.user.id;

    if (!q || q.trim().length === 0) {
      return res.json({ chats: [], messages: [], total: 0 });
    }

    // Escape special FTS5 characters and prepare search query
    const searchQuery = q
      .trim()
      .replace(/["\*\-\(\)]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 0)
      .map(term => `"${term}"*`)
      .join(' OR ');

    if (!searchQuery) {
      return res.json({ chats: [], messages: [], total: 0 });
    }

    const results = { chats: [], messages: [], total: 0 };
    const limitNum = Math.min(parseInt(limit) || 20, 50);
    const offsetNum = parseInt(offset) || 0;

    // Search chat titles
    if (type === 'all' || type === 'chats') {
      const chatResults = db.prepare(`
        SELECT
          c.id,
          c.title,
          c.created_at,
          c.updated_at,
          snippet(chats_fts, 0, '<mark>', '</mark>', '...', 32) as title_snippet,
          (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) as message_count
        FROM chats_fts
        JOIN chats c ON chats_fts.chat_id = c.id
        WHERE chats_fts MATCH ? AND c.user_id = ?
        ORDER BY rank
        LIMIT ? OFFSET ?
      `).all(searchQuery, userId, limitNum, offsetNum);

      results.chats = chatResults;
    }

    // Search message contents
    if (type === 'all' || type === 'messages') {
      const messageResults = db.prepare(`
        SELECT
          m.id as message_id,
          m.chat_id,
          m.role,
          m.content,
          m.created_at,
          c.title as chat_title,
          snippet(messages_fts, 0, '<mark>', '</mark>', '...', 64) as content_snippet
        FROM messages_fts
        JOIN messages m ON messages_fts.message_id = m.id
        JOIN chats c ON m.chat_id = c.id
        WHERE messages_fts MATCH ? AND c.user_id = ?
        ORDER BY rank
        LIMIT ? OFFSET ?
      `).all(searchQuery, userId, limitNum, offsetNum);

      results.messages = messageResults;
    }

    // Get total counts
    if (type === 'all' || type === 'chats') {
      const chatCount = db.prepare(`
        SELECT COUNT(*) as count
        FROM chats_fts
        JOIN chats c ON chats_fts.chat_id = c.id
        WHERE chats_fts MATCH ? AND c.user_id = ?
      `).get(searchQuery, userId);
      results.totalChats = chatCount?.count || 0;
    }

    if (type === 'all' || type === 'messages') {
      const messageCount = db.prepare(`
        SELECT COUNT(*) as count
        FROM messages_fts
        JOIN messages m ON messages_fts.message_id = m.id
        JOIN chats c ON m.chat_id = c.id
        WHERE messages_fts MATCH ? AND c.user_id = ?
      `).get(searchQuery, userId);
      results.totalMessages = messageCount?.count || 0;
    }

    results.total = (results.totalChats || 0) + (results.totalMessages || 0);

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
