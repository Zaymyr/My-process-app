// migrate.js
import { existsSync, mkdirSync } from "node:fs";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

if (!existsSync("./data")) mkdirSync("./data", { recursive: true });

const DEMO_EMAIL = "demo@example.com";
const DEMO_HASH  = "$2b$10$Z5fH0b2S3g7nYQj4iT8GXeA7Wm9qO4C/1LJk8kRvKc9r5hT6e4mFO"; // "demo1234"

async function run() {
  const db = await open({ filename: "./data/app.sqlite", driver: sqlite3.Database });
  await db.exec("PRAGMA foreign_keys = ON");

  // 0) Ensure 'processes' table exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS processes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      content    TEXT    NOT NULL,        -- JSON string
      updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 1) Users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name          TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 2) Add processes.user_id if missing (for older schemas)
  const cols = await db.all(`PRAGMA table_info(processes)`);
  const hasUserId = cols.some(c => c.name === "user_id");
  if (!hasUserId) {
    await db.exec(`ALTER TABLE processes ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;`);
    console.log("Added processes.user_id");
  } else {
    console.log("processes.user_id already exists");
  }

  // 3) Seed demo user
  await db.run(
    `INSERT OR IGNORE INTO users (email, password_hash, name) VALUES (?, ?, ?)`,
    [DEMO_EMAIL, DEMO_HASH, "Demo"]
  );

  // 4) Attach existing processes to demo where user_id is NULL
  await db.run(
    `UPDATE processes
       SET user_id = (SELECT id FROM users WHERE email = ?)
     WHERE user_id IS NULL`,
    [DEMO_EMAIL]
  );

  console.log("Migration done ✅");
  await db.close();
}

run().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
