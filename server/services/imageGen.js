import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from '../database.js';
import { getApiKeyInfo } from './ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure generated images directory
const generatedDir = process.env.GENERATED_PATH || join(__dirname, '../../data/generated');
if (!existsSync(generatedDir)) {
  mkdirSync(generatedDir, { recursive: true });
}

// Default image generation model
const DEFAULT_IMAGE_MODEL = 'stabilityai/stable-diffusion-3.5-large';

/**
 * Get the image generation model for a user
 */
export function getImageModel(userId) {
  // Check user preference
  const user = db.prepare('SELECT default_image_model FROM users WHERE id = ?').get(userId);
  if (user?.default_image_model) {
    return user.default_image_model;
  }

  // Check system default
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'default_image_model'").get();
  if (setting?.value) {
    return setting.value;
  }

  return DEFAULT_IMAGE_MODEL;
}

/**
 * Generate an image using OpenRouter
 */
export async function generateImage(userId, prompt, options = {}) {
  const {
    chatId = null,
    size = '1024x1024',
    quality = 'standard',
    model = null
  } = options;

  // Get API key
  const apiKeyInfo = await getApiKeyInfo(userId);
  if (!apiKeyInfo) {
    throw new Error('No API key configured');
  }

  const imageModel = model || getImageModel(userId);

  const openai = new OpenAI({
    apiKey: apiKeyInfo.key,
    baseURL: 'https://openrouter.ai/api/v1'
  });

  console.log(`Generating image with model: ${imageModel}`);
  console.log(`Prompt: ${prompt}`);

  try {
    // Use chat completion with the image model
    // OpenRouter routes image generation through chat completions
    const response = await openai.chat.completions.create({
      model: imageModel,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      // Some image models support these parameters
      ...(size && { size }),
      ...(quality && { quality })
    });

    // Check if response contains image data
    const message = response.choices[0]?.message;

    if (!message) {
      throw new Error('No response from image generation model');
    }

    // For models that return image URLs or base64 in content
    let imageUrl = null;
    let imageData = null;

    // Check for image in various response formats
    if (message.content) {
      // Try to extract image URL from markdown or plain text
      const urlMatch = message.content.match(/https?:\/\/[^\s\)]+\.(png|jpg|jpeg|webp|gif)/i);
      if (urlMatch) {
        imageUrl = urlMatch[0];
      }

      // Check for base64 image data
      const base64Match = message.content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
      if (base64Match) {
        imageData = base64Match[1];
      }
    }

    // If we got an image URL, download it
    if (imageUrl) {
      const fetchResponse = await fetch(imageUrl);
      if (fetchResponse.ok) {
        const buffer = await fetchResponse.arrayBuffer();
        imageData = Buffer.from(buffer).toString('base64');
      }
    }

    // If we still don't have image data, the model might have just returned text
    // In this case, we'll save the response as a "failed" generation
    if (!imageData) {
      console.log('No image data in response, model returned text:', message.content?.substring(0, 200));

      // Return the text response so the user knows what happened
      return {
        success: false,
        message: message.content || 'Image generation model did not return an image',
        model: imageModel
      };
    }

    // Save the image
    const imageId = uuidv4();
    const filename = `${imageId}.png`;
    const storagePath = join(generatedDir, filename);

    const imageBuffer = Buffer.from(imageData, 'base64');
    writeFileSync(storagePath, imageBuffer);

    // Save to database
    db.prepare(`
      INSERT INTO generated_images (id, user_id, chat_id, prompt, revised_prompt, model, size, quality, storage_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      imageId,
      userId,
      chatId,
      prompt,
      null, // revised_prompt - not all models provide this
      imageModel,
      size,
      quality,
      storagePath
    );

    return {
      success: true,
      id: imageId,
      url: `/api/images/${imageId}`,
      prompt,
      model: imageModel,
      size
    };
  } catch (error) {
    console.error('Image generation error:', error);
    throw error;
  }
}

/**
 * Get a generated image by ID
 */
export function getGeneratedImage(imageId, userId) {
  return db.prepare(`
    SELECT * FROM generated_images WHERE id = ? AND user_id = ?
  `).get(imageId, userId);
}

/**
 * List generated images for a user
 */
export function listGeneratedImages(userId, limit = 20, offset = 0) {
  return db.prepare(`
    SELECT * FROM generated_images
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, limit, offset);
}

/**
 * Delete a generated image
 */
export function deleteGeneratedImage(imageId, userId) {
  const image = getGeneratedImage(imageId, userId);
  if (!image) return false;

  // Delete file
  if (existsSync(image.storage_path)) {
    const { unlinkSync } = require('fs');
    unlinkSync(image.storage_path);
  }

  // Delete from database
  db.prepare('DELETE FROM generated_images WHERE id = ?').run(imageId);
  return true;
}
