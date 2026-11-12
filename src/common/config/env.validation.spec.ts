import { validateEnv } from './env.validation';

const validEnvironment = {
  NODE_ENV: 'test',
  PORT: '3001',
  DB_HOST: '127.0.0.1',
  DB_PORT: '5432',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: '',
  DB_NAME: 'civicpulse_test',
  DB_SSL: 'false',
  JWT_SECRET: 'a-secret-that-is-longer-than-thirty-two-characters',
  JWT_EXPIRES_IN: '1h',
  CORS_ORIGIN: 'http://localhost:3000',
};

describe('validateEnv', () => {
  it('accepts a valid environment', () => {
    const result = validateEnv(validEnvironment);

    expect(result.JWT_SECRET).toBe(validEnvironment.JWT_SECRET);
    expect(result.DB_PORT).toBe(5432);
    expect(result.DB_SSL).toBe(false);
  });

  it('rejects a missing or short JWT secret', () => {
    expect(() => validateEnv({ ...validEnvironment, JWT_SECRET: 'too-short' })).toThrow(
      /JWT_SECRET/,
    );

    const withoutSecret = { ...validEnvironment } as Record<string, unknown>;
    delete withoutSecret.JWT_SECRET;

    expect(() => validateEnv(withoutSecret)).toThrow(/JWT_SECRET/);
  });

  it('rejects an invalid JWT expiry format', () => {
    expect(() =>
      validateEnv({ ...validEnvironment, JWT_EXPIRES_IN: 'forever' }),
    ).toThrow(/JWT_EXPIRES_IN/);
  });
});
