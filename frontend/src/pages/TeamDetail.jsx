import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';

export default function TeamDetail({ teamId: propTeamId, onBack }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const teamId = propTeamId || id;
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/teams/${teamId}`);
        if (res.data.success) {
          const t = res.data.data;
          const mapped = {
            id: t.TeamID,
            name: t.TeamName,
            gameId: t.GameID,
            game: t.Game?.GameName || '未指定项目',
            captain: t.Captain?.UserName || 'UNKNOWN',
            captainIntro: t.Captain?.Intro || '暂无简介',
            description: t.Description || '暂无队伍介绍',
            members: (t.UserTeams || []).map(ut => ({
              id: ut.UserID,
              name: ut.User?.UserName || 'UNKNOWN',
              isCaptain: ut.IsCaptain
            })),
            tournaments: (t.SignUps || []).map(s => ({
              id: s.Tournament?.TournamentID,
              name: s.Tournament?.TournamentName || 'UNKNOWN',
              status: s.Tournament?.Status || 'UNKNOWN',
              signUpTime: s.SignUpTime
            }))
          };
          setData(mapped);
        }
      } catch (error) {
        console.error('获取队伍详情失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [teamId]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="py-24 text-center">
          <p className="text-gray-400 font-bold tracking-widest text-sm">LOADING...</p>
        </div>
      );
    }

    if (!data) {
      return (
        <div className="py-24 text-center">
          <p className="text-red-500 font-bold tracking-widest text-sm">TEAM NOT FOUND</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* 左侧：核心信息 */}
        <div className="lg:col-span-7 space-y-8">
          {/* 队伍标题信息 */}
          <div className="bg-white border-2 border-black p-8 shadow-[4px_4px_0_0_#000]">
            <div className="flex items-start justify-between mb-6">
              <div>
                <span className="inline-block text-[10px] font-black tracking-widest text-gray-500 mb-2 px-2 py-1 border border-gray-400">
                  TEAM PROFILE
                </span>
                <h1 className="text-4xl font-black tracking-tight">{data.name}</h1>
              </div>
              <span className="text-xs font-bold border-2 border-black px-3 py-1 self-start">
                {data.game}
              </span>
            </div>

            {/* 队长信息 */}
            <div className="border-t border-gray-200 pt-6 mb-6">
              <p className="text-[10px] font-bold tracking-widest text-gray-500 mb-2">TEAM CAPTAIN</p>
              <p className="text-xl font-black">{data.captain}</p>
              {data.captainIntro && (
                <p className="text-sm text-gray-600 mt-2">{data.captainIntro}</p>
              )}
            </div>

            {/* 队伍介绍 */}
            {data.description && (
              <div className="border-t border-gray-200 pt-6">
                <p className="text-[10px] font-bold tracking-widest text-gray-500 mb-3">TEAM INTRODUCTION</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {data.description}
                </p>
              </div>
            )}
          </div>

          {/* 队员列表 */}
          <div className="bg-white border-2 border-black p-8 shadow-[4px_4px_0_0_#000]">
            <h2 className="text-xl font-black tracking-widest mb-6 flex justify-between items-center">
              ROSTER
              <span className="text-sm text-gray-500">{data.members.length} 成员</span>
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {data.members.map(member => (
                <div
                  key={member.id}
                  className={`flex items-center justify-between p-4 border-2 ${
                    member.isCaptain ? 'border-black bg-yellow-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="font-bold text-lg">{member.name}</span>
                  {member.isCaptain && (
                    <span className="text-[10px] font-black tracking-widest bg-black text-white px-2 py-1">
                      CAPTAIN
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧：参赛记录 */}
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0_0_#000] flex-1">
            <h2 className="text-xl font-black tracking-widest mb-6">TOURNAMENT HISTORY</h2>
            {data.tournaments.length === 0 ? (
              <p className="text-sm text-gray-400 font-bold tracking-widest text-center py-8 border-2 border-dashed border-gray-200">
                NO TOURNAMENT ENROLLMENTS YET
              </p>
            ) : (
              <div className="space-y-3">
                {data.tournaments.map(t => (
                  <div key={t.id} className="p-4 border-2 border-gray-200">
                    <p className="font-bold text-sm mb-1">{t.name}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-gray-500 tracking-widest">
                        {t.status}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Signed up {t.signUpTime}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-full selection:bg-[#660874] selection:text-white pb-32">
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-in { animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-slide-in">
        {/* 顶部返回栏 */}
        <div className="border-b-4 border-black pb-6 mb-10 flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-yellow-400 text-black text-[10px] font-black px-2 py-1 tracking-widest">
                PUBLIC PROFILE
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter">Team Detail</h1>
          </div>

          <button
            onClick={onBack || (() => navigate('/teams'))}
            className="text-xs font-bold tracking-widest text-gray-400 hover:text-black transition-colors"
          >
            ← BACK TO TEAM LIST
          </button>
        </div>

        {renderContent()}
      </div>
    </div>
  );
}
