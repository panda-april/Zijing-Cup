# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zijing Cup is a full-stack esports tournament management platform. The backend is a Node.js/Express REST API using Prisma ORM with SQLite. The frontend is a React 19 SPA built with Vite and Tailwind CSS.

## Development Commands

### Backend (root directory)
```bash
node index.js          # Start backend server on port 3000
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
Start backend first (`node index.js`), then frontend (`cd frontend && npm run dev`).

## Architecture

### Backend (`index.js`)
Single-file Express server (~1300 lines). Key patterns:
- **Auth**: JWT tokens (24h expiry), `verifyToken` middleware, `requireAdmin` for administrator-only routes
- **Roles**: `audience`, `captain`, `administrator`
- **Transactions**: Critical operations (team creation, tournament signup, match results) use `prisma.$transaction()`
- **Soft deletes**: Teams use `DisbandedAt` timestamp instead of hard delete
- **Admin audit log**: All admin actions are logged to `AdminLog` model

API structure:
- Public: `/api/users/register`, `/api/users/login`, `/api/games`, `/api/tournaments`, `/api/teams`, `/api/matches/recent|upcoming|history`
- Authenticated: `/api/me/*`, team management, match scheduling
- Admin only: tournament/match CRUD, result locking, `/api/admin/stats|logs`

### Frontend (`frontend/src/`)
- **`App.jsx`**: ~575 lines. Main application component with global state management, authentication, and navigation. Uses `activeTab` state for page switching (not URL routing).
- **`pages/`**: 10 feature pages imported into App.jsx — `TeamManagement`, `TeamListSelect`, `CreateTeam`, `TournamentDetail`, `AdminConsole`, `MessageCenter`, `MatchDeploy`, `TournamentEdit`, `InputMatchResult`, `DeployTournament`
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
