import express from 'express';
import bcrypt from 'bcryptjs';
import db, { hasMasterUser } from '../database.js';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper function to get permissions for a user group
function getGroupPermissions(groupId) {
  const group = db.prepare('SELECT permissions FROM user_groups WHERE id = ?').get(groupId || 'user');
  if (group && group.permissions) {
    return JSON.parse(group.permissions);
  }
  // Default permissions if group not found
  return {
    can_access_chat: true,
    can_create_chats: true,
    can_delete_chats: true,
    can_use_default_key: false,
    can_access_memories: false,
    can_access_image_gen: false,
    can_access_settings: false,
    can_access_admin: false,
    can_view_other_stats: false,
    can_edit_permissions: false,
    can_manage_users: false
  };
}

// Helper to get group info
function getGroupInfo(groupId) {
  const group = db.prepare('SELECT id, name, color FROM user_groups WHERE id = ?').get(groupId || 'user');
  return group || { id: 'user', name: 'User', color: '#3b82f6' };
}

// Check if master user exists
router.get('/status', (req, res) => {
  try {
    const hasMaster = hasMasterUser();
    res.json({ hasMaster });
  } catch (error) {
    console.error('Setup status error:', error);
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

// Check if registration is enabled (public endpoint)
router.get('/registration-status', (req, res) => {
  try {
    const registrationSetting = db.prepare("SELECT value FROM settings WHERE key = 'registration_enabled'").get();
    const isEnabled = registrationSetting ? registrationSetting.value === 'true' : false;
    res.json({ enabled: isEnabled });
  } catch (error) {
    console.error('Registration status error:', error);
    res.status(500).json({ error: 'Failed to check registration status' });
  }
});

// Create master user (only works when no master exists)
router.post('/create-master', (req, res) => {
  try {
    // Check if master already exists
    if (hasMasterUser()) {
      return res.status(403).json({ error: 'Master user already exists' });
    }

    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Create master user with full admin privileges
    const result = db.prepare(`
      INSERT INTO users (email, password, name, is_admin, user_type, user_group, accent_color)
      VALUES (?, ?, ?, 1, 'master', 'admin', 'amber')
    `).run(email, hashedPassword, name);

    const token = generateToken(result.lastInsertRowid);
    const groupInfo = getGroupInfo('admin');
    const permissions = getGroupPermissions('admin');

    res.json({
      token,
      user: {
        id: result.lastInsertRowid,
        email,
        name,
        is_admin: true,
        user_type: 'master',
        user_group: 'admin',
        accent_color: 'amber',
        group_info: groupInfo,
        permissions
      }
    });
  } catch (error) {
    console.error('Create master error:', error);
    res.status(500).json({ error: 'Failed to create master account' });
  }
});

export default router;
