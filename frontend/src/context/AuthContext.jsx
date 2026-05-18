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
