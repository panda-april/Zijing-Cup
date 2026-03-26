import React, { useEffect, useState } from 'react';
import api from '../utils/api';

export default function TeamListSelect({ teams = [], onSelectTeam, onCreateTeam, onBack }) {
  // teams 已经由 App.jsx 从 API 获取并传入，不需要重新获取
  const [myTeams, setMyTeams] = useState(teams);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMyTeams(teams);
  }, [teams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-black border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-sm font-bold text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 标题区域 */}
        <div className="flex flex-col md:flex-row justify-between md:items-end border-b border-black pb-4 mb-8 gap-4">
          <h2 className="text-3xl font-black tracking-tight">My Teams</h2>
          <button
            onClick={onCreateTeam}
            className="bg-[#660874] text-white px-6 py-2 font-bold text-sm hover:opacity-90 transition-opacity w-fit"
          >
            + 组建新队伍
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-600 text-sm font-bold">
            {error}
          </div>
        )}

        {/* 团队列表 */}
        {myTeams.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-400 font-medium tracking-widest mb-6">你还没有加入任何团队</p>
            <button
              onClick={onCreateTeam}
              className="bg-black text-white px-8 py-3 font-bold text-sm hover:bg-[#660874] transition-colors"
            >
              创建我的第一个团队
            </button>
          </div>
        ) : (
          <div className="border-t border-black">
            {myTeams.map((teamWrapper) => {
              // 处理后端返回的数据结构 { Team: {...}, IsCaptain: boolean, ... }
              const team = teamWrapper.Team || teamWrapper;
              const isCaptain = teamWrapper.IsCaptain || team.isCaptain;
              return (
                <div
                  key={team.TeamID}
                  onClick={() => onSelectTeam(team)}
                  className="border-b border-gray-200 py-6 flex flex-col md:flex-row justify-between md:items-center gap-6 group hover:bg-gray-50 px-2 transition-colors cursor-pointer"
                >
                  <div className="flex-1">
                    <h3 className="text-2xl font-black mb-2 group-hover:underline underline-offset-4 decoration-2">
                      {team.TeamName}
                    </h3>
                    <div className="text-[10px] font-bold text-gray-400 space-x-4 tracking-wider">
                      <span className="text-black border border-black px-1">
                        {team.Game?.GameName || '未指定'}
                      </span>
                      <span>{team.Members?.length || 1} 成员</span>
                      {isCaptain && (
                        <span className="bg-[#660874] text-white px-1">队长</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center md:justify-end md:w-1/3">
                    <span className="text-sm font-bold tracking-wider text-black opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      进入管理 →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
