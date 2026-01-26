import db from './database.js';

console.log("Repairing database...");

try {
    console.log("Dropping FTS tables...");
    db.prepare("DROP TABLE IF EXISTS messages_fts").run();
    db.prepare("DROP TABLE IF EXISTS chats_fts").run();
    console.log("✅ Dropped FTS tables.");

    // Triggers usually get dropped with the table they are on, but FTS triggers are on 'messages' table.
    // We should recreate triggers just in case, but initDatabase does that with CREATE TRIGGER IF NOT EXISTS.
    // Best to drop triggers too to ensure fresh start.

    console.log("Dropping FTS triggers...");
    db.prepare("DROP TRIGGER IF EXISTS messages_fts_insert").run();
    db.prepare("DROP TRIGGER IF EXISTS messages_fts_delete").run();
    db.prepare("DROP TRIGGER IF EXISTS messages_fts_update").run();

    db.prepare("DROP TRIGGER IF EXISTS chats_fts_insert").run();
    db.prepare("DROP TRIGGER IF EXISTS chats_fts_delete").run();
    db.prepare("DROP TRIGGER IF EXISTS chats_fts_update").run();
    console.log("✅ Dropped FTS triggers.");

    console.log("Re-initializing database (this will recreate tables/triggers and populate FTS)...");
    // We need to re-run the init part. Since we imported db, it already ran once (and failed/skipped).
    // We can't easily re-run the module body. 
    // But we can copy the specific FTS creation/population logic here or restart the server.
    // For this script, let's manually run the FTS creation part to ensure it works.

    // 1. Create FTS tables matches database.js
    db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      content,
      chat_id UNINDEXED,
      message_id UNINDEXED,
      content='messages',
      content_rowid='rowid'
    )
  `);

    db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chats_fts USING fts5(
      title,
      chat_id UNINDEXED,
      content='chats',
      content_rowid='rowid'
    )
  `);

    // 2. Create triggers
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

    // 3. Populate
    console.log("Populating FTS tables...");
    db.exec(`
    INSERT INTO messages_fts(rowid, content, chat_id, message_id)
    SELECT rowid, content, chat_id, id FROM messages
  `);

    db.exec(`
    INSERT INTO chats_fts(rowid, title, chat_id)
    SELECT rowid, title, id FROM chats
  `);

    console.log("✅ Repair complete.");

} catch (e) {
    console.error("❌ Repair failed:", e);
}
