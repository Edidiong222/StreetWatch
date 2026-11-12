import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.config';
import { UserRole } from '../src/common/enums/user-role.enum';
import { User } from '../src/users/entities/user.entity';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let usersRepository: Repository<User>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    dataSource = app.get(DataSource);
    await dataSource.query('DROP SCHEMA IF EXISTS public CASCADE');
    await dataSource.query('CREATE SCHEMA public');
    await dataSource.runMigrations();

    usersRepository = dataSource.getRepository(User);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "users" RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  const registerCitizen = (overrides: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'citizen@example.com',
        password: 'Password123',
        fullName: 'Test Citizen',
        ...overrides,
      });

  const createUserWithRole = async (role: UserRole, email: string) => {
    const passwordHash = await argon2.hash('Password123');
    const user = usersRepository.create({
      email,
      passwordHash,
      fullName: `${role} User`,
      role,
    });

    return usersRepository.save(user);
  };

  it('registers a citizen and returns a safe user payload', async () => {
    const response = await registerCitizen().expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.tokenType).toBe('Bearer');
    expect(response.body.user).toMatchObject({
      email: 'citizen@example.com',
      fullName: 'Test Citizen',
      role: UserRole.CITIZEN,
      isActive: true,
    });
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body.user).not.toHaveProperty('password');
  });

  it('prevents duplicate email registration regardless of case', async () => {
    await registerCitizen().expect(201);

    const response = await registerCitizen({
      email: 'CITIZEN@EXAMPLE.COM',
    }).expect(409);

    expect(response.body.message).toBe('An account with this email already exists');
  });

  it('rejects attempts to assign a role during registration', async () => {
    const response = await registerCitizen({ role: UserRole.ADMIN }).expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('role')]),
    );
    await expect(usersRepository.count()).resolves.toBe(0);
  });

  it('logs in with valid credentials and rejects invalid credentials', async () => {
    await registerCitizen().expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'citizen@example.com', password: 'Password123' })
      .expect(200);

    expect(loginResponse.body.user.email).toBe('citizen@example.com');
    expect(loginResponse.body.user).not.toHaveProperty('passwordHash');

    const invalidPasswordResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'citizen@example.com', password: 'WrongPassword123' })
      .expect(401);

    expect(invalidPasswordResponse.body.message).toBe('Invalid email or password');

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'unknown@example.com', password: 'Password123' })
      .expect(401);
  });

  it('protects the profile endpoint', async () => {
    await request(app.getHttpServer()).get('/api/users/me').expect(401);

    const registerResponse = await registerCitizen().expect(201);
    const token = registerResponse.body.accessToken as string;

    const profileResponse = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profileResponse.body.email).toBe('citizen@example.com');
    expect(profileResponse.body).not.toHaveProperty('passwordHash');
  });

  it('allows only administrators to list users', async () => {
    const citizenResponse = await registerCitizen().expect(201);
    const citizenToken = citizenResponse.body.accessToken as string;

    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${citizenToken}`)
      .expect(403);

    await createUserWithRole(UserRole.ADMIN, 'admin@example.com');

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'Password123' })
      .expect(200);

    const listResponse = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(listResponse.body).toHaveLength(2);
    expect(listResponse.body[0]).not.toHaveProperty('passwordHash');
    expect(listResponse.body[0]).not.toHaveProperty('password');
  });

  it('allows super administrators to list users', async () => {
    await createUserWithRole(UserRole.SUPER_ADMIN, 'superadmin@example.com');

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'superadmin@example.com', password: 'Password123' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .expect(200);
  });

  it('enforces the unique email constraint at the database level', async () => {
    const passwordHash = await argon2.hash('Password123');
    const user = usersRepository.create({
      email: 'unique@example.com',
      passwordHash,
      fullName: 'Unique User',
    });

    await usersRepository.save(user);

    const duplicate = usersRepository.create({
      email: 'unique@example.com',
      passwordHash,
      fullName: 'Duplicate User',
    });

    await expect(usersRepository.save(duplicate)).rejects.toMatchObject({
      driverError: { code: '23505' },
    });
  });

  it('validates registration input', async () => {
    await registerCitizen({ email: 'not-an-email', password: 'short' }).expect(400);
  });
});
