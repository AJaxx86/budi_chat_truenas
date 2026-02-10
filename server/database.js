import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync, mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DB_PATH || join(__dirname, "../data/database.db");
const dbDir = dirname(dbPath);

if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Initialize database schema
function initDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      user_type TEXT DEFAULT 'user',
      openai_api_key TEXT,
      use_default_key INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Add user_type column to users table if it doesn't exist
  try {
    const usersInfo = db.prepare("PRAGMA table_info(users)").all();
    const hasUserType = usersInfo.some((col) => col.name === "user_type");
    if (!hasUserType) {
      db.exec("ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT 'user'");
      // Migrate existing admins to user_type='admin', others to 'user'
      db.exec("UPDATE users SET user_type = 'admin' WHERE is_admin = 1");
      db.exec("UPDATE users SET user_type = 'user' WHERE is_admin = 0 OR is_admin IS NULL");
      console.log("✅ Migration: Added user_type column to users table and migrated existing users");
    }
  } catch (e) {
    console.error("Migration error:", e);
  }

  // Settings table (for default keys and system settings)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User groups table (for role-based permissions)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      permissions TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Workspaces table (for organizing chats into projects)
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT 'Folder',
      color TEXT DEFAULT '#f59e0b',
      default_model TEXT,
      default_system_prompt TEXT,
      default_temperature REAL DEFAULT 0.7,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Chats table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      parent_chat_id TEXT,
      fork_point_message_id TEXT,
      model TEXT DEFAULT 'moonshotai/kimi-k2-thinking',
      system_prompt TEXT,
      temperature REAL DEFAULT 0.7,
      depth TEXT DEFAULT 'standard',
      tone TEXT DEFAULT 'professional',
      agent_mode INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_chat_id) REFERENCES chats(id) ON DELETE SET NULL
    )
  `);

  // Messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      reasoning_content TEXT,
      tool_calls TEXT,
      tool_call_id TEXT,
      name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    )
  `);

  // Memories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      importance INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tools table (available tools for agent mode)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      parameters TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Personas table
  db.exec(`
    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      system_prompt TEXT NOT NULL,
      icon TEXT DEFAULT 'User',
      category TEXT DEFAULT 'general',
      creativity TEXT DEFAULT 'balanced',
      depth TEXT DEFAULT 'standard',
      tone TEXT DEFAULT 'professional',
      is_default INTEGER DEFAULT 0,
      usage_count INTEGER DEFAULT 0,
      last_used_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // User stats table (persistent lifetime stats that survive message deletion)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id INTEGER PRIMARY KEY,
      total_messages INTEGER DEFAULT 0,
      total_prompt_tokens INTEGER DEFAULT 0,
      total_completion_tokens INTEGER DEFAULT 0,
      total_cost REAL DEFAULT 0,
      total_reasoning_chars INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // User model stats table (persistent per-model stats that survive message deletion)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_model_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      model TEXT NOT NULL,
      usage_count INTEGER DEFAULT 0,
      total_prompt_tokens INTEGER DEFAULT 0,
      total_completion_tokens INTEGER DEFAULT 0,
      total_cost REAL DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, model)
    )
  `);

  // File uploads table
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_uploads (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      chat_id TEXT,
      message_id TEXT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      extracted_text TEXT,
      extraction_status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE SET NULL,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
    )
  `);

  // Migration: Add extracted_text columns if they don't exist
  try {
    const fileUploadsInfo = db.prepare("PRAGMA table_info(file_uploads)").all();
    const hasExtractedText = fileUploadsInfo.some(col => col.name === "extracted_text");
    if (!hasExtractedText) {
      db.exec("ALTER TABLE file_uploads ADD COLUMN extracted_text TEXT");
      db.exec("ALTER TABLE file_uploads ADD COLUMN extraction_status TEXT DEFAULT 'pending'");
      console.log("✅ Migration: Added extracted_text columns to file_uploads");
    }
  } catch (e) {
    // Table might not exist yet
  }

  // Generated images table
  db.exec(`
    CREATE TABLE IF NOT EXISTS generated_images (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      chat_id TEXT,
      message_id TEXT,
      prompt TEXT NOT NULL,
      revised_prompt TEXT,
      model TEXT NOT NULL,
      size TEXT,
      quality TEXT,
      storage_path TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE SET NULL
    )
  `);

  // Shared chats table (for public chat links)
  db.exec(`
    CREATE TABLE IF NOT EXISTS shared_chats (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      share_token TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT,
      view_count INTEGER DEFAULT 0,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Message steps table (for storing individual AI response steps)
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_steps (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      step_type TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      content TEXT,
      tool_call_id TEXT,
      tool_name TEXT,
      tool_arguments TEXT,
      duration_ms INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    )
  `);

  // Index for faster step lookups by message
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_message_steps_message ON message_steps(message_id)
  `);

  // Migration: Add default_image_model to users table
  try {
    const usersInfo = db.prepare("PRAGMA table_info(users)").all();
    const hasImageModel = usersInfo.some(col => col.name === "default_image_model");
    if (!hasImageModel) {
      db.exec("ALTER TABLE users ADD COLUMN default_image_model TEXT");
      console.log("✅ Migration: Added default_image_model to users table");
    }
  } catch (e) {
    // Ignore
  }

  // Add default_image_model setting if not exists
  const imageModelSetting = db.prepare("SELECT * FROM settings WHERE key = 'default_image_model'").get();
  if (!imageModelSetting) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('default_image_model', 'stabilityai/stable-diffusion-3.5-large');
    console.log("✅ Added default_image_model setting");
  }

  // Add guest_model_whitelist setting if not exists
  const guestWhitelistSetting = db.prepare("SELECT * FROM settings WHERE key = 'guest_model_whitelist'").get();
  if (!guestWhitelistSetting) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('guest_model_whitelist', '[]');
    console.log("✅ Added guest_model_whitelist setting");
  }

  // FTS5 virtual table for full-text search on messages
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      content,
      chat_id UNINDEXED,
      message_id UNINDEXED,
      content='messages',
      content_rowid='rowid'
    )
  `);

  // FTS5 virtual table for full-text search on chat titles
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chats_fts USING fts5(
      title,
      chat_id UNINDEXED,
      content='chats',
      content_rowid='rowid'
    )
  `);

  // Create triggers to keep FTS index synchronized with messages table
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(rowid, content, chat_id, message_id)
      VALUES (NEW.rowid, NEW.content, NEW.chat_id, NEW.id);
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, content, chat_id, message_id)
      VALUES ('delete', OLD.rowid, OLD.content, OLD.chat_id, OLD.id);
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, content, chat_id, message_id)
      VALUES ('delete', OLD.rowid, OLD.content, OLD.chat_id, OLD.id);
      INSERT INTO messages_fts(rowid, content, chat_id, message_id)
      VALUES (NEW.rowid, NEW.content, NEW.chat_id, NEW.id);
    END
  `);

  // Create triggers to keep FTS index synchronized with chats table
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS chats_fts_insert AFTER INSERT ON chats BEGIN
      INSERT INTO chats_fts(rowid, title, chat_id)
      VALUES (NEW.rowid, NEW.title, NEW.id);
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS chats_fts_delete AFTER DELETE ON chats BEGIN
      INSERT INTO chats_fts(chats_fts, rowid, title, chat_id)
      VALUES ('delete', OLD.rowid, OLD.title, OLD.id);
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS chats_fts_update AFTER UPDATE OF title ON chats BEGIN
      INSERT INTO chats_fts(chats_fts, rowid, title, chat_id)
      VALUES ('delete', OLD.rowid, OLD.title, OLD.id);
      INSERT INTO chats_fts(rowid, title, chat_id)
      VALUES (NEW.rowid, NEW.title, NEW.id);
    END
  `);

  // Migration: Add reasoning_content to messages if it doesn't exist
  const tableInfo = db.prepare("PRAGMA table_info(messages)").all();
  const hasReasoning = tableInfo.some(
    (col) => col.name === "reasoning_content",
  );
  if (!hasReasoning) {
    try {
      db.exec("ALTER TABLE messages ADD COLUMN reasoning_content TEXT");
      console.log("✅ Migration: Added reasoning_content to messages table");
    } catch (e) {
      console.error("Migration error:", e);
    }
  }

  // Migration: Add token usage and timing columns to messages
  const hasTokens = tableInfo.some((col) => col.name === "prompt_tokens");
  if (!hasTokens) {
    try {
      db.exec("ALTER TABLE messages ADD COLUMN prompt_tokens INTEGER");
      db.exec("ALTER TABLE messages ADD COLUMN completion_tokens INTEGER");
      db.exec("ALTER TABLE messages ADD COLUMN response_time_ms INTEGER");
      console.log(
        "✅ Migration: Added token usage and timing columns to messages table",
      );
    } catch (e) {
      console.error("Migration error:", e);
    }
  }

  // Migration: Add model and cost columns to messages
  const hasModel = tableInfo.some((col) => col.name === "model");
  if (!hasModel) {
    try {
      db.exec("ALTER TABLE messages ADD COLUMN model TEXT");
      db.exec("ALTER TABLE messages ADD COLUMN cost REAL DEFAULT 0");
      console.log(
        "✅ Migration: Added model and cost columns to messages table",
      );
    } catch (e) {
      console.error("Migration error:", e);
    }
  }

  // Migration: Add used_default_key column to track which API key type was used
  const hasUsedDefaultKey = tableInfo.some(
    (col) => col.name === "used_default_key",
  );
  if (!hasUsedDefaultKey) {
    try {
      db.exec(
        "ALTER TABLE messages ADD COLUMN used_default_key INTEGER DEFAULT 0",
      );
      console.log("✅ Migration: Added used_default_key to messages table");
    } catch (e) {
      console.error("Migration error:", e);
    }
  }

  // Migration: Add default/personal key breakdown columns to user_stats
  try {
    const userStatsInfo = db.prepare("PRAGMA table_info(user_stats)").all();
    const hasDefaultKeyTokens = userStatsInfo.some(
      (col) => col.name === "default_key_tokens",
    );
    if (!hasDefaultKeyTokens) {
      db.exec("ALTER TABLE user_stats ADD COLUMN default_key_tokens INTEGER DEFAULT 0");
      db.exec("ALTER TABLE user_stats ADD COLUMN default_key_cost REAL DEFAULT 0");
      db.exec("ALTER TABLE user_stats ADD COLUMN personal_key_tokens INTEGER DEFAULT 0");
      db.exec("ALTER TABLE user_stats ADD COLUMN personal_key_cost REAL DEFAULT 0");
      console.log("✅ Migration: Added default/personal key breakdown to user_stats table");
    }
  } catch (e) {
    console.error("Migration error:", e);
  }

  // Migration: Add user_group column to users table
  try {
    const usersInfo = db.prepare("PRAGMA table_info(users)").all();
    const hasUserGroup = usersInfo.some((col) => col.name === "user_group");
    if (!hasUserGroup) {
      db.exec("ALTER TABLE users ADD COLUMN user_group TEXT DEFAULT 'user'");
      // Migrate existing admins to admin group
      db.exec("UPDATE users SET user_group = 'admin' WHERE is_admin = 1");
      console.log("✅ Migration: Added user_group column to users table");
    }
  } catch (e) {
    console.error("Migration error:", e);
  }

  // Migration: Add accent_color column to users table
  try {
    const usersInfo = db.prepare("PRAGMA table_info(users)").all();
    const hasAccentColor = usersInfo.some((col) => col.name === "accent_color");
    if (!hasAccentColor) {
      db.exec("ALTER TABLE users ADD COLUMN accent_color TEXT DEFAULT 'amber'");
      console.log("✅ Migration: Added accent_color column to users table");
    }
  } catch (e) {
    console.error("Migration error:", e);
  }

  // Migration: Add show_recent_personas column to users table
  try {
    const usersInfo = db.prepare("PRAGMA table_info(users)").all();
    const hasShowRecentPersonas = usersInfo.some((col) => col.name === "show_recent_personas");
    if (!hasShowRecentPersonas) {
      db.exec("ALTER TABLE users ADD COLUMN show_recent_personas INTEGER DEFAULT 0");
      console.log("✅ Migration: Added show_recent_personas column to users table");
    }
  } catch (e) {
    console.error("Migration error:", e);
  }

  // Migration: Add workspace_id column to chats table
  try {
    const chatsInfo = db.prepare("PRAGMA table_info(chats)").all();
    const hasWorkspaceId = chatsInfo.some((col) => col.name === "workspace_id");
    if (!hasWorkspaceId) {
      db.exec("ALTER TABLE chats ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL");
      db.exec("CREATE INDEX IF NOT EXISTS idx_chats_workspace ON chats(workspace_id)");
      console.log("✅ Migration: Added workspace_id column and index to chats table");
    }
  } catch (e) {
    console.error("Migration error:", e);
  }

  // Migration: Add specific persona settings to chats table
  try {
    const chatsInfo = db.prepare("PRAGMA table_info(chats)").all();
    const hasDepth = chatsInfo.some((col) => col.name === "depth");

    if (!hasDepth) {
      db.exec("ALTER TABLE chats ADD COLUMN depth TEXT DEFAULT 'standard'");
      db.exec("ALTER TABLE chats ADD COLUMN tone TEXT DEFAULT 'professional'");
      console.log("✅ Migration: Added depth and tone columns to chats table");
    }

    const hasThinkingMode = chatsInfo.some((col) => col.name === "thinking_mode");
    if (!hasThinkingMode) {
      db.exec("ALTER TABLE chats ADD COLUMN thinking_mode TEXT DEFAULT 'medium'");
      console.log("✅ Migration: Added thinking_mode column to chats table");
    }
  } catch (e) {
    console.error("Migration error:", e);
  }

  // Migration: Add response_group_id to messages table (for multi-message tool-use chains)
  try {
    const messagesInfo = db.prepare("PRAGMA table_info(messages)").all();
    const hasResponseGroupId = messagesInfo.some((col) => col.name === "response_group_id");
    if (!hasResponseGroupId) {
      db.exec("ALTER TABLE messages ADD COLUMN response_group_id TEXT");
      db.exec("CREATE INDEX IF NOT EXISTS idx_messages_response_group ON messages(response_group_id)");
      console.log("✅ Migration: Added response_group_id column and index to messages table");
    }
  } catch (e) {
    console.error("Migration error:", e);
  }

  // Migration: Add creativity, depth, and tone columns to personas table
  try {
    const personasInfo = db.prepare("PRAGMA table_info(personas)").all();
    const hasCreativity = personasInfo.some((col) => col.name === "creativity");

    if (!hasCreativity) {
      db.exec("ALTER TABLE personas ADD COLUMN creativity TEXT DEFAULT 'balanced'");
      db.exec("ALTER TABLE personas ADD COLUMN depth TEXT DEFAULT 'standard'");
      db.exec("ALTER TABLE personas ADD COLUMN tone TEXT DEFAULT 'professional'");
      console.log("✅ Migration: Added creativity, depth, and tone columns to personas table");
    }
  } catch (e) {
    console.error("Migration error:", e);
  }

  // Migration: Add persona_id to chats table
  try {
    const chatsInfo = db.prepare("PRAGMA table_info(chats)").all();
    const hasPersonaId = chatsInfo.some((col) => col.name === "persona_id");
    if (!hasPersonaId) {
      db.exec("ALTER TABLE chats ADD COLUMN persona_id TEXT REFERENCES personas(id) ON DELETE SET NULL");
      console.log("✅ Migration: Added persona_id column to chats table");
    }
  } catch (e) {
    console.error("Migration error:", e);
  }

  // Migration: Add default_persona_id to workspaces table
  try {
    const workspacesInfo = db.prepare("PRAGMA table_info(workspaces)").all();
    const hasDefaultPersonaId = workspacesInfo.some((col) => col.name === "default_persona_id");
    if (!hasDefaultPersonaId) {
      db.exec("ALTER TABLE workspaces ADD COLUMN default_persona_id TEXT REFERENCES personas(id) ON DELETE SET NULL");
      console.log("✅ Migration: Added default_persona_id column to workspaces table");
    }
  } catch (e) {
    console.error("Migration error:", e);
  }

  // Initialize default user groups with permissions
  const defaultGroups = [
    {
      id: 'guest',
      name: 'Guest',
      color: '#6b7280',
      permissions: JSON.stringify({
        can_access_chat: true,
        can_create_chats: true,
        can_delete_chats: true,
        can_use_default_key: false,
        can_access_memories: false,
        can_access_image_gen: false,
        can_access_settings: false,
        can_access_admin: false,
        can_view_other_stats: false,
        can_edit_permissions: false,
        can_manage_users: false
      })
    },
    {
      id: 'user',
      name: 'User',
      color: '#3b82f6',
      permissions: JSON.stringify({
        can_access_chat: true,
        can_create_chats: true,
        can_delete_chats: true,
        can_use_default_key: true,
        can_access_memories: true,
        can_access_image_gen: true,
        can_access_settings: true,
        can_access_admin: false,
        can_view_other_stats: false,
        can_edit_permissions: false,
        can_manage_users: false
      })
    },
    {
      id: 'admin',
      name: 'Admin',
      color: '#a855f7',
      permissions: JSON.stringify({
        can_access_chat: true,
        can_create_chats: true,
        can_delete_chats: true,
        can_use_default_key: true,
        can_access_memories: true,
        can_access_image_gen: true,
        can_access_settings: true,
        can_access_admin: true,
        can_view_other_stats: true,
        can_edit_permissions: true,
        can_manage_users: true
      })
    }
  ];

  const insertGroup = db.prepare(`
    INSERT OR IGNORE INTO user_groups (id, name, color, permissions)
    VALUES (?, ?, ?, ?)
  `);
  for (const group of defaultGroups) {
    if (group.id === 'admin' && group.color === '#a855f7') {
      group.color = '#ef4444'; // Red-500 to match admin tag
    }
    insertGroup.run(group.id, group.name, group.color, group.permissions);
  }

  // Migration: Update admin group color to red (if it is still the old purple)
  try {
    db.prepare("UPDATE user_groups SET color = '#ef4444' WHERE id = 'admin' AND color = '#a855f7'").run();
    // Also strictly force it if it's not red? The user request implies it should be red.
    // Let's just force update it to ensure it matches the request.
    db.prepare("UPDATE user_groups SET color = '#ef4444' WHERE id = 'admin'").run();
    console.log("✅ Migration: Updated admin group color to red");
  } catch (e) {
    console.error("Migration error:", e);
  }

  // REMOVED: Automatic admin creation from environment variables
  // Master user must be created through the setup flow
  // Check if master user exists and log status
  const masterExists = db.prepare("SELECT id FROM users WHERE user_type = 'master' LIMIT 1").get();
  if (!masterExists) {
    console.log(`\n⚠️  No master user found. Please complete the setup flow to create a master user.\n`);
  }

  // Insert default tools
  const toolsExist = db.prepare("SELECT COUNT(*) as count FROM tools").get();
  if (toolsExist.count === 0) {
    const defaultTools = [
      {
        id: "web_search",
        name: "web_search",
        description: "Search the web for current information",
        parameters: JSON.stringify({
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query",
            },
          },
          required: ["query"],
        }),
      },
      {
        id: "calculator",
        name: "calculator",
        description: "Perform mathematical calculations",
        parameters: JSON.stringify({
          type: "object",
          properties: {
            expression: {
              type: "string",
              description: "The mathematical expression to evaluate",
            },
          },
          required: ["expression"],
        }),
      },
      {
        id: "code_interpreter",
        name: "code_interpreter",
        description: "Execute Python code and return the result",
        parameters: JSON.stringify({
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "The Python code to execute",
            },
          },
          required: ["code"],
        }),
      },
      {
        id: "web_fetch",
        name: "web_fetch",
        description: "Fetch and read the content of a specific web page URL",
        parameters: JSON.stringify({
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL of the web page to fetch",
            },
          },
          required: ["url"],
        }),
      },
      {
        id: "workspace_search",
        name: "workspace_search",
        description: "Search messages and chats within the current workspace. Returns relevant snippets with chat title, role, and timestamp. Use this to find previous conversations and context within the project.",
        parameters: JSON.stringify({
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query to find relevant messages",
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (default 10, max 20)",
            },
          },
          required: ["query"],
        }),
      },
      {
        id: "add_memory",
        name: "add_memory",
        description: "Store a memory about the user for future context. Use this when the user shares important personal information, preferences, facts, or context that would be useful to remember across conversations. Examples: user preferences, project details, personal facts, important dates, etc.",
        parameters: JSON.stringify({
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The content of the memory to store",
            },
            category: {
              type: "string",
              description: "Category for the memory (e.g., 'preference', 'fact', 'project', 'general'). Default is 'general'.",
            },
            importance: {
              type: "number",
              description: "Importance level 1-5 (1 = low, 5 = high). Default is 1.",
            },
          },
          required: ["content"],
        }),
      },
      {
        id: "read_memories",
        name: "read_memories",
        description: "Retrieve stored memories about the user. Use this to recall relevant context before answering questions or to provide personalized responses. Can filter by category or search for specific topics.",
        parameters: JSON.stringify({
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Filter by category (e.g., 'preference', 'fact', 'project'). If not provided, retrieves all memories.",
            },
            query: {
              type: "string",
              description: "Optional search query to filter memories by content relevance",
            },
            limit: {
              type: "number",
              description: "Maximum number of memories to return (default 10, max 50)",
            },
          },
          required: [],
        }),
      },
    ];

    const insertTool = db.prepare(`
      INSERT INTO tools (id, name, description, parameters)
      VALUES (?, ?, ?, ?)
    `);

    for (const tool of defaultTools) {
      insertTool.run(tool.id, tool.name, tool.description, tool.parameters);
    }
  }

  // Migration: Add missing tools (web_fetch, workspace_search) if they don't exist
  // This handles the case where the tools table exists (so the block above is skipped)
  // but new tools have been added to the application
  const searchTool = db.prepare("SELECT id FROM tools WHERE name = 'workspace_search'").get();
  if (!searchTool) {
    db.prepare(`
      INSERT INTO tools (id, name, description, parameters)
      VALUES (?, ?, ?, ?)
    `).run(
      "workspace_search",
      "workspace_search",
      "Search messages and chats using keywords. Supports prefix matches automatically. Returns relevant snippets with chat title and timestamp. Use this to find previous conversations.",
      JSON.stringify({
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to find relevant messages",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default 10, max 20)",
          },
        },
        required: ["query"],
      })
    );
    console.log("✅ Migration: Added workspace_search tool");
  }

  const fetchTool = db.prepare("SELECT id FROM tools WHERE name = 'web_fetch'").get();
  if (!fetchTool) {
    db.prepare(`
      INSERT INTO tools (id, name, description, parameters)
      VALUES (?, ?, ?, ?)
    `).run(
      "web_fetch",
      "web_fetch",
      "Fetch and read the content of a specific web page URL",
      JSON.stringify({
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL of the web page to fetch",
          },
        },
        required: ["url"],
      })
    );
    console.log("✅ Migration: Added web_fetch tool");
  }

  // Migration: Add memory tools if they don't exist
  const addMemoryTool = db.prepare("SELECT id FROM tools WHERE name = 'add_memory'").get();
  if (!addMemoryTool) {
    db.prepare(`
      INSERT INTO tools (id, name, description, parameters)
      VALUES (?, ?, ?, ?)
    `).run(
      "add_memory",
      "add_memory",
      "Store a memory about the user for future context. Use this when the user shares important personal information, preferences, facts, or context that would be useful to remember across conversations. Examples: user preferences, project details, personal facts, important dates, etc.",
      JSON.stringify({
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "The content of the memory to store",
          },
          category: {
            type: "string",
            description: "Category for the memory (e.g., 'preference', 'fact', 'project', 'general'). Default is 'general'.",
          },
          importance: {
            type: "number",
            description: "Importance level 1-5 (1 = low, 5 = high). Default is 1.",
          },
        },
        required: ["content"],
      })
    );
    console.log("✅ Migration: Added add_memory tool");
  }

  const readMemoriesTool = db.prepare("SELECT id FROM tools WHERE name = 'read_memories'").get();
  if (!readMemoriesTool) {
    db.prepare(`
      INSERT INTO tools (id, name, description, parameters)
      VALUES (?, ?, ?, ?)
    `).run(
      "read_memories",
      "read_memories",
      "Retrieve stored memories about the user. Use this to recall relevant context before answering questions or to provide personalized responses. Can filter by category or search for specific topics.",
      JSON.stringify({
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Filter by category (e.g., 'preference', 'fact', 'project'). If not provided, retrieves all memories.",
          },
          query: {
            type: "string",
            description: "Optional search query to filter memories by content relevance",
          },
          limit: {
            type: "number",
            description: "Maximum number of memories to return (default 10, max 50)",
          },
        },
        required: [],
      })
    );
    console.log("✅ Migration: Added read_memories tool");
  }

  // Insert default personas
  const defaultPersonas = [
    {
      id: "socratic-philosophy",
      name: "Socratic Philosophy Tutor",
      description: "Learn through questioning - never gives direct answers",
      system_prompt: "You are a Socratic philosophy tutor. Never give direct answers. Instead, guide the student to discover truths through careful questioning. Ask probing questions that challenge assumptions and lead to deeper understanding. Use the Socratic method: ask clarifying questions, examine definitions, explore implications, and help the student arrive at their own insights. Be patient, encouraging, and intellectually rigorous.",
      icon: "BookOpen",
      category: "education",
      creativity: "balanced",
      depth: "detailed",
      tone: "friendly"
    },
    {
      id: "socratic-code",
      name: "Socratic Programming Guide",
      description: "Learn programming through guided discovery and inquiry",
      system_prompt: "You are a Socratic programming tutor. Never give direct code solutions. Instead, guide students to discover programming concepts and solutions through carefully crafted questions. When they're stuck, ask questions that help them think through the logic: 'What is this code supposed to achieve?', 'What happens if we trace through this step by step?', or 'What patterns have you seen that might apply here?'. Help them break problems into smaller pieces, understand debugging as a detective process, and develop computational thinking. Ask about their thought process, what they've tried, and what they expect to happen. Build programming intuition through dialogue rather than answers.",
      icon: "Code",
      category: "development",
      creativity: "balanced",
      depth: "detailed",
      tone: "friendly"
    },
    {
      id: "code-mentor",
      name: "Patient Code Mentor",
      description: "Programming with clear explanations and patience",
      system_prompt: "You are a patient programming mentor. Explain coding concepts clearly without assuming prior knowledge. Use analogies to real-world concepts when helpful. When reviewing code, point out both strengths and areas for improvement. Provide working code examples with detailed comments. Anticipate common misconceptions and address them proactively. Be encouraging and supportive.",
      icon: "Code",
      category: "development",
      creativity: "precise",
      depth: "detailed",
      tone: "friendly"
    },
    {
      id: "creative-writing",
      name: "Creative Writing Partner",
      description: "Story and poetry collaboration",
      system_prompt: "You are a creative writing partner. Help with brainstorming, plot development, character creation, dialogue, and prose refinement. Offer constructive feedback that respects the author's voice. Suggest alternatives without being prescriptive. When asked to write, match the requested style and tone. Be inspiring and help overcome writer's block with creative prompts and exercises.",
      icon: "Feather",
      category: "creative",
      creativity: "imaginative",
      depth: "standard",
      tone: "enthusiastic"
    },
    {
      id: "devils-advocate",
      name: "Devil's Advocate",
      description: "Challenge and strengthen ideas",
      system_prompt: "You are a skilled devil's advocate. Your role is to strengthen ideas by challenging them rigorously but respectfully. Find weak points in arguments, suggest counterexamples, and push for deeper thinking. Play the opposing view convincingly without being dismissive. Help identify blind spots and assumptions. Your goal is to help refine ideas through constructive challenge, not to win debates.",
      icon: "Scale",
      category: "analytical",
      creativity: "balanced",
      depth: "detailed",
      tone: "professional"
    },
    {
      id: "eli5",
      name: "ELI5 Explainer",
      description: "Complex topics made simple",
      system_prompt: "You explain complex topics as if to a curious 5-year-old. Use simple words, relatable analogies, and everyday examples. Break down complicated ideas into their most basic components. Be enthusiastic and make learning fun. Avoid jargon entirely. If a concept requires prerequisite knowledge, explain that first. Check understanding by asking simple follow-up questions.",
      icon: "Lightbulb",
      category: "education",
      creativity: "imaginative",
      depth: "concise",
      tone: "friendly"
    },
    {
      id: "brainstorm",
      name: "Brainstorm Partner",
      description: "Idea generation without judgment",
      system_prompt: "You are an enthusiastic brainstorming partner. Generate ideas freely without judgment. Build on suggestions with 'Yes, and...' rather than 'No, but...'. Encourage wild ideas that can be refined later. Use techniques like mind mapping, random association, and perspective shifting. Help overcome creative blocks by approaching problems from unexpected angles. Quantity over quality initially - refinement comes later.",
      icon: "Sparkles",
      category: "creative",
      creativity: "imaginative",
      depth: "standard",
      tone: "enthusiastic"
    }
  ];

  // Remove deprecated personas that are no longer in defaultPersonas
  const deprecatedIds = ['socratic-math', 'socratic-science'];
  const removeDeprecated = db.prepare('DELETE FROM personas WHERE id = ? AND is_default = 1');
  for (const id of deprecatedIds) {
    removeDeprecated.run(id);
  }

  const insertPersona = db.prepare(`
    INSERT OR REPLACE INTO personas (id, name, description, system_prompt, icon, category, creativity, depth, tone, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  for (const persona of defaultPersonas) {
    insertPersona.run(persona.id, persona.name, persona.description, persona.system_prompt, persona.icon, persona.category, persona.creativity, persona.depth, persona.tone);
  }

  console.log("✅ Database initialized successfully");
}

initDatabase();

// Helper function to check if a master user exists
export function hasMasterUser() {
  const master = db.prepare("SELECT id FROM users WHERE user_type = 'master' LIMIT 1").get();
  return !!master;
}

export default db;
