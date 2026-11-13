import 'reflect-metadata';

process.env.NODE_ENV = 'test';
process.env.PORT ??= '3001';
process.env.DB_HOST ??= '127.0.0.1';
process.env.DB_PORT ??= '55432';
process.env.DB_USERNAME ??= 'postgres';
process.env.DB_PASSWORD ??= '';
process.env.DB_NAME ??= 'civicpulse_test';
process.env.DB_SSL ??= 'false';
process.env.JWT_SECRET ??= 'test-only-jwt-secret-with-at-least-32-characters';
process.env.JWT_EXPIRES_IN ??= '1h';
process.env.CORS_ORIGIN ??= 'http://localhost:3000';

delete process.env.CLOUDINARY_CLOUD_NAME;
delete process.env.CLOUDINARY_API_KEY;
delete process.env.CLOUDINARY_API_SECRET;
process.env.CLOUDINARY_FOLDER ??= 'streetwatch/test';
