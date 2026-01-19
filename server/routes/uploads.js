import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { existsSync, mkdirSync, unlinkSync, readFileSync } from 'fs';
import db from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { extractText, isExtractable, getFileCategory } from '../services/fileProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure upload directory
const uploadDir = process.env.UPLOAD_PATH || join(__dirname, '../../data/uploads');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  }
});

// File filter - allow images and documents
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Documents
    'application/pdf',
    'text/plain',
    'text/csv',
    'text/markdown',
    'text/x-markdown',
    'application/json'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed. Supported: images, PDF, TXT, CSV, JSON, Markdown.`), false);
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 5 // Max 5 files per request
  }
});

const router = express.Router();

// Upload file(s)
// POST /api/uploads
router.post('/', authMiddleware, upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const { chat_id } = req.body;
    const uploadedFiles = [];

    for (const file of req.files) {
      const fileId = uuidv4();
      const category = getFileCategory(file.mimetype);
      let extractedText = null;
      let extractionStatus = 'not_applicable';

      // Extract text from documents
      if (isExtractable(file.mimetype)) {
        extractionStatus = 'processing';
        try {
          const result = await extractText(file.path, file.mimetype);
          if (result && result.text) {
            extractedText = result.text;
            extractionStatus = 'completed';
          } else {
            extractionStatus = 'empty';
          }
        } catch (err) {
          console.error('Text extraction failed:', err);
          extractionStatus = 'failed';
        }
      }

      db.prepare(`
        INSERT INTO file_uploads (id, user_id, chat_id, filename, original_name, mimetype, size, storage_path, extracted_text, extraction_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        fileId,
        req.user.id,
        chat_id || null,
        file.filename,
        file.originalname,
        file.mimetype,
        file.size,
        file.path,
        extractedText,
        extractionStatus
      );

      uploadedFiles.push({
        id: fileId,
        filename: file.filename,
        original_name: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        category,
        extraction_status: extractionStatus,
        has_text: !!extractedText,
        url: `/api/uploads/${fileId}`
      });
    }

    res.json({ files: uploadedFiles });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get file
// GET /api/uploads/:id
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const file = db.prepare(`
      SELECT * FROM file_uploads WHERE id = ? AND user_id = ?
    `).get(id, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (!existsSync(file.storage_path)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
    res.sendFile(file.storage_path);
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ error: 'Failed to get file' });
  }
});

// Get file as base64 (for AI vision)
// GET /api/uploads/:id/base64
router.get('/:id/base64', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const file = db.prepare(`
      SELECT * FROM file_uploads WHERE id = ? AND user_id = ?
    `).get(id, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (!existsSync(file.storage_path)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const fileBuffer = readFileSync(file.storage_path);
    const base64 = fileBuffer.toString('base64');
    const dataUrl = `data:${file.mimetype};base64,${base64}`;

    res.json({
      id: file.id,
      mimetype: file.mimetype,
      original_name: file.original_name,
      data_url: dataUrl
    });
  } catch (error) {
    console.error('Get base64 error:', error);
    res.status(500).json({ error: 'Failed to get file' });
  }
});

// Delete file
// DELETE /api/uploads/:id
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const file = db.prepare(`
      SELECT * FROM file_uploads WHERE id = ? AND user_id = ?
    `).get(id, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete from disk
    if (existsSync(file.storage_path)) {
      unlinkSync(file.storage_path);
    }

    // Delete from database
    db.prepare('DELETE FROM file_uploads WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Link file to message
// PUT /api/uploads/:id/link
router.put('/:id/link', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { message_id, chat_id } = req.body;

    const file = db.prepare(`
      SELECT * FROM file_uploads WHERE id = ? AND user_id = ?
    `).get(id, req.user.id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    db.prepare(`
      UPDATE file_uploads SET message_id = ?, chat_id = ? WHERE id = ?
    `).run(message_id || null, chat_id || null, id);

    res.json({ success: true });
  } catch (error) {
    console.error('Link file error:', error);
    res.status(500).json({ error: 'Failed to link file' });
  }
});

// Error handling middleware for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum is 5 files.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

export default router;
