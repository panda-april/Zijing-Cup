import React, { useEffect, useRef } from 'react';
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

  const dialogRef = useRef(null);

  useEffect(() => {
    if (!showLoginModal) return;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeLogin();
    };
    document.addEventListener('keydown', onKeyDown);

    // Focus the first input when modal opens
    const firstInput = dialogRef.current?.querySelector('input');
    if (firstInput) firstInput.focus();

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showLoginModal, closeLogin]);

  if (!showLoginModal) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(loginForm.userName, loginForm.password);
    } catch {
      // loginError is set by AuthContext
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await register(loginForm);
    } catch {
      // loginError is set by AuthContext (register may throw from auto-login)
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label={isLoginMode ? '登录' : '注册'}>
      <div ref={dialogRef} className="bg-white border-2 border-black w-full max-w-md p-8 shadow-2xl relative">
        <button onClick={closeLogin} className="absolute top-4 right-4 text-gray-400 hover:text-black transition-colors" aria-label="关闭登录窗口">
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
