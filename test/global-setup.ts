import './setup-env';
import { Client } from 'pg';

export default async function globalSetup(): Promise<void> {
  const database = process.env.DB_NAME ?? 'civicpulse_test';

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(database)) {
    throw new Error('DB_NAME must be a valid PostgreSQL identifier');
  }

  const client = new Client({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 55432),
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: 'postgres',
  });

  await client.connect();

  try {
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);

    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE "${database}"`);
    }
  } finally {
    await client.end();
  }
}
