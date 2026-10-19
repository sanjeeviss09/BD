# BDIQ Platform Deployment Guide

This repository is configured for modern enterprise cloud deployment:
- **Frontend**: Deployed on **Vercel**
- **Backend API**: Deployed on **Render**
- **Database & Auth**: Managed by **Supabase**
- **AI Acceleration**: **NVIDIA Enterprise AI Platform (NIM / NeMo)**

---

## 1. Frontend Deployment (Vercel)

### Live Production Deployment
- **Production URL**: [https://frontend-ten-olive-29.vercel.app](https://frontend-ten-olive-29.vercel.app)
- **Deployment URL**: [https://frontend-orjes6g18-sanjeeviss09s-projects.vercel.app](https://frontend-orjes6g18-sanjeeviss09s-projects.vercel.app)

### Vercel Project Settings
| Setting | Value |
|---|---|
| **Framework Preset** | Vite |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### Environment Variables on Vercel
Configure these in **Project Settings &rarr; Environment Variables**:

| Variable | Description | Example / Production Value |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL | `https://ihykbjwzferyqqzazhfk.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public Supabase Client Key | `eyJhbGciOiJIUzI1NiIsInR5cCI...` |
| `VITE_API_URL` | Render Backend Base URL | `https://bdiq-backend.onrender.com` (your Render service URL) |

> **Note on Client-Side Routing**: The frontend includes `frontend/vercel.json` with SPA catch-all rewrites (`/(.*) -> /index.html`), ensuring deep links like `/meetings/:id` work seamlessly on page refresh.

---

## 2. Backend Deployment (Render)

The backend Express application is container/cloud-ready with automatic port binding, flexible CORS, background schedulers, and zero-downtime health check endpoints.

### Option A: Automatic Blueprint Deployment (Recommended)
1. Go to the [Render Dashboard](https://dashboard.render.com).
2. Click **New +** &rarr; **Blueprint**.
3. Select your GitHub repository: `https://github.com/sanjeeviss09/BD`.
4. Render will automatically detect the [`render.yaml`](./render.yaml) file at the root of the repository.
5. Review the service configuration and click **Apply**.

### Option B: Manual Web Service Setup
If creating the service manually:
1. Click **New +** &rarr; **Web Service**.
2. Select your repository `https://github.com/sanjeeviss09/BD`.
3. Configure the following parameters:
   - **Name**: `bdiq-backend`
   - **Language**: `Node`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`

### Environment Variables on Render
Configure these in **Environment** under your Render service:

| Variable | Recommended Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enables production optimizations and security filters |
| `PORT` | `10000` | Port automatically assigned by Render |
| `FRONTEND_URL` | `https://frontend-ten-olive-29.vercel.app` | Allowed CORS origin (also auto-allows `*.vercel.app`) |
| `SUPABASE_URL` | `https://ihykbjwzferyqqzazhfk.supabase.co` | Supabase API connection |
| `SUPABASE_ANON_KEY` | *(from your backend/.env)* | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | *(your service role secret)* | Server-only Supabase admin key |
| `NVIDIA_API_KEY` | *(your NVIDIA API key)* | Enterprise AI Orchestration Key |
| `NVIDIA_NEMOTRON_PARSE_KEY` | *(your Nemotron Parse key)* | Document parsing and synthesis |
| `NVIDIA_RETRIEVER_KEY` | *(your NeMo retriever key)* | Semantic vector retrieval |
| `NVIDIA_BASE_URL` | `https://integrate.api.nvidia.com/v1` | NVIDIA NIM endpoint |

---

## 3. End-to-End Verification

1. **Verify Backend Health**:
   Visit `https://<your-render-backend-url>/health`. You should receive:
   ```json
   {
     "status": "ok",
     "service": "bdiq-backend",
     "timestamp": "..."
   }
   ```

2. **Verify Frontend Connectivity**:
   Open [https://frontend-ten-olive-29.vercel.app](https://frontend-ten-olive-29.vercel.app). Ensure:
   - Login / authentication routes load without errors.
   - API network calls succeed without CORS errors.
