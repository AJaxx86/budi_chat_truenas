import express from 'express';
import { ensureModelsCache, getModelsCacheInfo } from '../services/models.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const models = await ensureModelsCache();
    res.json({ data: models });
  } catch (error) {
    const cacheInfo = getModelsCacheInfo();
    console.error('Failed to fetch models from OpenRouter:', error);
    res.status(500).json({
      error: 'Failed to fetch models',
      lastFetchedAt: cacheInfo.lastFetchedAt,
    });
  }
});

export default router;
