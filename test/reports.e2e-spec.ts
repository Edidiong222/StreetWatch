import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.config';
import { UserRole } from '../src/common/enums/user-role.enum';
import { ReportStatus } from '../src/common/enums/report-status.enum';
import { Category } from '../src/categories/entities/category.entity';
import { ReportImage } from '../src/reports/entities/report-image.entity';
import { Report } from '../src/reports/entities/report.entity';
import { User } from '../src/users/entities/user.entity';
import { ReportVerification } from '../src/verification/entities/report-verification.entity';

describe('Reports and community verification (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let usersRepository: Repository<User>;
  let reportsRepository: Repository<Report>;
  let imagesRepository: Repository<ReportImage>;
  let verificationsRepository: Repository<ReportVerification>;
  let categoriesRepository: Repository<Category>;
  let roadsCategoryId: string;
  let waterCategoryId: string;

  const validPng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);

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
    reportsRepository = dataSource.getRepository(Report);
    imagesRepository = dataSource.getRepository(ReportImage);
    verificationsRepository = dataSource.getRepository(ReportVerification);
    categoriesRepository = dataSource.getRepository(Category);

    const roads = await categoriesRepository.findOneOrFail({
      where: { slug: 'roads-transport' },
    });
    const water = await categoriesRepository.findOneOrFail({
      where: { slug: 'water-supply' },
    });
    roadsCategoryId = roads.id;
    waterCategoryId = water.id;
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "report_verifications", "report_images", "reports", "users" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const registerCitizen = async (
    email = 'citizen@example.com',
  ): Promise<{ token: string; userId: string }> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: 'Password123',
        fullName: 'Test Citizen',
      })
      .expect(201);

    return {
      token: response.body.accessToken as string,
      userId: response.body.user.id as string,
    };
  };

  const createUserWithRole = async (
    role: UserRole,
    email: string,
  ): Promise<User> => {
    const passwordHash = await argon2.hash('Password123');
    const user = usersRepository.create({
      email,
      passwordHash,
      fullName: `${role} User`,
      role,
    });

    return usersRepository.save(user);
  };

  const login = async (email: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'Password123' })
      .expect(200);

    return response.body.accessToken as string;
  };

  const createAdminToken = async (): Promise<string> => {
    await createUserWithRole(UserRole.ADMIN, 'admin@example.com');
    return login('admin@example.com');
  };

  const reportPayload = (overrides: Record<string, unknown> = {}) => ({
    title: 'Large pothole on Main Street',
    description:
      'A deep pothole is causing damage to vehicles near the main junction.',
    categoryId: roadsCategoryId,
    location: 'Main Street junction',
    latitude: 6.5244,
    longitude: 3.3792,
    ...overrides,
  });

  const createReport = async (
    token: string,
    overrides: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> => {
    const response = await request(app.getHttpServer())
      .post('/api/reports')
      .set('Authorization', `Bearer ${token}`)
      .send(reportPayload(overrides))
      .expect(201);

    return response.body as Record<string, unknown>;
  };

  const setStatus = async (
    token: string,
    reportId: string,
    status: ReportStatus,
  ): Promise<Record<string, unknown>> => {
    const response = await request(app.getHttpServer())
      .patch(`/api/reports/${reportId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status })
      .expect(200);

    return response.body as Record<string, unknown>;
  };

  describe('report creation', () => {
    it('requires authentication and creates a pending report', async () => {
      await request(app.getHttpServer())
        .post('/api/reports')
        .send(reportPayload())
        .expect(401);

      const { token, userId } = await registerCitizen();
      const response = await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(reportPayload())
        .expect(201);

      expect(response.body).toMatchObject({
        title: 'Large pothole on Main Street',
        status: ReportStatus.PENDING_REVIEW,
        verificationCount: 0,
        location: 'Main Street junction',
        latitude: 6.5244,
        longitude: 3.3792,
        images: [],
        category: {
          id: roadsCategoryId,
          slug: 'roads-transport',
        },
        creator: { id: userId },
      });
      expect(response.body).not.toHaveProperty('creatorId');
    });

    it('rejects invalid categories and invalid payloads', async () => {
      const { token } = await registerCitizen();

      await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(
          reportPayload({
            categoryId: '5b6b2d9a-1e2f-4a3b-8c7d-9e0f1a2b3c4d',
          }),
        )
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(reportPayload({ description: 'too short' }))
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(reportPayload({ latitude: 6.5, longitude: undefined }))
        .expect(400);
    });

    it('rejects duplicate recent submissions from the same user', async () => {
      const { token } = await registerCitizen();

      await createReport(token);

      const response = await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(reportPayload())
        .expect(409);

      expect(response.body.message).toContain('similar report');
    });
  });

  describe('report retrieval', () => {
    it('hides pending reports from the public but shows approved reports', async () => {
      const { token } = await registerCitizen();
      const report = await createReport(token);
      const reportId = report.id as string;

      await request(app.getHttpServer())
        .get(`/api/reports/${reportId}`)
        .expect(404);

      const mine = await request(app.getHttpServer())
        .get('/api/reports/mine')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mine.body.meta.total).toBe(1);
      expect(mine.body.data[0].status).toBe(ReportStatus.PENDING_REVIEW);

      const pendingList = await request(app.getHttpServer())
        .get('/api/reports')
        .expect(200);

      expect(pendingList.body.meta.total).toBe(0);

      const adminToken = await createAdminToken();
      await setStatus(adminToken, reportId, ReportStatus.APPROVED);

      const publicResponse = await request(app.getHttpServer())
        .get(`/api/reports/${reportId}`)
        .expect(200);

      expect(publicResponse.body.status).toBe(ReportStatus.APPROVED);

      const publicList = await request(app.getHttpServer())
        .get('/api/reports')
        .expect(200);

      expect(publicList.body.meta.total).toBe(1);
      expect(publicList.body.data[0].id).toBe(reportId);
    });

    it('returns 404 for another citizen viewing a pending report', async () => {
      const owner = await registerCitizen('owner@example.com');
      await registerCitizen('other@example.com');
      const otherToken = await login('other@example.com');
      const report = await createReport(owner.token);

      await request(app.getHttpServer())
        .get(`/api/reports/${report.id as string}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
    });
  });

  describe('report updates and ownership', () => {
    it('allows only the owner to update an eligible report', async () => {
      const owner = await registerCitizen('owner@example.com');
      await registerCitizen('other@example.com');
      const otherToken = await login('other@example.com');
      const adminToken = await createAdminToken();
      const report = await createReport(owner.token);
      const reportId = report.id as string;

      await request(app.getHttpServer())
        .patch(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ title: 'Hijacked report title' })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ categoryId: '5b6b2d9a-1e2f-4a3b-8c7d-9e0f1a2b3c4d' })
        .expect(400);

      const updated = await request(app.getHttpServer())
        .patch(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          title: 'Updated pothole report',
          location: 'Second Avenue',
        })
        .expect(200);

      expect(updated.body.title).toBe('Updated pothole report');
      expect(updated.body.location).toBe('Second Avenue');
      expect(updated.body.status).toBe(ReportStatus.PENDING_REVIEW);

      await setStatus(adminToken, reportId, ReportStatus.APPROVED);

      await request(app.getHttpServer())
        .patch(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'Cannot edit approved report' })
        .expect(400);
    });

    it('allows only administrators to change status', async () => {
      const owner = await registerCitizen();
      const report = await createReport(owner.token);

      await request(app.getHttpServer())
        .patch(`/api/reports/${report.id as string}/status`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ status: ReportStatus.APPROVED })
        .expect(403);

      const adminToken = await createAdminToken();
      const approved = await setStatus(
        adminToken,
        report.id as string,
        ReportStatus.APPROVED,
      );

      expect(approved.status).toBe(ReportStatus.APPROVED);

      await request(app.getHttpServer())
        .patch(`/api/reports/${report.id as string}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ReportStatus.PENDING_REVIEW })
        .expect(400);
    });
  });

  describe('community verification', () => {
    it('prevents self-verification and duplicate verification', async () => {
      const owner = await registerCitizen('owner@example.com');
      await registerCitizen('verifier@example.com');
      const verifierToken = await login('verifier@example.com');
      const adminToken = await createAdminToken();
      const report = await createReport(owner.token);
      const reportId = report.id as string;

      await request(app.getHttpServer())
        .post(`/api/reports/${reportId}/verifications`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .expect(400);

      await setStatus(adminToken, reportId, ReportStatus.APPROVED);

      await request(app.getHttpServer())
        .post(`/api/reports/${reportId}/verifications`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(403);

      const verified = await request(app.getHttpServer())
        .post(`/api/reports/${reportId}/verifications`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .expect(201);

      expect(verified.body).toMatchObject({
        reportId,
        verificationCount: 1,
        verified: true,
      });

      const duplicate = await request(app.getHttpServer())
        .post(`/api/reports/${reportId}/verifications`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .expect(409);

      expect(duplicate.body.message).toContain('already verified');

      const verifier = await usersRepository.findOneOrFail({
        where: { email: 'verifier@example.com' },
      });

      await expect(
        verificationsRepository.insert({
          reportId,
          userId: verifier.id,
        }),
      ).rejects.toMatchObject({ driverError: { code: '23505' } });

      const count = await request(app.getHttpServer())
        .get(`/api/reports/${reportId}/verifications`)
        .expect(200);

      expect(count.body.verificationCount).toBe(1);

      const detail = await request(app.getHttpServer())
        .get(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .expect(200);

      expect(detail.body.verificationCount).toBe(1);
      expect(detail.body.hasVerified).toBe(true);
    });

    it('allows a citizen to remove their verification and keeps the count accurate', async () => {
      const owner = await registerCitizen('owner@example.com');
      await registerCitizen('verifier@example.com');
      const verifierToken = await login('verifier@example.com');
      const adminToken = await createAdminToken();
      const report = await createReport(owner.token);
      const reportId = report.id as string;

      await setStatus(adminToken, reportId, ReportStatus.APPROVED);

      await request(app.getHttpServer())
        .post(`/api/reports/${reportId}/verifications`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .expect(201);

      const removed = await request(app.getHttpServer())
        .delete(`/api/reports/${reportId}/verifications/me`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .expect(200);

      expect(removed.body).toMatchObject({
        reportId,
        verificationCount: 0,
        verified: false,
      });

      await request(app.getHttpServer())
        .delete(`/api/reports/${reportId}/verifications/me`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .expect(404);

      const stored = await reportsRepository.findOneOrFail({
        where: { id: reportId },
      });

      expect(stored.verificationCount).toBe(0);
      await expect(verificationsRepository.count()).resolves.toBe(0);
    });
  });

  describe('filtering, search and pagination', () => {
    it('filters by category and status, searches and paginates', async () => {
      const owner = await registerCitizen();
      const adminToken = await createAdminToken();

      const roadReport = await createReport(owner.token, {
        title: 'Broken streetlight',
        location: 'Oak Avenue',
      });
      const waterReport = await createReport(owner.token, {
        title: 'Water pipe leak',
        location: 'River Road',
        categoryId: waterCategoryId,
      });
      const potholeReport = await createReport(owner.token, {
        title: 'Pothole near school',
        location: 'School Lane',
      });

      const ids = [
        roadReport.id as string,
        waterReport.id as string,
        potholeReport.id as string,
      ];

      for (const id of ids) {
        await setStatus(adminToken, id, ReportStatus.APPROVED);
      }

      const all = await request(app.getHttpServer())
        .get('/api/reports?limit=2&page=1')
        .expect(200);

      expect(all.body.meta).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
      expect(all.body.data).toHaveLength(2);

      const byCategory = await request(app.getHttpServer())
        .get(`/api/reports?categoryId=${waterCategoryId}`)
        .expect(200);

      expect(byCategory.body.meta.total).toBe(1);
      expect(byCategory.body.data[0].id).toBe(waterReport.id);

      const bySearch = await request(app.getHttpServer())
        .get('/api/reports?search=streetlight')
        .expect(200);

      expect(bySearch.body.meta.total).toBe(1);
      expect(bySearch.body.data[0].id).toBe(roadReport.id);

      await setStatus(adminToken, potholeReport.id as string, ReportStatus.IN_PROGRESS);

      const approvedOnly = await request(app.getHttpServer())
        .get('/api/reports')
        .expect(200);

      expect(approvedOnly.body.meta.total).toBe(2);

      const inProgress = await request(app.getHttpServer())
        .get('/api/reports?status=IN_PROGRESS')
        .expect(200);

      expect(inProgress.body.meta.total).toBe(1);
      expect(inProgress.body.data[0].id).toBe(potholeReport.id);

      await request(app.getHttpServer())
        .get('/api/reports?status=PENDING_REVIEW')
        .expect(400);
    });
  });

  describe('image upload validation', () => {
    it('validates ownership, file type and Cloudinary configuration', async () => {
      const owner = await registerCitizen('owner@example.com');
      await registerCitizen('other@example.com');
      const otherToken = await login('other@example.com');
      const report = await createReport(owner.token);
      const reportId = report.id as string;

      await request(app.getHttpServer())
        .post(`/api/reports/${reportId}/images`)
        .attach('images', validPng, {
          filename: 'photo.png',
          contentType: 'image/png',
        })
        .expect(401);

      await request(app.getHttpServer())
        .post(`/api/reports/${reportId}/images`)
        .set('Authorization', `Bearer ${otherToken}`)
        .attach('images', validPng, {
          filename: 'photo.png',
          contentType: 'image/png',
        })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/api/reports/${reportId}/images`)
        .set('Authorization', `Bearer ${owner.token}`)
        .attach('images', Buffer.from('plain text'), {
          filename: 'notes.txt',
          contentType: 'text/plain',
        })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/api/reports/${reportId}/images`)
        .set('Authorization', `Bearer ${owner.token}`)
        .attach('images', Buffer.from('not really a png'), {
          filename: 'fake.png',
          contentType: 'image/png',
        })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/api/reports/${reportId}/images`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(400);

      await request(app.getHttpServer())
        .post(`/api/reports/${reportId}/images`)
        .set('Authorization', `Bearer ${owner.token}`)
        .attach('images', validPng, {
          filename: 'photo.png',
          contentType: 'image/png',
        })
        .expect(503);

      await expect(imagesRepository.count()).resolves.toBe(0);
    });
  });

  describe('category management', () => {
    it('lists active categories and restricts category management to administrators', async () => {
      const publicList = await request(app.getHttpServer())
        .get('/api/categories')
        .expect(200);

      expect(publicList.body.length).toBeGreaterThanOrEqual(7);

      const citizen = await registerCitizen();

      await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${citizen.token}`)
        .send({ name: 'Noise Complaints', description: 'Noise issues' })
        .expect(403);

      const adminToken = await createAdminToken();

      const created = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Noise Complaints', description: 'Noise issues' })
        .expect(201);

      expect(created.body.slug).toBe('noise-complaints');

      await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Noise Complaints', description: 'Duplicate' })
        .expect(409);
    });
  });
});
