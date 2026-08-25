# 🚀 SchedX - Deployment Links & Production Access

This document lists all active deployment links, network endpoints, access credentials, and service startup commands for **SchedX (Distributed Job Scheduler)**.

---

## 1. Live Deployment & Access Links

| Environment / Service | Access Link | Description |
| :--- | :--- | :--- |
| 🖥️ **Web Dashboard (Local)** | **[http://localhost:3000](http://localhost:3000)** | Local React 18 + Ant Design Dashboard |
| 📡 **Web Dashboard (Network Access)** | **[http://172.22.11.162:3000](http://172.22.11.162:3000)** | Wi-Fi / Local Area Network (LAN) Dashboard |
| ⚡ **REST API Gateway (Local)** | **[http://localhost:4000](http://localhost:4000)** | Fastify Control Plane API |
| ⚡ **REST API Gateway (Network Access)** | **[http://172.22.11.162:4000](http://172.22.11.162:4000)** | Fastify API exposed on Host `0.0.0.0` |
| 📚 **Swagger API Documentation** | **[http://localhost:4000/documentation](http://localhost:4000/documentation)** | Interactive OpenAPI 3.0 UI |
| 📚 **Swagger API Docs (Network)** | **[http://172.22.11.162:4000/documentation](http://172.22.11.162:4000/documentation)** | Network Interactive OpenAPI UI |
| 🔌 **Realtime WebSocket Stream** | `ws://localhost:4000/ws` | Live Event Stream Feed |
| 🔌 **Realtime WebSocket (Network)** | `ws://172.22.11.162:4000/ws` | Network Live Event Stream Feed |

---

## 2. Seeded Login Credentials

| Role | Email Address | Password | Privileges |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@acme.com` | `password123` | Full Owner & Admin Access across Acme Corp |
| **Developer** | `user@acme.com` | `password123` | Member Access across Analytics Engine |

---

## 3. Host & Port Configuration

```ini
HOST=0.0.0.0
WEB_PORT=3000
API_PORT=4000
DATABASE_URL="file:./dev.db"
JWT_SECRET="super-secret-jwt-token-key-change-in-production"
```

---

## 4. Service Daemon Commands

### Launching Development Daemons:
```bash
# Start API Gateway on Port 4000
npm run dev:api

# Start Background Worker Daemon
npm run dev:worker

# Start Web Dashboard on Port 3000
npm run dev:web
```

### Compiling Production Bundles:
```bash
# Typecheck & generate production assets in apps/web/dist
npm run build
```
