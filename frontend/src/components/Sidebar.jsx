import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';

export default function Sidebar() {
  const { userName, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);

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
    setTeamLoading(true);
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
    } finally {
      setTeamLoading(false);
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
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-black transition-colors" aria-label="关闭菜单">
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
                  {teamLoading ? '加载中...' : '团队管理'}
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
