import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

// Multer configuration for memory images
const UPLOAD_PATH = process.env.UPLOAD_PATH || path.join(__dirname, '../../data/uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_PATH)) {
  fs.mkdirSync(UPLOAD_PATH, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_PATH);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

router.use(authMiddleware);

// Get all memories for user with their images
router.get('/', (req, res) => {
  try {
    const memories = db.prepare(`
      SELECT * FROM memories 
      WHERE user_id = ? 
      ORDER BY importance DESC, updated_at DESC
    `).all(req.user.id);

    // Fetch images for each memory
    const memoriesWithImages = memories.map(memory => {
      const images = db.prepare(`
        SELECT f.id, f.original_name, f.mimetype, f.size
        FROM memory_images mi
        JOIN file_uploads f ON mi.file_id = f.id
        WHERE mi.memory_id = ?
        ORDER BY mi.created_at ASC
      `).all(memory.id);
      
      return {
        ...memory,
        images
      };
    });

    res.json(memoriesWithImages);
  } catch (error) {
    console.error('Get memories error:', error);
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

// Create memory with optional images
router.post('/', upload.array('images', 10), (req, res) => {
  try {
    const { content, category, importance } = req.body;
    const imageFiles = req.files || [];

    if (!content) {
      // Clean up uploaded files if validation fails
      imageFiles.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          console.error('Failed to clean up file:', e);
        }
      });
      return res.status(400).json({ error: 'Content is required' });
    }

    // Insert memory
    const result = db.prepare(`
      INSERT INTO memories (user_id, content, category, importance)
      VALUES (?, ?, ?, ?)
    `).run(
      req.user.id,
      content,
      category || 'general',
      importance || 1
    );

    const memoryId = result.lastInsertRowid;

    // Insert file uploads and memory_images records
    imageFiles.forEach(file => {
      const fileId = uuidv4();
      
      // Insert into file_uploads
      db.prepare(`
        INSERT INTO file_uploads (
          id, user_id, filename, original_name, mimetype, size, storage_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        fileId,
        req.user.id,
        file.filename,
        file.originalname,
        file.mimetype,
        file.size,
        file.path
      );

      // Insert into memory_images junction table
      db.prepare(`
        INSERT INTO memory_images (memory_id, file_id) VALUES (?, ?)
      `).run(memoryId, fileId);
    });

    // Fetch the created memory with images
    const memory = db.prepare('SELECT * FROM memories WHERE id = ?').get(memoryId);
    const images = db.prepare(`
      SELECT f.id, f.original_name, f.mimetype, f.size
      FROM memory_images mi
      JOIN file_uploads f ON mi.file_id = f.id
      WHERE mi.memory_id = ?
      ORDER BY mi.created_at ASC
    `).all(memoryId);

    res.json({ ...memory, images });
  } catch (error) {
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          console.error('Failed to clean up file:', e);
        }
      });
    }
    console.error('Create memory error:', error);
    res.status(500).json({ error: 'Failed to create memory' });
  }
});

// Update memory - can add new images or remove existing ones
router.put('/:id', upload.array('images', 10), (req, res) => {
  try {
    const { id } = req.params;
    const { content, category, importance, remove_image_ids } = req.body;
    const imageFiles = req.files || [];
    const removeIds = remove_image_ids ? JSON.parse(remove_image_ids) : [];

    const updates = [];
    const values = [];

    if (content !== undefined) {
      updates.push('content = ?');
      values.push(content);
    }

    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }

    if (importance !== undefined) {
      updates.push('importance = ?');
      values.push(importance);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id, req.user.id);

      db.prepare(`
        UPDATE memories SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
      `).run(...values);
    }

    // Handle removed images
    if (removeIds.length > 0) {
      for (const fileId of removeIds) {
        // Get file info before deleting
        const fileInfo = db.prepare(`
          SELECT f.storage_path FROM file_uploads f
          JOIN memory_images mi ON f.id = mi.file_id
          WHERE f.id = ? AND mi.memory_id = ? AND f.user_id = ?
        `).get(fileId, id, req.user.id);

        if (fileInfo) {
          // Delete from memory_images
          db.prepare('DELETE FROM memory_images WHERE memory_id = ? AND file_id = ?').run(id, fileId);
          
          // Delete from file_uploads
          db.prepare('DELETE FROM file_uploads WHERE id = ? AND user_id = ?').run(fileId, req.user.id);
          
          // Delete physical file
          try {
            if (fs.existsSync(fileInfo.storage_path)) {
              fs.unlinkSync(fileInfo.storage_path);
            }
          } catch (e) {
            console.error('Failed to delete file:', e);
          }
        }
      }
    }

    // Handle new images
    imageFiles.forEach(file => {
      const fileId = uuidv4();
      
      // Insert into file_uploads
      db.prepare(`
        INSERT INTO file_uploads (
          id, user_id, filename, original_name, mimetype, size, storage_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        fileId,
        req.user.id,
        file.filename,
        file.originalname,
        file.mimetype,
        file.size,
        file.path
      );

      // Insert into memory_images junction table
      db.prepare(`
        INSERT INTO memory_images (memory_id, file_id) VALUES (?, ?)
      `).run(id, fileId);
    });

    res.json({ message: 'Memory updated successfully' });
  } catch (error) {
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          console.error('Failed to clean up file:', e);
        }
      });
    }
    console.error('Update memory error:', error);
    res.status(500).json({ error: 'Failed to update memory' });
  }
});

// Delete memory and associated images
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Get all associated files before deleting
    const files = db.prepare(`
      SELECT f.id, f.storage_path FROM file_uploads f
      JOIN memory_images mi ON f.id = mi.file_id
      WHERE mi.memory_id = ? AND f.user_id = ?
    `).all(id, req.user.id);

    // Delete physical files
    for (const file of files) {
      try {
        if (fs.existsSync(file.storage_path)) {
          fs.unlinkSync(file.storage_path);
        }
      } catch (e) {
        console.error('Failed to delete file:', e);
      }
      
      // Delete from file_uploads (cascade will handle memory_images)
      db.prepare('DELETE FROM file_uploads WHERE id = ? AND user_id = ?').run(file.id, req.user.id);
    }

    // Delete memory (memory_images will be deleted by CASCADE)
    db.prepare('DELETE FROM memories WHERE id = ? AND user_id = ?').run(id, req.user.id);
    
    res.json({ message: 'Memory deleted successfully' });
  } catch (error) {
    console.error('Delete memory error:', error);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

export default router;
