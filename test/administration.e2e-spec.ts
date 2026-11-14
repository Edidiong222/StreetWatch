import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.config';
import { Category } from '../src/categories/entities/category.entity';
import { Comment } from '../src/comments/entities/comment.entity';
import { NotificationType } from '../src/common/enums/notification-type.enum';
import { ReportStatus } from '../src/common/enums/report-status.enum';
import { UserRole } from '../src/common/enums/user-role.enum';
import { Notification } from '../src/notifications/entities/notification.entity';
import { NotificationsService } from '../src/notifications/notifications.service';
import { ReportStatusHistory } from '../src/reports/entities/report-status-history.entity';
import { Report } from '../src/reports/entities/report.entity';
import { User } from '../src/users/entities/user.entity';

describe('Administration, comments and notifications (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let usersRepository: Repository<User>;
  let reportsRepository: Repository<Report>;
  let historyRepository: Repository<ReportStatusHistory>;
  let notificationsRepository: Repository<Notification>;
  let commentsRepository: Repository<Comment>;
  let roadsCategoryId: string;
  let waterCategoryId: string;

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
    historyRepository = dataSource.getRepository(ReportStatusHistory);
    notificationsRepository = dataSource.getRepository(Notification);
    commentsRepository = dataSource.getRepository(Comment);

    const categoriesRepository = dataSource.getRepository(Category);
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
      'TRUNCATE TABLE "notifications", "comments", "report_status_history", "report_verifications", "report_images", "reports", "users" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const registerCitizen = async (
    email = 'citizen@example.com',
    fullName = 'Test Citizen',
  ): Promise<{ token: string; userId: string }> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Password123', fullName })
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
    return usersRepository.save(
      usersRepository.create({
        email,
        passwordHash,
        fullName: `${role} User`,
        role,
      }),
    );
  };

  const login = async (email: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'Password123' })
      .expect(200);

    return response.body.accessToken as string;
  };

  const createAdminToken = async (email = 'admin@example.com'): Promise<string> => {
    await createUserWithRole(UserRole.ADMIN, email);
    return login(email);
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

  const approveReport = async (
    adminToken: string,
    reportId: string,
    note?: string,
  ): Promise<Record<string, unknown>> => {
    const response = await request(app.getHttpServer())
      .patch(`/api/admin/reports/${reportId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(note ? { note } : {})
      .expect(200);

    return response.body as Record<string, unknown>;
  };

  describe('administration permissions', () => {
    it('restricts administration endpoints to administrators', async () => {
      const { token } = await registerCitizen();

      await request(app.getHttpServer())
        .get('/api/admin/statistics')
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/admin/statistics')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      const adminToken = await createAdminToken();

      await request(app.getHttpServer())
        .get('/api/admin/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/admin/reports/pending')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('prevents citizens from changing official report statuses', async () => {
      const { token } = await registerCitizen();
      const report = await createReport(token);

      await request(app.getHttpServer())
        .patch(`/api/admin/reports/${report.id as string}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/reports/${report.id as string}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: ReportStatus.APPROVED })
        .expect(403);
    });
  });

  describe('status transitions and history', () => {
    it('approves a report atomically with history and a notification', async () => {
      const { token, userId } = await registerCitizen();
      const report = await createReport(token);
      const adminToken = await createAdminToken();

      const approved = await approveReport(
        adminToken,
        report.id as string,
        'Verified the location',
      );

      expect(approved.status).toBe(ReportStatus.APPROVED);

      const historyResponse = await request(app.getHttpServer())
        .get(`/api/reports/${report.id as string}/history`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(historyResponse.body).toHaveLength(1);
      expect(historyResponse.body[0]).toMatchObject({
        previousStatus: ReportStatus.PENDING_REVIEW,
        newStatus: ReportStatus.APPROVED,
        note: 'Verified the location',
        changedBy: { fullName: 'ADMIN User' },
      });

      const storedHistory = await historyRepository.count();
      expect(storedHistory).toBe(1);

      const notifications = await notificationsRepository.find({
        where: { userId },
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        type: NotificationType.REPORT_APPROVED,
        reportId: report.id,
        isRead: false,
      });
    });

    it('rejects invalid transitions without writing history', async () => {
      const { token } = await registerCitizen();
      const report = await createReport(token);
      const adminToken = await createAdminToken();

      await request(app.getHttpServer())
        .patch(`/api/admin/reports/${report.id as string}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(await historyRepository.count()).toBe(0);
      expect(await notificationsRepository.count()).toBe(0);
    });

    it('rolls back status and history when the notification write fails', async () => {
      const { token } = await registerCitizen();
      const report = await createReport(token);
      const adminToken = await createAdminToken();
      const notificationsService = app.get(NotificationsService);
      const createNotification = jest
        .spyOn(notificationsService, 'create')
        .mockRejectedValueOnce(new Error('Notification store unavailable'));

      try {
        await request(app.getHttpServer())
          .patch(`/api/admin/reports/${report.id as string}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({})
          .expect(500);
      } finally {
        createNotification.mockRestore();
      }

      const stored = await reportsRepository.findOneOrFail({
        where: { id: report.id as string },
      });
      expect(stored.status).toBe(ReportStatus.PENDING_REVIEW);
      expect(await historyRepository.count()).toBe(0);
      expect(await notificationsRepository.count()).toBe(0);
    });

    it('requires a reason when rejecting and records it', async () => {
      const { token, userId } = await registerCitizen();
      const report = await createReport(token);
      const adminToken = await createAdminToken();

      await request(app.getHttpServer())
        .patch(`/api/admin/reports/${report.id as string}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/api/reports/${report.id as string}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ReportStatus.REJECTED })
        .expect(400);

      const rejected = await request(app.getHttpServer())
        .patch(`/api/admin/reports/${report.id as string}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Insufficient evidence' })
        .expect(200);

      expect(rejected.body.status).toBe(ReportStatus.REJECTED);

      const history = await historyRepository.findOneOrFail({
        where: { reportId: report.id as string },
      });
      expect(history.note).toBe('Insufficient evidence');

      const notification = await notificationsRepository.findOneOrFail({
        where: { userId },
      });
      expect(notification.type).toBe(NotificationType.REPORT_REJECTED);
      expect(notification.message).toContain('Insufficient evidence');
    });

    it('tracks the full approved, in-progress and resolved lifecycle', async () => {
      const { token, userId } = await registerCitizen();
      const report = await createReport(token);
      const adminToken = await createAdminToken();

      await approveReport(adminToken, report.id as string);

      await request(app.getHttpServer())
        .patch(`/api/admin/reports/${report.id as string}/in-progress`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ note: 'Team dispatched' })
        .expect(200);

      const resolved = await request(app.getHttpServer())
        .patch(`/api/admin/reports/${report.id as string}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ note: 'Repaired' })
        .expect(200);

      expect(resolved.body.status).toBe(ReportStatus.RESOLVED);

      const history = await historyRepository.find({
        where: { reportId: report.id as string },
        order: { createdAt: 'ASC' },
      });
      expect(history.map((entry) => entry.newStatus)).toEqual([
        ReportStatus.APPROVED,
        ReportStatus.IN_PROGRESS,
        ReportStatus.RESOLVED,
      ]);

      const notifications = await notificationsRepository.find({
        where: { userId },
        order: { createdAt: 'ASC' },
      });
      expect(notifications.map((entry) => entry.type)).toEqual([
        NotificationType.REPORT_APPROVED,
        NotificationType.REPORT_STATUS_CHANGED,
        NotificationType.REPORT_RESOLVED,
      ]);
    });

    it('only exposes pending history to the owner and administrators', async () => {
      const { token } = await registerCitizen();
      const report = await createReport(token);
      const other = await registerCitizen('other@example.com');
      const adminToken = await createAdminToken();

      await request(app.getHttpServer())
        .get(`/api/reports/${report.id as string}/history`)
        .set('Authorization', `Bearer ${other.token}`)
        .expect(404);

      await request(app.getHttpServer())
        .get(`/api/reports/${report.id as string}/history`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/admin/reports/${report.id as string}/history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('comments', () => {
    const createApprovedReport = async () => {
      const creator = await registerCitizen('creator@example.com', 'Report Creator');
      const report = await createReport(creator.token);
      const adminToken = await createAdminToken();
      await approveReport(adminToken, report.id as string);
      return { creator, report, adminToken };
    };

    it('allows citizens to comment and notifies the report creator', async () => {
      const { creator, report } = await createApprovedReport();
      const commenter = await registerCitizen('commenter@example.com', 'Commenter');

      await request(app.getHttpServer())
        .post(`/api/reports/${report.id as string}/comments`)
        .send({ content: 'I can confirm this issue.' })
        .expect(401);

      const response = await request(app.getHttpServer())
        .post(`/api/reports/${report.id as string}/comments`)
        .set('Authorization', `Bearer ${commenter.token}`)
        .send({ content: 'I can confirm this issue.' })
        .expect(201);

      expect(response.body).toMatchObject({
        reportId: report.id,
        content: 'I can confirm this issue.',
        isHidden: false,
        author: { fullName: 'Commenter' },
      });

      const publicList = await request(app.getHttpServer())
        .get(`/api/reports/${report.id as string}/comments`)
        .expect(200);

      expect(publicList.body.data).toHaveLength(1);
      expect(publicList.body.meta.total).toBe(1);

      const notification = await notificationsRepository.findOneOrFail({
        where: {
          userId: creator.userId,
          type: NotificationType.REPORT_COMMENT,
        },
      });
      expect(notification.type).toBe(NotificationType.REPORT_COMMENT);
      expect(notification.message).toContain('Commenter');
    });

    it('rejects comments on reports that have not been approved', async () => {
      const { token } = await registerCitizen();
      const report = await createReport(token);

      await request(app.getHttpServer())
        .post(`/api/reports/${report.id as string}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'This report is still pending.' })
        .expect(400);
    });

    it('restricts comment creation to citizens and editing to the author', async () => {
      const { report, adminToken } = await createApprovedReport();
      const author = await registerCitizen('author@example.com', 'Comment Author');
      const other = await registerCitizen('other@example.com', 'Other Citizen');

      await request(app.getHttpServer())
        .post(`/api/reports/${report.id as string}/comments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ content: 'Administrator comment.' })
        .expect(403);

      const created = await request(app.getHttpServer())
        .post(`/api/reports/${report.id as string}/comments`)
        .set('Authorization', `Bearer ${author.token}`)
        .send({ content: 'Original comment.' })
        .expect(201);

      const commentId = created.body.id as string;

      await request(app.getHttpServer())
        .patch(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${other.token}`)
        .send({ content: 'Hijacked comment.' })
        .expect(403);

      const updated = await request(app.getHttpServer())
        .patch(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${author.token}`)
        .send({ content: 'Updated comment.' })
        .expect(200);

      expect(updated.body.content).toBe('Updated comment.');

      await request(app.getHttpServer())
        .delete(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${other.token}`)
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${author.token}`)
        .expect(200);

      expect(await commentsRepository.count()).toBe(0);
    });

    it('lets administrators hide and restore comments', async () => {
      const { report, adminToken } = await createApprovedReport();
      const author = await registerCitizen('author@example.com', 'Comment Author');

      const created = await request(app.getHttpServer())
        .post(`/api/reports/${report.id as string}/comments`)
        .set('Authorization', `Bearer ${author.token}`)
        .send({ content: 'Inappropriate comment.' })
        .expect(201);

      const commentId = created.body.id as string;

      const moderated = await request(app.getHttpServer())
        .patch(`/api/comments/${commentId}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ hidden: true, reason: 'Abusive language' })
        .expect(200);

      expect(moderated.body).toMatchObject({
        isHidden: true,
        moderationReason: 'Abusive language',
      });

      const publicList = await request(app.getHttpServer())
        .get(`/api/reports/${report.id as string}/comments`)
        .expect(200);

      expect(publicList.body.data).toHaveLength(0);

      const hiddenList = await request(app.getHttpServer())
        .get(`/api/reports/${report.id as string}/comments?includeHidden=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(hiddenList.body.data).toHaveLength(1);

      await request(app.getHttpServer())
        .patch(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${author.token}`)
        .send({ content: 'Trying to edit a hidden comment.' })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/api/comments/${commentId}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ hidden: false })
        .expect(200);

      const restored = await request(app.getHttpServer())
        .get(`/api/reports/${report.id as string}/comments`)
        .expect(200);

      expect(restored.body.data).toHaveLength(1);
    });
  });

  describe('notifications', () => {
    it('lists notifications, tracks unread counts and marks them read', async () => {
      const { token, userId } = await registerCitizen();
      const first = await createReport(token, {
        title: 'First pothole',
        location: 'First Street',
      });
      const second = await createReport(token, {
        title: 'Second pothole',
        location: 'Second Street',
      });
      const adminToken = await createAdminToken();

      await approveReport(adminToken, first.id as string);
      await approveReport(adminToken, second.id as string);

      const list = await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(list.body.data).toHaveLength(2);
      expect(list.body.meta.total).toBe(2);

      const unread = await request(app.getHttpServer())
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(unread.body.unreadCount).toBe(2);

      const notificationId = list.body.data[0].id as string;

      await request(app.getHttpServer())
        .patch(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((response) => {
          expect(response.body.isRead).toBe(true);
        });

      const afterRead = await request(app.getHttpServer())
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(afterRead.body.unreadCount).toBe(1);

      const unreadOnly = await request(app.getHttpServer())
        .get('/api/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(unreadOnly.body.data).toHaveLength(1);

      const markedAll = await request(app.getHttpServer())
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(markedAll.body.updated).toBe(1);

      const finalCount = await request(app.getHttpServer())
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(finalCount.body.unreadCount).toBe(0);

      const other = await registerCitizen('other@example.com');
      expect(other.userId).not.toBe(userId);

      await request(app.getHttpServer())
        .patch(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${other.token}`)
        .expect(404);
    });
  });

  describe('dashboard statistics', () => {
    it('returns database-backed report counts and category groupings', async () => {
      const citizenA = await registerCitizen('a@example.com', 'Citizen A');
      const citizenB = await registerCitizen('b@example.com', 'Citizen B');
      const adminToken = await createAdminToken();

      const pending = await createReport(citizenA.token, {
        title: 'Pending road issue',
        location: 'Road A',
      });
      const approved = await createReport(citizenA.token, {
        title: 'Approved road issue',
        location: 'Road B',
      });
      const inProgress = await createReport(citizenB.token, {
        title: 'Water issue',
        location: 'Water A',
        categoryId: waterCategoryId,
      });
      const rejected = await createReport(citizenB.token, {
        title: 'Rejected water issue',
        location: 'Water B',
        categoryId: waterCategoryId,
      });

      await approveReport(adminToken, approved.id as string);

      await approveReport(adminToken, inProgress.id as string);
      await request(app.getHttpServer())
        .patch(`/api/admin/reports/${inProgress.id as string}/in-progress`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/admin/reports/${rejected.id as string}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Duplicate' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/api/admin/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        totalReports: 4,
        pendingReports: 1,
        approvedReports: 1,
        inProgressReports: 1,
        resolvedReports: 0,
        rejectedReports: 1,
      });

      expect(response.body.reportsByStatus).toEqual(
        expect.arrayContaining([
          { status: ReportStatus.PENDING_REVIEW, count: 1 },
          { status: ReportStatus.APPROVED, count: 1 },
          { status: ReportStatus.IN_PROGRESS, count: 1 },
          { status: ReportStatus.REJECTED, count: 1 },
        ]),
      );

      expect(response.body.reportsByCategory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            categoryId: roadsCategoryId,
            count: 2,
          }),
          expect.objectContaining({
            categoryId: waterCategoryId,
            count: 2,
          }),
        ]),
      );

      expect(response.body.recentSubmissions).toHaveLength(4);
      expect(pending.id).toBeDefined();
    });
  });
});
