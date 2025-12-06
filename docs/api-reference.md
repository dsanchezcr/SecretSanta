# Secret Santa API Reference

## Base URL
- Local: `http://localhost:7071/api`
- Production: `https://<your-swa-url>/api`

## Supported Languages

The API supports the following languages for game content and email notifications:

| Code | Language | Native Name |
|------|----------|-------------|
| `en` | English | English |
| `es` | Spanish | Español |
| `pt` | Portuguese | Português |
| `fr` | French | Français |
| `it` | Italian | Italiano |
| `ja` | Japanese | 日本語 |
| `zh` | Chinese (Simplified) | 中文 |
| `de` | German | Deutsch |
| `nl` | Dutch | Nederlands |

Use the `language` parameter in request bodies to specify the language for the game. This affects UI translations and email notifications.

## Health Endpoints

### Full Health Check
```
GET /api/health
GET /api/health?verbose=true
```
Returns comprehensive API status including version, uptime, and dependency health.

**Response (200):**
```json
{
  "status": "healthy",
  "version": "prod-abc123",
  "environment": "prod",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "uptime": 3600,
  "checks": {
    "database": {
      "status": "healthy",
      "latencyMs": 45
    },
    "email": {
      "status": "healthy",
      "configured": true
    }
  }
}
```

With `?verbose=true`, includes memory usage:
```json
{
  "memory": {
    "heapUsed": "50.5 MB",
    "heapTotal": "100.2 MB",
    "external": "5.1 MB",
    "rss": "120.3 MB"
  }
}
```

### Liveness Probe
```
GET /api/health/live
```
Simple check that the service is running. Use for Kubernetes liveness probes.

