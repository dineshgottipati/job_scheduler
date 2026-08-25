# REST & WebSocket API Specification

Base URL: `/api/v1`
Interactive Swagger OpenAPI Docs: `http://localhost:4000/documentation`

---

## 1. Authentication Endpoints

### POST `/api/v1/auth/register`
Creates a new user account, default organization, default project, and default queue.

**Request Body:**
```json
{
  "email": "admin@acme.com",
  "password": "password123",
  "name": "Alice Admin"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "u-12345",
    "email": "admin@acme.com",
    "name": "Alice Admin",
    "createdAt": "2026-08-24T21:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsIn..."
}
```

### POST `/api/v1/auth/login`
Authenticates credentials and returns a Bearer JWT token.

**Request Body:**
```json
{
  "email": "admin@acme.com",
  "password": "password123"
}
```

---

## 2. Organization & Project Endpoints

### GET `/api/v1/organizations`
Lists organizations the authenticated user belongs to.

### GET `/api/v1/projects?organizationId=:id`
Lists projects owned by the specified organization.

---

## 3. Queue Management Endpoints

### GET `/api/v1/queues?projectId=:id`
Lists active queues in the given project.

### POST `/api/v1/queues`
Creates a new queue with priority, max concurrency, and retry policy.

### POST `/api/v1/queues/:id/pause`
Pauses job claiming and submissions on the queue.

### POST `/api/v1/queues/:id/resume`
Resumes job claiming on the queue.

### GET `/api/v1/queues/:id/stats`
Returns aggregated throughput, success rate, average duration, and job status breakdown.

---

## 4. Job Lifecycle Endpoints

### POST `/api/v1/jobs`
Submits a single job with optional idempotency key and execution delay.

**Headers:**
`Authorization: Bearer <token>`
`Idempotency-Key: idempotent-key-9921` (Optional)

**Request Body:**
```json
{
  "queueId": "q-12345",
  "name": "send_email",
  "payload": {
    "to": "customer@example.com",
    "subject": "Order Received"
  },
  "priority": 10,
  "scheduledAt": "2026-08-24T22:30:00.000Z"
}
```

### POST `/api/v1/jobs/batch`
Batch submits up to 100 jobs atomically.

### GET `/api/v1/jobs`
Filterable and paginated list of jobs.
Query parameters: `page`, `pageSize`, `projectId`, `queueId`, `status`, `search`, `fromDate`, `toDate`.

### GET `/api/v1/jobs/:id`
Retrieves detailed job information including execution attempts and log lines.

### POST `/api/v1/jobs/:id/retry`
Manually requeues a `FAILED` or `DEAD_LETTER` job.

### GET `/api/v1/jobs/:id/ai-summary`
Generates an AI failure root-cause analysis and recommended fix.

---

## 5. Dead Letter Queue & Worker Cluster Endpoints

### GET `/api/v1/dlq`
Lists all dead-lettered entries.

### POST `/api/v1/dlq/:id/retry`
Requeues a DLQ job and removes it from dead-letter entries.

### POST `/api/v1/dlq/:id/resolve`
Marks a DLQ entry as resolved with optional notes.

### GET `/api/v1/workers`
Lists registered worker cluster nodes and status.

---

## 6. Realtime WebSocket Protocol

Connect to `ws://localhost:4000/ws`

**Event Payload Format:**
```json
{
  "event": "JOB_UPDATED",
  "data": {
    "jobId": "j-9921",
    "status": "COMPLETED",
    "queueId": "q-12345"
  },
  "timestamp": "2026-08-24T22:00:00.000Z"
}
```
