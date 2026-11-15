# StreetWatch Progress

Last updated: 2026-11-15

## Current Phase

Phase 3: Administration, comments and notifications. Complete pending user approval.

The backend MVP feature set is implemented through Phase 3. The frontend is scaffolded only: it has package metadata and empty module folders, with no UI, design document or API integration yet.

### Project status at a glance

| Area | Status |
| --- | --- |
| Backend foundation and authentication | Complete |
| Reports, categories and community verification | Complete |
| Administration, comments and notifications | Complete |
| Frontend application | Not started beyond scaffold |
| Super-admin account management and platform settings | Not started |
| Real-time notifications (SSE) | Intentionally deferred |

### Phase 3 completed

- Added `ReportStatusHistory` records for every official administrator status change, including previous status, new status, administrator, optional note and timestamp. Rejections require a reason.
- Status changes, history records and status notifications are saved in one database transaction with a pessimistic report lock. Invalid transitions write nothing.
- Added administrator endpoints:
  - All reports with report filters and pagination.
  - Pending reports.
  - Approve, reject-with-reason, move to in-progress and resolve actions.
  - Report status history access.
  - Database-backed statistics.
  - Existing admin category endpoints remain at `/api/categories/all`, `POST /api/categories` and `PATCH /api/categories/:id`.
- Added persistent comments:
  - Citizens can comment on approved, in-progress or resolved reports.
  - Public comment listing excludes hidden comments.
  - Authors can edit or delete their own comments.
  - Hidden comments cannot be edited.
  - Administrators can hide or restore comments with an optional moderation reason.
  - Report creators receive a notification when someone else comments.
- Added persistent notifications:
  - Notifications are stored in PostgreSQL with type, title, message, optional report, read flag and read timestamp.
  - Created for approval, rejection, in-progress, resolution and new comments.
  - Endpoints for listing, unread counts, marking one as read and marking all as read.
  - Users can only access their own notifications.
- Added database-backed dashboard statistics:
  - Total, pending, approved, in-progress, resolved and rejected counts.
  - Reports grouped by status and category.
  - Ten most recent submissions.
- Added migration `1794000002000-CreateCommentsNotificationsAndStatusHistory`.
- Added 14 e2e tests for administration permissions, status transitions, history, rollback atomicity, comments, moderation, notifications and statistics.

### Phase 2 completed

- Added `ReportStatus` enum, public report statuses and report sort whitelists.
- Added `Category`, `Report`, `ReportImage` and `ReportVerification` entities with UUID keys, relationships, indexes, unique verification constraint, FK delete rules and coordinate/count check constraints.
- Added category management:
  - Public active category listing.
  - Admin-only full listing, creation and updates.
  - Migration seeds seven default categories.
- Added report management:
  - Authenticated report creation with `PENDING_REVIEW` status and a 24-hour duplicate submission guard.
  - Public approved report listing (also supports `IN_PROGRESS` and `RESOLVED`).
  - Optional-authentication single report retrieval. Pending/rejected reports are visible only to the owner or an administrator.
  - Authenticated own-report listing across all statuses.
  - Owner-only updates while `PENDING_REVIEW` or `REJECTED`; rejected reports return to `PENDING_REVIEW` after an edit.
  - Admin-only validated status transitions.
  - Category and status filters, title/description/location search, sorting and pagination.
- Added Cloudinary image uploads:
  - Owner-only, multipart field `images`.
  - Maximum 5 files, 5 MB each.
  - JPEG, PNG and WebP only, validated by both MIME type and file signature.
  - Cloudinary URLs and public IDs stored in PostgreSQL.
  - Failed partial uploads are cleaned up from Cloudinary.
  - Clear `503` response when Cloudinary is not configured.
- Added community verification:
  - Authenticated `CITIZEN` users can verify `APPROVED` reports.
  - Owners cannot verify their own reports.
  - Duplicate verification prevented by application checks and the `(report_id, user_id)` unique constraint.
  - Verification insert, count increment and count decrement run in transactions with a row lock.
  - Citizens can remove their own verification while a report is approved or in progress.
  - Report responses expose `verificationCount`; authenticated detail responses also expose `hasVerified`.
- Added migration `1794000001000-CreateReportsAndVerification`.
- Added `docs/phase-2-reports-api.md` with endpoint and Postman instructions.
- Added 12 e2e tests for reports, verification, upload validation, filtering, pagination and categories.
- Phase 2 outcome: report submission, discovery, ownership rules, image upload validation and community verification are implemented and covered by e2e tests. Live Cloudinary uploads remain unverified because credentials were unavailable.

