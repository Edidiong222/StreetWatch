# Phase 3 API: Administration, Comments and Notifications

All routes are prefixed with `/api`.

## Prerequisites

Run the migrations before testing:

```powershell
npm --prefix backend run migration:run
```

Start the API:

```powershell
npm --prefix backend run dev
```

Promote a test account to an administrator once:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

Log in again after changing the role so the JWT strategy reloads it.

## Postman setup

Create a Postman environment with:

- `baseUrl` = `http://localhost:3001/api`
- `token` = the citizen access token
- `adminToken` = the administrator access token

For protected requests add:

```text
Authorization: Bearer {{token}}
```

Use `{{adminToken}}` for `/admin/*` and comment moderation requests.

## Administration

All administration routes require `ADMIN` or `SUPER_ADMIN`.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/admin/reports` | All reports; supports report filters and pagination |
| GET | `/admin/reports/pending` | Pending reports only |
| GET | `/admin/reports/:id/history` | Official status history |
| GET | `/admin/statistics` | Dashboard statistics |
| PATCH | `/admin/reports/:id/approve` | Optional `note` |
| PATCH | `/admin/reports/:id/reject` | Required `reason` |
| PATCH | `/admin/reports/:id/in-progress` | Optional `note` |
| PATCH | `/admin/reports/:id/resolve` | Optional `note` |

Existing category administration remains available at:

- `GET /categories/all`
- `POST /categories`
- `PATCH /categories/:id`

### Status transitions

| Current status | Allowed next statuses |
| --- | --- |
| `PENDING_REVIEW` | `APPROVED`, `REJECTED` |
| `APPROVED` | `IN_PROGRESS`, `RESOLVED`, `REJECTED` |
| `IN_PROGRESS` | `RESOLVED`, `REJECTED` |
| `RESOLVED` | None |
| `REJECTED` | None |

Repeated status changes are no-ops. Invalid transitions return `400`. Rejecting a report through any endpoint requires a reason.

### Approve example

```http
PATCH {{baseUrl}}/admin/reports/REPORT_ID/approve
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

```json
{
  "note": "Location verified by the field team"
}
```

### Reject example

