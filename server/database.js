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
      openai_api_key TEXT,
      use_default_key INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Settings table (for default keys and system settings)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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

  // Migration: Populate FTS indexes for existing data
  try {
    const messagesFtsCount = db.prepare("SELECT COUNT(*) as count FROM messages_fts").get();
    const messagesCount = db.prepare("SELECT COUNT(*) as count FROM messages").get();

    if (messagesFtsCount.count === 0 && messagesCount.count > 0) {
      db.exec(`
        INSERT INTO messages_fts(rowid, content, chat_id, message_id)
        SELECT rowid, content, chat_id, id FROM messages
      `);
      console.log("✅ Migration: Populated messages_fts with existing data");
    }

    const chatsFtsCount = db.prepare("SELECT COUNT(*) as count FROM chats_fts").get();
    const chatsCount = db.prepare("SELECT COUNT(*) as count FROM chats").get();

    if (chatsFtsCount.count === 0 && chatsCount.count > 0) {
      db.exec(`
        INSERT INTO chats_fts(rowid, title, chat_id)
        SELECT rowid, title, id FROM chats
      `);
      console.log("✅ Migration: Populated chats_fts with existing data");
    }
  } catch (e) {
    // FTS tables might not exist yet on first run, ignore
    console.log("FTS migration note:", e.message);
  }

  // Create default admin user if not exists
  const adminExists = db
    .prepare("SELECT id FROM users WHERE is_admin = 1")
    .get();
  if (!adminExists) {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);

    db.prepare(
      `
      INSERT INTO users (email, password, name, is_admin)
      VALUES (?, ?, ?, 1)
    `,
    ).run(adminEmail, hashedPassword, "Admin");

    console.log(`\n✅ Default admin created:`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   ⚠️  Please change the password after first login!\n`);
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
    ];

    const insertTool = db.prepare(`
      INSERT INTO tools (id, name, description, parameters)
      VALUES (?, ?, ?, ?)
    `);

    for (const tool of defaultTools) {
      insertTool.run(tool.id, tool.name, tool.description, tool.parameters);
    }
  }

  console.log("✅ Database initialized successfully");
}

initDatabase();

export default db;