## Phase 1 completed

- Inspected the repository and established the backend structure.
- Repaired the root npm workspace install by removing corrupt root `node_modules` and `package-lock.json`, then reinstalling.
- Added NestJS build, TypeScript, Jest and environment configuration.
- Added PostgreSQL/TypeORM configuration using migrations. `synchronize` remains disabled.
- Added environment validation, including JWT secret length and expiry format checks.
- Added the `User` entity with:
  - UUID primary key.
  - Unique email constraint.
  - `CITIZEN`, `ADMIN`, `SUPER_ADMIN` roles.
  - `passwordHash` stored with `select: false`.
  - Active flag and timestamps.
  - Role index.
- Added argon2 password hashing.
- Added registration, login and JWT authentication.
- Added `GET /api/users/me` for authenticated users.
- Added `GET /api/users` restricted to `ADMIN` and `SUPER_ADMIN`.
- Added role and JWT guards.
- Added global DTO validation with whitelist and non-whitelisted property rejection.
- Added global exception response formatting.
- Added global and auth endpoint rate limiting.
- Added an initial users migration and an environment-driven SUPER_ADMIN seed script.
- Added e2e and environment-validation tests.
- Added `SUPER_ADMIN_*` entries to `.env.example`.
- Phase 1 outcome: the authentication and role foundation is complete, with password hashing, JWT guards, role enforcement, validation and rate limiting in place.

## Key Decisions

- JWT is returned as a Bearer token. Logout is client-side; token revocation is not implemented.
- Registration never accepts a role from the client. New accounts are always `CITIZEN`.
- Emails are normalized to lowercase before storage and lookup.
- Duplicate emails are prevented by both application checks and a database unique constraint.
- Password hashes are never returned by API responses.
- The JWT payload is treated as identity only; the current role is reloaded from the database by the JWT strategy.
- API routes use the `/api` prefix.
- `POST /api/auth/register` and `POST /api/auth/login` are limited to 20 requests per minute.
- Global rate limiting is 100 requests per minute. Throttling is disabled only when `NODE_ENV=test`.
- Tests use an isolated PostgreSQL database and reset the `public` schema before running migrations. This is destructive and must only point at the test database.
- Reports are created as `PENDING_REVIEW`; only administrators can change official statuses.
- Public report listing defaults to `APPROVED`. `IN_PROGRESS` and `RESOLVED` are also public; pending and rejected reports are not.
- Report owners can edit only pending or rejected reports. Editing a rejected report re-enters review.
- Verification counts are denormalized on `reports.verification_count` and maintained transactionally. Clients cannot submit counts.
- Verification endpoints are restricted to the `CITIZEN` role. Administrators can moderate reports but do not add community verification.
- Uploaded image binaries are never stored in PostgreSQL. Only Cloudinary URLs and public IDs are stored.
- Report coordinates are optional but must be provided as a pair and are range-checked in validation, the service and the database.
- Only administrator status changes are recorded as official status history. Owner edits that resubmit a rejected report are not administrator actions.
- Report status changes, their history records and their notifications are committed atomically. Invalid transitions roll back without writing anything.
- Comments are allowed after a report passes review: `APPROVED`, `IN_PROGRESS` and `RESOLVED`. Pending and rejected reports remain closed to comments.
- Comment moderation hides content instead of deleting it, preserving the moderation trail. Hidden comments are invisible to the public but available to administrators.
- Notifications are persistent database records, not real-time events. SSE is intentionally deferred.
- Dashboard statistics are computed from aggregate SQL queries on every request; no counters are hardcoded.

