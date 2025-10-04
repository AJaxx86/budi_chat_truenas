# 🚀 AI Chat Hub

A feature-rich, multi-user AI chat application with advanced capabilities including memories, chat forking, agent mode with tools, and comprehensive user management.

![AI Chat Hub](https://img.shields.io/badge/AI-Chat%20Hub-blue?style=for-the-badge&logo=openai)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)
![TrueNAS](https://img.shields.io/badge/TrueNAS-Scale-0095D5?style=for-the-badge&logo=truenas)

## ✨ Features

### 🎯 Core Features
- **Multi-User Support** - Secure user authentication and isolated chat sessions
- **Beautiful Modern UI** - Colorful, responsive design with Tailwind CSS
- **Real-time Streaming** - Live AI responses with Server-Sent Events (SSE)
- **Multiple AI Models** - Support for GPT-4, GPT-4 Turbo, and GPT-3.5 Turbo

### 🔧 Advanced Features
- **🧠 Memories** - Store important context that AI can reference across conversations
- **🌿 Chat Forking** - Branch conversations from any message point
- **🤖 Agent Mode** - Enable AI to use tools (web search, calculator, code interpreter)
- **🎛️ Customizable Chat Settings** - Adjust temperature, system prompts, and model per chat
- **👥 User Management** - Admin panel for managing users and permissions

### 🔑 API Key Management
- Users can set their own OpenAI API keys
- Admins can configure a default API key for authorized users
- Flexible permission system for key access

## 📋 Prerequisites

- Docker and Docker Compose
- OpenAI API key (get one at [platform.openai.com](https://platform.openai.com/api-keys))

## 🐳 Deployment on TrueNAS Scale

### Method 1: Using TrueNAS Custom App

1. **Navigate to Apps** in TrueNAS Scale UI
2. **Click "Discover Apps"** → **"Custom App"**
3. **Fill in the Application Configuration:**

   **Application Name:** `ai-chat-hub`

   **Image Repository:** Build the image first (see Building Docker Image below) or use a registry

   **Image Tag:** `latest`

   **Container Configuration:**
   - Port Forwarding:
     - Container Port: `3001`
     - Node Port: `3001` (or your preferred port)

   **Environment Variables:**
   ```
   JWT_SECRET=your-secure-random-string-here-change-this
   ADMIN_EMAIL=admin@yourdomain.com
   ADMIN_PASSWORD=your-secure-admin-password
   DEFAULT_OPENAI_API_KEY=sk-your-key-here (optional)
   ```

   **Storage:**
   - Host Path: `/mnt/pool/ai-chat-hub/data`
   - Mount Path: `/app/data`
   - Type: Host Path

4. **Click "Install"**

5. **Access the application** at `http://your-truenas-ip:3001`

### Method 2: Using Docker Compose

1. **Clone or copy this repository to your TrueNAS server:**
   ```bash
   git clone <your-repo-url>
   cd ai-chat-hub
   ```

2. **Create and configure environment file:**
   ```bash
   cp .env.example .env
   nano .env
   ```

   Update these critical values:
   ```env
   JWT_SECRET=your-very-secure-random-string-change-this
   ADMIN_EMAIL=admin@yourdomain.com
   ADMIN_PASSWORD=your-secure-password
   DEFAULT_OPENAI_API_KEY=sk-your-openai-key (optional)
   ```

3. **Build and start the application:**
   ```bash
   docker-compose up -d
   ```

4. **Access the application** at `http://your-truenas-ip:3001`

## 🔨 Building Docker Image

```bash
# Build the image
docker build -t ai-chat-hub:latest .

# Or using docker-compose
docker-compose build
```

## 🚀 Local Development

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Setup

1. **Install backend dependencies:**
   ```bash
   npm install
   ```

2. **Install frontend dependencies:**
   ```bash
   cd client
   npm install
   cd ..
   ```

3. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration.

4. **Start the backend server:**
   ```bash
   npm run dev
   ```

5. **In a new terminal, start the frontend dev server:**
   ```bash
   cd client
   npm run dev
   ```

6. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## 📖 Usage Guide

### First Time Setup

1. **Login with default admin credentials:**
   - Email: `admin@example.com` (or what you set in .env)
   - Password: `admin123` (or what you set in .env)
   - ⚠️ **IMPORTANT:** Change these immediately after first login!

2. **Configure API Keys:**
   - Option A: Go to **Settings** → Set your personal OpenAI API key
   - Option B: As admin, go to **Admin Panel** → Set default API key for all users

### Creating Users (Admin)

1. Navigate to **Admin Panel**
2. Click **Add User**
3. Fill in user details
4. Choose permissions:
   - **Admin Privileges**: Full system access
   - **Can Use Default API Key**: User can use the shared API key

### Using the Chat

1. **Create a New Chat:**
   - Click "New Chat" button
   - Configure chat settings (optional)

2. **Chat Settings:**
   - **Model**: Choose between GPT-4, GPT-4 Turbo, or GPT-3.5
   - **Temperature**: Control response randomness (0-2)
   - **System Prompt**: Set custom behavior
   - **Agent Mode**: Enable AI tools (web search, calculator, code execution)

3. **Chat Features:**
   - **Fork Chat**: Branch from any AI response to explore alternative paths
   - **Memories**: Store important context in the Memories page
   - **Streaming Responses**: Real-time AI replies

### Managing Memories

1. Go to **Memories** page
2. Click **Add Memory**
3. Enter information you want AI to remember
4. Set category and importance level
5. AI will reference your top 5 memories in conversations

## 🏗️ Architecture

### Backend
- **Framework**: Express.js (Node.js)
- **Database**: SQLite with better-sqlite3
- **Authentication**: JWT tokens
- **AI Integration**: OpenAI API with streaming support

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Routing**: React Router v6
- **Markdown**: Marked + DOMPurify

### Database Schema
- **users** - User accounts and API key configuration
- **settings** - System-wide settings (default API key)
- **chats** - Chat sessions with configuration
- **messages** - Chat messages with tool call support
- **memories** - User memories for context
- **tools** - Available tools for agent mode

## 🔒 Security Features

- Secure password hashing with bcrypt
- JWT-based authentication
- API key encryption
- Input sanitization
- XSS protection with DOMPurify
- SQL injection protection with prepared statements

## 🛠️ Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `JWT_SECRET` | JWT signing secret | *Must change* |
| `ADMIN_EMAIL` | Default admin email | `admin@example.com` |
| `ADMIN_PASSWORD` | Default admin password | `admin123` |
| `DEFAULT_OPENAI_API_KEY` | Shared API key | Empty |
| `DB_PATH` | Database file path | `./data/database.db` |

### Chat Settings (Per Chat)

- **Model**: `gpt-4-turbo-preview`, `gpt-4`, `gpt-3.5-turbo`
- **Temperature**: 0.0 to 2.0 (default: 0.7)
- **System Prompt**: Custom instructions for AI
- **Agent Mode**: Enable/disable tool usage

## 🧰 Available Tools (Agent Mode)

1. **Web Search** - Search the web for current information
2. **Calculator** - Perform mathematical calculations  
3. **Code Interpreter** - Execute Python code

*Note: Tools are placeholders in the default setup. Implement actual functionality in `server/services/ai.js`*

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### Admin
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/settings` - Get settings
- `PUT /api/admin/settings` - Update settings

### Chats
- `GET /api/chats` - List user's chats
- `GET /api/chats/:id` - Get chat with messages
- `POST /api/chats` - Create new chat
- `PUT /api/chats/:id` - Update chat settings
- `DELETE /api/chats/:id` - Delete chat
- `POST /api/chats/:id/fork` - Fork chat from message

### Messages
- `POST /api/messages/:chatId` - Send message (SSE streaming)
- `GET /api/messages/:chatId` - Get chat messages

### Memories
- `GET /api/memories` - List user's memories
- `POST /api/memories` - Create memory
- `PUT /api/memories/:id` - Update memory
- `DELETE /api/memories/:id` - Delete memory

## 🐛 Troubleshooting

### Database Issues
```bash
# Reset database (WARNING: Deletes all data)
rm -rf data/
# Restart application to recreate
```

### Permission Issues in Docker
```bash
# Fix data directory permissions
sudo chown -R 1000:1000 ./data
```

### API Key Not Working
1. Verify key format starts with `sk-`
2. Check key has sufficient credits at OpenAI
3. Ensure key has proper permissions
4. Try regenerating the key

### Port Already in Use
```bash
# Change port in .env or docker-compose.yml
PORT=3002
```

## 🚧 Roadmap

- [ ] Support for additional AI providers (Anthropic, Google, etc.)
- [ ] Voice input/output
- [ ] Image generation integration
- [ ] Advanced tool implementations
- [ ] Multi-language support
- [ ] Export/import conversations
- [ ] Conversation search
- [ ] Rate limiting and usage tracking
- [ ] OAuth2 integration
- [ ] Mobile app

## 📝 License

This project is provided as-is for personal and commercial use.

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

## 💬 Support

For issues and questions:
1. Check the Troubleshooting section
2. Review existing GitHub issues
3. Create a new issue with detailed information

## 🎉 Credits

Built with:
- [OpenAI API](https://openai.com)
- [Express.js](https://expressjs.com)
- [React](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Vite](https://vitejs.dev)
- [Better SQLite3](https://github.com/WiseLibs/better-sqlite3)

---

**Made with ❤️ for the TrueNAS Scale community**

🌟 If you find this project useful, please consider starring it on GitHub!
