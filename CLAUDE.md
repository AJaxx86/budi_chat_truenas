# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Chat Hub (Budi Chat) - A full-stack multi-user AI chat application with chat forking, memory management, and agent mode. Designed for TrueNAS Scale deployment.

**Tech Stack:** Node.js/Express backend, React 18/Vite frontend, SQLite (better-sqlite3), JWT auth, OpenRouter API, Tailwind CSS

## Development Commands

### Backend (from project root)
```bash
npm install              # Install backend dependencies
npm run dev              # Start dev server (port 3001)
npm start                # Production mode (NODE_ENV=production)
```

### Frontend (from client/)
```bash
cd client
npm install              # Install client dependencies
npm run dev              # Start Vite dev server (port 9000)
npm run build            # Build for production
```

### Full Build
```bash
npm run build            # Builds frontend from root
```

### Docker
```bash
docker build -t budi-chat:latest .
docker-compose up -d
```

## Development Setup

1. Copy `.env.example` to `.env` and configure `JWT_SECRET`
2. Run `npm install` in root and `client/` directories
3. Start backend: `npm run dev` (port 3001)
4. Start frontend: `cd client && npm run dev` (port 9000)
5. Vite proxies `/api/*` requests to backend automatically

## Architecture

### Directory Structure
```
server/                 # Express.js backend
├── index.js           # Entry point, Express setup
├── database.js        # SQLite schema & initialization
├── middleware/auth.js # JWT middleware
├── routes/            # REST API endpoints
│   ├── auth.js       # User registration/login
│   ├── admin.js      # User management (admin only)
│   ├── chats.js      # Chat CRUD, forking
│   ├── messages.js   # Message streaming (SSE)
│   ├── memories.js   # Memory storage
│   └── stats.js      # Usage statistics
└── services/ai.js    # OpenRouter API integration

client/src/             # React frontend
├── App.jsx            # Main routing
├── contexts/          # Auth context
├── components/        # Shared UI components
└── pages/             # Route pages (Chat, Admin, Memories, Profile)
```

### Key Patterns
- **ES Modules:** Project uses `"type": "module"` throughout
- **SSE Streaming:** Messages API uses Server-Sent Events for real-time AI responses
- **SQLite:** Uses prepared statements (SQL injection protected)
- **Auth:** JWT tokens in Authorization header, bcryptjs for password hashing
- **Markdown:** Rendered with `marked`, sanitized with `dompurify`

### Database Schema (6 tables)
- `users` - Accounts, API keys, admin flag
- `settings` - System settings (default API key, title gen model)
- `chats` - Chat sessions with parent/fork tracking
- `messages` - Messages with tool call support
- `memories` - User memories for context injection
- `tools` - Available tools for agent mode

### API Routes
- `/api/auth` - Authentication (register, login, profile)
- `/api/admin` - Admin operations (user/settings management)
- `/api/chats` - Chat CRUD and forking
- `/api/messages` - Message streaming
- `/api/memories` - Memory management
- `/api/stats` - Usage statistics

## Environment Variables

| Variable | Required | Default |
|----------|----------|---------|
| `JWT_SECRET` | Yes | - |
| `PORT` | No | 3001 |
| `ADMIN_EMAIL` | No | admin@example.com |
| `ADMIN_PASSWORD` | No | admin123 |
| `DEFAULT_OPENROUTER_API_KEY` | No | - |
| `DB_PATH` | No | ./data/database.db |

## Notes

- No linting or test frameworks configured
- Database auto-initializes on first server start
- Production: Frontend is served statically from backend
- Vite dev server runs on port 9000, backend on 3001
