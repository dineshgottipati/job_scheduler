# Database ER Diagram & Schema Specification

## 1. Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ OrganizationMember : "belongs to"
    Organization ||--o{ OrganizationMember : "has members"
    Organization ||--o{ Project : "owns"
    Project ||--o{ Queue : "owns"
    Project ||--o{ RetryPolicy : "defines"
    RetryPolicy ||--o{ Queue : "applies to"
    Queue ||--o{ Job : "contains"
    Queue ||--o{ ScheduledJob : "contains"
    Queue ||--o{ DeadLetterEntry : "tracks"
    Worker ||--o{ Job : "claims"
    Worker ||--o{ JobExecution : "executes"
    Worker ||--o{ WorkerHeartbeat : "emits"
    Job ||--o{ JobExecution : "has attempts"
    JobExecution ||--o{ JobLog : "generates"
    Job ||--o| DeadLetterEntry : "escalates to"
    Job ||--o{ JobDependency : "parent"
    Job ||--o{ JobDependency : "child"

    User {
        uuid id PK
        string email UK
        string password_hash
        string name
        datetime created_at
    }

    Organization {
        uuid id PK
        string name
        string slug UK
    }

    OrganizationMember {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        string role
    }

    Project {
        uuid id PK
        uuid organization_id FK
        string name
        string slug
    }

    Queue {
        uuid id PK
        uuid project_id FK
        string name
        int priority
        int max_concurrency
        boolean is_paused
        datetime deleted_at
    }

    RetryPolicy {
        uuid id PK
        uuid project_id FK
        string name
        string type
        int max_attempts
        int base_delay_seconds
        int max_delay_seconds
    }

    Job {
        uuid id PK
        uuid queue_id FK
        string name
        jsonb payload
        jsonb result
        jsonb error
        int priority
        string status
        int attempt_count
        int max_attempts
        datetime scheduled_at
        datetime claimed_at
        datetime started_at
        datetime completed_at
        datetime lease_expires_at
        uuid worker_id FK
        string idempotency_key UK
    }

    JobExecution {
        uuid id PK
        uuid job_id FK
        uuid worker_id FK
        int attempt_number
        string status
        int duration_ms
        jsonb output
        jsonb error
    }

    JobLog {
        uuid id PK
        uuid execution_id FK
        string level
        string message
        jsonb metadata
    }

    ScheduledJob {
        uuid id PK
        uuid queue_id FK
        string name
        string cron_expression
        string timezone
        datetime next_run_at
    }

    Worker {
        uuid id PK
        string name
        string hostname
        int concurrency
        string status
        datetime last_heartbeat_at
    }

    WorkerHeartbeat {
        uuid id PK
        uuid worker_id FK
        datetime recorded_at
        int active_jobs_count
    }

    DeadLetterEntry {
        uuid id PK
        uuid job_id FK
        uuid queue_id FK
        string reason
        datetime failed_at
        boolean is_resolved
    }
```

---

## 2. Table Cardinalities & Constraints

| Entity | Primary Key | Key Foreign Keys | Unique Constraints | Cascade Rules | Soft Delete |
|:---|:---|:---|:---|:---|:---|
| `users` | `id` (UUID) | - | `email` | - | No |
| `organizations` | `id` (UUID) | - | `slug` | Cascade to projects/members | No |
| `organization_members` | `id` (UUID) | `organization_id`, `user_id` | `[organization_id, user_id]` | Cascade delete | No |
| `projects` | `id` (UUID) | `organization_id` | `[organization_id, slug]` | Cascade to queues/retry policies | No |
| `queues` | `id` (UUID) | `project_id`, `retry_policy_id` | `[project_id, name]` | Set Null on retry policy delete | Yes (`deleted_at`) |
| `retry_policies` | `id` (UUID) | `project_id` | - | Cascade delete | No |
| `jobs` | `id` (UUID) | `queue_id`, `worker_id` | `idempotency_key` | Cascade to executions/logs/DLQ | No |
| `job_executions` | `id` (UUID) | `job_id`, `worker_id` | - | Cascade to logs | No |
| `job_logs` | `id` (UUID) | `execution_id` | - | Cascade delete | No |
| `scheduled_jobs` | `id` (UUID) | `queue_id` | - | Cascade delete | No |
| `workers` | `id` (UUID) | - | - | Set Null on job claim release | No |
| `worker_heartbeats` | `id` (UUID) | `worker_id` | - | Cascade delete | No |
| `dead_letter_entries` | `id` (UUID) | `job_id`, `queue_id` | `job_id` | Cascade delete | No |

---

## 3. High-Performance Index Design

The schema defines indexes optimized specifically for worker queries, queue stats, and execution logs:

1. **Job Claim Index**:
   `jobs(queue_id, priority DESC, scheduled_at ASC, created_at ASC) WHERE status = 'QUEUED'`
   *Optimizes `SELECT FOR UPDATE SKIP LOCKED` worker polling queries.*

2. **Scheduled Job Index**:
   `jobs(scheduled_at ASC) WHERE status = 'SCHEDULED'`
   *Accelerates scheduler scans for due delayed jobs.*

3. **Lease Recovery Index**:
   `jobs(lease_expires_at ASC) WHERE status IN ('CLAIMED', 'RUNNING')`
   *Allows instant lookup of crashed worker jobs whose lease has expired.*

4. **Job Execution History Index**:
   `job_executions(job_id, attempt_number DESC)`
   *Accelerates retrieving historical attempts for a job.*

5. **Job Log Index**:
   `job_logs(execution_id, created_at ASC)`
   *Ensures sequential streaming of log lines per execution attempt.*

6. **Worker Heartbeat Index**:
   `worker_heartbeats(worker_id, recorded_at DESC)`
   *Fast lookup for latest worker heartbeat metrics.*
