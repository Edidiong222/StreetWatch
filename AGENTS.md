# AGENTS.md — CivicPulse

## 1. Project Overview

CivicPulse is a community-driven civic issue reporting and resolution platform.

Its purpose is to help citizens report problems in their communities, allow other residents to verify reports, and enable authorised administrators to track and manage their resolution.

Examples of reportable issues:
- Damaged roads and potholes.
- Water shortages.
- Electricity outages.
- Waste disposal problems.
- Broken public infrastructure.
- Drainage and flooding.
- Other community-related problems.

Core product philosophy:

**Report it. Track it. Resolve it.**

The application must be designed around transparency, accountability, usability and reliable data management.

## 2. Technology Stack

### Frontend
- Next.js (App Router).
- TypeScript.
- Tailwind CSS.
- Responsive design.
- React Hook Form where appropriate.
- Zod for validation.

### Backend
- NestJS.
- TypeScript.
- REST API.
- TypeORM.
- PostgreSQL.
- JWT authentication.
- bcrypt or argon2 for password hashing.
- class-validator and class-transformer for DTO validation.

### External Services
- Cloudinary for image storage.
- PostgreSQL for persistent data.
- Server-Sent Events for live updates where appropriate.

Do not introduce additional infrastructure or libraries without a clear technical reason.

## 3. Architecture

Use a modular monolith architecture.

Keep the frontend and backend logically separated.

and please for every change you make create/update the progress.md to allow other agents to know your progress

Suggested structure:

```text
civicpulse/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   └── types/
│
├── backend/
│   └── src/
│       ├── auth/
│       ├── users/
│       ├── reports/
│       ├── categories/
│       ├── verification/
│       ├── comments/
│       ├── notifications/
│       ├── administration/
│       ├── common/
│       └── database/
│
├── design/
│   └── design.md
│
├── AGENTS.md
└── README.md
```

Adjust the structure if the existing repository already has an established architecture.

### Architecture rules

- Controllers handle HTTP requests and responses.
- Services contain business logic.
- Entities represent database structures.
- DTOs validate incoming data.
- Guards enforce authentication and permissions.
- Repositories handle database access through TypeORM.
- Modules organise related functionality.
- Shared business rules must not be duplicated across controllers.

Do not put business logic inside controllers.

## 4. Core Features

### Authentication
- User registration.
- Login and logout.
- Password hashing.
- JWT authentication.
- Protected routes.
- User profile management.

### User Roles

Implement three roles:

1. CITIZEN
   - Create reports.
   - Upload evidence.
   - View reports.
   - Verify reports.
   - Comment on reports.
   - Track report progress.

2. ADMIN
   - Review reports.
   - Approve or reject reports.
   - Update report status.
   - Moderate comments.
   - Manage report categories.
   - View platform statistics.

3. SUPER_ADMIN
   - All administrator permissions.
   - Manage administrator accounts.
   - Manage platform-wide settings.

Never trust a role supplied by the frontend.

### Reports

Each report should support:

- Title.
- Description.
- Category.
- Location.
- Optional coordinates.
- Images.
- Creator.
- Current status.
- Verification count.
- Creation date.
- Last update date.

Report statuses:

- PENDING_REVIEW
- APPROVED
- IN_PROGRESS
- RESOLVED
- REJECTED

Only authorised administrators can approve, reject or change official report statuses.

### Community Verification

- Authenticated citizens can verify approved reports.
- A citizen can verify a particular report only once.
- Users cannot verify their own reports.
- Verification counts must be calculated reliably.
- Prevent duplicate verification through database constraints.

Verification represents community confirmation, not proof that an issue has been independently investigated.

### Comments

- Citizens can comment on approved reports.
- Administrators can moderate inappropriate comments.
- Validate all comment inputs.

### Notifications

Notify users when:
- Their report is approved or rejected.
- Their report status changes.
- Their report is marked resolved.
- Someone comments on a report they created, where appropriate.

### Administration Dashboard

Display:
- Total reports.
- Pending reports.
- Reports in progress.
- Resolved reports.
- Recent submissions.
- Reports grouped by category.
- Reports grouped by status.

