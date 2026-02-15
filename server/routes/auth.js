import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../database.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';

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

// Register
router.post('/register', (req, res) => {
  try {
    // Check if registration is enabled
    const registrationSetting = db.prepare("SELECT value FROM settings WHERE key = 'registration_enabled'").get();
    if (registrationSetting && registrationSetting.value === 'false') {
      return res.status(403).json({ error: 'New registrations are currently disabled' });
    }
    // If setting doesn't exist, treat as disabled by default
    if (!registrationSetting) {
      return res.status(403).json({ error: 'New registrations are currently disabled' });
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

    // Create user with default 'user' group and accent color
    const result = db.prepare(`
      INSERT INTO users (email, password, name, is_admin, user_type, user_group, accent_color)
      VALUES (?, ?, ?, 0, 'user', 'user', 'amber')
    `).run(email, hashedPassword, name);

    const token = generateToken(result.lastInsertRowid);
    const groupInfo = getGroupInfo('user');
    const permissions = getGroupPermissions('user');

    res.json({
      token,
      user: {
        id: result.lastInsertRowid,
        email,
        name,
        is_admin: false,
        user_type: 'user',
        user_group: 'user',
        accent_color: 'amber',
        group_info: groupInfo,
        permissions
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);
    const userGroup = user.user_group || (user.is_admin ? 'admin' : 'user');
    const groupInfo = getGroupInfo(userGroup);
    const permissions = getGroupPermissions(userGroup);

    // Set token as HTTP-only cookie for image/file access
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        is_admin: !!user.is_admin,
        user_type: user.user_type || 'user',
        user_group: userGroup,
        accent_color: user.accent_color || 'amber',
        group_info: groupInfo,
        permissions
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare(`
    SELECT id, email, name, is_admin, user_type, use_default_key, user_group, accent_color, show_recent_personas,
           CASE WHEN openai_api_key IS NOT NULL THEN 1 ELSE 0 END as has_api_key
    FROM users WHERE id = ?
  `).get(req.user.id);

  const userGroup = user.user_group || (user.is_admin ? 'admin' : 'user');
  const groupInfo = getGroupInfo(userGroup);
  const permissions = getGroupPermissions(userGroup);

  // Determine if user is using the default API key (no personal key)
  const hasPersonalKey = !!user.has_api_key;
  const usingDefaultKey = !hasPersonalKey;

  // Get model whitelist only if user is using default key AND doesn't have can_use_default_key permission
  let guestModelWhitelist = [];
  if (usingDefaultKey && !permissions.can_use_default_key) {
    const whitelistSetting = db.prepare("SELECT value FROM settings WHERE key = 'guest_model_whitelist'").get();
    if (whitelistSetting?.value) {
      try {
        guestModelWhitelist = JSON.parse(whitelistSetting.value);
      } catch (e) {
        console.error('Failed to parse guest_model_whitelist:', e);
      }
    }
  }

  res.json({
    ...user,
    user_group: userGroup,
    group_info: groupInfo,
    permissions,
    usingDefaultKey,
    guestModelWhitelist
  });
});

// Update user profile
router.put('/profile', authMiddleware, (req, res) => {
  try {
    const { name, password, openai_api_key, accent_color, show_recent_personas } = req.body;
    const updates = [];
    const values = [];

    if (name) {
      updates.push('name = ?');
      values.push(name);
    }

    if (password) {
      updates.push('password = ?');
      values.push(bcrypt.hashSync(password, 10));
    }

    if (openai_api_key !== undefined) {
      updates.push('openai_api_key = ?');
      values.push(openai_api_key || null);
    }

    if (accent_color !== undefined) {
      updates.push('accent_color = ?');
      values.push(accent_color);
    }

    if (show_recent_personas !== undefined) {
      updates.push('show_recent_personas = ?');
      values.push(show_recent_personas ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.user.id);

    db.prepare(`
      UPDATE users SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Delete user account
router.delete('/profile', authMiddleware, (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password confirmation required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.is_admin) {
      return res.status(403).json({ error: 'Admin accounts cannot be deleted' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Delete user's data
    db.prepare('DELETE FROM memories WHERE user_id = ?').run(req.user.id);
    db.prepare('DELETE FROM chats WHERE user_id = ?').run(req.user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
