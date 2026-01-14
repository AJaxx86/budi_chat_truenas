import express from 'express';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

// Get user statistics
router.get('/', (req, res) => {
    try {
        const userId = req.user.id;

        // Get all user messages (assistant role) to calculate totals
        // We join with chats to ensure we only get messages for this user's chats
        const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_messages,
        SUM(prompt_tokens) as total_prompt_tokens,
        SUM(completion_tokens) as total_completion_tokens,
        SUM(cost) as total_cost,
        AVG(response_time_ms) as avg_response_time,
        SUM(LENGTH(reasoning_content)) as total_reasoning_chars
      FROM messages m
      JOIN chats c ON m.chat_id = c.id
      WHERE c.user_id = ? AND m.role = 'assistant'
    `).get(userId);

        // Get chattiest day
        const chattiestDay = db.prepare(`
      SELECT DATE(m.created_at) as date, COUNT(*) as count
      FROM messages m
      JOIN chats c ON m.chat_id = c.id
      WHERE c.user_id = ? AND m.role = 'user'
      GROUP BY DATE(m.created_at)
      ORDER BY count DESC
      LIMIT 1
    `).get(userId);

        // Get most used models with token counts
        const topModels = db.prepare(`
      SELECT
        model,
        COUNT(*) as usage_count,
        COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
        COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
        COALESCE(SUM(prompt_tokens + completion_tokens), 0) as total_tokens,
        COALESCE(SUM(cost), 0) as total_cost
      FROM messages m
      JOIN chats c ON m.chat_id = c.id
      WHERE c.user_id = ? AND m.role = 'assistant' AND model IS NOT NULL
      GROUP BY model
      ORDER BY total_tokens DESC
      LIMIT 3
    `).all(userId);

        // Get usage trend (last 7 days token usage)
        const usageTrend = db.prepare(`
      SELECT DATE(m.created_at) as date, SUM(prompt_tokens + completion_tokens) as total_tokens
      FROM messages m
      JOIN chats c ON m.chat_id = c.id
      WHERE c.user_id = ? AND m.role = 'assistant'
      AND m.created_at >= date('now', '-7 days')
      GROUP BY DATE(m.created_at)
      ORDER BY date ASC
    `).all(userId);

        // Get recent activity (last 14 days) for weekly progress calendar
        // Frontend filters to current week Mon-Fri
        const weekActivity = db.prepare(`
      SELECT
        DATE(m.created_at) as date,
        COUNT(*) as message_count
      FROM messages m
      JOIN chats c ON m.chat_id = c.id
      WHERE c.user_id = ?
        AND m.role = 'user'
        AND DATE(m.created_at) >= DATE('now', '-14 days')
      GROUP BY DATE(m.created_at)
      ORDER BY date ASC
    `).all(userId);

        res.json({
            totals: {
                messages: stats.total_messages || 0,
                prompt_tokens: stats.total_prompt_tokens || 0,
                completion_tokens: stats.total_completion_tokens || 0,
                total_tokens: (stats.total_prompt_tokens || 0) + (stats.total_completion_tokens || 0),
                cost: stats.total_cost || 0,
                avg_response_time_ms: Math.round(stats.avg_response_time || 0),
                total_reasoning_chars: stats.total_reasoning_chars || 0
            },
            fun_stats: {
                chattiest_day: chattiestDay || null,
            },
            top_models: topModels || [],
            usage_trend: usageTrend || [],
            week_activity: weekActivity || []
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

export default router;
