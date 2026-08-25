# ☁️ SchedX - Step-by-Step Render.com Deployment Guide

This guide provides instructions for deploying **SchedX** to **Render.com** (Free 24/7 Cloud Hosting) so your application stays live online permanently without running `npm` on your local machine.

---

## 🚀 Option 1: One-Click Automated Blueprint Deployment (Recommended)

SchedX includes a pre-configured `render.yaml` Blueprint file in the root directory.

### Steps:
1. Push your repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/schedx-job-scheduler.git
   git push -u origin main
   ```
2. Log into **[Render.com](https://render.com)**.
3. Click **New +** ➔ **Blueprint**.
4. Connect your GitHub repository.
5. Render will automatically detect `render.yaml` and provision:
   - **`schedx-api`** (REST API & WebSocket Server)
   - **`schedx-worker`** (Background Polling Daemon)
   - **`schedx-dashboard`** (Ant Design Web Dashboard)
6. Click **Apply**. Render will build and launch all 3 services with a permanent 24/7 HTTPS link (e.g., `https://schedx-dashboard.onrender.com`)!

---

## 🛠️ Option 2: Manual Step-by-Step Render Deployment

If you prefer to configure each service manually in Render:

### Step 1: Deploy API Server (Web Service)
1. On Render Dashboard, click **New +** ➔ **Web Service**.
2. Connect your GitHub repository.
3. Configure settings:
   - **Name**: `schedx-api`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run dev:api`
4. Add **Environment Variables**:
   - `HOST`: `0.0.0.0`
   - `PORT`: `4000`
   - `DATABASE_URL`: `file:./dev.db`
   - `JWT_SECRET`: `your-random-jwt-secret-key-here`
5. Click **Create Web Service**. (Your API URL: `https://schedx-api.onrender.com`)

---

### Step 2: Deploy Background Worker (Background Worker)
1. On Render Dashboard, click **New +** ➔ **Background Worker**.
2. Connect the same GitHub repository.
3. Configure settings:
   - **Name**: `schedx-worker`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run dev:worker`
4. Add **Environment Variables**:
   - `DATABASE_URL`: `file:./dev.db`
5. Click **Create Background Worker**.

---

### Step 3: Deploy Web Dashboard (Static Site)
1. On Render Dashboard, click **New +** ➔ **Static Site**.
2. Connect the same GitHub repository.
3. Configure settings:
   - **Name**: `schedx-dashboard`
   - **Build Command**: `npm install && npm run build --workspace=@job-scheduler/web`
   - **Publish Directory**: `apps/web/dist`
4. Add **Environment Variable**:
   - `VITE_API_URL`: `https://schedx-api.onrender.com`
5. Click **Create Static Site**. (Your permanent 24/7 Dashboard URL: `https://schedx-dashboard.onrender.com`)

---

## 🔑 Default Login Credentials
Once live, log in using:
- **Email**: `admin@acme.com`
- **Password**: `password123`
