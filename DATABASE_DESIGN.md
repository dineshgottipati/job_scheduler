# 🗄️ SchedX - Database Design & Schema Specification

## 1. Overview & Storage Engine

SchedX utilizes **Prisma ORM** over an **SQLite** (development) / **PostgreSQL** (production) relational database engine. The database layer is designed to support:
- **High Concurrency Polling**: Fast indexing for status-based lease acquisition.
- **Idempotency Guarantees**: Unique idempotency keys to prevent duplicate enqueues.
- **Transactional Consistency**: Atomic lease claiming, execution logging, and Dead Letter Queue (DLQ) transfers.
- **Multi-Tenancy**: Organization and Project isolation with Role-Based Access Control (RBAC).

---

## 2. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    users ||--o{ organization_members : "memberships"
    organizations ||--o{ organization_members : "members"
    organizations ||--o{ projects : "contains"
    projects ||--o{ retry_policies : "defines"
    projects ||--o{ queues : "owns"
    retry_policies ||--o{ queues : "applies to"
    queues ||--o{ jobs : "contains"
    queues ||--o{ scheduled_jobs : "schedules"
    queues ||--o{ dead_letter_entries : "captures"
    jobs ||--o{ job_executions : "runs"
    jobs ||--o| dead_letter_entries : "transfers to"
    jobs ||--o{ job_dependencies : "parent of"
    jobs ||--o{ job_dependencies : "child of"
    job_executions ||--o{ job_logs : "emits"
    workers ||--o{ jobs : "claims"
    workers ||--o{ job_executions : "executes"
    workers ||--o{ worker_heartbeats : "records"

    users {
        string id PK
        string email UK
        string password_hash
        string name
        dateTime created_at
        dateTime updated_at
    }

    organizations {
        string id PK
        string name
        string slug UK
        dateTime created_at
        dateTime updated_at
    }

    organization_members {
        string id PK
        string organization_id FK
        string user_id FK
        string role
        dateTime created_at
        dateTime updated_at
    }

    projects {
        string id PK
        string organization_id FK
        string name
        string slug
        string description
        dateTime created_at
        dateTime updated_at
    }

    retry_policies {
        string id PK
        string project_id FK
        string name
        string type
        int max_attempts
        int base_delay_seconds
        int max_delay_seconds
        dateTime created_at
        dateTime updated_at
    }

    queues {
        string id PK
        string project_id FK
        string name
        int priority
        int max_concurrency
        boolean is_paused
        string retry_policy_id FK
        dateTime deleted_at
        dateTime created_at
        dateTime updated_at
    }

    jobs {
        string id PK
        string queue_id FK
        string name
        string payload
        string result
        string error
        int priority
        string status
        int attempt_count
        int max_attempts
        dateTime scheduled_at
        dateTime claimed_at
        dateTime started_at
        dateTime completed_at
        dateTime lease_expires_at
        string worker_id FK
        string idempotency_key UK
        int timeout_seconds
        dateTime created_at
        dateTime updated_at
    }

    job_dependencies {
        string id PK
        string parent_job_id FK
        string child_job_id FK
        dateTime created_at
    }

    job_executions {
        string id PK
        string job_id FK
        string worker_id FK
        int attempt_number
        string status
        dateTime started_at
        dateTime completed_at
        int duration_ms
        string error
        string output
        dateTime created_at
    }

    job_logs {
        string id PK
        string execution_id FK
        string level
        string message
        string metadata
        dateTime created_at
    }

    scheduled_jobs {
        string id PK
        string queue_id FK
        string name
        string payload
        string cron_expression
        string timezone
        int priority
        int max_attempts
        boolean is_paused
        dateTime last_run_at
        dateTime next_run_at
        dateTime created_at
        dateTime updated_at
    }

    workers {
        string id PK
        string name
        string hostname
        int concurrency
        string status
        dateTime started_at
        dateTime stopped_at
        dateTime last_heartbeat_at
        dateTime created_at
        dateTime updated_at
    }

    worker_heartbeats {
        string id PK
        string worker_id FK
        dateTime recorded_at
        int active_jobs_count
        string memory_usage
        float cpu_usage
        dateTime created_at
    }

    dead_letter_entries {
        string id PK
        string job_id FK,UK
        string queue_id FK
        string reason
        dateTime failed_at
        string error_details
        boolean is_resolved
        dateTime resolved_at
        string resolution_notes
        dateTime created_at
    }
```

---

## 3. Data Dictionary & Table Definitions

### 3.1 `users`
Stores system users for dashboard access and JWT authentication.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, Default: UUID | Unique user identifier |
| `email` | `String` | Unique, Required | User email address for login |
| `password_hash` | `String` | Required | Argon2/Bcrypt hashed password |
| `name` | `String` | Required | User full name |
| `created_at` | `DateTime` | Default: NOW() | Creation timestamp |
| `updated_at` | `DateTime` | Auto-update | Last modification timestamp |

### 3.2 `organizations` & `organization_members`
Multi-tenant isolation boundaries. Users belong to organizations with roles (`OWNER`, `ADMIN`, `MEMBER`).
- **Unique Constraint**: `@@unique([organization_id, user_id])`

### 3.3 `queues`
Defines priority queues with maximum concurrency limits and active engine states.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key | Queue identifier |
| `project_id` | `UUID` | Foreign Key (`projects.id`) | Owning project ID |
| `name` | `String` | Unique per Project | Queue identifier (e.g., `emails`, `reports`) |
| `priority` | `Int` | Default: 5 | Queue priority level (0-10) |
| `max_concurrency` | `Int` | Default: 5 | Max parallel executing jobs |
| `is_paused` | `Boolean` | Default: `false` | Engine execution toggle |

### 3.4 `jobs`
The primary table managing job dispatch, lease locking, scheduling, and execution state.
| Column | Type | Index / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key | Unique job ID |
| `queue_id` | `UUID` | Foreign Key (`queues.id`) | Target queue |
| `name` | `String` | Required | Handler action name (e.g. `send_email`) |
| `payload` | `Text` | Default: `{}` | JSON string payload |
| `status` | `String` | Indexed | `QUEUED`, `CLAIMED`, `RUNNING`, `COMPLETED`, `FAILED`, `SCHEDULED`, `DEAD_LETTER` |
| `attempt_count` | `Int` | Default: 0 | Current attempt iteration |
| `max_attempts` | `Int` | Default: 3 | Maximum allowed retries |
| `scheduled_at` | `DateTime` | Indexed | Timestamp when job becomes eligible for execution |
| `lease_expires_at` | `DateTime` | Indexed | Lease expiration lock timestamp |
| `worker_id` | `UUID` | Foreign Key (`workers.id`) | Assigned worker node |
| `idempotency_key` | `String` | Unique, Nullable | Prevents duplicate enqueuing |

---

## 4. Indexing & Query Performance Strategy

To ensure zero lock contention and instantaneous worker polling, the following composite and single-column indexes are enforced:

```prisma
// Job Polling Index (Composite)
@@index([queueId, priority, scheduledAt, createdAt])

// High-frequency Status Lookup
@@index([status])

// Lease Lock Expiration Index
@@index([leaseExpiresAt])

// Scheduled Execution Filter
@@index([scheduledAt])

// Execution Logs Lookup
@@index([executionId, createdAt])

// Worker Metrics Time-Series Lookup
@@index([workerId, recordedAt])
```

---

## 5. Job Status State Machine

```mermaid
stateDiagram-v2
    QUEUED --> CLAIMED : Worker Lease Acquisition
    CLAIMED --> RUNNING : Handler Started
    RUNNING --> COMPLETED : Execution Succeeded
    RUNNING --> FAILED : Exception Thrown
    
    FAILED --> SCHEDULED : Attempt < MaxAttempts (Re-scheduled via Backoff)
    SCHEDULED --> QUEUED : Scheduled Time Expired
    
    FAILED --> DEAD_LETTER : Attempt >= MaxAttempts (Transferred to DLQ)
    DEAD_LETTER --> QUEUED : Manual Retry Triggered
```

---

## 6. Cascading Deletion & Referential Integrity

- **Cascade Delete**: Deleting an `Organization` cascades to all `OrganizationMember` records and `Project` entities.
- **Cascade Delete**: Deleting a `Project` cascades to all child `Queue` and `RetryPolicy` definitions.
- **Cascade Delete**: Deleting a `Queue` cascades to all associated `Job`, `ScheduledJob`, and `DeadLetterEntry` records.
- **Set Null**: Deleting a `Worker` sets `worker_id` on active or historical `Job` records to `NULL`, maintaining execution log auditability.
