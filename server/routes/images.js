import express from 'express';
import { existsSync, unlinkSync } from 'fs';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  generateImage,
  getGeneratedImage,
  listGeneratedImages,
  getImageModel
} from '../services/imageGen.js';

const router = express.Router();

// Generate an image
// POST /api/images/generate
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { prompt, chat_id, size, quality, model } = req.body;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await generateImage(req.user.id, prompt.trim(), {
      chatId: chat_id,
      size,
      quality,
      model
    });

    res.json(result);
  } catch (error) {
    console.error('Generate image error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate image' });
  }
});

// Get generated image file
// GET /api/images/:id
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const image = getGeneratedImage(id, req.user.id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    if (!existsSync(image.storage_path)) {
      return res.status(404).json({ error: 'Image file not found' });
    }

    res.setHeader('Content-Type', 'image/png');
    res.sendFile(image.storage_path);
  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({ error: 'Failed to get image' });
  }
});

// Get image metadata
// GET /api/images/:id/info
router.get('/:id/info', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const image = getGeneratedImage(id, req.user.id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json({
      id: image.id,
      prompt: image.prompt,
      revised_prompt: image.revised_prompt,
      model: image.model,
      size: image.size,
      quality: image.quality,
      created_at: image.created_at,
      url: `/api/images/${image.id}`
    });
  } catch (error) {
    console.error('Get image info error:', error);
    res.status(500).json({ error: 'Failed to get image info' });
  }
});

// List generated images
// GET /api/images
router.get('/', authMiddleware, (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const images = listGeneratedImages(
      req.user.id,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      images: images.map(img => ({
        id: img.id,
        prompt: img.prompt,
        model: img.model,
        size: img.size,
        created_at: img.created_at,
        url: `/api/images/${img.id}`
      }))
    });
  } catch (error) {
    console.error('List images error:', error);
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// Get user's image generation settings
// GET /api/images/settings
router.get('/settings/current', authMiddleware, (req, res) => {
  try {
    const currentModel = getImageModel(req.user.id);

    // Get user's personal setting
    const user = db.prepare('SELECT default_image_model FROM users WHERE id = ?').get(req.user.id);

    // Get system default
    const systemDefault = db.prepare("SELECT value FROM settings WHERE key = 'default_image_model'").get();

    res.json({
      current_model: currentModel,
      user_model: user?.default_image_model || null,
      system_default: systemDefault?.value || 'stabilityai/stable-diffusion-3.5-large'
    });
  } catch (error) {
    console.error('Get image settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update user's image generation model
// PUT /api/images/settings
router.put('/settings', authMiddleware, (req, res) => {
  try {
    const { model } = req.body;

    db.prepare('UPDATE users SET default_image_model = ? WHERE id = ?')
      .run(model || null, req.user.id);

    res.json({
      success: true,
      model: model || getImageModel(req.user.id)
    });
  } catch (error) {
    console.error('Update image settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Delete generated image
// DELETE /api/images/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const image = getGeneratedImage(id, req.user.id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete file if exists
    if (existsSync(image.storage_path)) {
      unlinkSync(image.storage_path);
    }

    db.prepare('DELETE FROM generated_images WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

export default router;
