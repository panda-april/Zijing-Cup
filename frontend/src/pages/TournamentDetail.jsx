import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { showAlert } from '../components/CustomAlert';

export default function TournamentDetails({ tournamentId = 'T002', onBack }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);

  //核心状态：记录哪些卡片被展开了
  const [expandedMatches, setExpandedMatches] = useState({});

  useEffect(() => {
    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/tournaments/${tournamentId}`);
        if (res.data.success) {
          const t = res.data.data;
          const mapped = {
            id: t.TournamentID,
            name: t.TournamentName,
            gameId: t.GameID,
            game: t.Game?.GameName || '未指定项目',
            status: t.Status || 'REGISTRATION',
            maxTeams: t.MaxTeamSize,
            currentTeams: t.CurrentTeams,
            prizePool: t.PrizePool || 'TBD',
            format: t.Format || 'TBD',
            description: t.Description || '暂无赛事说明',
            enrolledTeams: (t.SignUps || []).map((s) => ({
              id: s.Team.TeamID,
              name: s.Team.TeamName,
              captain: s.Team.Captain?.UserName || 'UNKNOWN',
              joinedAt: s.SignUpTime
            })),
            matches: (t.MatchInfos || []).map((m) => ({
              id: m.MatchID,
              type: m.MatchType,
              round: m.MatchName,
              time: m.MatchTime,
              status: m.Status === 'Finished' ? 'FINISHED' : 'UPCOMING',
              participants: (m.MatchParticipations || []).map((p) => ({
                id: p.TeamID,
                name: p.Team?.TeamName || 'UNKNOWN',
                score: p.Score,
                rank: p.FinalRank,
                isWinner: p.IsWinner
              })),
              totalTeamsInLobby: (m.MatchParticipations || []).length
            }))
          };
          setData(mapped);
        }
      } catch (error) {
        console.error('获取赛事详情失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [tournamentId]);

  const toggleMatchExpand = (matchId) => {
    setExpandedMatches(prev => ({
      ...prev,
      [matchId]: !prev[matchId]
    }));
  };

  const openEnrollModal = async () => {
    setShowEnrollModal(true);
    setIsLoadingTeams(true);
    setAvailableTeams([]);
    setSelectedTeamId(null);
    try {
      // 获取当前用户作为队长且项目匹配的队伍
      const res = await api.get(`/me/captain-teams/${data.gameId}`);
      if (res.data.success) {
        const teams = res.data.data || [];
        // 规则：一个选手只能参加一个赛事的一支队伍，无论你是队长还是队员
        // 检查当前用户是否已经报名参赛（只要你在任意一支已报名队伍中，都不能再报名）
        const storedUserName = localStorage.getItem('userName');
        const userAlreadyEnrolled = data.enrolledTeams.some(enrolled =>
          enrolled.captain === storedUserName
        );
        if (userAlreadyEnrolled) {
          showAlert('你已经是本赛事一支参赛队伍的成员，每个选手只能参加一支队伍');
          setShowEnrollModal(false);
          return;
        }
        // 过滤掉已经报名了该赛事的队伍
        const availableTeams = teams.filter(team =>
          !data.enrolledTeams.some(enrolled => enrolled.id === team.TeamID)
        );
        if (availableTeams.length === 0) {
          showAlert('你没有可报名该赛事的队伍（需要你是队长且项目匹配且未报名）');
          setShowEnrollModal(false);
          return;
        }
        setAvailableTeams(availableTeams);
      }
    } catch (error) {
      console.error('获取可用队伍失败:', error);
    } finally {
      setIsLoadingTeams(false);
    }
  };

  const confirmEnroll = async () => {
    if (!selectedTeamId) {
      showAlert('请先选择一支队伍');
      return;
    }
    setIsEnrolling(true);
    try {
      await api.post(`/tournaments/${data.id}/signup`, { teamId: selectedTeamId });
      showAlert("队伍已成功报名该赛事！");
      setShowEnrollModal(false);
      const latest = await api.get(`/tournaments/${data.id}`);
      if (latest.data.success) {
        const t = latest.data.data;
        const mapped = {
          id: t.TournamentID,
          name: t.TournamentName,
          gameId: t.GameID,
          game: t.Game?.GameName || '未指定项目',
          status: t.Status || 'REGISTRATION',
          maxTeams: t.MaxTeamSize,
          currentTeams: t.CurrentTeams,
          prizePool: t.PrizePool || 'TBD',
          format: t.Format || 'TBD',
          description: t.Description || '暂无赛事说明',
          enrolledTeams: (t.SignUps || []).map((s) => ({
            id: s.Team.TeamID,
            name: s.Team.TeamName,
            captain: s.Team.Captain?.UserName || 'UNKNOWN',
            joinedAt: s.SignUpTime
          })),
          matches: (t.MatchInfos || []).map((m) => ({
            id: m.MatchID,
            type: m.MatchType,
            round: m.MatchName,
            time: m.MatchTime,
            status: m.Status === 'Finished' ? 'FINISHED' : 'UPCOMING',
            participants: (m.MatchParticipations || []).map((p) => ({
              id: p.TeamID,
              name: p.Team?.TeamName || 'UNKNOWN',
              score: p.Score,
              rank: p.FinalRank,
              isWinner: p.IsWinner
            })),
            totalTeamsInLobby: (m.MatchParticipations || []).length
          }))
        };
        setData(mapped);
      }
    } catch (error) {
      showAlert(error.response?.data?.error || '报名失败');
    } finally {
      setIsEnrolling(false);
    }
  };

  const statusLabel = useMemo(() => {
    if (!data) return '';
    if (data.status === 'REGISTRATION') return '报名中 (REGISTRATION)';
    if (data.status === 'ONGOING') return '进行中 (ONGOING)';
    if (data.status === 'COMPLETED') return '已完赛 (COMPLETED)';
    return data.status;
  }, [data]);

  const renderH2HMatch = (match) => {
    const teamA = match.participants[0];
    const teamB = match.participants[1];

    return (
      <div className="flex items-center justify-between gap-4 mt-auto">
        <div className={`flex-1 text-right ${match.status === 'FINISHED' && teamA.isWinner ? 'text-black font-black' : 'text-gray-600 font-bold'}`}>
          <span className="text-lg md:text-xl  tracking-tight truncate block">{teamA.name}</span>
        </div>
        
        <div className="flex-shrink-0">
          {match.status === 'FINISHED' ? (
            <div className="flex items-center justify-center gap-3 bg-gray-100 px-4 h-12 border border-gray-200 min-w-[100px]">
              <span className={`text-2xl font-black ${teamA.isWinner ? 'text-[#660874]' : 'text-gray-400'}`}>{teamA.score}</span>
              <span className="text-gray-300 font-black">-</span>
              <span className={`text-2xl font-black ${teamB.isWinner ? 'text-[#660874]' : 'text-gray-400'}`}>{teamB.score}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center px-4 h-12 border-2 border-dashed border-gray-300 text-gray-400 font-bold text-[10px]  tracking-widest min-w-[100px]">
              VS
            </div>
          )}
        </div>

        <div className={`flex-1 text-left ${match.status === 'FINISHED' && teamB.isWinner ? 'text-black font-black' : 'text-gray-600 font-bold'}`}>
          <span className="text-lg md:text-xl  tracking-tight truncate block">{teamB.name}</span>
        </div>
      </div>
    );
  };

  // 渲染大厅混战 (包含原地展开逻辑)
  const renderLobbyMatch = (match, isExpanded) => {
    const displayCount = isExpanded ? match.participants.length : 3;
    const displayedTeams = match.participants.slice(0, displayCount);
    const hasMore = match.totalTeamsInLobby > 3;

    if (match.status === 'UPCOMING') {
      return (
        <div className="text-center py-4 bg-gray-50 border-2 border-dashed border-gray-200 mt-auto">
          <p className="text-sm font-black  text-gray-500 tracking-widest mb-1">MULTI-SQUAD LOBBY</p>
          <p className="text-xs font-bold text-gray-400 ">Awaiting deployment of {match.totalTeamsInLobby || match.participants.length} squads...</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col mt-auto">
        {/* 展开状态下切换为 3 列网格，未展开时为 1 列 */}
        <div className={`grid gap-2 mb-3 transition-all duration-500 ${isExpanded ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {displayedTeams.map((team, idx) => (
            <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 border border-gray-200 group-hover:border-black transition-colors animate-fade-in">
              <div className="flex items-center gap-3">
                <span className={`w-6 text-center font-black ${team.rank === 1 ? 'text-[#660874] text-xl' : team.rank === 2 ? 'text-gray-500 text-lg' : team.rank === 3 ? 'text-yellow-700 text-base' : 'text-gray-400 text-sm'}`}>
                  {team.rank === 1 ? '🥇' : team.rank === 2 ? '🥈' : team.rank === 3 ? '🥉' : `#${team.rank}`}
                </span>
                <span className={`font-bold  text-sm ${team.rank === 1 ? 'text-black' : 'text-gray-600'} truncate max-w-[120px]`}>
                  {team.name}
                </span>
              </div>
              <span className={`font-black  tracking-wider text-xs ${team.rank === 1 ? 'text-[#660874]' : 'text-gray-500'}`}>
                {team.score}
              </span>
            </div>
          ))}
        </div>
        
        {hasMore && (
          <button 
            onClick={() => toggleMatchExpand(match.id)}
            className={`w-full py-3 border text-xs font-bold  tracking-widest transition-colors ${
              isExpanded 
              ? 'bg-black text-white border-black hover:bg-gray-800' 
              : 'bg-white border-gray-200 text-gray-400 hover:border-black hover:text-black'
            }`}
          >
            {isExpanded ? 'COLLAPSE STANDINGS (收起榜单)' : `+ VIEW ALL ${match.participants.length} STANDINGS (展开完整排行)`}
          </button>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="font-black  tracking-widest text-gray-400 animate-pulse">LOADING TOURNAMENT...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <p className="font-black  tracking-widest text-red-500">TOURNAMENT NOT FOUND.</p>
        <button onClick={onBack} className="text-xs font-bold  tracking-widest text-gray-400 hover:text-black">← GO BACK</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans p-6 md:p-12 selection:bg-[#660874] selection:text-white pb-32">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
      `}</style>

      <div className="max-w-7xl mx-auto animate-fade-in">
        
        <button onClick={onBack} className="text-xs font-bold  tracking-widest text-gray-400 hover:text-black transition-colors mb-8 flex items-center gap-2 group">
          <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M15 19l-7-7 7-7"></path></svg>
          BACK TO DIRECTORY
        </button>

        {/* Hero Header */}
        <div className="border-b-4 border-black pb-8 mb-12">
          <div className="flex flex-col md:flex-row justify-between md:items-end gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="bg-black text-white text-[10px] font-bold px-3 py-1.5  tracking-widest">{data.game}</span>
                <span className="bg-green-100 text-green-800 border border-green-800 text-[10px] font-bold px-3 py-1.5  tracking-widest">{statusLabel}</span>
                <span className="text-[#660874] font-bold text-xs  tracking-widest">● OFFICIAL TOURNAMENT</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter  leading-tight">{data.name}</h1>
            </div>

            <div className="flex flex-col items-end gap-2 w-full md:w-auto mt-6 md:mt-0 shrink-0">
              <p className="text-xs font-bold  tracking-widest text-gray-500">
                SLOTS: <span className="text-black">{data.currentTeams} / {data.maxTeams}</span>
              </p>
              <button
                onClick={openEnrollModal}
                disabled={isEnrolling || data.currentTeams >= data.maxTeams}
                className="w-full md:w-auto bg-[#660874] text-white px-10 py-5 font-black  tracking-widest text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
              >
                {isEnrolling ? 'PROCESSING...' : 'ENROLL SQUAD'}
                {!isEnrolling && <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-20">
          
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
            <div className="lg:col-span-8 space-y-6">
              <h3 className="text-2xl font-black  border-b border-black pb-2">Intelligence</h3>
              <p className="text-gray-600 font-medium leading-relaxed text-lg">{data.description}</p>
            </div>
            
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="border border-black p-6 bg-gray-50 flex flex-col justify-center">
                <p className="text-[10px] font-bold text-gray-500  tracking-widest mb-2">PRIZE POOL</p>
                <p className="text-2xl font-black text-[#660874]">{data.prizePool}</p>
              </div>
              <div className="border border-black p-6 bg-gray-50 flex flex-col justify-center">
                <p className="text-[10px] font-bold text-gray-500  tracking-widest mb-2">FORMAT</p>
                <p className="text-xl font-black ">{data.format}</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-2xl font-black  mb-8 border-b border-black pb-2 flex justify-between items-end">
              <span>Registered Squads</span>
              <span className="text-sm font-bold text-gray-400">{data.currentTeams} / {data.maxTeams} CAPACITY</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.enrolledTeams.map((team, idx) => (
                <div key={team.id} className="border border-gray-200 p-5 group hover:border-black hover:shadow-lg transition-all flex items-center gap-4 bg-white relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-transparent group-hover:bg-[#660874] transition-colors"></div>
                  <span className="text-2xl font-black text-gray-200 group-hover:text-gray-900 transition-colors w-6">{idx < 9 ? `0${idx + 1}` : idx + 1}</span>
                  <div>
                    <h4 className="font-bold  text-base group-hover:text-[#660874] transition-colors truncate w-32 md:w-40">{team.name}</h4>
                    <p className="text-[10px] font-bold text-gray-400  tracking-widest mt-1 truncate">CAPT: {team.captain}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 🚀 模块 C: 赛程与战果 */}
          <section>
            <h3 className="text-2xl font-black  mb-8 border-b border-black pb-2">Schedule & Results</h3>
            
            {/* 🚀 注意这里的 items-start：防止相邻卡片被拉伸！ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {data.matches.map(match => {
                const isExpanded = expandedMatches[match.id];

                return (
                  <div 
                    key={match.id} 
                    className={`border border-black bg-white relative overflow-hidden group hover:shadow-[4px_4px_0_0_#000] transition-all duration-300 flex flex-col ${
                      isExpanded ? 'lg:col-span-2 shadow-[4px_4px_0_0_#000]' : ''
                    }`}
                  >
                    {/* 侧边装饰条 */}
                    <div className={`absolute left-0 top-0 bottom-0 w-2 ${match.status === 'FINISHED' ? 'bg-gray-300' : 'bg-[#660874]'}`}></div>
                    
                    <div className="p-6 pl-8 flex-1 flex flex-col">
                      <div className="flex justify-between items-center mb-6">
                        <span className="text-[10px] font-bold bg-black text-white px-2 py-1  tracking-widest">
                          {match.round}
                        </span>
                        <span className="text-xs font-bold text-gray-500  tracking-widest flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          {match.time ? new Date(match.time).toLocaleString() : '待定档'}
                        </span>
                      </div>

                      {/* 渲染具体的比赛内容 */}
                      {match.type === 'LOBBY' ? renderLobbyMatch(match, isExpanded) : renderH2HMatch(match)}
                      
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

        </div>
        {isLoading && <p className="text-xs font-bold text-gray-500  tracking-widest mt-8">Loading tournament data...</p>}
      </div>

      {/* 报名选择队伍弹窗 */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border-2 border-black w-full max-w-md max-h-[80vh] overflow-y-auto p-8 shadow-2xl relative">
            <button
              onClick={() => setShowEnrollModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-black transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <h3 className="text-3xl font-black tracking-tight mb-8">Select<br />Team.</h3>

            {isLoadingTeams ? (
              <p className="text-center py-8 text-gray-400 font-bold">加载中...</p>
            ) : availableTeams.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-red-500 font-bold mb-2">你还不是此项目一支队伍的队长</p>
                <p className="text-sm text-gray-500">只有队长才能代表队伍报名赛事</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 mb-6">
                  {availableTeams.map(team => (
                    <label
                      key={team.TeamID}
                      className={`flex items-center justify-between p-4 border-2 cursor-pointer transition-colors ${
                        selectedTeamId === team.TeamID
                          ? 'border-[#660874] bg-[#660874] text-white'
                          : 'border-gray-200 hover:border-black bg-white text-black'
                      }`}
                    >
                      <div>
                        <p className="font-bold">{team.TeamName}</p>
                        <p className={`text-xs font-bold tracking-wider ${selectedTeamId === team.TeamID ? 'text-white/80' : 'text-gray-500'}`}>
                          {team._count.Members} 名队员
                        </p>
                      </div>
                      <input
                        type="radio"
                        name="teamSelect"
                        value={team.TeamID}
                        checked={selectedTeamId === team.TeamID}
                        onChange={() => setSelectedTeamId(team.TeamID)}
                        className={`w-4 h-4 ${selectedTeamId === team.TeamID ? 'accent-white' : 'accent-[#660874]'}`}
                      />
                    </label>
                  ))}
                </div>
                <div className="flex flex-col gap-4 mt-4">
                  <button
                    onClick={confirmEnroll}
                    disabled={isEnrolling || !selectedTeamId}
                    className="mt-4 bg-[#660874] text-white py-4 font-black tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isEnrolling ? 'PROCESSING...' : 'CONFIRM ENROLL'}
                  </button>
                  <button
                    onClick={() => setShowEnrollModal(false)}
                    className="py-3 border border-black text-black font-bold tracking-widest hover:bg-gray-50 transition-colors"
                  >
                    CANCEL
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}