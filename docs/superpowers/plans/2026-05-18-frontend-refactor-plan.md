# Frontend Code Structure Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose App.jsx (~767 lines) into Router-driven architecture with Context-based state management and Promise-based alert system.

**Architecture:** React Router v7 provides URL-based navigation. AuthContext + AlertContext replace module-level variables and scattered useState. Custom hooks (usePublicData, useAuth, useAlerts) provide clean data access. Layout component wraps Navbar + Sidebar + Outlet.

**Tech Stack:** React 19, React Router v7, Axios, Tailwind CSS v4, Vite

---

### Task 1: Create AlertContext + useAlerts hook + rewrite CustomAlert

**Files:**
- Create: `frontend/src/context/AlertContext.jsx`
- Create: `frontend/src/hooks/useAlerts.js`
- Rewrite: `frontend/src/components/CustomAlert.jsx`

- [ ] **Step 1: Create AlertContext with Promise-based queue**

Write `frontend/src/context/AlertContext.jsx`:

```jsx
import React, { createContext, useReducer, useCallback, useRef, useEffect } from 'react';

const AlertContext = createContext(null);

function alertReducer(state, action) {
  switch (action.type) {
    case 'PUSH':
      return { ...state, queue: [...state.queue, action.item] };
    case 'SHIFT':
      return { ...state, queue: state.queue.slice(1), current: null };
    case 'SET_CURRENT':
      return { ...state, current: action.item };
    case 'CLOSE_CURRENT':
      return { ...state, current: null };
    default:
      return state;
  }
}

let alertIdCounter = 0;

function createAlertItem(type, message, defaultValue, resolve, reject) {
  return { id: ++alertIdCounter, type, message, defaultValue, resolve, reject };
}

export function AlertProvider({ children }) {
  const [state, dispatch] = useReducer(alertReducer, { queue: [], current: null });
  const processingRef = useRef(false);

  const processNext = useCallback(() => {
    processingRef.current = false;
    if (state.queue.length === 0) return;
    processingRef.current = true;
    const next = state.queue[0];
    dispatch({ type: 'SET_CURRENT', item: next });
  }, [state.queue.length]);

  useEffect(() => {
    if (!state.current && state.queue.length > 0 && !processingRef.current) {
      processNext();
    }
  }, [state.queue.length, state.current, processNext]);

  const makeShowFn = useCallback((type) => {
    return (message, defaultValue = '') => {
      return new Promise((resolve, reject) => {
        dispatch({
          type: 'PUSH',
          item: createAlertItem(
            type,
            message,
            defaultValue,
            (value) => {
              dispatch({ type: 'SHIFT' });
              resolve(value);
            },
            () => {
              dispatch({ type: 'SHIFT' });
              reject(new Error('cancelled'));
            }
          ),
        });
      });
    };
  }, []);

  const showAlert = useCallback((message) => {
    const fn = makeShowFn('alert');
    return fn(message).catch(() => {});
  }, [makeShowFn]);

  const showConfirm = useCallback((message) => {
    const fn = makeShowFn('confirm');
    return fn(message).then(
      () => true,
      () => false
    );
  }, [makeShowFn]);

  const showPrompt = useCallback((message, defaultValue) => {
    const fn = makeShowFn('prompt');
    return fn(message, defaultValue).then(
      (value) => value,
      () => null
    );
  }, [makeShowFn]);

  const handleConfirm = useCallback((value) => {
    if (state.current) {
      const { resolve } = state.current;
      dispatch({ type: 'CLOSE_CURRENT' });
      resolve(value);
    }
  }, [state.current]);

  const handleCancel = useCallback(() => {
    if (state.current) {
      const { reject } = state.current;
      dispatch({ type: 'CLOSE_CURRENT' });
      reject(new Error('cancelled'));
    }
  }, [state.current]);

  const value = {
    showAlert,
    showConfirm,
    showPrompt,
    current: state.current,
    handleConfirm,
    handleCancel,
  };

  return (
    <AlertContext.Provider value={value}>
      {children}
    </AlertContext.Provider>
  );
}

export default AlertContext;
```

- [ ] **Step 2: Create useAlerts hook**

Write `frontend/src/hooks/useAlerts.js`:

```js
import { useContext } from 'react';
import AlertContext from '../context/AlertContext';

export function useAlerts() {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    throw new Error('useAlerts must be used within AlertProvider');
  }
  return ctx;
}
```

- [ ] **Step 3: Rewrite CustomAlert to read from AlertContext**

