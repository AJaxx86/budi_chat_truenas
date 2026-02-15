import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import authRoutes from './routes/auth.js';
import setupRoutes from './routes/setup.js';
import adminRoutes from './routes/admin.js';
import chatsRoutes from './routes/chats.js';
import messagesRoutes from './routes/messages.js';
import memoriesRoutes from './routes/memories.js';
import statsRoutes from './routes/stats.js';
import searchRoutes from './routes/search.js';
import exportRoutes from './routes/export.js';
import uploadsRoutes from './routes/uploads.js';
import imagesRoutes from './routes/images.js';
import shareRoutes from './routes/share.js';
import personasRoutes from './routes/personas.js';
import workspacesRoutes from './routes/workspaces.js';
import modelsRoutes from './routes/models.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  credentials: true,
  origin: true
}));
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/memories', memoriesRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/images', imagesRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/personas', personasRoutes);
app.use('/api/workspaces', workspacesRoutes);
app.use('/api/models', modelsRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../client/dist')));

  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🚀 AI Chat Hub server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   API: http://localhost:${PORT}/api`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`   Frontend dev server: http://localhost:5173\n`);
  }
});
