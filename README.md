# Distributed Job Scheduling Platform Monorepo

A production-inspired, distributed job scheduling platform built as a full-stack TypeScript monorepo. Features an API server, independent worker engine with atomic row claims (`SELECT ... FOR UPDATE SKIP LOCKED`), React dashboard, PostgreSQL database, retry backoffs, Dead Letter Queue (DLQ), WebSockets live updates, and AI failure diagnostics.

---

## 🛠 Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, TanStack React Query, Lucide Icons
- **Backend API**: Node.js, Fastify, JWT, WebSockets, Zod Validation, Swagger/OpenAPI
- **Worker Engine**: Node.js, TypeScript, PostgreSQL Row Locking (`FOR UPDATE SKIP LOCKED`)
- **Database & ORM**: PostgreSQL, Prisma ORM
- **Infrastructure**: Docker Compose, npm Workspaces

---

## 📁 Repository Layout

```text
apps/
  api/                 # Fastify REST API & WebSocket Server (Port 4000)
  worker/              # Standalone Job Execution Daemon Process
  web/                 # React Dashboard (Port 3000)
packages/
  database/            # Prisma Schema, Migrations, and Seed Data
  shared/              # Shared TypeScript types, Zod schemas, & retry algorithms
docs/
  architecture.md      # System diagram & component responsibilities
  er-diagram.md        # Database schema, indexes, constraints, cardinalities
  api.md               # REST & WebSocket API specification
  design-decisions.md  # Architectural trade-offs & design decisions
docker-compose.yml     # Containerized full-stack deployment
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js v18+ & npm v10+
- Docker & Docker Compose (or a local PostgreSQL instance running on port 5432)

### 1. Environment Setup
Copy the example environment file:
```bash
cp .env.example .env
```

Default credentials in `.env.example`:
- Database URL: `postgresql://postgres:postgrespassword@localhost:5432/job_scheduler?schema=public`
- JWT Secret: `super-secret-jwt-key-development-32-chars-minimum`

### 2. Start PostgreSQL via Docker Compose
```bash
docker-compose up -d postgres
```

### 3. Install Dependencies & Build Packages
```bash
npm install
npm run build --workspace=@job-scheduler/shared
```

### 4. Run Database Schema Push & Seed
```bash
npm run db:push
npm run db:seed
```

Default seed credentials generated:
- **Admin**: `admin@acme.com` / `password123`
- **Developer**: `dev@acme.com` / `password123`

### 5. Start Development Applications
You can start all 3 services in separate terminal windows:

```bash
# Terminal 1: API Server (http://localhost:4000)
npm run dev:api

# Terminal 2: Worker Process Node
npm run dev:worker

# Terminal 3: React Web Dashboard (http://localhost:3000)
npm run dev:web
```

---

## 🐋 Full Docker Compose Deployment

To build and run the entire stack (PostgreSQL, API, Worker, Web Dashboard) in containerized mode:

```bash
docker-compose up --build
```

Access the dashboard at `http://localhost:3000` and Swagger API docs at `http://localhost:4000/documentation`.

---

## 🧪 Running Automated Tests

Run the test suite across all monorepo packages:

```bash
npm test
```

Tests cover:
- Authentication & JWT token issuance
- Schema validation rules
- Fixed, Linear, and Exponential retry backoff mathematical precision
- Worker handler execution & operational error handling

---

## 📖 System Documentation

- [`docs/architecture.md`](file:///c:/Users/gotti/Downloads/job_scheduler/docs/architecture.md): Architecture diagram, component responsibilities, and concurrency model.
- [`docs/er-diagram.md`](file:///c:/Users/gotti/Downloads/job_scheduler/docs/er-diagram.md): ER diagram, table cardinalities, foreign key cascades, and high-performance database indexes.
- [`docs/api.md`](file:///c:/Users/gotti/Downloads/job_scheduler/docs/api.md): Detailed REST API endpoints and WebSocket event specifications.
- [`docs/design-decisions.md`](file:///c:/Users/gotti/Downloads/job_scheduler/docs/design-decisions.md): Architectural trade-offs (PostgreSQL row locks vs Redis BullMQ, polling vs WebSockets, DB normalization).
