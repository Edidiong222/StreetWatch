import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';

function parseBoolean(value: string | undefined): boolean {
  return value === 'true';
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'civicpulse',
  entities: [User],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
  synchronize: false,
  logging: parseBoolean(process.env.DB_LOGGING),
  ssl: parseBoolean(process.env.DB_SSL) ? { rejectUnauthorized: false } : false,
});