Statistics must come from actual database queries.

## 5. Database Design

Use PostgreSQL and TypeORM.

Design entities with appropriate relationships, indexes and constraints.

Expected entities:

- User
- Report
- ReportImage
- Category
- ReportVerification
- Comment
- Notification
- ReportStatusHistory

Important database rules:

- User emails must be unique.
- One user cannot verify the same report twice.
- A report must have a valid creator.
- Deleting a user must not accidentally destroy historical civic reports.
- Status changes should be auditable.
- Use migrations for schema changes.
- Do not use synchronize: true in production.

Consider PostgreSQL geospatial capabilities if location-based queries require them. Do not add PostGIS without establishing the need.

## 6. Security Requirements

- Hash passwords securely.
- Validate every incoming DTO.
- Use authentication guards.
- Use role-based authorization.
- Prevent mass assignment.
- Restrict file types and file sizes.
- Validate image uploads.
- Rate-limit authentication and report submission endpoints.
- Prevent SQL injection through safe ORM queries.
- Protect against duplicate submissions.
- Do not expose sensitive user information.
- Never trust frontend permissions.
- Keep secrets in environment variables.
- Do not commit secrets.
- Avoid exposing precise residential coordinates publicly.

## 7. Frontend Design Requirements

The interface must feel like a professionally designed civic technology product.

Avoid generic AI-generated dashboard aesthetics.

Design principles:

- Clean and modern.
- Strong typography.
- Clear visual hierarchy.
- Neutral backgrounds.
- Restrained green accent colour.
- Consistent spacing.
- Meaningful empty states.
- Clear loading and error states.
- Responsive layouts.
- Accessible forms and navigation.

Create a `design/design.md` file before implementing the main interface.

The design must cover:
- Colour palette.
- Typography.
- Spacing.
- Components.
- Buttons.
- Forms.
- Cards.
- Navigation.
- Status indicators.
- Responsive behaviour.

Avoid excessive gradients, unnecessary glassmorphism and excessive rounded cards.

## 8. Engineering Standards

- Write readable, maintainable TypeScript.
- Avoid unnecessary abstractions.
- Avoid duplicating code.
- Use meaningful variable and function names.
- Handle errors explicitly.
- Use transactions when multiple database operations must succeed together.
- Implement pagination for report listings.
- Implement filtering and sorting on the backend.
- Avoid fetching unnecessary database records.
- Use appropriate indexes.
- Do not store uploaded image binaries in PostgreSQL.
- Do not return password hashes in API responses.

## 9. Testing

Write tests for critical functionality.

Prioritise:
- Authentication.
- Role permissions.
- Report creation.
- Report status transitions.
- Community verification.
- Duplicate prevention.
- Comment permissions.
- Notification creation.

Run relevant tests after each implementation phase.

Do not claim a feature works unless it has been tested.

## 10. AI Agent Behaviour

The agent must work incrementally.

Before writing code:

1. Inspect the existing repository.
2. Understand the existing architecture.
3. Identify what already exists.
4. Identify missing functionality.
5. Present a concise implementation plan.

During implementation:

- Work on one phase at a time.
- Do not rewrite working code unnecessarily.
- Do not create duplicate modules or services.
- Do not silently change architectural decisions.
- Explain important implementation decisions.
- Keep code minimal but maintainable.
- Do not introduce unnecessary dependencies.
- Run relevant tests and report the results.

After each phase:

1. Summarise what was implemented.
2. List files created or modified.
3. Report tests performed.
4. Report any outstanding issues.
5. Stop and wait for my approval before proceeding.

If something fails, investigate and fix the current phase before moving forward.

Do not proceed to the next phase automatically.

## 11. Definition of Done

A feature is complete only when:

- Its functionality is implemented.
- Input validation exists.
- Permissions are enforced.
- Errors are handled.
- Database operations are correct.
- Relevant tests pass.
- Frontend integration works where applicable.

The ultimate objective is a secure, usable and demonstrable CivicPulse MVP, not an unnecessarily complicated enterprise system.