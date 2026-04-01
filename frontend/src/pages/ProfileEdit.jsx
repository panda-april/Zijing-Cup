import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { showAlert } from '../components/CustomAlert';

export default function ProfileEdit({ onBack }) {
  const [formData, setFormData] = useState({
    userName: '',
    rank: '',
    mainRole: '',
    intro: '',
    oldPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 加载当前个人信息
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await api.get('/me/profile');
        if (res.data.success) {
          const user = res.data.data;
          setFormData(prev => ({
            ...prev,
            userName: user.UserName,
            rank: user.Rank || '',
            mainRole: user.MainRole || '',
            intro: user.Intro || ''
          }));
        }
      } catch (error) {
        console.error('加载个人信息失败:', error);
        showAlert('加载个人信息失败');
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // 前端校验
    if (formData.newPassword) {
      if (!formData.oldPassword) {
        showAlert('修改密码需要填写原密码');
        setIsSubmitting(false);
        return;
      }
      if (formData.newPassword !== formData.confirmNewPassword) {
        showAlert('两次输入的新密码不一致');
        setIsSubmitting(false);
        return;
      }
      if (formData.newPassword.length < 6) {
        showAlert('新密码长度至少6位');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      await api.put('/me/profile', {
        rank: formData.rank || null,
        mainRole: formData.mainRole || null,
        intro: formData.intro || null,
        oldPassword: formData.oldPassword || null,
        newPassword: formData.newPassword || null
      });
      showAlert('个人信息更新成功！');
      // 如果改了密码，其实token还是有效的，但建议用户重新登录
      if (formData.newPassword) {
        setTimeout(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('userName');
          localStorage.removeItem('userRole');
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      showAlert(error.response?.data?.error || '更新失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full bg-gray-100 p-6 md:p-12">
        <div className="max-w-2xl mx-auto text-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-black border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-sm font-bold text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-100 text-gray-900 font-sans p-6 md:p-12 selection:bg-black selection:text-yellow-300 pb-32">
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-in { animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      <div className="max-w-2xl mx-auto animate-slide-in">
        {/* 顶部头部 */}
        <div className="border-b-4 border-black pb-6 mb-10 flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-yellow-400 text-black text-[10px] font-black px-2 py-1 tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                USER SETTINGS
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter">Edit Profile.</h1>
          </div>
          <button
            type="button" onClick={onBack}
            className="text-xs font-bold tracking-widest text-gray-400 hover:text-black transition-colors"
          >
            ← BACK
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 基本信息 */}
          <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0_0_#000]">
            <label className="block text-xs font-black tracking-widest text-black mb-6">
              01. BASIC INFORMATION (基本信息)
            </label>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 tracking-widest mb-2">Username (用户名)</label>
                <input
                  type="text"
                  disabled
                  value={formData.userName}
                  className="w-full border-b-4 border-gray-200 py-2 font-bold bg-gray-50 text-gray-500 outline-none"
                />
                <p className="text-[10px] text-gray-400 font-bold mt-1">用户名不可修改</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 tracking-widest mb-2">Rank / 游戏段位 (可选)</label>
                  <input
                    type="text"
                    placeholder="e.g. Diamond / 大师"
                    value={formData.rank}
                    onChange={e => setFormData({ ...formData, rank: e.target.value })}
                    className="w-full border-b-4 border-gray-200 py-2 font-bold transition-colors bg-transparent outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 tracking-widest mb-2">Main Role / 主打位置 (可选)</label>
                  <input
                    type="text"
                    placeholder="e.g. Carry / 支援"
                    value={formData.mainRole}
                    onChange={e => setFormData({ ...formData, mainRole: e.target.value })}
                    className="w-full border-b-4 border-gray-200 py-2 font-bold transition-colors bg-transparent outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 tracking-widest mb-2">Introduction / 个人介绍 (可选)</label>
                <textarea
                  placeholder="介绍一下自己和你的游戏经历..."
                  value={formData.intro}
                  onChange={e => setFormData({ ...formData, intro: e.target.value })}
                  className="w-full flex-1 min-h-[120px] border-2 border-gray-200 p-4 text-sm font-medium outline-none focus:border-black transition-colors resize-none placeholder-gray-300"
                />
              </div>
            </div>
          </div>

          {/* 修改密码 */}
          <div className="bg-gray-50 border-2 border-black p-6 shadow-[4px_4px_0_0_#000]">
            <label className="block text-xs font-black tracking-widest text-black mb-6">
              02. CHANGE PASSWORD (修改密码)
            </label>
            <p className="text-[10px] font-bold text-gray-500 mb-6">
              如果你不需要修改密码，请留空以下字段。只有填写了新密码才会生效。
            </p>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 tracking-widest mb-2">Current Password (原密码)</label>
                <input
                  type="password"
                  placeholder="请输入原密码"
                  value={formData.oldPassword}
                  onChange={e => setFormData({ ...formData, oldPassword: e.target.value })}
                  className="w-full border-b-4 border-gray-200 py-2 font-bold transition-colors bg-transparent outline-none focus:border-yellow-400"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 tracking-widest mb-2">New Password (新密码)</label>
                  <input
                    type="password"
                    placeholder="至少6位"
                    value={formData.newPassword}
                    onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                    className="w-full border-b-4 border-gray-200 py-2 font-bold transition-colors bg-transparent outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 tracking-widest mb-2">Confirm New Password (确认新密码)</label>
                  <input
                    type="password"
                    placeholder="重复新密码"
                    value={formData.confirmNewPassword}
                    onChange={e => setFormData({ ...formData, confirmNewPassword: e.target.value })}
                    className="w-full border-b-4 border-gray-200 py-2 font-bold transition-colors bg-transparent outline-none focus:border-yellow-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-yellow-400 border-2 border-black text-black py-6 font-black tracking-widest text-lg hover:bg-black hover:text-yellow-400 transition-colors flex items-center justify-center gap-3 shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'SAVING...' : 'SAVE CHANGES'}
            {!isSubmitting && (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M5 13l4 4L19 7"></path></svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
