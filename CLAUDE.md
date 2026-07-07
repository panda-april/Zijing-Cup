# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zijing Cup is a full-stack esports tournament management platform. The backend is a Node.js/Express REST API using Prisma ORM with SQLite. The frontend is a React 19 SPA built with Vite and Tailwind CSS.

## Development Commands

### Backend (root directory)
```bash
node src/app.js        # Start backend server on port 3000
npx prisma studio      # Browse/edit database visually
npx prisma db push     # Apply schema changes to dev.db
npx prisma generate    # Regenerate Prisma client after schema changes
```

### Frontend (frontend/ directory)
```bash
npm run dev    # Start Vite dev server (port 5173)
npm run build  # Production build
npm run lint   # ESLint
```

### Running the full stack
Start backend first (`node src/app.js`), then frontend (`cd frontend && npm run dev`).

## Architecture

### Backend (`src/`)
Modular Express server organized by domain:
- **`src/app.js`**: Entry point — Express setup, CORS, JSON, mounts all routers
- **`src/config/`**: JWT_SECRET and PORT from environment
- **`src/middleware/`**: `auth.js` (verifyToken), `admin.js` (requireAdmin), `errorHandler.js` (centralized)
- **`src/utils/`**: `AppError.js`, `recalcTournamentCurrentTeams.js`, `writeAdminLog.js`
- **`src/services/`**: Business logic — `teamDashboardService.js`
- **`src/routes/`**: 10 domain routers (auth, me, users, games, tournaments, teams, matches, proposals, notifications) + 2 admin routers
- **`src/db.js`**: Shared Prisma client instance

Key patterns:
- **Auth**: JWT tokens (24h expiry), `verifyToken` middleware per-route, `requireAdmin` for administrator-only routes
- **Roles**: `audience`, `captain`, `administrator`
- **Transactions**: Critical operations (team creation, tournament signup, match results) use `prisma.$transaction()`
- **Soft deletes**: Teams use `DisbandedAt` timestamp instead of hard delete
- **Admin audit log**: All admin actions are logged to `AdminLog` model
- **Bug fixes applied**: Undeclared variables in `/me/upcoming-matches`, admin log moved inside transaction, consistent Module casing

API structure:
- Public: `/api/users/register`, `/api/users/login`, `/api/games`, `/api/tournaments`, `/api/teams`, `/api/matches/recent|upcoming|history`
- Authenticated: `/api/me/*`, team management, match scheduling
- Admin only: tournament/match CRUD, result locking, `/api/admin/stats|logs`

### Frontend (`frontend/src/`)
- **`App.jsx`**: Main app with React Router v6 route definitions, context providers, and role-based route protection
- **`components/`**: 7 shared components — `Layout`, `Navbar`, `Sidebar`, `LoginModal`, `CustomAlert`, `ProtectedRoute`, `RequireAdmin`
- **`pages/`**: 17 page components + 3 wrapper components for standalone routing
- **`pages/wrappers/`**: `DeployTournamentWrapper`, `TournamentEditWrapper`, `InputMatchResultWrapper` — adapt prop-driven pages for URL routing
- **`context/`**: `AuthContext` (auth state + login modal), `AlertContext` (queue-based alert/confirm system)
- **`hooks/`**: `useAuth`, `useAlerts`, `usePublicData`
- **`utils/api.js`**: Axios instance with base URL `http://localhost:3000/api`, 10s timeout, auto Bearer token injection from localStorage, 401 → logout handler
- Dependencies: React 19, Tailwind CSS v4, react-router-dom, Axios

### Database (`prisma/schema.prisma`)
SQLite via `better-sqlite3`. 11 models:
- Core entities: `User`, `Game`, `Team`, `Tournament`, `MatchInfo`
- Junction tables: `UserTeam` (with `IsCaptain`), `SignUp`, `MatchParticipation`
- Workflow: `TeamRequest` (APPLY/INVITE/RECOMMEND), `MatchProposal` (schedule negotiation with JSON `ProposedTimes` stored as string), `AdminLog`
- `Tournament.CurrentTeams` is a denormalized count — must be recalculated on every signup/withdrawal

### Environment
- `DATABASE_URL="file:./dev.db"` in root `.env`
- No frontend `.env` — API base URL is hardcoded in `utils/api.js`
