import db from './database.js';

console.log("Checking messages_fts schema...");
try {
    const info = db.pragma("table_info(messages_fts)");
    console.log(JSON.stringify(info, null, 2));
} catch (e) {
    console.error("Error checking schema:", e);
}

console.log("\nChecking chats_fts schema...");
try {
    const info = db.pragma("table_info(chats_fts)");
    console.log(JSON.stringify(info, null, 2));
} catch (e) {
    console.error("Error checking schema:", e);
}
