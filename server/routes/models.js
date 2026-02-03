import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        if (!response.ok) {
            throw new Error(`OpenRouter API responded with ${response.status}`);
        }
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Failed to fetch models from OpenRouter:', error);
        res.status(500).json({ error: 'Failed to fetch models' });
    }
});

export default router;
