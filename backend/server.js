// server.js (ESM)
import express from "express";
import session from "express-session";
import connectSqlite3 from "connect-sqlite3";
import bcrypt from "bcrypt";
import cors from "cors";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const isCodespaces = !!process.env.CODESPACE_NAME;
const PORT = process.env.PORT || 3000;

/* -------------------- CORS -------------------- */
const CS_5173 = isCodespaces
  ? `https://${process.env.CODESPACE_NAME}-5173.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
  : null;

function isAllowedOrigin(origin) {
  if (!origin) return true; // curl/Postman
  if (origin === "http://localhost:5173") return true;
  if (origin === "http://127.0.0.1:5173") return true;
  if (CS_5173 && origin === CS_5173) return true;
  // Allow same codespace domain (5173/3000 ports)
  if (
    isCodespaces &&
    origin.endsWith(`.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`) &&
    origin.startsWith(`https://${process.env.CODESPACE_NAME}-`)
  ) {
    return true;
  }
  return false;
}

const corsOptions = {
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
  credentials: true,
};

const app = express();
app.use(express.json());
app.use(cors(corsOptions));

// Preflight responder (avoid path-to-regexp issues)
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    const origin = req.headers.origin || "";
    if (isAllowedOrigin(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE");
      res.header(
        "Access-Control-Allow-Headers",
        req.headers["access-control-request-headers"] || "Content-Type"
      );
    }
    return res.sendStatus(204);
  }
  next();
});

/* -------------------- Sessions -------------------- */
const SQLiteStore = connectSqlite3(session);
app.set("trust proxy", 1);
app.use(
  session({
    store: new SQLiteStore({ db: "sessions.sqlite", dir: "./data" }),
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    name: "sid",
    cookie: {
      httpOnly: true,
      sameSite: isCodespaces ? "none" : "lax",
      secure: isCodespaces, // true on Codespaces (HTTPS)
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

/* -------------------- DB -------------------- */
const dbp = open({
  filename: "./data/app.sqlite",
  driver: sqlite3.Database,
});

// --- put this near your other DB code ---
async function initDb() {
  const db = await dbp;
  await db.exec(`PRAGMA foreign_keys = ON;`);

  // 1) Ensure users table exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name          TEXT,
      created_at    TEXT
    );
  `);

  // 2) Ensure processes table exists (no function defaults!)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS processes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT NOT NULL DEFAULT '',
      content    TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  // 3) Safe migrations for older DBs
  const cols = await db.all(`PRAGMA table_info(processes)`);
  const has = (name) => cols.some(c => c.name === name);

  if (!has("created_at")) {
    console.log("[migrate] Adding processes.created_at …");
    await db.exec(`ALTER TABLE processes ADD COLUMN created_at TEXT;`);        // no default
    await db.exec(`UPDATE processes SET created_at = datetime('now') WHERE created_at IS NULL;`);
  }
  if (!has("updated_at")) {
    console.log("[migrate] Adding processes.updated_at …");
    await db.exec(`ALTER TABLE processes ADD COLUMN updated_at TEXT;`);        // no default
    await db.exec(`UPDATE processes SET updated_at = datetime('now') WHERE updated_at IS NULL;`);
  }
  if (!has("user_id")) {
    console.log("[migrate] Adding processes.user_id …");
    await db.exec(`ALTER TABLE processes ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;`);
    // Optionally attach existing rows to a user here
  }

  // 4) Keep timestamps correct via triggers (idempotent)
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_processes_insert_ts
    AFTER INSERT ON processes
    BEGIN
      UPDATE processes
         SET created_at = COALESCE(NEW.created_at, datetime('now')),
             updated_at = COALESCE(NEW.updated_at, datetime('now'))
       WHERE id = NEW.id;
    END;
  `);

  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_processes_touch
    AFTER UPDATE ON processes
    BEGIN
      UPDATE processes
         SET updated_at = datetime('now')
       WHERE id = NEW.id;
    END;
  `);

  // (Optional) do the same insert trigger for users
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_users_insert_ts
    AFTER INSERT ON users
    BEGIN
      UPDATE users
         SET created_at = COALESCE(NEW.created_at, datetime('now'))
       WHERE id = NEW.id;
    END;
  `);
}



/* -------------------- Auth helpers -------------------- */
async function getUserByEmail(email) {
  const db = await dbp;
  return db.get("SELECT * FROM users WHERE email = ?", [email]);
}
async function getUserById(id) {
  const db = await dbp;
  return db.get(
    "SELECT id, email, name, created_at FROM users WHERE id = ?",
    [id]
  );
}
async function createUser({ email, password, name }) {
  const db = await dbp;
  const hash = await bcrypt.hash(password, 10);
  const res = await db.run(
    "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
    [email, hash, name || null]
  );
  return getUserById(res.lastID);
}

/* -------------------- Auth routes -------------------- */
app.post("/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "email and password required" });
    if (await getUserByEmail(email))
      return res.status(409).json({ error: "email already in use" });
    const user = await createUser({ email, password, name });
    req.session.userId = user.id;
    res.json({ user });
  } catch (e) {
    console.error("register failed:", e);
    res.status(500).json({ error: "register failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "email and password required" });
    const u = await getUserByEmail(email);
    if (!u) return res.status(401).json({ error: "invalid credentials" });
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });
    req.session.userId = u.id;
    res.json({ user: await getUserById(u.id) });
  } catch (e) {
    console.error("login failed:", e);
    res.status(500).json({ error: "login failed" });
  }
});

