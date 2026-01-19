import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Generate a secure share token
function generateShareToken() {
    return crypto.randomBytes(16).toString('base64url');
}

// Create a share link for a chat
// POST /api/share/:chatId
router.post('/:chatId', authMiddleware, (req, res) => {
    try {
        const { chatId } = req.params;
        const { expires_in_days } = req.body; // Optional: null = never expires

        // Verify chat ownership
        const chat = db.prepare(`
      SELECT * FROM chats WHERE id = ? AND user_id = ?
    `).get(chatId, req.user.id);

        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        // Check if share link already exists
        const existingShare = db.prepare(`
      SELECT * FROM shared_chats WHERE chat_id = ? AND user_id = ?
    `).get(chatId, req.user.id);

        if (existingShare) {
            // Return existing share link
            const shareUrl = `/share/${existingShare.share_token}`;
            return res.json({
                id: existingShare.id,
                share_token: existingShare.share_token,
                share_url: shareUrl,
                created_at: existingShare.created_at,
                expires_at: existingShare.expires_at,
                view_count: existingShare.view_count,
                already_exists: true
            });
        }

        // Create new share link
        const shareId = uuidv4();
        const shareToken = generateShareToken();
        let expiresAt = null;

        if (expires_in_days && expires_in_days > 0) {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + expires_in_days);
            expiresAt = expiryDate.toISOString();
        }

        db.prepare(`
      INSERT INTO shared_chats (id, chat_id, user_id, share_token, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(shareId, chatId, req.user.id, shareToken, expiresAt);

        const shareUrl = `/share/${shareToken}`;

        res.status(201).json({
            id: shareId,
            share_token: shareToken,
            share_url: shareUrl,
            created_at: new Date().toISOString(),
            expires_at: expiresAt,
            view_count: 0
        });
    } catch (error) {
        console.error('Create share error:', error);
        res.status(500).json({ error: 'Failed to create share link' });
    }
});

// Get shared chat data (public - no auth required)
// GET /api/share/:token
router.get('/:token', (req, res) => {
    try {
        const { token } = req.params;

        // Find the share record
        const share = db.prepare(`
      SELECT sc.*, c.title, c.model, c.system_prompt, c.temperature, c.created_at as chat_created_at,
             u.name as owner_name
      FROM shared_chats sc
      JOIN chats c ON sc.chat_id = c.id
      JOIN users u ON sc.user_id = u.id
      WHERE sc.share_token = ?
    `).get(token);

        if (!share) {
            return res.status(404).json({ error: 'Shared chat not found' });
        }

        // Check if expired
        if (share.expires_at && new Date(share.expires_at) < new Date()) {
            return res.status(410).json({ error: 'This share link has expired' });
        }

        // Increment view count
        db.prepare(`
      UPDATE shared_chats SET view_count = view_count + 1 WHERE id = ?
    `).run(share.id);

        // Get messages
        const messages = db.prepare(`
      SELECT id, role, content, reasoning_content, created_at, model
      FROM messages
      WHERE chat_id = ?
      ORDER BY created_at ASC
    `).all(share.chat_id);

        res.json({
            chat: {
                id: share.chat_id,
                title: share.title,
                model: share.model,
                system_prompt: share.system_prompt,
                temperature: share.temperature,
                created_at: share.chat_created_at,
                owner_name: share.owner_name
            },
            messages: messages,
            share_info: {
                created_at: share.created_at,
                expires_at: share.expires_at,
                view_count: share.view_count + 1
            }
        });
    } catch (error) {
        console.error('Get shared chat error:', error);
        res.status(500).json({ error: 'Failed to get shared chat' });
    }
});

// Get share info for a chat (authenticated - for managing shares)
// GET /api/share/info/:chatId
router.get('/info/:chatId', authMiddleware, (req, res) => {
    try {
        const { chatId } = req.params;

        const share = db.prepare(`
      SELECT * FROM shared_chats WHERE chat_id = ? AND user_id = ?
    `).get(chatId, req.user.id);

        if (!share) {
            return res.json({ shared: false });
        }

        const shareUrl = `/share/${share.share_token}`;

        res.json({
            shared: true,
            id: share.id,
            share_token: share.share_token,
            share_url: shareUrl,
            created_at: share.created_at,
            expires_at: share.expires_at,
            view_count: share.view_count
        });
    } catch (error) {
        console.error('Get share info error:', error);
        res.status(500).json({ error: 'Failed to get share info' });
    }
});

// Delete/revoke share link
// DELETE /api/share/:chatId
router.delete('/:chatId', authMiddleware, (req, res) => {
    try {
        const { chatId } = req.params;

        // Verify ownership and delete
        const result = db.prepare(`
      DELETE FROM shared_chats WHERE chat_id = ? AND user_id = ?
    `).run(chatId, req.user.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Share link not found' });
        }

        res.json({ success: true, message: 'Share link revoked' });
    } catch (error) {
        console.error('Delete share error:', error);
        res.status(500).json({ error: 'Failed to delete share link' });
    }
});

// List all shares for the current user
// GET /api/share
router.get('/', authMiddleware, (req, res) => {
    try {
        const shares = db.prepare(`
      SELECT sc.*, c.title
      FROM shared_chats sc
      JOIN chats c ON sc.chat_id = c.id
      WHERE sc.user_id = ?
      ORDER BY sc.created_at DESC
    `).all(req.user.id);

        res.json({
            shares: shares.map(share => ({
                id: share.id,
                chat_id: share.chat_id,
                chat_title: share.title,
                share_token: share.share_token,
                share_url: `/share/${share.share_token}`,
                created_at: share.created_at,
                expires_at: share.expires_at,
                view_count: share.view_count
            }))
        });
    } catch (error) {
        console.error('List shares error:', error);
        res.status(500).json({ error: 'Failed to list shares' });
    }
});

export default router;
