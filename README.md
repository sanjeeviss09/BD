# BDIQ — Business Development Intelligence & Qualification Platform

An enterprise pharmaceutical CDMO Business Development Intelligence, Opportunity Qualification, Production Feasibility, and Meeting Notification Platform.

---

## Architecture Overview

```
.
├── backend/            # Express, Node.js, TypeScript, Supabase backend
│   ├── src/            # Controllers, services, routes, middleware
│   ├── supabase/       # SQL migrations (001 - 023)
│   └── tests/          # Jest unit & regression tests (184 passing tests)
├── frontend/           # React 18, Vite, TypeScript, Tailwind CSS
│   ├── src/            # Pages, components, hooks, contexts
│   └── vercel.json     # SPA routing configuration for Vercel
└── README.md
```

---

## Hosting & Deployment Guide

### 1. Backend on Render (Web Service)

1. Create a **New Web Service** on [Render](https://render.com) and connect the GitHub repository `https://github.com/sanjeeviss09/BD.git`.
2. Configure settings:
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. Add Environment Variables on Render:
   | Variable | Value / Description |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `PORT` | `4000` (or Render's default `$PORT`) |
   | `FRONTEND_URL` | Your Vercel frontend URL (e.g., `https://your-app.vercel.app`) |
   | `SUPABASE_URL` | Your Supabase project URL |
   | `SUPABASE_ANON_KEY` | Your Supabase anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role secret key |

---

### 2. Frontend on Vercel

1. Import the GitHub repository on [Vercel](https://vercel.com).
2. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add Environment Variables on Vercel:
   | Variable | Value / Description |
   | :--- | :--- |
   | `VITE_SUPABASE_URL` | Your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon public key |
   | `VITE_API_URL` | Your Render backend URL (e.g., `https://your-backend.onrender.com`) |

*Note: `frontend/vercel.json` is pre-configured with SPA route rewrites to ensure seamless client-side navigation.*

---

### 3. Database (Supabase)

All database migrations are located in `backend/supabase/migrations/`:
- From `001_initial_schema.sql` through `023_enterprise_notification_system.sql`.
- Execute them sequentially in the Supabase SQL editor or via the Supabase CLI.

---

## Local Development

### Backend
```bash
cd backend
npm install
npm run dev      # Runs with npx tsx watch on http://localhost:4000
npm test         # Runs full Jest test suite (184 tests)
npm run build    # Compiles TypeScript to dist/
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # Runs Vite dev server on http://localhost:5173
npm run build    # Compiles TypeScript and builds production bundle
```