Write `frontend/src/components/CustomAlert.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import { useAlerts } from '../hooks/useAlerts';

export default function CustomAlert() {
  const { current, handleConfirm, handleCancel } = useAlerts();
  const [visible, setVisible] = useState(false);
  const [promptValue, setPromptValue] = useState('');

  useEffect(() => {
    if (current) {
      setPromptValue(current.defaultValue || '');
      // Small delay for transition animation
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [current]);

  if (!current) return null;

  const type = current.type;

  const onConfirm = () => {
    setVisible(false);
    setTimeout(() => {
      if (type === 'prompt') {
        handleConfirm(promptValue);
      } else {
        handleConfirm(undefined);
      }
    }, 150);
  };

  const onCancel = () => {
    setVisible(false);
    setTimeout(() => handleCancel(), 150);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border-2 border-black w-full max-w-md p-8 shadow-[8px_8px_0_0_#000] relative animate-slide-in">
        <div className="mb-6">
          <div className="w-12 h-12 bg-yellow-400 border-2 border-black flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="square" d="M12 9v4m0 4h.01"></path>
              <circle cx="12" cy="12" r="9" stroke="currentColor"></circle>
            </svg>
          </div>
          <h3 className="text-xl font-black text-center tracking-tight">
            {type === 'alert' ? 'Message' : type === 'confirm' ? 'Confirmation' : 'Input Required'}
          </h3>
        </div>

        <div className="mb-6">
          <p className="text-sm font-bold text-gray-700 whitespace-pre-line text-center">
            {current.message}
          </p>
        </div>

        {type === 'prompt' && (
          <div className="mb-6">
            <input
              type="text"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              className="w-full border-2 border-black px-4 py-3 text-sm font-bold outline-none focus:border-yellow-400 transition-colors"
              autoFocus
            />
          </div>
        )}

        <div className="flex flex-col gap-3">
          {type === 'alert' && (
            <button
              onClick={onConfirm}
              className="w-full bg-black text-yellow-400 py-4 font-black tracking-widest hover:bg-yellow-400 hover:text-black transition-colors shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
            >
              OK
            </button>
          )}
          {(type === 'confirm' || type === 'prompt') && (
            <>
              <button
                onClick={onConfirm}
                className="w-full bg-red-600 text-white border-2 border-red-600 py-3 font-black tracking-widest hover:bg-red-700 transition-colors shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
              >
                CONFIRM
              </button>
              <button
                onClick={onCancel}
                className="w-full bg-white text-black border-2 border-black py-3 font-black tracking-widest hover:bg-black hover:text-white transition-colors"
              >
                CANCEL
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify the file structure**

Run: `ls frontend/src/context/ frontend/src/hooks/`
Expected: AlertContext.jsx and useAlerts.js exist.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/context/AlertContext.jsx frontend/src/hooks/useAlerts.js frontend/src/components/CustomAlert.jsx
git commit -m "feat: add AlertContext with Promise-based queue, rewrite CustomAlert"
```

---

### Task 2: Create AuthContext + useAuth hook

**Files:**
- Create: `frontend/src/context/AuthContext.jsx`
- Create: `frontend/src/hooks/useAuth.js`

- [ ] **Step 1: Create AuthContext with Provider**

Write `frontend/src/context/AuthContext.jsx`:

```jsx
import React, { createContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [loginForm, setLoginForm] = useState({
    userName: '',
    password: '',
    confirmPassword: '',
    rank: '',
    mainRole: '',
    intro: '',
  });
  const [loginError, setLoginError] = useState('');

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('userName');
    const storedRole = localStorage.getItem('userRole');
    if (token && storedUser) {
      setIsLoggedIn(true);
      setUserName(storedUser);
      setUserRole(storedRole || '');
    }
  }, []);

  // Listen for auth:expired events from api.js interceptor
  useEffect(() => {
    const onAuthExpired = () => {
      setIsLoggedIn(false);
      setUserName('');
      setUserRole('');
      setLoginError('登录身份已过期，请重新登录');
      setShowLoginModal(true);
    };
    window.addEventListener('auth:expired', onAuthExpired);
    return () => window.removeEventListener('auth:expired', onAuthExpired);
  }, []);

  const login = useCallback(async (name, password) => {
    setLoginError('');
    try {
      const res = await api.post('/users/login', { userName: name, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('userName', res.data.data.UserName);
      localStorage.setItem('userRole', res.data.data.UserRole);
      setIsLoggedIn(true);
      setUserName(res.data.data.UserName);
      setUserRole(res.data.data.UserRole);
      setShowLoginModal(false);
    } catch (err) {
      setLoginError(err.response?.data?.error || '登录失败，请检查网络或账号密码');
      throw err;
    }
  }, []);

  const register = useCallback(async (formData) => {
    // Frontend validation
    if (!formData.userName || !formData.password) {
      setLoginError('用户名和密码不能为空');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setLoginError('两次输入的密码不一致');
      return;
    }
    if (formData.password.length < 6) {
      setLoginError('密码长度至少6位');
      return;
    }

    await api.post('/users/register', {
      userName: formData.userName,
      password: formData.password,
      rank: formData.rank || null,
      mainRole: formData.mainRole || null,
      intro: formData.intro || null,
      role: 'audience',
    });

    // Auto-login after register
    await login(formData.userName, formData.password);
  }, [login]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    setIsLoggedIn(false);
    setUserName('');
    setUserRole('');
  }, []);

  const openLogin = useCallback(() => {
    setIsLoginMode(true);
    setLoginError('');
    setShowLoginModal(true);
  }, []);

  const closeLogin = useCallback(() => {
    setShowLoginModal(false);
    setLoginError('');
  }, []);

  const toggleLoginMode = useCallback(() => {
    setIsLoginMode((prev) => !prev);
    setLoginError('');
  }, []);

  const updateLoginForm = useCallback((partial) => {
    setLoginForm((prev) => ({ ...prev, ...partial }));
  }, []);

  const value = {
    isLoggedIn,
    userName,
    userRole,
    showLoginModal,
    isLoginMode,
    loginForm,
    loginError,
    login,
    register,
    logout,
    openLogin,
    closeLogin,
    toggleLoginMode,
    updateLoginForm,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
```

- [ ] **Step 2: Create useAuth hook**

Write `frontend/src/hooks/useAuth.js`:

```js
import { useContext } from 'react';
import AuthContext from '../context/AuthContext';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/context/AuthContext.jsx frontend/src/hooks/useAuth.js
git commit -m "feat: add AuthContext with login/register/logout, useAuth hook"
```

---

### Task 3: Create usePublicData hook

**Files:**
- Create: `frontend/src/hooks/usePublicData.js`

- [ ] **Step 1: Create usePublicData hook**

Write `frontend/src/hooks/usePublicData.js`:

