# ✨ AI Chat Hub - Features Overview

A comprehensive guide to all the features and capabilities of AI Chat Hub.

## 🎯 Core Features

### 1. 👥 Multi-User System

**Secure User Management**
- Individual user accounts with secure authentication
- Isolated chat sessions per user
- Role-based access control (Admin/User)
- Profile management

**Authentication**
- JWT token-based authentication
- Secure password hashing with bcrypt
- 7-day session duration
- Automatic token refresh

### 2. 💬 Advanced Chat System

**Real-Time Conversations**
- Server-Sent Events (SSE) for streaming responses
- Live message streaming as AI generates responses
- No page refreshes needed
- Smooth, responsive interface

**Multiple Chat Sessions**
- Create unlimited chat sessions
- Each chat maintains independent history
- Quick switching between chats
- Persistent conversation storage

**Message Management**
- Full conversation history
- Markdown rendering with syntax highlighting
- Code block formatting
- Link detection and formatting
- Safe HTML rendering with XSS protection

### 3. 🌿 Chat Forking

**Branch Your Conversations**
- Fork any conversation from any message point
- Explore alternative conversation paths
- Compare different AI responses
- Maintain conversation tree structure

**Use Cases**
- Explore different problem-solving approaches
- Test various prompts and see results
- Keep main conversation clean while exploring tangents
- Compare responses to similar questions

**How It Works**
```
Original Chat:
  Message 1 → Message 2 → Message 3 → Message 4

Fork from Message 2:
  Message 1 → Message 2 → [New Message 3] → [New Message 4]
```

### 4. 🧠 Memory System

**Persistent Context Across Chats**
- Store important information about yourself
- AI references memories in all conversations
- Organized by category and importance
- Easy to manage and update

**Memory Categories**
- **General**: General facts and preferences
- **Personal**: Personal information
- **Work**: Professional context and projects
- **Preferences**: Communication style, likes/dislikes

**Memory Importance Levels**
- Scale from 1-5 stars
- Higher importance = more likely to be referenced
- Top 5 memories injected into every conversation
- Automatic context management

**Example Memories**
```
Category: Personal
Importance: ⭐⭐⭐⭐⭐
Content: "I'm a software developer specializing in React and Node.js"

Category: Preferences  
Importance: ⭐⭐⭐⭐
Content: "I prefer concise code examples with detailed comments"

Category: Work
Importance: ⭐⭐⭐
Content: "Currently working on a microservices architecture project"
```

### 5. 🤖 Agent Mode with Tools

**AI as an Active Agent**
Enable agent mode to let AI use tools to accomplish tasks.

**Available Tools**

1. **🔍 Web Search**
   - Search the web for current information
   - Get up-to-date facts and data
   - Research topics in real-time

2. **🧮 Calculator**
   - Perform complex mathematical calculations
   - Accurate arithmetic operations
   - Handle scientific notation

3. **💻 Code Interpreter**
   - Execute Python code
   - Test algorithms and functions
   - Generate and run scripts

**How Agent Mode Works**
```
User: "What's the weather in Tokyo and calculate 15% tip on $84.50?"

AI analyzes request → Identifies tools needed:
  1. Web search for Tokyo weather
  2. Calculator for tip amount

AI uses tools → Gets results:
  1. Weather: 22°C, Sunny
  2. Tip: $12.68

AI responds with complete answer combining all information
```

### 6. 🎛️ Customizable Chat Settings

**Per-Chat Configuration**

**Model Selection**
- **GPT-4 Turbo**: Latest, fastest GPT-4 model
- **GPT-4**: Most capable model
- **GPT-3.5 Turbo**: Fast and cost-effective

**Temperature Control (0.0 - 2.0)**
- **0.0 - 0.3**: Precise, deterministic, factual
- **0.4 - 0.7**: Balanced (default: 0.7)
- **0.8 - 1.2**: Creative, varied responses
- **1.3 - 2.0**: Highly creative, unpredictable

