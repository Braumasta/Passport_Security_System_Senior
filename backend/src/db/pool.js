import pg from 'pg';
import { env } from '../config/env.js';

const { Pool, types } = pg;

// Keep SQL DATE columns as date-only strings. Converting them to JS Date objects
// shifts values across timezones during JSON serialization.
types.setTypeParser(1082, (value) => value);

const shouldUseSsl =
  env.pgSslMode === 'require' || env.databaseUrl.includes('supabase.co');

if (!env.databaseUrl) {
  throw new Error('DATABASE_URL is required. Configure the Supabase Postgres connection in backend/.env');
}

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
});

export const query = (text, params = []) => pool.query(text, params);

export default pool;
