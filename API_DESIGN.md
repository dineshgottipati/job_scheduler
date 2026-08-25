# 🌐 SchedX - REST & WebSocket API Design Specification

## 1. API Conventions & Overview

The **SchedX API** provides a RESTful control plane and a WebSocket realtime event stream for enqueuing jobs, managing priority queues, monitoring worker nodes, inspecting Dead Letter Queue (DLQ) entries, and configuring cron schedules.

### Key Specifications:
- **Base URL**: `http://localhost:4000/api/v1` (Dev) / `http://172.22.11.162:4000/api/v1` (Network)
- **WebSocket Endpoint**: `ws://localhost:4000/ws`
- **Interactive Documentation**: `http://localhost:4000/documentation` (OpenAPI 3.0 / Swagger UI)
- **Content-Type**: `application/json`
- **Authentication**: JWT Bearer Token in `Authorization: Bearer <token>` header

---

## 2. Standard Response Envelopes

### 2.1 Success Response Envelope
```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 15,
    "total": 42,
    "totalPages": 3
  }
}
```

### 2.2 Error Response Envelope
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired authentication token",
    "requestId": "req-9821-ab34"
  }
}
```

---

## 3. Endpoints Reference

```mermaid
graph LR
    Client[📱 Client / Web Dashboard] --> API[⚡ SchedX API Router]

    subgraph API Modules
        API --> Auth[/api/v1/auth]
        API --> Queues[/api/v1/queues]
        API --> Jobs[/api/v1/jobs]
        API --> Workers[/api/v1/workers]
        API --> DLQ[/api/v1/dlq]
        API --> Cron[/api/v1/scheduled-jobs]
    end
```

### 3.1 Authentication & Profile (`/api/v1/auth`)

#### `POST /api/v1/auth/register`
Creates a new user profile, organization, and default project.

- **Request Body**:
  ```json
  {
    "email": "dev@acme.com",
    "password": "Password123!",
    "name": "Alex Developer",
    "organizationName": "Acme Corp"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "u-1042",
      "email": "dev@acme.com",
      "name": "Alex Developer"
    }
  }
  ```

#### `POST /api/v1/auth/login`
- **Request Body**: `{ "email": "dev@acme.com", "password": "Password123!" }`
- **Response `200 OK`**: `{ "token": "...", "user": { ... } }`

#### `GET /api/v1/auth/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response `200 OK`**: Returns current user profile and organization memberships.

---

### 3.2 Queue Management (`/api/v1/queues`)

#### `GET /api/v1/queues`
- **Query Params**: `projectId={id}`
- **Response `200 OK`**:
  ```json
  {
    "queues": [
      {
        "id": "q-981",
        "name": "default",
        "priority": 5,
        "maxConcurrency": 5,
        "isPaused": false,
        "retryPolicy": {
          "name": "Exponential Backoff (1s base)",
          "type": "EXPONENTIAL"
        }
      }
    ]
  }
  ```

#### `POST /api/v1/queues`
- **Request Body**:
  ```json
  {
    "projectId": "p-101",
    "name": "emails-high-priority",
    "priority": 8,
    "maxConcurrency": 10
  }
  ```

#### `POST /api/v1/queues/:id/pause` | `POST /api/v1/queues/:id/resume`
- Toggles queue execution engine state.

---

### 3.3 Job Dispatcher & Explorer (`/api/v1/jobs`)

#### `POST /api/v1/jobs` (Single Job Dispatch)
- **Request Body**:
  ```json
  {
    "queueId": "q-981",
    "name": "send_email",
    "payload": {
      "to": "user@example.com",
      "template": "welcome"
    },
    "scheduledAt": "2026-08-26T01:00:00.000Z",
    "idempotencyKey": "email-tx-9012"
  }
  ```

#### `POST /api/v1/jobs/batch` (Bulk Dispatch)
- **Request Body**:
  ```json
  {
    "queueId": "q-981",
    "jobs": [
      {
        "name": "send_email-1",
        "payload": { "to": "user1@example.com" },
        "idempotencyKey": "batch-101-1"
      },
      {
        "name": "send_email-2",
        "payload": { "to": "user2@example.com" },
        "idempotencyKey": "batch-101-2"
      }
    ]
  }
  ```

#### `GET /api/v1/jobs` (Paginated Explorer)
- **Query Params**: `projectId={id}&page=1&pageSize=15&status=QUEUED&search=email`
- **Response `200 OK`**: Returns paginated job logs with attempt counts, status tags, and error traces.

---

### 3.4 Worker Cluster Management (`/api/v1/workers`)

#### `GET /api/v1/workers`
- **Response `200 OK`**: Returns active, idle, and stale worker node metrics and last executed job details.

#### `POST /api/v1/workers`
- **Request Body**: `{ "name": "worker-us-east-1c", "hostname": "node-srv-03", "concurrency": 10 }`

#### `DELETE /api/v1/workers/:id`
- Deregisters and removes worker node from cluster.

---

### 3.5 Dead Letter Queue (`/api/v1/dlq`)

#### `GET /api/v1/dlq`
- **Response `200 OK`**: Returns permanently failed job entries.

#### `POST /api/v1/dlq/:id/retry`
- Re-enqueues a DLQ job back into active queue for execution.

---

## 4. WebSocket Event Specification (`ws://localhost:4000/ws`)

Clients connect via WebSocket to receive live job stream events:

```json
{
  "type": "JOB_DISPATCHED",
  "payload": {
    "id": "job-8910",
    "name": "send_email",
    "queueName": "default",
    "status": "QUEUED"
  },
  "timestamp": "2026-08-26T00:35:00.000Z"
}
```

### Event Types Broadcasted:
- `JOB_DISPATCHED`: Triggered when a single or batch job is enqueued.
- `JOB_UPDATED`: Triggered when job status changes (`RUNNING`, `COMPLETED`, `FAILED`, `DEAD_LETTER`).
- `WORKER_HEARTBEAT`: Triggered on worker heartbeat metric recordings.
- `QUEUE_PAUSED`: Triggered when a queue engine status is updated.

---

## 5. Error Code Matrix

| Error Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `UNAUTHORIZED` | `401` | Missing, invalid, or expired JWT bearer token |
| `FORBIDDEN` | `403` | User lacks organization or project permissions |
| `NOT_FOUND` | `404` | Requested job, queue, worker, or schedule does not exist |
| `INVALID_PAYLOAD` | `400` | Zod validation failed for request body or query parameters |
| `QUEUE_PAUSED` | `422` | Cannot dispatch job into a paused queue |
| `INTERNAL_SERVER_ERROR` | `500` | Unhandled operational exception |