**System Prompts**
- Set custom behavior for each chat
- Define AI personality and role
- Add context and constraints
- Examples:
  ```
  "You are a senior software architect reviewing code"
  "You are a creative writing assistant for sci-fi novels"
  "You are a patient teacher explaining concepts to beginners"
  ```

**Agent Mode Toggle**
- Enable/disable tools per chat
- Control when AI can use external tools
- Customize behavior based on use case

## 🔑 API Key Management

### User-Level API Keys

**Personal API Keys**
- Each user can set their own OpenRouter API key
- Keys stored encrypted in database
- Full control over API usage and costs
- Easy to update or remove

**Benefits**
- Individual cost tracking
- Personal usage limits
- No shared key concerns
- Full privacy

### Admin-Level Default Key

**Shared Default Key**
- Admins can set a system-wide default key
- Users can be granted permission to use it
- Simplified onboarding for new users
- Centralized cost management

**Permission System**
- Admin controls who can use default key
- Can be enabled/disabled per user
- Users can still override with personal key
- Flexible access control

**Use Cases**
- Family sharing
- Small team deployment
- Educational settings
- Trial periods

## 👨‍💼 Admin Panel

### User Management

**Create Users**
- Add new users with email and password
- Set initial permissions
- Grant admin rights
- Enable default key access

**Edit Users**
- Update user information
- Change permissions
- Reset passwords
- Modify key access

**Delete Users**
- Remove users and their data
- Cascade delete (chats, messages, memories)
- Cannot delete self
- Confirmation required

**User Overview**
- See all registered users
- View API key status
- Check permissions
- Monitor user activity

### System Settings

**Default API Key Configuration**
- Set shared OpenRouter API key
- Update key anytime
- Secure storage
- Used by authorized users

**System Monitoring**
- View active users
- Monitor resource usage
- Check system health
- Review logs

## 🎨 User Interface

### Design Philosophy

**Modern & Colorful**
- Gradient accents (blue → purple)
- Smooth animations and transitions
- Intuitive iconography
- Responsive design

**Color Scheme**
- **Primary**: Blue gradient for main actions
- **Accent**: Purple/pink for highlights
- **Success**: Green for confirmations
- **Error**: Red for warnings
- **Neutral**: Gray scale for content

### Layout

**Sidebar**
- Chat list with quick access
- New chat button
- Navigation menu
- User profile

**Main Area**
- Chat messages
- Input box
- Settings panel
- Streaming indicator

**Responsive Design**
- Desktop: Full sidebar and chat
- Tablet: Collapsible sidebar
- Mobile: Optimized touch interface

### User Experience

**Smooth Interactions**
- Real-time message streaming
- Instant feedback
- Loading indicators
- Error messages
- Success confirmations

**Keyboard Shortcuts**
- Enter to send message
- Quick navigation
- Efficient workflow

## 🔒 Security Features

### Authentication & Authorization

**Secure Login**
- Password hashing with bcrypt (10 rounds)
- JWT tokens for session management
- 7-day token expiration
- Automatic logout on expiry

**Protected Routes**
- All API endpoints require authentication
- Admin routes require admin role
- User isolation (can't access others' data)
- CORS protection

### Data Security

**API Key Protection**
- Keys never sent to frontend
- Stored encrypted in database
- Masked in UI
- Secure transmission

**Input Sanitization**
- SQL injection prevention
- XSS protection with DOMPurify
- Input validation
- Safe markdown rendering

**Privacy**
- User data isolation
- No cross-user data leakage
- Secure password storage
- Private conversation history

## 📊 Data Management

### Database

**SQLite Database**
- Self-contained, serverless
- Zero configuration
- Reliable and fast
- Perfect for 1-100 users

**Data Persistence**
- All chats saved automatically
- Message history preserved
- Memories stored permanently
- User data backed up in database

**Backup & Recovery**
- Simple file-based backup
- Easy to restore
- Portable database
- Migration friendly

### Storage

**Efficient Storage**
- Compressed message storage
- Indexed queries
- Optimized for performance
- Minimal disk footprint

## 🚀 Performance

### Optimization

**Frontend**
- Vite for fast builds
- React 18 with concurrent features
- Lazy loading
- Optimized bundle size

