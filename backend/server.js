// server.js  (ESM)
import express from "express";
import session from "express-session";
import connectSqlite3 from "connect-sqlite3";
import bcrypt from "bcrypt";
import cors from "cors";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { existsSync, mkdirSync } from "node:fs";

if (!existsSync("./data")) mkdirSync("./data", { recursive: true });

const app = express();
app.use(express.json());

// ---------- CORS (Vite on 5173) ----------
const allowed = ["http://localhost:5173", "http://127.0.0.1:5173"];

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);   // allow curl/postman
    cb(null, allowed.includes(origin));   // reflect exact whitelisted origin
  },
  credentials: true,                      // Access-Control-Allow-Credentials: true
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],       // add "Authorization" if you use it
};

app.use(cors(corsOptions));               // ✅ one CORS middleware only
// ❌ REMOVE any app.options(...) lines

// ---------- SQLite ----------
const dbp = open({ filename: "./data/app.sqlite", driver: sqlite3.Database });

// ---------- Sessions ----------
const SQLiteStore = connectSqlite3(session);
app.use(
  session({
    store: new SQLiteStore({ db: "sessions.sqlite", dir: "./data" }),
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    name: "sid",
    cookie: {
      httpOnly: true,
      sameSite: "lax",      // ok on localhost even across ports
      secure: false,        // set true behind HTTPS in prod
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

// ---------- Auth helpers ----------
async function getUserByEmail(email) {
  const db = await dbp;
  return db.get("SELECT * FROM users WHERE email = ?", [email]);
}
async function getUserById(id) {
  const db = await dbp;
  return db.get("SELECT id, email, name, created_at FROM users WHERE id = ?", [id]);
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

// ---------- Auth routes ----------
app.post("/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    if (await getUserByEmail(email)) return res.status(409).json({ error: "email already in use" });
    const user = await createUser({ email, password, name });
    req.session.userId = user.id;
    res.json({ user });
  } catch (e) { console.error(e); res.status(500).json({ error: "register failed" }); }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    const u = await getUserByEmail(email);
    if (!u) return res.status(401).json({ error: "invalid credentials" });
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });
    req.session.userId = u.id;
    res.json({ user: await getUserById(u.id) });
  } catch (e) { console.error(e); res.status(500).json({ error: "login failed" }); }
});

app.post("/auth/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get("/auth/me", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "not authenticated" });
  res.json({ user: await getUserById(req.session.userId) });
});

// ---------- Guard ----------
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "not authenticated" });
  next();
}

// ---------- Processes (example GET; add POST/PUT/DELETE similarly) ----------
app.get("/api/process", requireAuth, async (req, res) => {
  const db = await dbp;
  const rows = await db.all(
    "SELECT id, name, content, updated_at FROM processes WHERE user_id = ? ORDER BY updated_at DESC",
    [req.session.userId]
  );
  res.json(rows.map(r => ({ ...r, content: JSON.parse(r.content) })));
});

// TODO: add your POST/PUT/DELETE endpoints here in the same style

app.listen(3000, () => console.log("API on http://localhost:3000"));
// --- more process routes (place below the existing GET /api/process) ---

app.get("/api/process/:id", requireAuth, async (req, res) => {
  const db = await dbp;
  const row = await db.get(
    "SELECT id, name, content, updated_at FROM processes WHERE id = ? AND user_id = ?",
    [req.params.id, req.session.userId]
  );
  if (!row) return res.status(404).json({ error: "not found" });
  res.json({ ...row, content: JSON.parse(row.content) });
});

app.post("/api/process", requireAuth, async (req, res) => {
  const db = await dbp;
  const { name, content } = req.body || {};
  const result = await db.run(
    "INSERT INTO processes (name, content, user_id, updated_at) VALUES (?, ?, ?, datetime('now'))",
    [name || "Untitled", JSON.stringify(content || {}), req.session.userId]
  );
  const row = await db.get(
    "SELECT id, name, content, updated_at FROM processes WHERE id = ?",
    [result.lastID]
  );
  res.json({ ...row, content: JSON.parse(row.content) });
});

app.put("/api/process/:id", requireAuth, async (req, res) => {
  const db = await dbp;
  const { name, content } = req.body || {};
  const { changes } = await db.run(
    "UPDATE processes SET name=?, content=?, updated_at=datetime('now') WHERE id=? AND user_id=?",
    [name || "Untitled", JSON.stringify(content || {}), req.params.id, req.session.userId]
  );
  if (!changes) return res.status(404).json({ error: "not found" });
  const row = await db.get(
    "SELECT id, name, content, updated_at FROM processes WHERE id=? AND user_id=?",
    [req.params.id, req.session.userId]
  );
  res.json({ ...row, content: JSON.parse(row.content) });
});

app.delete("/api/process/:id", requireAuth, async (req, res) => {
  const db = await dbp;
  const { changes } = await db.run(
    "DELETE FROM processes WHERE id=? AND user_id=?",
    [req.params.id, req.session.userId]
  );
  if (!changes) return res.status(404).json({ error: "not found" });
  res.json({ ok: true });
});
