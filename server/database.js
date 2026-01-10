import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DB_PATH || join(__dirname, '../data/database.db');
const dbDir = dirname(dbPath);

if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

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

  // Migration: Add reasoning_content to messages if it doesn't exist
  const tableInfo = db.prepare("PRAGMA table_info(messages)").all();
  const hasReasoning = tableInfo.some(col => col.name === 'reasoning_content');
  if (!hasReasoning) {
    try {
      db.exec("ALTER TABLE messages ADD COLUMN reasoning_content TEXT");
      console.log('✅ Migration: Added reasoning_content to messages table');
    } catch (e) {
      console.error('Migration error:', e);
    }
  }

  // Create default admin user if not exists
  const adminExists = db.prepare('SELECT id FROM users WHERE is_admin = 1').get();
  if (!adminExists) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    
    db.prepare(`
      INSERT INTO users (email, password, name, is_admin)
      VALUES (?, ?, ?, 1)
    `).run(adminEmail, hashedPassword, 'Admin');

    console.log(`\n✅ Default admin created:`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   ⚠️  Please change the password after first login!\n`);
  }

  // Insert default tools
  const toolsExist = db.prepare('SELECT COUNT(*) as count FROM tools').get();
  if (toolsExist.count === 0) {
    const defaultTools = [
      {
        id: 'web_search',
        name: 'web_search',
        description: 'Search the web for current information',
        parameters: JSON.stringify({
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query'
            }
          },
          required: ['query']
        })
      },
      {
        id: 'calculator',
        name: 'calculator',
        description: 'Perform mathematical calculations',
        parameters: JSON.stringify({
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'The mathematical expression to evaluate'
            }
          },
          required: ['expression']
        })
      },
      {
        id: 'code_interpreter',
        name: 'code_interpreter',
        description: 'Execute Python code and return the result',
        parameters: JSON.stringify({
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'The Python code to execute'
            }
          },
          required: ['code']
        })
      }
    ];

    const insertTool = db.prepare(`
      INSERT INTO tools (id, name, description, parameters)
      VALUES (?, ?, ?, ?)
    `);

    for (const tool of defaultTools) {
      insertTool.run(tool.id, tool.name, tool.description, tool.parameters);
    }
  }

  console.log('✅ Database initialized successfully');
}

initDatabase();

export default db;