app.post("/auth/logout", (req, res) =>
  req.session.destroy(() => res.json({ ok: true }))
);
app.get("/auth/me", async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "not authenticated" });
  res.json({ user: await getUserById(req.session.userId) });
});

/* -------------------- Guard -------------------- */
function requireAuth(req, res, next) {
  if (!req.session.userId)
    return res.status(401).json({ error: "not authenticated" });
  next();
}

/* -------------------- Processes CRUD -------------------- */
// List
app.get("/api/process", requireAuth, async (req, res) => {
  try {
    const db = await dbp;
    const rows = await db.all(
      `SELECT id, name, content, created_at, updated_at
         FROM processes
        WHERE user_id = ?
        ORDER BY updated_at DESC`,
      [req.session.userId]
    );
    res.json(
      rows.map((r) => ({
        ...r,
        content: JSON.parse(r.content),
      }))
    );
  } catch (e) {
    console.error("GET /api/process error:", e);
    res.status(500).json({ error: "list failed" });
  }
});

// Read one
app.get("/api/process/:id", requireAuth, async (req, res) => {
  try {
    const db = await dbp;
    const row = await db.get(
      `SELECT id, name, content, created_at, updated_at
         FROM processes
        WHERE id = ? AND user_id = ?`,
      [req.params.id, req.session.userId]
    );
    if (!row) return res.status(404).json({ error: "not found" });
    row.content = JSON.parse(row.content);
    res.json(row);
  } catch (e) {
    console.error("GET /api/process/:id error:", e);
    res.status(500).json({ error: "read failed" });
  }
});

// Create
app.post("/api/process", requireAuth, async (req, res) => {
  try {
    const { name = "", content } = req.body || {};
    if (typeof content !== "object")
      return res.status(400).json({ error: "content must be an object" });

    const db = await dbp;
    const result = await db.run(
      `INSERT INTO processes (user_id, name, content)
       VALUES (?, ?, ?)`,
      [req.session.userId, String(name || ""), JSON.stringify(content)]
    );
    const row = await db.get(
      `SELECT id, name, content, created_at, updated_at
         FROM processes
        WHERE id = ?`,
      [result.lastID]
    );
    row.content = JSON.parse(row.content);
    res.status(201).json(row);
  } catch (e) {
    console.error("POST /api/process error:", e);
    res.status(500).json({ error: "create failed" });
  }
});

// Update
app.put("/api/process/:id", requireAuth, async (req, res) => {
  try {
    const { name = "", content } = req.body || {};
    if (typeof content !== "object")
      return res.status(400).json({ error: "content must be an object" });

    const db = await dbp;
    const result = await db.run(
      `UPDATE processes
          SET name = ?, content = ?, updated_at = datetime('now')
        WHERE id = ? AND user_id = ?`,
      [String(name || ""), JSON.stringify(content), req.params.id, req.session.userId]
    );
    if (result.changes === 0) return res.status(404).json({ error: "not found" });

    const row = await db.get(
      `SELECT id, name, content, created_at, updated_at
         FROM processes
        WHERE id = ?`,
      [req.params.id]
    );
    row.content = JSON.parse(row.content);
    res.json(row);
  } catch (e) {
    console.error("PUT /api/process/:id error:", e);
    res.status(500).json({ error: "update failed" });
  }
});

// Delete
app.delete("/api/process/:id", requireAuth, async (req, res) => {
  try {
    const db = await dbp;
    const result = await db.run(
      `DELETE FROM processes WHERE id = ? AND user_id = ?`,
      [req.params.id, req.session.userId]
    );
    if (result.changes === 0) return res.status(404).json({ error: "not found" });
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/process/:id error:", e);
    res.status(500).json({ error: "delete failed" });
  }
});

/* -------------------- Boot -------------------- */
(async () => {
  // ensure ./data exists
  import('fs').then(({ default: fs }) => {
    try { fs.mkdirSync("./data", { recursive: true }); } catch {}
  });
  const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
  })
  .catch((e) => {
    console.error("DB init failed:", e);
    process.exit(1);
  });

})();
