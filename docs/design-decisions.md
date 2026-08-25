# Architectural Design Decisions & Technical Trade-Offs

## 1. PostgreSQL as the Queue Source of Truth vs Redis BullMQ / RabbitMQ

### Decision:
We use PostgreSQL with native transactions as the single, durable transactional source of truth for queue states and job payloads, rather than an in-memory broker like Redis BullMQ or RabbitMQ.

### Rationale & Trade-offs:
- **ACID Guarantee & Durability**: Jobs are critical enterprise operations (e.g. payment settlements, invoice generation). Redis in-memory storage runs the risk of data loss on node crashes or un-persisted memory snapshots. PostgreSQL guarantees zero job loss under hard power failures.
- **Transactional Consistency**: Submitting a job can occur inside the same PostgreSQL database transaction as business state updates (e.g. creating an Order record AND queuing an `order_created` job atomically).
- **Simplified Operational Complexity**: Avoids managing separate Redis / RabbitMQ clusters, access credentials, and sync mechanisms.
- **Trade-off**: PostgreSQL throughput is lower than raw Redis in-memory throughput (thousands of ops/sec vs tens of thousands). However, with composite partial indexes (`status = 'QUEUED'`) and `FOR UPDATE SKIP LOCKED`, PostgreSQL easily scales to high-throughput production requirements.

---

## 2. Atomic Claims via `SELECT ... FOR UPDATE SKIP LOCKED`

### Decision:
Worker processes claim jobs using PostgreSQL transactions with `SELECT id FROM jobs ... FOR UPDATE SKIP LOCKED`.

### Rationale:
- **Zero Lock Contention**: `SKIP LOCKED` instructs PostgreSQL to instantly skip any rows currently locked by another worker process. Multiple workers can poll the same queue simultaneously without waiting on locks or causing deadlocks.
- **Strict Concurrency Safety**: Guaranteed exactly-once worker assignment per claim attempt without duplicate claims across distributed nodes.

---

## 3. Polling vs Event-Driven Execution

### Decision:
Workers poll active queues at configurable intervals (e.g. 1000ms), supplemented by instant local task dispatch when concurrency slots open.

### Rationale:
- **Resilience**: Polling automatically self-heals from temporary network drops or backend API restarts. If an event-driven pub/sub listener disconnects, events can be missed unless backed by durable offset logs. Polling relies directly on state in DB.

---

## 4. Polling vs WebSockets for Live Dashboard Updates

### Decision:
The Web Dashboard uses WebSockets (`/ws`) for real-time live updates, with automatic fallback to React Query polling when disconnected.

### Rationale:
- Provides instant visual feedback on job status transitions without hammering the API server with high-frequency HTTP requests.

---

## 5. Monorepo and Modular-Monolith Design

### Decision:
Organized as a clean TypeScript monorepo with `apps/api`, `apps/worker`, `apps/web`, `packages/database`, and `packages/shared`.

### Rationale:
- **Code Sharing**: Shared Zod schemas, TypeScript types, and retry math formulas are compiled once and consumed across API, worker, and frontend.
- **Independent Deployability**: The API server and worker daemon share code but build into separate Docker images that scale independently based on CPU/memory load.

---

## 6. Idempotency & Retry Semantics

### Decision:
- **Idempotent Job Creation**: API consumers provide an `Idempotency-Key` header. If a duplicate submission occurs, the API returns the existing job record without re-queuing.
- **Retry Backoffs**: Pure math algorithms (Fixed, Linear, Exponential) calculate `scheduledAt` dates for failed jobs.

---

## 7. Separate `JobExecution` and `JobLog` Tables

### Decision:
`JobExecution` (attempts) and `JobLog` (log messages) are normalized as separate tables from the parent `Job`.

### Rationale:
- **Auditability**: Preserves full historical audit logs for every individual attempt (attempt #1 failed in 200ms, attempt #2 succeeded in 400ms).
- **Performance**: Prevents bloat on the main `jobs` table, keeping worker queue claims fast and light.
