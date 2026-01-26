import db from './database.js';

console.log("Checking database integrity...");

// 1. Check foreign keys
try {
    const fk_violations = db.pragma('foreign_key_check');
    if (fk_violations.length > 0) {
        console.error("❌ Foreign Key Violations Found:", fk_violations.length);
        fk_violations.forEach(v => {
            console.log(`   Table: ${v.table}, RowID: ${v.rowid}, Parent: ${v.parent}, FKey: ${v.fkid}`);
        });
    } else {
        console.log("✅ No foreign key violations found.");
    }
} catch (e) {
    console.error("Error checking foreign keys:", e);
}

// 2. Check general integrity
try {
    const integrity = db.pragma('integrity_check');
    if (integrity.length === 1 && integrity[0].integrity_check === 'ok') {
        console.log("✅ Database integrity check passed.");
    } else {
        console.error("❌ Integrity check failed:", integrity);
    }
} catch (e) {
    console.error("Error checking integrity:", e);
}

// 3. List chats
try {
    const chats = db.prepare("SELECT id, title, created_at FROM chats ORDER BY created_at DESC LIMIT 5").all();
    console.log("\nRecent Chats:");
    chats.forEach(c => {
        console.log(`- ${c.title} (${c.id})`);
    });
} catch (e) {
    console.error("Error listing chats", e);
}