## Endpoints

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/users/me` | Authenticated |
| GET | `/api/users` | ADMIN, SUPER_ADMIN |
| GET | `/api/categories` | Public |
| GET | `/api/categories/all` | ADMIN, SUPER_ADMIN |
| POST | `/api/categories` | ADMIN, SUPER_ADMIN |
| PATCH | `/api/categories/:id` | ADMIN, SUPER_ADMIN |
| POST | `/api/reports` | Authenticated |
| GET | `/api/reports` | Public |
| GET | `/api/reports/mine` | Authenticated |
| GET | `/api/reports/:id` | Public, owner or admin |
| GET | `/api/reports/:id/history` | Public, owner or admin |
| PATCH | `/api/reports/:id` | Owner |
| PATCH | `/api/reports/:id/status` | ADMIN, SUPER_ADMIN |
| POST | `/api/reports/:id/images` | Owner |
| GET | `/api/reports/:reportId/comments` | Public, owner or admin |
| POST | `/api/reports/:reportId/comments` | CITIZEN |
| PATCH | `/api/comments/:id` | Comment author |
| DELETE | `/api/comments/:id` | Comment author |
| PATCH | `/api/comments/:id/moderate` | ADMIN, SUPER_ADMIN |
| GET | `/api/reports/:reportId/verifications` | Public |
| POST | `/api/reports/:reportId/verifications` | CITIZEN |
| DELETE | `/api/reports/:reportId/verifications/me` | CITIZEN |
| GET | `/api/notifications` | Authenticated |
| GET | `/api/notifications/unread-count` | Authenticated |
| PATCH | `/api/notifications/:id/read` | Authenticated |
| PATCH | `/api/notifications/read-all` | Authenticated |
| GET | `/api/admin/reports` | ADMIN, SUPER_ADMIN |
| GET | `/api/admin/reports/pending` | ADMIN, SUPER_ADMIN |
| GET | `/api/admin/reports/:id/history` | ADMIN, SUPER_ADMIN |
| GET | `/api/admin/statistics` | ADMIN, SUPER_ADMIN |
| PATCH | `/api/admin/reports/:id/approve` | ADMIN, SUPER_ADMIN |
| PATCH | `/api/admin/reports/:id/reject` | ADMIN, SUPER_ADMIN |
| PATCH | `/api/admin/reports/:id/in-progress` | ADMIN, SUPER_ADMIN |
| PATCH | `/api/admin/reports/:id/resolve` | ADMIN, SUPER_ADMIN |

## Verification

Completed successfully:

```text
npm --prefix backend run build
npx tsc -p backend\tsconfig.json --noEmit
npm --prefix backend test
```

Test result:

```text
Test Suites: 4 passed, 4 total
Tests:       38 passed, 38 total
```

Coverage includes registration, duplicate email prevention, role-injection rejection, login success/failure, profile authentication, ADMIN/SUPER_ADMIN authorization, database uniqueness, DTO validation, report creation, retrieval visibility, report ownership, update permissions, invalid categories, admin status transitions, duplicate verification, self-verification prevention, verification removal and accurate counts, filtering, search, pagination, category management, image upload validation, administration permissions, invalid status transitions, status history, atomic status updates and rollback, comment permissions, comment moderation, notification creation, notification read state and dashboard statistics.

Also verified manually:

- `npm --prefix backend run migration:run` applies both Phase 2 and Phase 3 migrations.
- The e2e suites drop the test schema, run all migrations from scratch and pass.
- `npm --prefix backend run seed:super-admin` creates a `SUPER_ADMIN` user.
- A live Cloudinary upload was not executed because no Cloudinary credentials were available. Validation and the unconfigured-service failure path are covered by tests.

## Test Database

The test database used for verification was an ephemeral PostgreSQL 18 cluster:

- Host: `127.0.0.1`
- Port: `55432`
- User: `postgres`
- Password: empty
- Data directory: `%LOCALAPPDATA%\Temp\opencode\civicpulse-pg-55432`
- Default test database: `civicpulse_test`

Start it:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D "$env:LOCALAPPDATA\Temp\opencode\civicpulse-pg-55432" -o "-p 55432" -l "$env:LOCALAPPDATA\Temp\opencode\civicpulse-pg-55432\server.log" -w start
```

Stop it:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D "$env:LOCALAPPDATA\Temp\opencode\civicpulse-pg-55432" -w stop
```

If the data directory does not exist, initialize it with:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\initdb.exe' -D "$env:LOCALAPPDATA\Temp\opencode\civicpulse-pg-55432" -U postgres --auth=trust --encoding=UTF8 --no-locale
```

The test setup defaults to this cluster. Override `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD` and `DB_NAME` to use another PostgreSQL instance.

On this Windows machine, PostgreSQL child backends occasionally failed with `0xC0000142`/`0xC0000135` when the cluster was started directly from an automation shell. Starting the cluster detached through WMI `Win32_Process.Create` avoids the parent job object and made the test database stable.

## Outstanding Issues

- Rate limiting is configured but has no dedicated automated test yet.
- There is no token revocation or refresh-token flow.
- Live Cloudinary uploads require real credentials; only validation and failure handling are tested.
- Notifications are not pushed in real time. Clients must poll the notification endpoints. SSE is intentionally deferred.
- Notification retention and cleanup policies are not implemented.
- The frontend, super-admin account management and platform settings have not started.

## Main Files Created or Modified