**Response (200):**
```json
{
  "status": "alive",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### Readiness Probe
```
GET /api/health/ready
```
Checks if the service is ready to handle requests (database connectivity).

**Response (200):**
```json
{
  "status": "ready",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "checks": {
    "database": {
      "status": "healthy",
      "latencyMs": 45
    }
  }
}
```

**Response (503) - Not Ready:**
```json
{
  "status": "not_ready",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "checks": {
    "database": {
      "status": "unhealthy",
      "error": "Connection refused"
    }
  }
}
```

## Game Endpoints

### Create Game
```
POST /api/games
```
Creates a new Secret Santa game.

**Validation:**
- `date` must be today or a future date (past dates are rejected with 400 error)
- Minimum 3 participants required
- All participant names must be unique
- `language` must be one of: `en`, `es`, `pt`, `fr`, `it`, `ja`, `zh`, `de`, `nl`

**Request Body:**
```json
{
  "name": "Office Party 2025",
  "amount": "50",
  "currency": "USD",
  "date": "2025-12-25",
  "time": "18:00",
  "location": "Conference Room A",
  "participants": [
    { "name": "Alice", "email": "alice@example.com" },
    { "name": "Bob", "email": "bob@example.com" },
    { "name": "Charlie", "email": "charlie@example.com" }
  ],
  "organizerEmail": "organizer@example.com",
  "isProtected": true,
  "allowReassignment": true,
  "sendEmails": true,
  "language": "en"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "code": "123456",
  "name": "Office Party 2025",
  "organizerToken": "secret-token",
  "participants": [...],
  "assignments": [...],
  "emailResults": {
    "organizerEmailSent": true,
    "participantEmailsSent": 3,
    "participantEmailsFailed": 0
  }
}
```

### Get Game
```
GET /api/games/{code}
```
Retrieves game by 6-digit code.

**Response (200):**
```json
{
  "id": "uuid",
  "code": "123456",
  "name": "Office Party 2025",
  ...
}
```

### Update Game
```
PATCH /api/games/{code}
```
Updates game state (assignments, reassignments, etc.)

**Request Body (example - request reassignment):**
```json
{
  "action": "requestReassignment",
  "participantId": "participant-uuid"
}
```

**Request Body (example - regenerate participant token):**
```json
{
  "action": "regenerateToken",
  "organizerToken": "secret-token",
  "participantId": "participant-uuid"
}
```

**Request Body (example - organizer update):**
```json
{
  "action": "updateGameDetails",
  "organizerToken": "secret-token",
  "name": "Updated Name",
  "date": "2025-12-26"
}
```

**Request Body (example - update participant details):**
```json
{
  "action": "updateParticipantDetails",
  "organizerToken": "secret-token",
  "participantId": "participant-uuid",
  "name": "Updated Name",
  "email": "new@example.com",
  "desiredGift": "Book",
  "wish": "Fiction novels"
}
```

**Request Body (example - add participant):**
```json
{
  "action": "addParticipant",
  "organizerToken": "secret-token",
  "participantName": "Diana",
  "participantEmail": "diana@example.com"
}
```

**Request Body (example - remove participant):**
```json
{
  "action": "removeParticipant",
  "organizerToken": "secret-token",
  "participantId": "participant-uuid"
}
```

**Request Body (example - approve reassignment):**
```json
{
  "action": "approveReassignment",
  "organizerToken": "secret-token",
  "participantId": "participant-uuid"
}
```

**Request Body (example - approve all reassignments):**
```json
{
  "action": "approveAllReassignments",
  "organizerToken": "secret-token"
}
```

**Request Body (example - reassign all participants):**
```json
{
  "action": "reassignAll",
  "organizerToken": "secret-token"
}
```

**Request Body (example - regenerate organizer token):**
```json
{
  "action": "regenerateOrganizerToken",
  "organizerToken": "secret-token"
}
```

> ⚠️ **Security Note:** This action immediately invalidates the current organizer token and generates a new one. The new management link is sent to the organizer's email address. This feature is only available when the email service is configured AND the organizer has an email address on file.

**Response (200):**
```json
{
  "success": true,
  "message": "Organizer token regenerated",
  "emailSent": true
}
```

**Error Responses:**
- `400` - Email service not configured or organizer email missing
- `403` - Invalid organizer token

**Request Body (example - update wish):**
```json
{
  "action": "updateWish",
  "participantId": "participant-uuid",
  "wish": "I'd like a good book"
}
```

**Request Body (example - update participant email):**
```json
{
  "action": "updateParticipantEmail",
  "participantId": "participant-uuid",
  "email": "newemail@example.com"
}
```

### Send Email
```
POST /api/email/send
```
Sends notification emails.

**Request Body:**
```json
{
  "code": "123456",
  "type": "reminder",
  "language": "en",
  "organizerToken": "secret-token",
  "participantId": "participant-uuid",
  "customMessage": "Don't forget about the party!"
}
```

### Delete Game
```
DELETE /api/games/{code}?organizerToken={token}
```
Permanently deletes a game and all its data. **This action is irreversible.**

**Authentication:** Requires organizer token (query param or `x-organizer-token` header).

**Response (200):**
```json
{
  "success": true,
  "message": "Game deleted successfully",
  "deletedCode": "123456"
}
```

**Error Responses:**
- `401` - Missing organizer token
- `403` - Invalid organizer token
- `404` - Game not found
- `503` - Database unavailable

## Background Functions

### Cleanup Expired Games (Timer Trigger)
```
Schedule: 0 0 2 * * * (Daily at 2:00 AM UTC)
```
Automatically deletes games where the event date was 3 or more days ago. This is a background function that runs on a schedule and does not have an HTTP endpoint.

**Behavior:**
- Queries all games with `date <= (today - 3 days)`
- Deletes each expired game from the database
- Logs deletion results to Application Insights
- Sends telemetry events: `CleanupStarted`, `GameAutoDeleted`, `CleanupCompleted`

**Data Retention Policy:**
- Games are automatically deleted 3 days after their event date
- This ensures data privacy and storage optimization
- Organizers can manually delete games at any time before auto-deletion

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Invalid request body or validation error (e.g., past date) |
| 401 | Unauthorized - missing authentication token |
| 403 | Forbidden - invalid authentication token |
| 404 | Game not found |
| 503 | Database or service unavailable |
| 500 | Internal server error |

## Frontend Error Handling

### Token Entry on Error Pages

When a user encounters a protected game error or invalid token error, the frontend provides a token entry form allowing users to manually enter their access token. This is particularly useful when:

- Email service is not configured and users share game codes + tokens separately
- A participant's link has expired and they received a new token from the organizer
- Users copy/paste only the game code without the token parameter

**Error Types with Token Entry:**
- `invalid-token` - When the provided token doesn't match any participant
- `protected-game` - When accessing a protected game without a token

The token entry form shows:
- Input field for the access token
- Hint explaining the token format (the part after `participant=` in the link)
- Submit button to retry access with the entered token
- Option to go back home or ask the organizer for a new link

**Note:** This is a frontend-only feature. The API authentication mechanism remains unchanged - the token is passed to `GET /api/games/{code}` via the `participantToken` query parameter.

