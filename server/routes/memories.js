import express from 'express';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

// Get all memories for user
router.get('/', (req, res) => {
  try {
    const memories = db.prepare(`
      SELECT * FROM memories 
      WHERE user_id = ? 
      ORDER BY importance DESC, updated_at DESC
    `).all(req.user.id);

    res.json(memories);
  } catch (error) {
    console.error('Get memories error:', error);
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

// Create memory
router.post('/', (req, res) => {
  try {
    const { content, category, importance } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = db.prepare(`
      INSERT INTO memories (user_id, content, category, importance)
      VALUES (?, ?, ?, ?)
    `).run(
      req.user.id,
      content,
      category || 'general',
      importance || 1
    );

    const memory = db.prepare('SELECT * FROM memories WHERE id = ?').get(result.lastInsertRowid);
    res.json(memory);
  } catch (error) {
    console.error('Create memory error:', error);
    res.status(500).json({ error: 'Failed to create memory' });
  }
});

// Update memory
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { content, category, importance } = req.body;

    const updates = [];
    const values = [];

    if (content !== undefined) {
      updates.push('content = ?');
      values.push(content);
    }

    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }

    if (importance !== undefined) {
      updates.push('importance = ?');
      values.push(importance);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id, req.user.id);

    db.prepare(`
      UPDATE memories SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
    `).run(...values);

    res.json({ message: 'Memory updated successfully' });
  } catch (error) {
    console.error('Update memory error:', error);
    res.status(500).json({ error: 'Failed to update memory' });
  }
});

// Delete memory
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM memories WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.json({ message: 'Memory deleted successfully' });
  } catch (error) {
    console.error('Delete memory error:', error);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

export default router;
