const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// List processes
app.get('/api/process', (req, res) => {
  const rows = db.prepare('SELECT id, name, content, updated_at FROM processes ORDER BY id DESC').all();
  res.json(rows.map(r => ({ ...r, content: JSON.parse(r.content) })));
});

// Get one
app.get('/api/process/:id', (req, res) => {
  const row = db.prepare('SELECT id, name, content, updated_at FROM processes WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ ok:false, error:'Not found' });
  row.content = JSON.parse(row.content);
  res.json(row);
});

// Create
app.post('/api/process', (req, res) => {
  const { name, content } = req.body;
  const now = new Date().toISOString();
  const info = db.prepare('INSERT INTO processes (name, content, updated_at) VALUES (?, ?, ?)').run(name, JSON.stringify(content), now);
  const row = db.prepare('SELECT id, name, content, updated_at FROM processes WHERE id = ?').get(info.lastInsertRowid);
  row.content = JSON.parse(row.content);
  res.json(row);
});

// Update
app.put('/api/process/:id', (req, res) => {
  const { name, content } = req.body;
  const now = new Date().toISOString();
  const info = db.prepare('UPDATE processes SET name = ?, content = ?, updated_at = ? WHERE id = ?')
                 .run(name, JSON.stringify(content), now, req.params.id);
  if (info.changes === 0) return res.status(404).json({ ok:false, error:'Not found' });
  const row = db.prepare('SELECT id, name, content, updated_at FROM processes WHERE id = ?').get(req.params.id);
  row.content = JSON.parse(row.content);
  res.json(row);
});

// Delete
app.delete('/api/process/:id', (req, res) => {
  db.prepare('DELETE FROM processes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