**Backend**
- Express.js for speed
- Connection pooling
- Prepared statements
- Efficient queries

**Streaming**
- Server-Sent Events (SSE)
- Real-time updates
- Low latency
- Efficient bandwidth usage

### Resource Usage

**Lightweight**
- Backend: ~100MB RAM idle
- Frontend: ~50MB RAM
- Database: <1GB typical
- Low CPU usage

## 🎓 Use Cases

### Personal Assistant
- Daily planning and organization
- Research and learning
- Creative writing
- Problem solving

### Development
- Code review and suggestions
- Bug fixing assistance
- Architecture discussions
- Documentation generation

### Content Creation
- Blog post writing
- Social media content
- Story development
- Editing and refinement

### Education
- Homework help
- Concept explanations
- Study planning
- Research assistance

### Business
- Email drafting
- Report generation
- Data analysis
- Customer support scripts

## 🔄 Workflow Examples

### Example 1: Research with Forking

```
1. Start chat: "Tell me about quantum computing"
2. Get comprehensive overview
3. Fork at interesting point: "Explain quantum entanglement"
4. Explore deep dive on entanglement
5. Return to main chat, fork again: "Applications in cryptography"
6. Compare both branches
```

### Example 2: Agent Mode in Action

```
1. Enable Agent Mode
2. Ask: "Find the population of Tokyo and calculate 20% of it"
3. AI uses web_search tool → Gets population: 37 million
4. AI uses calculator → Calculates: 7.4 million
5. AI responds with complete answer and sources
```

### Example 3: Memory-Enhanced Conversations

```
Memory: "I'm learning React and prefer TypeScript"

Chat 1: "How do I handle state in React?"
→ AI provides React-specific, TypeScript examples

Chat 2: "Best practices for large apps?"
→ AI references your React focus, suggests TypeScript patterns

Chat 3: "Help me build a form"
→ AI uses React + TypeScript without you asking
```

## 🎉 Benefits

### For Individual Users
✅ Complete privacy and control
✅ Persistent context across sessions
✅ Advanced features like forking
✅ Tool usage for enhanced capabilities
✅ Beautiful, modern interface

### For Families
✅ Shared hosting, individual accounts
✅ Centralized API key management
✅ Cost-effective solution
✅ Safe, controlled environment
✅ Easy to deploy and maintain

### For Small Teams
✅ Collaborative knowledge base via memories
✅ Consistent AI assistant across team
✅ Admin controls for governance
✅ Individual conversation privacy
✅ Self-hosted for security

### For Developers
✅ Open source and customizable
✅ Easy to extend with new features
✅ Modern tech stack
✅ API for integrations
✅ Docker-ready deployment

## 🆚 Comparison with Alternatives

| Feature | AI Chat Hub | ChatGPT Web | Claude Web |
|---------|-------------|-------------|------------|
| Self-hosted | ✅ Yes | ❌ No | ❌ No |
| Multi-user | ✅ Yes | ❌ No | ❌ No |
| Chat Forking | ✅ Yes | ❌ No | ❌ No |
| Memories | ✅ Yes | ❌ Limited | ❌ No |
| Agent Mode | ✅ Yes | ✅ Yes | ❌ No |
| Custom Prompts | ✅ Yes | ✅ Yes | ✅ Yes |
| API Key Control | ✅ Full | ❌ N/A | ❌ N/A |
| Data Privacy | ✅ Full | ⚠️ Limited | ⚠️ Limited |
| Cost | 💰 API only | 💰 $20/mo | 💰 $20/mo |
| Customizable | ✅ Yes | ❌ No | ❌ No |

## 📈 Roadmap

### Planned Features
- Voice input/output
- Image generation integration
- Document upload and analysis
- Conversation search
- Export conversations (PDF, Markdown)
- Mobile app
- More AI providers (Claude, Gemini)
- Plugin system
- Advanced analytics

---

**AI Chat Hub**: The most feature-rich, privacy-focused, self-hosted AI chat solution.

Ready to get started? See [QUICK_START.md](QUICK_START.md)!
