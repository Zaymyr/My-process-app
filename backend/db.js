// db.js (ESM)
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export const dbp = open({
  filename: process.env.DB_FILE || './data/app.sqlite',
  driver: sqlite3.Database,
});
