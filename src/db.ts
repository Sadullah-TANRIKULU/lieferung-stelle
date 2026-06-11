import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Der Pool verwaltet mehrere Verbindungen zur Datenbank automatisch
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};
