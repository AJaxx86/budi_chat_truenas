import express from "express";
import db from "../database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();
router.use(authMiddleware);

// Get user statistics
router.get("/", (req, res) => {
  try {
    const userId = req.user.id;

    // Get persistent lifetime stats (survives message/chat deletion)
    const persistentStats = db
      .prepare(
        `
      SELECT
        total_messages,
        total_prompt_tokens,
        total_completion_tokens,
        total_cost,
        total_reasoning_chars
      FROM user_stats
      WHERE user_id = ?
    `,
      )
      .get(userId);

    // Get average response time from current messages (this is okay to lose on deletion)
    const avgResponseTime = db
      .prepare(
        `
      SELECT AVG(response_time_ms) as avg_response_time
      FROM messages m
      JOIN chats c ON m.chat_id = c.id
      WHERE c.user_id = ? AND m.role = 'assistant'
    `,
      )
      .get(userId);

    // Get chattiest day
    const chattiestDay = db
      .prepare(
        `
      SELECT DATE(m.created_at) as date, COUNT(*) as count
      FROM messages m
      JOIN chats c ON m.chat_id = c.id
      WHERE c.user_id = ? AND m.role = 'user'
      GROUP BY DATE(m.created_at)
      ORDER BY count DESC
      LIMIT 1
    `,
      )
      .get(userId);

    // Get most used models with token counts (from persistent table)
    const topModels = db
      .prepare(
        `
      SELECT
        model,
        usage_count,
        total_prompt_tokens,
        total_completion_tokens,
        (total_prompt_tokens + total_completion_tokens) as total_tokens,
        total_cost
      FROM user_model_stats
      WHERE user_id = ?
      ORDER BY total_tokens DESC
      LIMIT 3
    `,
      )
      .all(userId);

    // Get usage trend (last 7 days token usage)
    const usageTrend = db
      .prepare(
        `
      SELECT DATE(m.created_at) as date, SUM(prompt_tokens + completion_tokens) as total_tokens
      FROM messages m
      JOIN chats c ON m.chat_id = c.id
      WHERE c.user_id = ? AND m.role = 'assistant'
      AND m.created_at >= date('now', '-7 days')
      GROUP BY DATE(m.created_at)
      ORDER BY date ASC
    `,
      )
      .all(userId);

    // Get recent activity (last 14 days) for weekly progress calendar
    // Frontend filters to current week Mon-Fri
    const weekActivity = db
      .prepare(
        `
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
    `,
      )
      .all(userId);

    res.json({
      totals: {
        messages: persistentStats?.total_messages || 0,
        prompt_tokens: persistentStats?.total_prompt_tokens || 0,
        completion_tokens: persistentStats?.total_completion_tokens || 0,
        total_tokens:
          (persistentStats?.total_prompt_tokens || 0) +
          (persistentStats?.total_completion_tokens || 0),
        cost: persistentStats?.total_cost || 0,
        avg_response_time_ms: Math.round(
          avgResponseTime?.avg_response_time || 0,
        ),
        total_reasoning_chars: persistentStats?.total_reasoning_chars || 0,
      },
      fun_stats: {
        chattiest_day: chattiestDay || null,
      },
      top_models: topModels || [],
      usage_trend: usageTrend || [],
      week_activity: weekActivity || [],
    });
  } catch (error) {
    console.error("Stats error:", error.message);
    console.error("Stats error stack:", error.stack);
    res
      .status(500)
      .json({ error: "Failed to fetch statistics", details: error.message });
  }
});

export default router;
