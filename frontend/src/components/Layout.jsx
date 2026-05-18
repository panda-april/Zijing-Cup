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