- `package.json`
- `nest-cli.json`
- `tsconfig.json`
- `tsconfig.build.json`
- `jest.config.js`
- `.env.example`
- `.gitignore`
- `src/main.ts`
- `src/app.module.ts`
- `src/app.config.ts`
- `src/common/config/env.validation.ts`
- `src/common/config/env.validation.spec.ts`
- `src/common/decorators/current-user.decorator.ts`
- `src/common/decorators/roles.decorator.ts`
- `src/common/enums/user-role.enum.ts`
- `src/common/filters/all-exceptions.filter.ts`
- `src/common/guards/jwt-auth.guard.ts`
- `src/common/guards/roles.guard.ts`
- `src/common/utils/normalize-email.ts`
- `src/auth/auth.controller.ts`
- `src/auth/auth.module.ts`
- `src/auth/auth.service.ts`
- `src/auth/dto/login.dto.ts`
- `src/auth/dto/register.dto.ts`
- `src/auth/interfaces/auth-response.interface.ts`
- `src/auth/interfaces/jwt-payload.interface.ts`
- `src/auth/strategies/jwt.strategy.ts`
- `src/users/entities/user.entity.ts`
- `src/users/dto/user-response.dto.ts`
- `src/users/users.controller.ts`
- `src/users/users.module.ts`
- `src/users/users.service.ts`
- `src/common/enums/report-status.enum.ts`
- `src/common/enums/notification-type.enum.ts`
- `src/common/guards/optional-jwt-auth.guard.ts`
- `src/categories/entities/category.entity.ts`
- `src/categories/dto/create-category.dto.ts`
- `src/categories/dto/update-category.dto.ts`
- `src/categories/dto/category-response.dto.ts`
- `src/categories/categories.service.ts`
- `src/categories/categories.controller.ts`
- `src/categories/categories.module.ts`
- `src/reports/entities/report.entity.ts`
- `src/reports/entities/report-image.entity.ts`
- `src/reports/entities/report-status-history.entity.ts`
- `src/reports/dto/create-report.dto.ts`
- `src/reports/dto/update-report.dto.ts`
- `src/reports/dto/update-report-status.dto.ts`
- `src/reports/dto/query-reports.dto.ts`
- `src/reports/dto/report-response.dto.ts`
- `src/reports/dto/report-status-history-response.dto.ts`
- `src/reports/reports.service.ts`
- `src/reports/reports.controller.ts`
- `src/reports/reports.module.ts`
- `src/reports/uploads/cloudinary.service.ts`
- `src/reports/uploads/parse-report-images.pipe.ts`
- `src/reports/uploads/report-images.service.ts`
- `src/reports/uploads/report-images.controller.ts`
- `src/verification/entities/report-verification.entity.ts`
- `src/verification/dto/verification-response.dto.ts`
- `src/verification/verification.service.ts`
- `src/verification/verification.controller.ts`
- `src/verification/verification.module.ts`
- `src/comments/entities/comment.entity.ts`
- `src/comments/dto/create-comment.dto.ts`
- `src/comments/dto/update-comment.dto.ts`
- `src/comments/dto/query-comments.dto.ts`
- `src/comments/dto/moderate-comment.dto.ts`
- `src/comments/dto/comment-response.dto.ts`
- `src/comments/comments.service.ts`
- `src/comments/comments.controller.ts`
- `src/comments/comments.module.ts`
- `src/notifications/entities/notification.entity.ts`
- `src/notifications/dto/query-notifications.dto.ts`
- `src/notifications/dto/notification-response.dto.ts`
- `src/notifications/notifications.service.ts`
- `src/notifications/notifications.controller.ts`
- `src/notifications/notifications.module.ts`
- `src/administration/dto/admin-report-actions.dto.ts`
- `src/administration/dto/admin-statistics-response.dto.ts`
- `src/administration/administration.service.ts`
- `src/administration/administration.controller.ts`
- `src/administration/administration.module.ts`
- `src/database/data-source.ts`
- `src/database/database.module.ts`
- `src/database/migrations/1794000000000-CreateUsers.ts`
- `src/database/migrations/1794000001000-CreateReportsAndVerification.ts`
- `src/database/migrations/1794000002000-CreateCommentsNotificationsAndStatusHistory.ts`
- `src/database/seeds/create-super-admin.ts`
- `test/setup-env.ts`
- `test/global-setup.ts`
- `test/auth.e2e-spec.ts`
- `test/reports.e2e-spec.ts`
- `test/administration.e2e-spec.ts`
- `docs/phase-2-reports-api.md`
- `docs/phase-3-admin-comments-notifications.md`
