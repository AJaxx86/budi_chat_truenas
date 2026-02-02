import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

// Get all workspaces with chat counts
router.get('/', (req, res) => {
    try {
        const workspaces = db.prepare(`
      SELECT w.*, COUNT(c.id) as chat_count
      FROM workspaces w
      LEFT JOIN chats c ON w.id = c.workspace_id
      WHERE w.user_id = ?
      GROUP BY w.id
      ORDER BY w.sort_order ASC, w.created_at DESC
    `).all(req.user.id);

        res.json(workspaces);
    } catch (error) {
        console.error('Get workspaces error:', error);
        res.status(500).json({ error: 'Failed to fetch workspaces' });
    }
});

// Create workspace
router.post('/', (req, res) => {
    try {
        const { name, description, icon, color, default_model, default_system_prompt, default_temperature } = req.body;
        const id = uuidv4();

        // Get the max sort_order for the user
        const maxOrder = db.prepare(`
      SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order 
      FROM workspaces WHERE user_id = ?
    `).get(req.user.id);

        db.prepare(`
      INSERT INTO workspaces(id, user_id, name, description, icon, color, default_model, default_system_prompt, default_temperature, sort_order)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            id,
            req.user.id,
            name || 'New Workspace',
            description || null,
            icon || 'Folder',
            color || '#f59e0b',
            default_model || null,
            default_system_prompt || null,
            default_temperature !== undefined ? default_temperature : 0.7,
            maxOrder.next_order
        );

        const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
        res.json(workspace);
    } catch (error) {
        console.error('Create workspace error:', error);
        res.status(500).json({ error: 'Failed to create workspace' });
    }
});

// Get single workspace with its chats
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;

        const workspace = db.prepare(`
      SELECT * FROM workspaces WHERE id = ? AND user_id = ?
    `).get(id, req.user.id);

        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        const chats = db.prepare(`
      SELECT c.*, COUNT(m.id) as message_count
      FROM chats c
      LEFT JOIN messages m ON c.id = m.chat_id
      WHERE c.workspace_id = ? AND c.user_id = ?
      GROUP BY c.id
      ORDER BY c.updated_at DESC
    `).all(id, req.user.id);

        res.json({ ...workspace, chats });
    } catch (error) {
        console.error('Get workspace error:', error);
        res.status(500).json({ error: 'Failed to fetch workspace' });
    }
});

// Update workspace
router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, icon, color, default_model, default_system_prompt, default_temperature } = req.body;

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

        if (icon !== undefined) {
            updates.push('icon = ?');
            values.push(icon);
        }

        if (color !== undefined) {
            updates.push('color = ?');
            values.push(color);
        }

        if (default_model !== undefined) {
            updates.push('default_model = ?');
            values.push(default_model);
        }

        if (default_system_prompt !== undefined) {
            updates.push('default_system_prompt = ?');
            values.push(default_system_prompt);
        }

        if (default_temperature !== undefined) {
            updates.push('default_temperature = ?');
            values.push(default_temperature);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id, req.user.id);

        db.prepare(`
      UPDATE workspaces SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
    `).run(...values);

        const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
        res.json(workspace);
    } catch (error) {
        console.error('Update workspace error:', error);
        res.status(500).json({ error: 'Failed to update workspace' });
    }
});

// Delete workspace (chats become uncategorized)
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;

        // The foreign key ON DELETE SET NULL will handle setting workspace_id to NULL for chats
        db.prepare('DELETE FROM workspaces WHERE id = ? AND user_id = ?').run(id, req.user.id);

        res.json({ message: 'Workspace deleted successfully' });
    } catch (error) {
        console.error('Delete workspace error:', error);
        res.status(500).json({ error: 'Failed to delete workspace' });
    }
});

// Move chats into workspace
router.put('/:id/chats', (req, res) => {
    try {
        const { id } = req.params;
        const { chat_ids } = req.body;

        if (!Array.isArray(chat_ids)) {
            return res.status(400).json({ error: 'chat_ids must be an array' });
        }

        // Verify workspace belongs to user (or id is null for uncategorizing)
        if (id !== 'null') {
            const workspace = db.prepare(`
        SELECT id FROM workspaces WHERE id = ? AND user_id = ?
      `).get(id, req.user.id);

            if (!workspace) {
                return res.status(404).json({ error: 'Workspace not found' });
            }
        }

        const workspaceId = id === 'null' ? null : id;
        const updateStmt = db.prepare(`
      UPDATE chats SET workspace_id = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND user_id = ?
    `);

        for (const chatId of chat_ids) {
            updateStmt.run(workspaceId, chatId, req.user.id);
        }

        res.json({ message: 'Chats moved successfully' });
    } catch (error) {
        console.error('Move chats error:', error);
        res.status(500).json({ error: 'Failed to move chats' });
    }
});

// Reorder workspaces
router.put('/order', (req, res) => {
    try {
        const { workspace_ids } = req.body;

        if (!Array.isArray(workspace_ids)) {
            return res.status(400).json({ error: 'workspace_ids must be an array' });
        }

        const updateStmt = db.prepare(`
      UPDATE workspaces SET sort_order = ? WHERE id = ? AND user_id = ?
    `);

        for (let i = 0; i < workspace_ids.length; i++) {
            updateStmt.run(i, workspace_ids[i], req.user.id);
        }

        res.json({ message: 'Workspaces reordered successfully' });
    } catch (error) {
        console.error('Reorder workspaces error:', error);
        res.status(500).json({ error: 'Failed to reorder workspaces' });
    }
});

export default router;
