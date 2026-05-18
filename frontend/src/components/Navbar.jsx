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
