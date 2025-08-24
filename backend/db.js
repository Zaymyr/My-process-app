const Database = require('better-sqlite3');
const db = new Database('../app.db'); // creates file if it doesn't exist

// Create a simple table if not exists
db.exec(`
CREATE TABLE IF NOT EXISTS processes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  content TEXT NOT NULL,     -- JSON as string
  updated_at TEXT NOT NULL
);
`);

module.exports = db;
