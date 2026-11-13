# Phase 2 API: Reports, Images and Community Verification

All routes are prefixed with `/api`.

## Environment setup

Add these values to `backend/.env` before starting the server:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_FOLDER=streetwatch/reports
```

Cloudinary is only required for the image upload endpoint. Every other endpoint works without it. If Cloudinary is not configured, image uploads return `503 Service Unavailable`.

Run the migrations before testing:

```powershell
npm --prefix backend run migration:run
```

The migration also seeds the default report categories.

Start the API:

```powershell
npm --prefix backend run dev
```

## Postman setup

1. Create a Postman environment with:
   - `baseUrl` = `http://localhost:3001/api`
   - `token` = empty string
2. Register or log in. Save `accessToken` from the response into `token`.
3. For protected requests, add the header:

```text
Authorization: Bearer {{token}}
```

To test administrator-only endpoints, promote a test account once:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

Then log in again so the JWT strategy reloads the updated role.

## Authentication

| Method | Path | Access | Body |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | `email`, `password`, `fullName` |
| POST | `/auth/login` | Public | `email`, `password` |

### Register example

```json
{
  "email": "citizen@example.com",
  "password": "Password123",
  "fullName": "Test Citizen"
}
```

## Categories

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/categories` | Public | Active categories only |
| GET | `/categories/all` | ADMIN, SUPER_ADMIN | Includes inactive categories |
| POST | `/categories` | ADMIN, SUPER_ADMIN | `name`, `description` |
| PATCH | `/categories/:id` | ADMIN, SUPER_ADMIN | `name`, `description`, `isActive` |

## Reports

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| POST | `/reports` | Authenticated | Creates a `PENDING_REVIEW` report |
| GET | `/reports` | Public | Approved reports by default |
| GET | `/reports/mine` | Authenticated | All reports created by the caller |
| GET | `/reports/:id` | Public / owner / admin | Pending reports are hidden from the public |
| PATCH | `/reports/:id` | Owner | Only `PENDING_REVIEW` or `REJECTED` reports |
| PATCH | `/reports/:id/status` | ADMIN, SUPER_ADMIN | Official status transitions |

### Create report example

```json
{
  "title": "Large pothole on Main Street",
  "description": "A deep pothole is causing damage to vehicles near the main junction.",
  "categoryId": "REPLACE_WITH_CATEGORY_ID",
  "location": "Main Street junction",
  "latitude": 6.5244,
  "longitude": 3.3792
}
```

Latitude and longitude are optional, but they must be supplied together. Interface:

- `latitude`: -90 to 90, up to 6 decimal places.
- `longitude`: -180 to 180, up to 6 decimal places.

Only administrators can approve or reject reports. Supported transitions:

- `PENDING_REVIEW` -> `APPROVED` or `REJECTED`
- `APPROVED` -> `IN_PROGRESS`, `RESOLVED` or `REJECTED`
- `IN_PROGRESS` -> `RESOLVED` or `REJECTED`
- `RESOLVED` and `REJECTED` are terminal

### Listing, filtering and pagination

`GET /reports` and `GET /reports/mine` accept:

| Query | Default | Notes |
| --- | --- | --- |
| `page` | `1` | Positive integer |
| `limit` | `10` | Maximum `50` |
| `categoryId` | none | Category UUID |
| `status` | `APPROVED` for public list | Public list accepts `APPROVED`, `IN_PROGRESS`, `RESOLVED` |
| `search` | none | Matches title, description or location |
| `sortBy` | `createdAt` | `createdAt`, `updatedAt`, `verificationCount` |
| `sortOrder` | `DESC` | `ASC` or `DESC` |

Response shape:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0
  }
}
```

## Report images

| Method | Path | Access | Body |
| --- | --- | --- | --- |
| POST | `/reports/:id/images` | Owner | `multipart/form-data` field named `images` |

Rules:

- Up to 5 images per request.
- Maximum 5 MB per image.
- JPEG, PNG and WebP only.
- File content is checked against the declared MIME type.
- Images can only be added while the report is `PENDING_REVIEW` or `REJECTED`.
- Cloudinary URLs and public IDs are stored in PostgreSQL; binaries are not.

In Postman:

1. Select `Body` -> `form-data`.
2. Add key `images` and change its type from `Text` to `File`.
3. Select an image file and send the request.

## Community verification

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/reports/:reportId/verifications` | Public | Returns the current verification count |
| POST | `/reports/:reportId/verifications` | CITIZEN | Verifies an approved report |
| DELETE | `/reports/:reportId/verifications/me` | CITIZEN | Removes the caller's verification |

Rules:

- Only `APPROVED` reports can be verified.
- A citizen cannot verify their own report.
- A citizen can verify a report only once. The database has a unique constraint on `(report_id, user_id)`.
- Counts are updated in the same transaction as the verification row.
- The client cannot submit or override the verification count.
- Verification can be removed while the report is `APPROVED` or `IN_PROGRESS`.

## Error responses

Errors use a consistent shape:

```json
{
  "statusCode": 400,
  "message": "Human readable message",
  "error": "Bad Request",
  "path": "/api/reports",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Common status codes:

- `400`: validation failure, invalid category, invalid status transition.
- `401`: missing or invalid token.
- `403`: wrong role or trying to modify another user's report.
- `404`: report or verification not found.
- `409`: duplicate recent report, duplicate verification or duplicate category.
- `503`: Cloudinary is not configured.

## Automated tests

```powershell
npm --prefix backend test
```

The suite covers report creation, retrieval visibility, ownership, update permissions, invalid categories, duplicate verification, self-verification prevention, verification counts, filtering, search, pagination and image upload validation.
