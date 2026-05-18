# Frontend Code Structure Refactor Design

**Date:** 2026-05-18
**Scope:** App.jsx decomposition, React Router integration, Context-based state management, CustomAlert rewrite

---

## Goals

1. Decompose App.jsx (~767 lines) into focused modules
2. Replace `activeTab` state switching with React Router v7 (already in dependencies)
3. Replace module-level mutable variables in CustomAlert with Context + Reducer
4. Extract reusable custom hooks for auth and data fetching
5. Eliminate unnecessary re-fetches tied to tab switching

---

## Route Configuration

```
/                       → DashboardPage
/teams                  → TeamsDirectoryPage
/teams/:id              → TeamDetailPage
/teams/:id/manage       → TeamManagementPage
/teams/create           → CreateTeamPage
/tournaments/:id        → TournamentDetailPage
/history                → MatchHistoryPage
/admin                  → AdminConsolePage
/messages               → MessageCenterPage
/profile                → ProfileEditPage
/match/:id              → MatchSchedulingPage
*                       → NotFoundPage
```

---

## Component Tree

```
<App>
  <AuthProvider>
    <AlertProvider>
      <BrowserRouter>
        <Layout>
          <Navbar />          ← Logo + nav tabs + sign-in button
          <Sidebar />         ← Slide-out drawer with user links
          <LoginModal />      ← Login/register form overlay
          <Outlet />          ← Child route content
        </Layout>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/teams" element={<TeamsDirectoryPage />} />
            <Route path="/teams/:id" element={<TeamDetailPage />} />
            <Route path="/teams/:id/manage" element={<TeamManagementPage />} />
            <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
            <Route path="/history" element={<MatchHistoryPage />} />
            <Route path="/match/:id" element={<MatchSchedulingPage />} />
            <Route path="*" element={<NotFoundPage />} />
            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/teams/create" element={<CreateTeamPage />} />
              <Route path="/messages" element={<MessageCenterPage />} />
              <Route path="/profile" element={<ProfileEditPage />} />
              <Route path="/admin" element={<AdminConsolePage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AlertProvider>
  </AuthProvider>
</App>
```

### File Changes Summary

| Action | File | Description |
|--------|------|-------------|
| Rewrite | `src/App.jsx` | ~30 lines: Providers + Router setup only |
| New | `src/context/AuthContext.jsx` | Auth state Context + Provider |
| New | `src/context/AlertContext.jsx` | Alert queue Context + Provider (Promise-based) |
| New | `src/hooks/useAuth.js` | Wraps `useContext(AuthContext)` |
| New | `src/hooks/usePublicData.js` | Public data fetching (tournaments, teams, matches) |
| New | `src/hooks/useAlerts.js` | Wraps `useContext(AlertContext)` |
| New | `src/components/Layout.jsx` | Shell: Navbar + Sidebar + LoginModal + Outlet |
| New | `src/components/Navbar.jsx` | Top navigation bar |
| New | `src/components/Sidebar.jsx` | Slide-out sidebar panel |
| New | `src/components/LoginModal.jsx` | Login/register modal extracted from App.jsx |
| New | `src/components/ProtectedRoute.jsx` | Auth guard: redirects unauthenticated users |
| Rewrite | `src/components/CustomAlert.jsx` | Context-driven, no module-level variables |
| New | `src/pages/DashboardPage.jsx` | Extracted from App.jsx renderDashboard() |
| New | `src/pages/TeamsDirectoryPage.jsx` | Extracted from App.jsx renderTeams() |
| New | `src/pages/MatchHistoryPage.jsx` | Extracted from App.jsx renderHistory() |
| New | `src/pages/NotFoundPage.jsx` | 404 page |
| Edit | `src/pages/*.jsx` | Replace `showAlert` import with `useAlerts`; replace `setActiveTab(x)` + `setSelectedXxxId(y)` calls with `navigate()` |
| Edit | `src/utils/api.js` | baseURL from `import.meta.env.VITE_API_URL` with fallback |

---

## Context Design

### AuthContext

