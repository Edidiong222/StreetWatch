# StreetWatch Progress

Last updated: 2026-11-12

## Current Phase

Phase 2: Reports and community verification. In progress (backend only). Phase 1 is complete.

### Phase 2 progress

- Added `ReportStatus` enum and public status list.
- Added `Category`, `Report`, `ReportImage` and `ReportVerification` entities with relationships, indexes and constraints.
- Added category management (public listing plus admin create/update).
- Added report creation, approved/public listing, single report access, own reports listing, owner updates, admin status transitions, filtering, search, sorting and pagination.
- Added Cloudinary-backed report image uploads with file type, count and size validation.
- Pending: verification module, migration, e2e tests, final verification.

## Completed

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

## Key Decisions

- JWT is returned as a Bearer token. Logout is client-side; token revocation is not implemented.
- Registration never accepts a role from the client. New accounts are always `CITIZEN`.
- Emails are normalized to lowercase before storage and lookup.
- Duplicate emails are prevented by both application checks and a database unique constraint.
- Password hashes are never returned by API responses.
- The JWT payload is treated as identity only; the current role is reloaded from the database by the JWT strategy.
- API routes use the `/api` prefix.
- `POST /api/auth/register` and `POST /api/auth/login` are limited to 20 requests per minute.
- Global rate limiting is 100 requests per minute.
- Tests use an isolated PostgreSQL database and reset the `public` schema before running migrations. This is destructive and must only point at the test database.

## Endpoints

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/users/me` | Authenticated |
| GET | `/api/users` | ADMIN, SUPER_ADMIN |

## Verification

Completed successfully:

```text
npm --prefix backend run build
npx tsc -p backend\tsconfig.json --noEmit
npm --prefix backend test
```

Test result:

```text
Test Suites: 2 passed, 2 total
Tests:       12 passed, 12 total
```

Coverage includes registration, duplicate email prevention, role-injection rejection, login success/failure, profile authentication, ADMIN/SUPER_ADMIN authorization, database uniqueness, and DTO validation.

Also verified manually:

- `npm --prefix backend run migration:run` against a fresh database.
- `npm --prefix backend run seed:super-admin` creates a `SUPER_ADMIN` user.

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

## Outstanding Issues

- Rate limiting is configured but has no dedicated automated test yet.
- There is no token revocation or refresh-token flow.
- No reports, comments, verification, notifications, administration modules or frontend work has started.
- The temporary test PostgreSQL cluster was stopped after verification. Start it with the command above before rerunning the tests.

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
- `src/database/data-source.ts`
- `src/database/database.module.ts`
- `src/database/migrations/1794000000000-CreateUsers.ts`
- `src/database/seeds/create-super-admin.ts`
- `test/setup-env.ts`
- `test/global-setup.ts`
- `test/auth.e2e-spec.ts`