```js
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';

export function usePublicData() {
  const [tournaments, setTournaments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [historyMatches, setHistoryMatches] = useState([]);
  const [gameFilters, setGameFilters] = useState(['ALL']);
  const [historyFilter, setHistoryFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tourRes, teamRes, recentRes, upcomingRes, gamesRes] =
        await Promise.allSettled([
          api.get('/tournaments'),
          api.get('/teams'),
          api.get('/matches/recent'),
          api.get('/matches/upcoming'),
          api.get('/games'),
        ]);

      if (tourRes.status === 'fulfilled' && tourRes.value.data?.success) {
        setTournaments(tourRes.value.data.data);
      }
      if (teamRes.status === 'fulfilled' && teamRes.value.data?.success) {
        setTeams(teamRes.value.data.data);
      }
      if (recentRes.status === 'fulfilled' && recentRes.value.data?.success) {
        setRecentMatches(recentRes.value.data.data);
      }
      if (upcomingRes.status === 'fulfilled' && upcomingRes.value.data?.success) {
        setUpcomingMatches(upcomingRes.value.data.data);
      }
      if (gamesRes.status === 'fulfilled' && gamesRes.value.data?.success) {
        setGameFilters(['ALL', ...gamesRes.value.data.data.map((g) => g.GameName)]);
      }
    } catch (error) {
      console.error('[usePublicData] fetch failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (gameFilter = 'ALL') => {
    setHistoryFilter(gameFilter);
    try {
      const query = gameFilter !== 'ALL' ? `?game=${encodeURIComponent(gameFilter)}` : '';
      const res = await api.get(`/matches/history${query}`);
      if (res.data.success) {
        setHistoryMatches(res.data.data);
      }
    } catch (error) {
      console.error('获取历史战绩失败:', error);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchAll();
    }
  }, [fetchAll]);

  return {
    tournaments,
    teams,
    recentMatches,
    upcomingMatches,
    historyMatches,
    gameFilters,
    historyFilter,
    loading,
    refreshAll: fetchAll,
    fetchHistory,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/usePublicData.js
git commit -m "feat: add usePublicData hook for fetching tournaments, teams, matches"
```

---

### Task 4: Create Layout components (Navbar, Sidebar, LoginModal)

**Files:**
- Create: `frontend/src/components/Navbar.jsx`
- Create: `frontend/src/components/Sidebar.jsx`
- Create: `frontend/src/components/LoginModal.jsx`
- Create: `frontend/src/components/Layout.jsx`

- [ ] **Step 1: Create Navbar component**

Write `frontend/src/components/Navbar.jsx`:

```jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
  const { isLoggedIn, userName, openLogin } = useAuth();

  const linkClass = ({ isActive }) =>
    `tracking-widest transition-colors ${isActive ? 'text-black border-b-2 border-black pb-0.5' : 'hover:text-black'}`;

  return (
    <nav className="bg-white border-b border-black p-4 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-baseline gap-8">
          <h1 className="text-2xl font-black tracking-tighter cursor-pointer hover:opacity-70 transition-colors">
            <NavLink to="/">Zijing Cup.</NavLink>
          </h1>
          <div className="hidden md:flex gap-6 text-sm font-bold text-gray-500">
            <NavLink to="/" end className={linkClass}>赛事总览</NavLink>
            <NavLink to="/teams" className={linkClass}>参赛队伍</NavLink>
            <NavLink to="/history" className={linkClass}>历史战绩</NavLink>
          </div>
        </div>

        <div>
          {isLoggedIn ? (
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold tracking-wider">{userName}</span>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('sidebar:toggle'))}
                className="p-1 hover:text-[#660874] hover:bg-gray-50 transition-colors"
              >
                <svg className="w-6 h-6 text-current" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="square" d="M3 6h18M3 12h18M3 18h18"></path>
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={openLogin}
              className="bg-black text-white px-5 py-2 font-bold tracking-widest text-xs hover:bg-[#660874] transition-colors"
            >
              SIGN IN
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Create Sidebar component**

Write `frontend/src/components/Sidebar.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';