```jsx
// State
{
  isLoggedIn: boolean,
  userName: string,
  userRole: string,          // 'audience' | 'captain' | 'administrator'
  showLoginModal: boolean,
  isLoginMode: boolean,      // true=login, false=register
  loginForm: {
    userName: string,
    password: string,
    confirmPassword: string,
    rank: string,
    mainRole: string,
    intro: string
  },
  loginError: string
}

// Actions exposed via context value
login(userName, password) → Promise<void>
register(formData) → Promise<void>
logout()
showLogin()
hideLogin()
toggleLoginMode()
setLoginForm(partial)
```

On mount, AuthProvider reads `localStorage` for existing token/username/role to restore session. On logout, clears localStorage and dispatches update.

### AlertContext

```jsx
// Internal state (useReducer)
{
  queue: [],
  current: null  // currently displayed alert item
}

// Alert item shape
{ id: number, type: 'alert'|'confirm'|'prompt', message: string, defaultValue: string, resolve: fn, reject: fn }

// Actions exposed via context value
showAlert(message) → Promise<void>
showConfirm(message) → Promise<boolean>
showPrompt(message, defaultValue) → Promise<string | null>
```

Each function pushes an item to the queue and returns a Promise. When the user dismisses the dialog, the Promise resolves/rejects and the next item in the queue is displayed. This eliminates the module-level `alertQueue` and `triggerUpdate = setForceUpdate` pattern.

### CustomAlert Component

Reads from AlertContext. Renders the current alert item (alert/confirm/prompt types). Calls `resolve()` on confirm and `reject()` on cancel, then dispatches `SHIFT` to advance the queue.

---

## Hooks

### usePublicData

Replaces `fetchPublicData` from App.jsx. Fetches tournaments, teams, recent matches, upcoming matches, and game list on first call.

```jsx
// Return value
{
  tournaments: [],
  teams: [],
  recentMatches: [],
  upcomingMatches: [],
  historyMatches: [],
  gameFilters: [],
  fetchHistory(gameFilter),
  refreshAll()
}
```

- `fetchHistory(gameFilter)` loads history on demand (called by MatchHistoryPage)
- `refreshAll()` re-fetches all public data (called after team creation, etc.)
- Data is stored in a simple state object, not in Context (only DashboardPage, TeamsDirectoryPage, and MatchHistoryPage need it)

### useAuth

Thin wrapper: `export function useAuth() { return useContext(AuthContext); }`

### useAlerts

Thin wrapper: `export function useAlerts() { return useContext(AlertContext); }`

---

## State Mapping: Old → New

| Old App.jsx state | New home |
|---|---|
| `isLoggedIn`, `userName`, `userRole` | AuthContext |
| `showLoginModal`, `isLoginMode`, `loginForm`, `loginError` | AuthContext |
| `activeTab` | React Router `useLocation` / NavLink |
| `selectedTournamentId` | Route param `useParams().id` |
| `selectedTeamDetailId` | Route param `useParams().id` |
| `selectedMatchId` | Route param `useParams().id` |
| `selectedTeamId` | TeamManagementPage local state |
| `myTeams` | TeamListSelectPage local state |
| `searchQuery`, `activeFilter` | Respective page local state |
| `historyActiveFilter` | MatchHistoryPage local state |
| `tournaments`, `teams`, `recentMatches`, etc. | usePublicData hook |
| `isSidebarOpen` | Layout component local state |

---

## Navigation Changes

All call sites that previously did `setActiveTab('XXX'); setSelectedXxxId(y)` now call `navigate('/target-path')`.

Examples:
- Clicking a tournament card → `navigate(`/tournaments/${t.TournamentID}`)`
- Clicking a team card → `navigate(`/teams/${t.TeamID}`)`
- Sidebar "团队管理" → `navigate('/teams/manage')` (with team selection logic)

---

## API Utility Improvement

```js
// src/utils/api.js
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 10000,
});
```

Existing interceptors (token injection, 401 handling) remain unchanged.

---

## Migration Notes

- **Non-breaking change**: All existing page components keep their internal logic intact
- **showAlert/useAlerts**: Call sites change from `showAlert(msg)` import to `const { showAlert } = useAlerts()` hook usage
- **No backend changes required**
- **react-router-dom v7**: Already installed, no package changes needed
- Order of implementation: Contexts → Hooks → Layout components → Router in App.jsx → Extract pages → Update navigation calls
