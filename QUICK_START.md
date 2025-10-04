# ⚡ Quick Start Guide

Get AI Chat Hub up and running in 5 minutes!

## 🚀 Fastest Method: Docker Compose

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd ai-chat-hub
```

### 2. Configure Environment
```bash
# Copy example environment file
cp .env.example .env

# Edit with your settings
nano .env
```

**Minimum Required Changes:**
```env
JWT_SECRET=your-secure-random-string-at-least-32-characters-long
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=YourSecurePassword123
```

**Optional (can be set later via UI):**
```env
DEFAULT_OPENROUTER_API_KEY=sk-your-openrouter-api-key-here
```

### 3. Start Application
```bash
docker-compose up -d
```

### 4. Access Application
Open your browser: **http://localhost:3001**

Default credentials:
- Email: `admin@yourdomain.com` (or what you set)
- Password: `YourSecurePassword123` (or what you set)

### 5. First Steps

1. **Change Password:**
   - Click Settings → Update password

2. **Add API Key:**
   - Option A: Settings → Set your personal OpenRouter key
   - Option B: Admin Panel → Set default key for all users

3. **Start Chatting:**
   - Click "New Chat"
   - Type a message
   - Enjoy! 🎉

## 🛠️ Local Development

### Prerequisites
- Node.js 18+
- npm

### Setup

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Create .env file
cp .env.example .env

# Start backend (terminal 1)
npm run dev

# Start frontend (terminal 2)
cd client && npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## 🎯 Key Features to Try

### 1. Chat Settings
- Click "Chat Settings" button
- Try different models (GPT-4, GPT-3.5)
- Adjust temperature
- Set custom system prompt
- Enable Agent Mode for tools

### 2. Chat Forking
- Have a conversation
- Click "Fork from here" on any AI response
- Explore alternative conversation paths

### 3. Memories
- Go to Memories page
- Add information about yourself
- AI will remember this context in future chats

### 4. Admin Features (for admins)
- Manage users
- Set permissions
- Configure default API key

## 🐳 Docker Commands

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f

# Rebuild after changes
docker-compose up -d --build

# Reset everything (WARNING: deletes data)
docker-compose down -v
rm -rf data/
```

## 📝 Common Configurations

### Use Your Own API Key
1. Go to Settings
2. Add your OpenRouter API key
3. Start chatting

### Allow Users to Share Default Key
1. Login as admin
2. Go to Admin Panel
3. Set "Default OpenRouter API Key"
4. Edit user → Check "Can Use Default API Key"

### Create New Users
1. Admin Panel → Add User
2. Set permissions
3. Send credentials to user

## ⚠️ Security Notes

### Production Deployment Checklist
- [ ] Change `JWT_SECRET` to a strong random string
- [ ] Use strong admin password
- [ ] Enable HTTPS (use reverse proxy)
- [ ] Restrict network access
- [ ] Regular backups of `/data` directory
- [ ] Keep Docker image updated

### Generate Secure JWT Secret
```bash
# Linux/Mac
openssl rand -base64 32

# Or use any random string generator (32+ chars)
```

## 🔧 Troubleshooting

### Port Already in Use
```bash
# Change port in .env
PORT=3002

# Or in docker-compose.yml
ports:
  - "3002:3001"
```

### Database Locked Error
```bash
# Stop application
docker-compose down

# Restart
docker-compose up -d
```

### Cannot Connect to OpenRouter
1. Verify API key is correct
2. Check you have credits at OpenRouter
3. Test key at https://openrouter.ai/keys

### Memory Usage Too High
- Use GPT-3.5 instead of GPT-4
- Reduce concurrent users
- Increase Docker memory limit

## 📚 Next Steps

1. **Read Full Documentation:** See [README.md](README.md)
2. **TrueNAS Deployment:** See [TRUENAS_DEPLOYMENT.md](TRUENAS_DEPLOYMENT.md)
3. **Customize Features:** Explore code in `/server` and `/client`
4. **Set Up Backups:** Schedule regular backups of `/data` directory

## 🎉 Success!

You're now running your own private AI chat application!

**Enjoy the freedom of:**
- ✅ Complete data privacy
- ✅ Full customization
- ✅ Multiple users
- ✅ Advanced features
- ✅ No monthly subscriptions

---

Need help? Check [README.md](README.md) for detailed documentation.

Happy Chatting! 💬✨
