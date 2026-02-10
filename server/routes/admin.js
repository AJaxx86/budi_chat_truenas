import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../database.js';
import { authMiddleware, adminMiddleware, masterMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All routes require auth
router.use(authMiddleware);

// Factory reset - requires master user (must be before adminMiddleware)
router.post('/factory-reset', masterMiddleware, (req, res) => {
  try {
    // Delete all data except user_groups table
    // Order matters for foreign key constraints
    db.prepare('DELETE FROM message_steps').run();
    db.prepare('DELETE FROM generated_images').run();
    db.prepare('DELETE FROM file_uploads').run();
    db.prepare('DELETE FROM shared_chats').run();
    db.prepare('DELETE FROM messages').run();
    db.prepare('DELETE FROM chats').run();
    db.prepare('DELETE FROM workspaces').run();
    db.prepare('DELETE FROM memories').run();
    db.prepare('DELETE FROM user_model_stats').run();
    db.prepare('DELETE FROM user_stats').run();
    db.prepare('DELETE FROM personas').run();
    db.prepare('DELETE FROM tools').run();
    db.prepare('DELETE FROM settings').run();
    db.prepare('DELETE FROM users').run();

    res.json({ message: 'Factory reset completed successfully' });
  } catch (error) {
    console.error('Factory reset error:', error);
    res.status(500).json({ error: 'Failed to perform factory reset' });
  }
});

// All other admin routes require admin
router.use(adminMiddleware);

// Get all users with usage stats
router.get('/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, email, name, is_admin, user_type, use_default_key, user_group, created_at,
             CASE WHEN openai_api_key IS NOT NULL THEN 1 ELSE 0 END as has_api_key
      FROM users
      ORDER BY created_at DESC
    `).all();

    // Get usage stats for each user from persistent user_stats table
    const usersWithStats = users.map(user => {
      const stats = db.prepare(`
        SELECT
          COALESCE(total_prompt_tokens, 0) + COALESCE(total_completion_tokens, 0) as lifetime_tokens,
          COALESCE(total_cost, 0) as lifetime_cost,
          COALESCE(default_key_tokens, 0) as default_key_tokens,
          COALESCE(default_key_cost, 0) as default_key_cost,
          COALESCE(personal_key_tokens, 0) as personal_key_tokens,
          COALESCE(personal_key_cost, 0) as personal_key_cost
        FROM user_stats
        WHERE user_id = ?
      `).get(user.id);

      return {
        ...user,
        lifetime_tokens: stats?.lifetime_tokens || 0,
        lifetime_cost: stats?.lifetime_cost || 0,
        default_key_tokens: stats?.default_key_tokens || 0,
        default_key_cost: stats?.default_key_cost || 0,
        personal_key_tokens: stats?.personal_key_tokens || 0,
        personal_key_cost: stats?.personal_key_cost || 0
      };
    });

    res.json(usersWithStats);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create user
router.post('/users', (req, res) => {
  try {
    const { email, password, name, is_admin, use_default_key, user_group } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Determine user_group: explicit user_group takes precedence over is_admin
    const finalGroup = user_group || (is_admin ? 'admin' : 'user');
    const finalIsAdmin = finalGroup === 'admin' ? 1 : 0;

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (email, password, name, is_admin, use_default_key, user_group)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(email, hashedPassword, name, finalIsAdmin, use_default_key ? 1 : 0, finalGroup);

    res.json({
      id: result.lastInsertRowid,
      email,
      name,
      is_admin: !!finalIsAdmin,
      use_default_key: !!use_default_key,
      user_group: finalGroup
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, is_admin, use_default_key, user_group } = req.body;

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }

    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }

    if (password) {
      updates.push('password = ?');
      values.push(bcrypt.hashSync(password, 10));
    }

    // user_group takes precedence over is_admin
    if (user_group !== undefined) {
      updates.push('user_group = ?');
      values.push(user_group);
      // Also update is_admin for backwards compatibility
      updates.push('is_admin = ?');
      values.push(user_group === 'admin' ? 1 : 0);
    } else if (is_admin !== undefined) {
      updates.push('is_admin = ?');
      values.push(is_admin ? 1 : 0);
      updates.push('user_group = ?');
      values.push(is_admin ? 'admin' : 'user');
    }

    if (use_default_key !== undefined) {
      updates.push('use_default_key = ?');
      values.push(use_default_key ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`
      UPDATE users SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Reset user stats
router.delete('/users/:id/stats', (req, res) => {
  try {
    const { id } = req.params;

    // Delete from user_stats table
    db.prepare('DELETE FROM user_stats WHERE user_id = ?').run(id);

    // Delete from user_model_stats table
    db.prepare('DELETE FROM user_model_stats WHERE user_id = ?').run(id);

    res.json({ message: 'User stats reset successfully' });
  } catch (error) {
    console.error('Reset user stats error:', error);
    res.status(500).json({ error: 'Failed to reset user stats' });
  }
});

// Get system settings
router.get('/settings', (req, res) => {
  try {
    const settings = db.prepare('SELECT key, value FROM settings').all();
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    res.json(settingsObj);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update system settings
router.put('/settings', (req, res) => {
  try {
    const { default_openai_api_key, title_generation_model, global_system_prompt, brave_search_api_key, guest_model_whitelist, registration_enabled } = req.body;

    const upsert = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
    `);

    if (default_openai_api_key !== undefined) {
      upsert.run('default_openai_api_key', default_openai_api_key, default_openai_api_key);
    }

    if (title_generation_model !== undefined) {
      upsert.run('title_generation_model', title_generation_model, title_generation_model);
    }

    if (global_system_prompt !== undefined) {
      upsert.run('global_system_prompt', global_system_prompt, global_system_prompt);
    }

    if (brave_search_api_key !== undefined) {
      upsert.run('brave_search_api_key', brave_search_api_key, brave_search_api_key);
    }

    if (guest_model_whitelist !== undefined) {
      // Store as JSON string array
      const whitelistJson = JSON.stringify(guest_model_whitelist);
      upsert.run('guest_model_whitelist', whitelistJson, whitelistJson);
    }

    if (registration_enabled !== undefined) {
      // Store as string 'true' or 'false'
      const value = registration_enabled ? 'true' : 'false';
      upsert.run('registration_enabled', value, value);
    }

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get all user groups
router.get('/groups', (req, res) => {
  try {
    const groups = db.prepare('SELECT * FROM user_groups ORDER BY id').all();
    const groupsWithParsedPermissions = groups.map(group => ({
      ...group,
      permissions: JSON.parse(group.permissions || '{}')
    }));
    res.json(groupsWithParsedPermissions);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Update user group permissions
router.put('/groups/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, permissions } = req.body;

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }

    if (color !== undefined) {
      updates.push('color = ?');
      values.push(color);
    }

    if (permissions !== undefined) {
      updates.push('permissions = ?');
      values.push(JSON.stringify(permissions));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`
      UPDATE user_groups SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);

    res.json({ message: 'Group updated successfully' });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

export default router;