export default function Sidebar() {
  const { userName, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsOpen((prev) => !prev);
    window.addEventListener('sidebar:toggle', handler);
    return () => window.removeEventListener('sidebar:toggle', handler);
  }, []);

  const closeAndGo = (path) => {
    setIsOpen(false);
    navigate(path);
  };

  const handleTeamManagement = async () => {
    try {
      const res = await api.get('/me/team-dashboard');
      if (res.data.success) {
        const teamsData = res.data.data || [];
        if (teamsData.length === 1) {
          const teamId = teamsData[0].Team?.TeamID;
          closeAndGo(`/teams/${teamId}/manage`);
        } else {
          closeAndGo('/teams/manage');
        }
      }
    } catch (err) {
      console.error('获取团队列表失败:', err);
      closeAndGo('/teams/manage');
    }
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate('/');
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-white/80 backdrop-blur-sm z-30 transition-opacity"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-white border-l border-black z-40 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-8 h-full flex flex-col">
          <div className="flex justify-between items-start mb-12">
            <div>
              <p className="text-[10px] text-gray-500 font-bold tracking-widest mb-1">Account</p>
              <p className="text-xl font-black">{userName}</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-black transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="square" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <div className="flex-1 flex flex-col gap-1">
            {userRole === 'administrator' ? (
              <button
                onClick={() => closeAndGo('/admin')}
                className="text-left py-3 text-lg font-bold tracking-wider hover:pl-2 hover:text-[#660874] text-gray-500 transition-all"
              >
                管理员界面
              </button>
            ) : (
              <>
                <button
                  onClick={handleTeamManagement}
                  className="text-left py-3 text-lg font-bold tracking-wider hover:pl-2 hover:text-[#660874] text-gray-500 transition-all"
                >
                  团队管理
                </button>
                <button
                  onClick={() => closeAndGo('/messages')}
                  className="text-left py-3 text-lg font-bold tracking-wider hover:pl-2 hover:text-[#660874] text-gray-500 transition-all"
                >
                  消息中心
                </button>
              </>
            )}
            <button
              onClick={() => closeAndGo('/profile')}
              className="text-left py-3 text-lg font-bold tracking-wider hover:pl-2 hover:text-[#660874] text-gray-500 transition-all"
            >
              个人信息
            </button>
          </div>

          <div className="mt-auto border-t border-black pt-6">
            <button
              onClick={handleLogout}
              className="w-full text-left py-2 font-bold tracking-widest text-red-600 hover:bg-red-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Create LoginModal component**

Write `frontend/src/components/LoginModal.jsx`:

```jsx
import React from 'react';
import { useAuth } from '../hooks/useAuth';

export default function LoginModal() {
  const {
    showLoginModal,
    isLoginMode,
    loginForm,
    loginError,
    login,
    register,
    closeLogin,
    toggleLoginMode,
    updateLoginForm,
  } = useAuth();

  if (!showLoginModal) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoginMode) {
      try {
        await login(loginForm.userName, loginForm.password);
      } catch (err) {
        // loginError is set by the caller pattern — we need to handle this
        // The login function in AuthContext doesn't set loginError on failure
        // We'll handle it through the auth:expired event or direct error
        console.error('Login failed:', err);
      }
    } else {
      await register(loginForm);
    }
  };

  // Wrap login to catch errors
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(loginForm.userName, loginForm.password);
    } catch (err) {
      // Error will surface via auth:expired or we can set it here
      // We use a local state approach — the AuthContext login already handles errors
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    await register(loginForm);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border-2 border-black w-full max-w-md p-8 shadow-2xl relative">
        <button onClick={closeLogin} className="absolute top-4 right-4 text-gray-400 hover:text-black transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="square" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
        <h2 className="text-3xl font-black tracking-tight mb-8">
          {isLoginMode ? (<>Access<br />Account.</>) : (<>Create<br />Account.</>)}
        </h2>

        <form onSubmit={isLoginMode ? handleLogin : handleRegister} className="flex flex-col gap-6">
          <div>
            <label className="block text-xs font-bold tracking-widest text-gray-500 mb-2">Username</label>
            <input
              type="text" required
              value={loginForm.userName}
              onChange={(e) => updateLoginForm({ userName: e.target.value })}
              className="w-full border-b-2 border-gray-200 focus:border-black py-2 outline-none font-bold transition-colors bg-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widest text-gray-500 mb-2">Password</label>
            <input
              type="password" required
              value={loginForm.password}
              onChange={(e) => updateLoginForm({ password: e.target.value })}
              className="w-full border-b-2 border-gray-200 focus:border-black py-2 outline-none transition-colors bg-transparent"
            />
          </div>
          {!isLoginMode && (
            <>
              <div>
                <label className="block text-xs font-bold tracking-widest text-gray-500 mb-2">Confirm Password</label>
                <input
                  type="password" required
                  value={loginForm.confirmPassword}
                  onChange={(e) => updateLoginForm({ confirmPassword: e.target.value })}
                  className="w-full border-b-2 border-gray-200 focus:border-black py-2 outline-none transition-colors bg-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold tracking-widest text-gray-500 mb-2">Rank / 段位 (可选)</label>
                  <input
                    type="text"
                    value={loginForm.rank}
                    onChange={(e) => updateLoginForm({ rank: e.target.value })}
                    className="w-full border-b-2 border-gray-200 focus:border-black py-2 outline-none font-bold transition-colors bg-transparent"
                    placeholder="e.g. Diamond"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest text-gray-500 mb-2">Main Role / 主位置 (可选)</label>
                  <input
                    type="text"
                    value={loginForm.mainRole}
                    onChange={(e) => updateLoginForm({ mainRole: e.target.value })}
                    className="w-full border-b-2 border-gray-200 focus:border-black py-2 outline-none font-bold transition-colors bg-transparent"
                    placeholder="e.g. Carry"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold tracking-widest text-gray-500 mb-2">Introduction / 个人介绍 (可选)</label>
                <textarea
                  value={loginForm.intro}
                  onChange={(e) => updateLoginForm({ intro: e.target.value })}
                  className="w-full border-b-2 border-gray-200 focus:border-black py-2 outline-none font-bold transition-colors bg-transparent resize-none h-20"
                  placeholder="简单介绍一下自己..."
                />
              </div>
            </>
          )}
          {loginError && <p className="text-red-600 text-xs font-bold">{loginError}</p>}
          <button type="submit" className="mt-4 bg-[#660874] text-white py-4 font-black tracking-widest hover:opacity-90 transition-opacity">
            {isLoginMode ? 'Sign In' : 'Create Account'}
          </button>
          <div className="text-center pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={toggleLoginMode}
              className="text-xs font-bold text-gray-500 hover:text-black transition-colors tracking-widest"
            >
              {isLoginMode ? "Don't have an account? → Create one" : 'Already have an account? → Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create Layout component**

Write `frontend/src/components/Layout.jsx`:

```jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import LoginModal from './LoginModal';

export default function Layout() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans relative overflow-x-hidden selection:bg-[#660874] selection:text-white">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
        .animate-slide-in { animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
      <Navbar />
      <Sidebar />
      <LoginModal />
      <Outlet />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Navbar.jsx frontend/src/components/Sidebar.jsx frontend/src/components/LoginModal.jsx frontend/src/components/Layout.jsx
git commit -m "feat: add Layout, Navbar, Sidebar, LoginModal components"
```

---

### Task 5: Create ProtectedRoute and NotFoundPage

**Files:**
- Create: `frontend/src/components/ProtectedRoute.jsx`
- Create: `frontend/src/pages/NotFoundPage.jsx`

- [ ] **Step 1: Create ProtectedRoute**

Write `frontend/src/components/ProtectedRoute.jsx`:

```jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute() {
  const { isLoggedIn, openLogin } = useAuth();

  if (!isLoggedIn) {
    // Trigger login modal and redirect
    openLogin();
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
```

- [ ] **Step 2: Create NotFoundPage**

Write `frontend/src/pages/NotFoundPage.jsx`:

```jsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
      <h1 className="text-8xl font-black text-gray-200 mb-4">404</h1>
      <p className="text-xl font-bold text-gray-500 mb-8">Page Not Found</p>
      <Link
        to="/"
        className="inline-block bg-black text-white px-8 py-3 font-bold tracking-widest text-sm hover:bg-[#660874] transition-colors"
      >
        BACK TO HOME
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ProtectedRoute.jsx frontend/src/pages/NotFoundPage.jsx
git commit -m "feat: add ProtectedRoute auth guard and NotFoundPage"
```

---

### Task 6: Extract page components from App.jsx

**Files:**
- Create: `frontend/src/pages/DashboardPage.jsx`
- Create: `frontend/src/pages/TeamsDirectoryPage.jsx`
- Create: `frontend/src/pages/MatchHistoryPage.jsx`

- [ ] **Step 1: Create DashboardPage — extracted from App.jsx renderDashboard()**

Write `frontend/src/pages/DashboardPage.jsx`:

```jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePublicData } from '../hooks/usePublicData';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { tournaments, recentMatches, upcomingMatches, loading } = usePublicData();

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-center py-20 text-gray-400 font-bold tracking-widest">LOADING...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 animate-fade-in">
        <section className="lg:col-span-8">
          <div className="border-b border-black pb-4 mb-8">
            <h2 className="text-3xl font-black tracking-tight">Tournaments</h2>
          </div>
          <div className="flex flex-col">
            {tournaments.length === 0 ? (
              <p className="py-10 text-gray-400 font-bold tracking-widest text-sm text-center">
                No Tournaments Yet.
              </p>
            ) : (
              tournaments.map((t) => (
                <div
                  key={t.TournamentID}
                  className="border-b border-gray-200 py-8 group cursor-pointer hover:bg-gray-50 px-2 transition-colors"
                  onClick={() => navigate(`/tournaments/${t.TournamentID}`)}
                >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-3">
                    <h3 className="text-2xl font-bold group-hover:underline underline-offset-4 decoration-2">
                      {t.TournamentName}
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold border border-black px-2 py-1">
                        {t.Game?.GameName || '未指定'}
                      </span>
                      <span className="text-xs font-bold px-2 py-1 bg-black text-white">报名中</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium">
                    <p className="text-gray-500">
                      最高规模: <span className="text-black font-bold">{t.MaxTeamSize || 0} 支队伍</span>
                    </p>
                    <span className="text-black opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                      Details →
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="lg:col-span-4 space-y-16">
          <section>
            <h2 className="text-xl font-bold border-b border-black pb-4 mb-6">Recent Results</h2>
            <div className="flex flex-col border-t border-gray-100">
              {recentMatches.length === 0 ? (
                <p className="py-6 text-gray-400 font-bold tracking-widest text-xs text-center">
                  No Recent Results.
                </p>
              ) : (
                recentMatches.map((m) => (
                  <div key={m.id} className="py-4 border-b border-gray-100">
                    <p className="text-[10px] text-gray-400 font-bold mb-2">
                      {m.tournament} / {m.time}
                    </p>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-sm ${m.winnerA ? 'font-bold text-black' : 'text-gray-400'}`}>
                        {m.teamA}
                      </span>
                      <span className={`font-black ${m.winnerA ? 'text-[#660874]' : 'text-gray-300'}`}>
                        {m.scoreA ?? '-'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`text-sm ${m.winnerA === false ? 'font-bold text-black' : 'text-gray-400'}`}>
                        {m.teamB}
                      </span>
                      <span className={`font-black ${m.winnerA === false ? 'text-[#660874]' : 'text-gray-300'}`}>
                        {m.scoreB ?? '-'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold border-b border-black pb-4 mb-6">Upcoming Matches</h2>
            <div className="flex flex-col border-t border-gray-100">
              {upcomingMatches.length === 0 ? (
                <p className="py-6 text-gray-400 font-bold tracking-widest text-xs text-center">
                  No Upcoming Matches.
                </p>
              ) : (
                upcomingMatches.map((m) => (
                  <div key={m.id} className="py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] font-bold bg-black text-white px-2 py-0.5 tracking-wider">
                        {m.time}
                      </span>
                      <span className="text-xs text-gray-500 font-bold truncate">{m.tournament}</span>
                    </div>
                    <div className="flex flex-col gap-1 mt-3 text-sm font-bold">
                      <span className="text-black">{m.teamA}</span>
                      <span className="text-[10px] text-gray-400 font-medium">vs</span>
                      <span className="text-black">{m.teamB}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create TeamsDirectoryPage — extracted from App.jsx renderTeams()**

Write `frontend/src/pages/TeamsDirectoryPage.jsx`:

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePublicData } from '../hooks/usePublicData';
import { useAuth } from '../hooks/useAuth';

export default function TeamsDirectoryPage() {
  const navigate = useNavigate();
  const { teams, gameFilters } = usePublicData();
  const { isLoggedIn } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  const filtered = teams.filter(t => {
    const matchesSearch =
      !searchQuery.trim() ||
      t.TeamName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGame =
      activeFilter === 'ALL' ||
      (t.Game?.GameName || '未指定') === activeFilter;
    return matchesSearch && matchesGame;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between md:items-end border-b border-black pb-4 mb-8 gap-4">
          <h2 className="text-3xl font-black tracking-tight">Teams Directory</h2>
          {isLoggedIn && (
            <button
              onClick={() => navigate('/teams/create')}
              className="bg-[#660874] text-white px-6 py-2 font-bold text-sm hover:opacity-90 transition-opacity w-fit"
            >
              + 组建新队伍
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="w-full md:w-1/2 relative group">
            <input
              type="text"
              placeholder="SEARCH TEAMS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border-b-2 border-gray-200 focus:border-black py-2 pl-2 pr-4 outline-none font-bold tracking-wider text-sm transition-colors bg-transparent"
            />
          </div>
          <div className="relative w-full md:w-auto">
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="w-full md:w-auto flex items-center justify-between gap-6 border border-black bg-white px-4 py-3 font-bold text-xs"
            >
              <span>
                GAME:{' '}
                <span className={activeFilter !== 'ALL' ? 'text-[#660874]' : ''}>{activeFilter}</span>
              </span>
              <span>↓</span>
            </button>
            {isFilterDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsFilterDropdownOpen(false)}></div>
                <div className="absolute top-full right-0 w-full md:w-48 bg-white border border-black z-30 mt-1 max-h-48 overflow-y-auto shadow-xl">
                  {gameFilters.map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        setActiveFilter(g);
                        setIsFilterDropdownOpen(false);
                      }}
                      className={`block w-full text-left px-4 py-3 text-xs font-bold hover:bg-gray-100 border-b border-gray-100 ${
                        activeFilter === g ? 'bg-black text-white' : ''
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-black">
          {filtered.length === 0 ? (
            <div className="py-20 text-center text-gray-400 font-medium tracking-widest">No Teams Found.</div>
          ) : (
            filtered.map((t) => (
              <div
                key={t.TeamID}
                className="border-b border-gray-200 py-6 flex flex-col md:flex-row justify-between md:items-center gap-6 group hover:bg-gray-50 px-2 transition-colors cursor-pointer"
                onClick={() => navigate(`/teams/${t.TeamID}`)}
              >
                <div className="flex-1">
                  <h3 className="text-2xl font-black mb-2 group-hover:underline underline-offset-4 decoration-2">
                    {t.TeamName}
                  </h3>
                  <div className="text-[10px] font-bold text-gray-400 space-x-4 tracking-wider">
                    <span className="text-black border border-black px-1">{t.Game?.GameName || '未指定'}</span>
                  </div>
                </div>
                <div className="flex items-center md:justify-end md:w-1/3">
                  <span className="text-sm font-bold tracking-wider text-black opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    VIEW DETAILS →
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create MatchHistoryPage — extracted from App.jsx renderHistory()**

Write `frontend/src/pages/MatchHistoryPage.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import { usePublicData } from '../hooks/usePublicData';

export default function MatchHistoryPage() {
  const { historyMatches, gameFilters, historyFilter, fetchHistory } = usePublicData();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    fetchHistory(historyFilter);
  }, [historyFilter, fetchHistory]);

  const filtered = historyMatches.filter((h) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      h.teamA.toLowerCase().includes(q) ||
      h.teamB.toLowerCase().includes(q) ||
      h.tournament.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="animate-fade-in">
        <div className="border-b border-black pb-4 mb-8">
          <h2 className="text-3xl font-black tracking-tight">History</h2>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="w-full md:w-1/2 relative group">
            <input
              type="text"
              placeholder="SEARCH HISTORY..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border-b-2 border-gray-200 focus:border-black py-2 pl-2 pr-4 outline-none font-bold tracking-wider text-sm transition-colors bg-transparent"
            />
          </div>
          <div className="relative w-full md:w-auto">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full md:w-auto flex items-center justify-between gap-6 border border-black bg-white px-4 py-3 font-bold text-xs"
            >
              <span>
                GAME:{' '}
                <span className={historyFilter !== 'ALL' ? 'text-[#660874]' : ''}>{historyFilter}</span>
              </span>
              <span>↓</span>
            </button>
            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                <div className="absolute top-full right-0 w-full md:w-48 bg-white border border-black z-30 mt-1 max-h-48 overflow-y-auto shadow-xl">
                  {gameFilters.map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        fetchHistory(g);
                        setIsDropdownOpen(false);
                      }}
                      className={`block w-full text-left px-4 py-3 text-xs font-bold hover:bg-gray-100 border-b border-gray-100 ${
                        historyFilter === g ? 'bg-black text-white' : ''
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="border-t border-black">
          {filtered.map((h) => (
            <div key={h.id} className="border-b border-gray-100 py-8 group hover:bg-gray-50 transition-colors px-2">
              <div className="text-[10px] font-bold text-gray-400 mb-4 space-x-2">
                <span className="text-black border border-black px-1">{h.game}</span>
                <span>{h.date}</span>
                <span>/</span>
                <span className="text-black">{h.tournament}</span>
              </div>
              <div className="flex items-center gap-8">
                <span className={`text-2xl font-black flex-1 text-right ${h.scoreA > h.scoreB ? 'text-black' : 'text-gray-300'}`}>
                  {h.teamA}
                </span>
                <div className="bg-gray-100 px-6 py-2 text-3xl font-black flex gap-4">
                  <span className={h.scoreA > h.scoreB ? 'text-[#660874]' : 'text-gray-400'}>{h.scoreA}</span>
                  <span className="text-gray-300">-</span>
                  <span className={h.scoreB > h.scoreA ? 'text-[#660874]' : 'text-gray-400'}>{h.scoreB}</span>
                </div>
                <span className={`text-2xl font-black flex-1 ${h.scoreB > h.scoreA ? 'text-black' : 'text-gray-300'}`}>
                  {h.teamB}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/DashboardPage.jsx frontend/src/pages/TeamsDirectoryPage.jsx frontend/src/pages/MatchHistoryPage.jsx
git commit -m "feat: extract DashboardPage, TeamsDirectoryPage, MatchHistoryPage from App.jsx"
```

---

### Task 7: Rewrite App.jsx with Router + Providers

**Files:**
- Rewrite: `frontend/src/App.jsx`

- [ ] **Step 1: Rewrite App.jsx**

Write `frontend/src/App.jsx`:

```jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import CustomAlert from './components/CustomAlert';

import DashboardPage from './pages/DashboardPage';
import TeamsDirectoryPage from './pages/TeamsDirectoryPage';
import MatchHistoryPage from './pages/MatchHistoryPage';
import TeamDetail from './pages/TeamDetail';
import TeamManagement from './pages/TeamManagement';
import TournamentDetail from './pages/TournamentDetail';
import CreateTeam from './pages/CreateTeam';
import AdminConsole from './pages/AdminConsole';
import MessageCenter from './pages/MessageCenter';
import ProfileEdit from './pages/ProfileEdit';
import MatchScheduling from './pages/MatchScheduling';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <AuthProvider>
      <AlertProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              {/* Public routes */}
              <Route path="/" element={<DashboardPage />} />
              <Route path="/teams" element={<TeamsDirectoryPage />} />
              <Route path="/teams/:id" element={<TeamDetail />} />
              <Route path="/tournaments/:id" element={<TournamentDetail />} />
              <Route path="/history" element={<MatchHistoryPage />} />
              <Route path="/match/:id" element={<MatchScheduling />} />
              <Route path="*" element={<NotFoundPage />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/teams/create" element={<CreateTeam />} />
                <Route path="/teams/:id/manage" element={<TeamManagement />} />
                <Route path="/messages" element={<MessageCenter />} />
                <Route path="/profile" element={<ProfileEdit />} />
                <Route path="/admin" element={<AdminConsole />} />
              </Route>
            </Route>
          </Routes>
          <CustomAlert />
        </BrowserRouter>
      </AlertProvider>
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "refactor: rewrite App.jsx with Router, Context Providers, Layout"
```

---

### Task 8: Update existing page components — navigation and alerts

**Files:**
- Modify: `frontend/src/pages/TeamDetail.jsx`
- Modify: `frontend/src/pages/TeamManagement.jsx`
- Modify: `frontend/src/pages/TournamentDetail.jsx`
- Modify: `frontend/src/pages/CreateTeam.jsx`
- Modify: `frontend/src/pages/MessageCenter.jsx`
- Modify: `frontend/src/pages/ProfileEdit.jsx`
- Modify: `frontend/src/pages/MatchScheduling.jsx`
- Modify: `frontend/src/pages/AdminConsole.jsx`
- Modify: `frontend/src/pages/DeployTournament.jsx`
- Modify: `frontend/src/pages/TournamentEdit.jsx`
- Modify: `frontend/src/pages/InputMatchResult.jsx`
- Modify: `frontend/src/pages/MatchDeploy.jsx`

**Pattern for alert import change:**
Replace `import { showAlert } from '../components/CustomAlert'` with `import { useAlerts } from '../hooks/useAlerts'` and add `const { showAlert } = useAlerts()` inside the component.

For files that also import `showConfirm`/`showPrompt`, add those to the destructure.

**Pattern for confirm/prompt migration (showConfirm → async/await):**

Before (callback pattern):
```js
showConfirm('message', (confirmed) => {
  if (confirmed) { /* action */ }
});
```

After (async/await pattern):
```js
const confirmed = await showConfirm('message');
if (confirmed) { /* action */ }
```

This affects `AdminConsole.jsx` (handleDeactivateGame, handleHardDeleteGame) and `TournamentEdit.jsx` (status change confirmations).

**Pattern for navigation change:**
Replace `onBack()` calls with `useNavigate()` when used as standalone route,
but keep `onBack`/`onCancel`/`onSuccess` props for embedded usage by checking if the prop exists.

- [ ] **Step 1: Update TeamDetail.jsx — add useParams, keep onBack prop**

Edit `frontend/src/pages/TeamDetail.jsx`:
- Add import: `import { useNavigate, useParams } from 'react-router-dom';`
- At top of component add: `const { id } = useParams(); const navigate = useNavigate(); const teamId = teamId || id;`
- Replace `onBack` usage: `onClick={onBack || (() => navigate('/teams'))}`

- [ ] **Step 2: Update TeamManagement.jsx — add useParams, useAlerts, useNavigate**

Edit `frontend/src/pages/TeamManagement.jsx`:
- Remove: `import { showAlert } from '../components/CustomAlert';`
- Add: `import { useAlerts } from '../hooks/useAlerts';`
- Add: `import { useNavigate, useParams } from 'react-router-dom';`
- At top of component add: `const { showAlert } = useAlerts(); const { id } = useParams(); const navigate = useNavigate(); const teamId = propTeamId || id;`
- Replace `onNavigateMatch(matchId)` with `navigate('/match/' + matchId)`
- Replace `window.location.reload()` (in handleCancelSignup) with data refresh

- [ ] **Step 3: Update TournamentDetail.jsx — add useParams, useAlerts, useNavigate**

Edit `frontend/src/pages/TournamentDetail.jsx`:
- Remove: `import { showAlert } from '../components/CustomAlert';`
- Add: `import { useAlerts } from '../hooks/useAlerts';`
- Add: `import { useNavigate, useParams } from 'react-router-dom';`
- At top of component add: `const { showAlert } = useAlerts(); const { id } = useParams(); const navigate = useNavigate(); const tournamentId = tournamentId || id;`
- Replace `onBack` usage: `onClick={onBack || (() => navigate('/'))}`

- [ ] **Step 4: Update CreateTeam.jsx — add useAlerts, useNavigate**

Edit `frontend/src/pages/CreateTeam.jsx`:
- Remove: `import { showAlert } from '../components/CustomAlert';`
- Add: `import { useAlerts } from '../hooks/useAlerts';`
- Add: `import { useNavigate } from 'react-router-dom';`
- At top of component add: `const { showAlert } = useAlerts(); const navigate = useNavigate();`
- Replace `onCancel` usage: `onClick={onCancel || (() => navigate('/teams'))}`
- In `onSuccess` callback in handleSubmit: after API call, navigate to team management: `navigate('/teams/manage')`

- [ ] **Step 5: Update MessageCenter.jsx — add useAlerts, useNavigate**

Edit `frontend/src/pages/MessageCenter.jsx`:
- Remove: `import { showAlert } from '../components/CustomAlert';`
- Add: `import { useAlerts } from '../hooks/useAlerts';`
- Add: `import { useNavigate } from 'react-router-dom';`
- At top of component add: `const { showAlert } = useAlerts(); const navigate = useNavigate();`
- Replace `onNavigateMatch(matchId)` with `navigate('/match/' + matchId)`
- Replace `onBack` usage: `onClick={onBack || (() => navigate('/'))}`

- [ ] **Step 6: Update ProfileEdit.jsx — add useAlerts, useNavigate**

Edit `frontend/src/pages/ProfileEdit.jsx`:
- Remove: `import { showAlert } from '../components/CustomAlert';`
- Add: `import { useAlerts } from '../hooks/useAlerts';`
- Add: `import { useNavigate } from 'react-router-dom';`
- At top of component add: `const { showAlert } = useAlerts(); const navigate = useNavigate();`
- Replace `onBack` usage: `onClick={onBack || (() => navigate('/'))}`

- [ ] **Step 7: Update MatchScheduling.jsx — add useAlerts, useParams, useNavigate**

Edit `frontend/src/pages/MatchScheduling.jsx`:
- Remove: `import { showAlert } from '../components/CustomAlert';`
- Add: `import { useAlerts } from '../hooks/useAlerts';`
- Add: `import { useNavigate, useParams } from 'react-router-dom';`
- At top of component add: `const { showAlert } = useAlerts(); const { id } = useParams(); const navigate = useNavigate(); const matchId = matchId || id;`
- Replace `onBack` usage: `onClick={onBack || (() => navigate(-1))}`

- [ ] **Step 8: Update AdminConsole.jsx — add useAlerts, useNavigate, async showConfirm**

Edit `frontend/src/pages/AdminConsole.jsx`:
- Remove: `import { showAlert, showConfirm } from '../components/CustomAlert';`
- Add: `import { useAlerts } from '../hooks/useAlerts';`
- Add: `import { useNavigate } from 'react-router-dom';`
- At top of component add: `const { showAlert, showConfirm } = useAlerts(); const navigate = useNavigate();`
- Replace `onLogout` prop handling: use `navigate('/')` after logout
- **Convert showConfirm callbacks to async/await:**
  - `handleDeactivateGame`: Change from `showConfirm(msg, async () => { ... })` to `const ok = await showConfirm(msg); if (ok) { ... }`
  - `handleHardDeleteGame`: Change nested `showConfirm` callbacks to sequential `await showConfirm()` calls. First confirm → if true, second confirm → if true, hard delete.

- [ ] **Step 9: Update DeployTournament.jsx — add useAlerts**

Edit `frontend/src/pages/DeployTournament.jsx`:
- Remove: `import { showAlert } from '../components/CustomAlert';`
- Add: `import { useAlerts } from '../hooks/useAlerts';`
- At top of component add: `const { showAlert } = useAlerts();`

- [ ] **Step 10: Update TournamentEdit.jsx — add useAlerts, async confirm/prompt**

Edit `frontend/src/pages/TournamentEdit.jsx`:
- Remove: `import { showAlert, showConfirm, showPrompt } from '../components/CustomAlert';`
- Add: `import { useAlerts } from '../hooks/useAlerts';`
- At top of component add: `const { showAlert, showConfirm, showPrompt } = useAlerts();`
- Convert all `showConfirm(message, callback)` calls to async/await pattern
- Convert all `showPrompt(message, default, callback)` calls to async/await pattern

- [ ] **Step 11: Update InputMatchResult.jsx — add useAlerts**

Edit `frontend/src/pages/InputMatchResult.jsx`:
- Remove: `import { showAlert } from '../components/CustomAlert';`
- Add: `import { useAlerts } from '../hooks/useAlerts';`
- At top of component add: `const { showAlert } = useAlerts();`

- [ ] **Step 12: Update MatchDeploy.jsx — add useAlerts**

Edit `frontend/src/pages/MatchDeploy.jsx`:
- Remove: `import { showAlert } from '../components/CustomAlert';`
- Add: `import { useAlerts } from '../hooks/useAlerts';`
- At top of component add: `const { showAlert } = useAlerts();`

- [ ] **Step 13: Commit**

```bash
git add frontend/src/pages/
git commit -m "refactor: update page components to use useAlerts hook and React Router navigation"
```

---

### Task 9: Update api.js with env variable support

**Files:**
- Modify: `frontend/src/utils/api.js`

- [ ] **Step 1: Update baseURL**

Edit `frontend/src/utils/api.js`, change line 6 from:
```js
  baseURL: 'http://localhost:3000/api',
```
to:
```js
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/utils/api.js
git commit -m "feat: support VITE_API_URL env variable for API base URL"
```

---

### Task 10: Build verification

- [ ] **Step 1: Install dependencies**

Run: `cd frontend && npm install`
Expected: No errors (react-router-dom already in package.json)

- [ ] **Step 2: Build the frontend**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Check for any import or reference errors**

Run: `cd frontend && npx eslint src/ --ext .jsx,.js 2>&1 | head -50`
Expected: No new errors introduced (pre-existing warnings acceptable)

- [ ] **Step 4: Start dev server and verify pages load**

Run: `cd frontend && npm run dev`
Navigate to `http://localhost:5173` and verify:
- `/` shows Dashboard with tournaments
- `/teams` shows Teams Directory
- `/history` shows Match History
- `/teams/1` shows Team Detail
- `/tournaments/1` shows Tournament Detail
- Clicking SIGN IN opens login modal
- After login, sidebar opens with correct menu items

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: build verification fixes"
```