```http
PATCH {{baseUrl}}/admin/reports/REPORT_ID/reject
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

```json
{
  "reason": "Insufficient evidence to confirm the issue"
}
```

### Status history

Each official administrator status change creates a `report_status_history` row with:

- Previous status.
- New status.
- Responsible administrator.
- Optional note.
- Timestamp.

The report update, history row and notification are written in one PostgreSQL transaction with a row lock on the report. If any step fails, all changes roll back.

View history as an administrator:

```http
GET {{baseUrl}}/admin/reports/REPORT_ID/history
Authorization: Bearer {{adminToken}}
```

View history as the report owner or any user who can access the report:

```http
GET {{baseUrl}}/reports/REPORT_ID/history
Authorization: Bearer {{token}}
```

Response example:

```json
[
  {
    "id": "history-id",
    "reportId": "report-id",
    "previousStatus": "PENDING_REVIEW",
    "newStatus": "APPROVED",
    "changedBy": {
      "id": "admin-id",
      "fullName": "Admin User"
    },
    "note": "Location verified by the field team",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
]
```

### Statistics

```http
GET {{baseUrl}}/admin/statistics
Authorization: Bearer {{adminToken}}
```

The response is calculated from live SQL aggregate queries:

```json
{
  "totalReports": 4,
  "pendingReports": 1,
  "approvedReports": 1,
  "inProgressReports": 1,
  "resolvedReports": 0,
  "rejectedReports": 1,
  "reportsByStatus": [
    { "status": "PENDING_REVIEW", "count": 1 },
    { "status": "APPROVED", "count": 1 },
    { "status": "IN_PROGRESS", "count": 1 },
    { "status": "RESOLVED", "count": 0 },
    { "status": "REJECTED", "count": 1 }
  ],
  "reportsByCategory": [
    { "categoryId": "category-id", "name": "Roads & Transport", "count": 2 }
  ],
  "recentSubmissions": [
    {
      "id": "report-id",
      "title": "Large pothole on Main Street",
      "status": "PENDING_REVIEW",
      "category": { "id": "category-id", "name": "Roads & Transport" },
      "creator": { "id": "user-id", "fullName": "Test Citizen" },
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

## Comments

Comments are allowed on reports that have passed review: `APPROVED`, `IN_PROGRESS` and `RESOLVED`. Pending and rejected reports reject new comments.

| Method | Path | Access |
| --- | --- | --- |
| GET | `/reports/:reportId/comments` | Public; pending reports limited to owner/admin |
| POST | `/reports/:reportId/comments` | CITIZEN |
| PATCH | `/comments/:id` | Comment author |
| DELETE | `/comments/:id` | Comment author |
| PATCH | `/comments/:id/moderate` | ADMIN, SUPER_ADMIN |

### Add a comment

```http
POST {{baseUrl}}/reports/REPORT_ID/comments
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "content": "I can confirm this issue is still present."
}
```

Comment content is trimmed and must be 2 to 1000 characters.

### List comments

```http
GET {{baseUrl}}/reports/REPORT_ID/comments?page=1&limit=20
```

Public listings exclude hidden comments. Administrators can include them:

```http
GET {{baseUrl}}/reports/REPORT_ID/comments?includeHidden=true
Authorization: Bearer {{adminToken}}
```

### Moderate a comment

```http
PATCH {{baseUrl}}/comments/COMMENT_ID/moderate
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

```json
{
  "hidden": true,
  "reason": "Abusive language"
}
```

Moderation hides comments instead of deleting them. Hidden comments cannot be edited by their author. Send `{"hidden": false}` to restore a comment.

## Notifications

| Method | Path | Access |
| --- | --- | --- |
| GET | `/notifications` | Authenticated |
| GET | `/notifications/unread-count` | Authenticated |
| PATCH | `/notifications/:id/read` | Notification owner |
| PATCH | `/notifications/read-all` | Authenticated |

Query options:

- `page` default `1`.
- `limit` default `20`, maximum `50`.
- `unreadOnly=true` returns unread notifications only.

### Notification generation

| Event | Type |
| --- | --- |
| Report approved | `REPORT_APPROVED` |
| Report rejected | `REPORT_REJECTED` |
| Report moved to in-progress | `REPORT_STATUS_CHANGED` |
| Report resolved | `REPORT_RESOLVED` |
| Someone else comments on the creator's report | `REPORT_COMMENT` |

Notifications are persisted in PostgreSQL with `title`, `message`, `reportId`, `isRead`, `readAt` and `createdAt`. They are not pushed in real time; poll the endpoints.

### Read notifications

```http
PATCH {{baseUrl}}/notifications/NOTIFICATION_ID/read
Authorization: Bearer {{token}}
```

```http
PATCH {{baseUrl}}/notifications/read-all
Authorization: Bearer {{token}}
```

`read-all` returns the number of notifications updated.

## Suggested Postman flow

1. Register a citizen and an administrator, or promote an existing account with SQL.
2. Log in as both and store `token` and `adminToken`.
3. Create a report as the citizen with `POST /reports`.
4. Approve it as the administrator with `PATCH /admin/reports/:id/approve`.
5. Call `GET /reports/:id/history` and verify one history row.
6. Call `GET /notifications` as the citizen and verify the approval notification.
7. Create a second citizen, approve a report, and comment on it with the second citizen.
8. Call `GET /notifications` as the report creator and verify the comment notification.
9. Hide and restore the comment using `PATCH /comments/:id/moderate`.
10. Move the report to in-progress and resolved with the administrator endpoints.
11. Call `GET /admin/statistics` and confirm the counts match the reports you created.

## Common errors

- `400`: validation failure, comment on a pending report, hidden comment edit or invalid status transition.
- `401`: missing or invalid token.
- `403`: non-administrator calling an admin route, non-citizen commenting, or editing another user's comment.
- `404`: missing report, comment or notification; history for an inaccessible report.
- `409`: duplicate report or duplicate verification from Phase 2.

## Automated tests

```powershell
npm --prefix backend test
```

The Phase 3 suite covers administrative permissions, invalid transitions, atomic history creation, comment permissions, moderation, notification creation and read state, and dashboard statistics.
