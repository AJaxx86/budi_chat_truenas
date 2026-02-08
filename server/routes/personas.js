import express from 'express';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
router.use(authMiddleware);

// Get all personas (user's + defaults)
router.get('/', (req, res) => {
  try {
    const personas = db.prepare(`
      SELECT * FROM personas
      WHERE user_id = ? OR is_default = 1
      ORDER BY is_default DESC, usage_count DESC, name ASC
    `).all(req.user.id);

    res.json(personas);
  } catch (error) {
    console.error('Get personas error:', error);
    res.status(500).json({ error: 'Failed to fetch personas' });
  }
});

// Get recently used personas (limit 5)
router.get('/recent', (req, res) => {
  try {
    const personas = db.prepare(`
      SELECT * FROM personas
      WHERE (user_id = ? OR is_default = 1) AND last_used_at IS NOT NULL
      ORDER BY last_used_at DESC
      LIMIT 5
    `).all(req.user.id);

    res.json(personas);
  } catch (error) {
    console.error('Get recent personas error:', error);
    res.status(500).json({ error: 'Failed to fetch recent personas' });
  }
});

// Get single persona by ID
router.get('/:id', (req, res) => {
  try {
    const persona = db.prepare(`
      SELECT * FROM personas WHERE id = ? AND (user_id = ? OR is_default = 1)
    `).get(req.params.id, req.user.id);

    if (!persona) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    res.json(persona);
  } catch (error) {
    console.error('Get persona error:', error);
    res.status(500).json({ error: 'Failed to fetch persona' });
  }
});

// Create new persona
router.post('/', (req, res) => {
  try {
    const { name, description, system_prompt, icon, category, creativity, depth, tone } = req.body;

    if (!name || !system_prompt) {
      return res.status(400).json({ error: 'Name and system prompt are required' });
    }

    const id = uuidv4();

    db.prepare(`
      INSERT INTO personas (id, user_id, name, description, system_prompt, icon, category, creativity, depth, tone, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      id,
      req.user.id,
      name,
      description || '',
      system_prompt,
      icon || 'User',
      category || 'general',
      req.body.creativity || 'balanced',
      req.body.depth || 'standard',
      req.body.tone || 'professional'
    );

    const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(id);
    res.json(persona);
  } catch (error) {
    console.error('Create persona error:', error);
    res.status(500).json({ error: 'Failed to create persona' });
  }
});

// Update persona (own personas only)
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, system_prompt, icon, category, creativity, depth, tone } = req.body;

    // Check if persona exists and belongs to user (not a default)
    const existing = db.prepare('SELECT * FROM personas WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Persona not found' });
    }
    if (existing.is_default) {
      return res.status(403).json({ error: 'Cannot edit default personas' });
    }
    if (existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Cannot edit other users personas' });
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (system_prompt !== undefined) {
      updates.push('system_prompt = ?');
      values.push(system_prompt);
    }
    if (icon !== undefined) {
      updates.push('icon = ?');
      values.push(icon);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }
    if (creativity !== undefined) {
      updates.push('creativity = ?');
      values.push(creativity);
    }
    if (depth !== undefined) {
      updates.push('depth = ?');
      values.push(depth);
    }
    if (tone !== undefined) {
      updates.push('tone = ?');
      values.push(tone);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`
      UPDATE personas SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);

    const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(id);
    res.json(persona);
  } catch (error) {
    console.error('Update persona error:', error);
    res.status(500).json({ error: 'Failed to update persona' });
  }
});

// Track persona usage
router.post('/:id/use', (req, res) => {
  try {
    const { id } = req.params;

    // Check if persona exists and is accessible to user
    const existing = db.prepare('SELECT * FROM personas WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Persona not found' });
    }
    if (!existing.is_default && existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Cannot access this persona' });
    }

    db.prepare(`
      UPDATE personas
      SET usage_count = usage_count + 1,
          last_used_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    res.json({ message: 'Usage tracked' });
  } catch (error) {
    console.error('Track persona usage error:', error);
    res.status(500).json({ error: 'Failed to track usage' });
  }
});

// Delete persona (own personas only)
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Check if persona exists and belongs to user (not a default)
    const existing = db.prepare('SELECT * FROM personas WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Persona not found' });
    }
    if (existing.is_default) {
      return res.status(403).json({ error: 'Cannot delete default personas' });
    }
    if (existing.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Cannot delete other users personas' });
    }

    db.prepare('DELETE FROM personas WHERE id = ?').run(id);
    res.json({ message: 'Persona deleted successfully' });
  } catch (error) {
    console.error('Delete persona error:', error);
    res.status(500).json({ error: 'Failed to delete persona' });
  }
});

export default router;
