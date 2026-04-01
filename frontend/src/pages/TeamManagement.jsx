import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { showAlert } from '../components/CustomAlert';

export default function TeamManagement({ teamId: propTeamId, onBack, onNavigateMatch }) {
  const [myTeam, setMyTeam] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [applications, setApplications] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingInvites, setPendingInvites] = useState([]);
  const [searchResults, setSearchResults] = useState([]);

  // 计算当前用户在该团队中的角色
  const currentRole = currentUser?.role;

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        // 获取用户所有团队数据
        const res = await api.get('/me/team-dashboard');
        if (res.data.success) {
          const teamsData = res.data.data || [];

          // 如果传入了 teamId，找到对应的团队；否则使用第一个团队
          let targetTeam;
          if (propTeamId) {
            // 处理两种可能的数据结构：{ Team: {...} } 或直接的 Team 对象
            const found = teamsData.find(t => {
              const teamId = String(t.Team?.TeamID || t.TeamID);
              return teamId === String(propTeamId);
            });
            targetTeam = found?.Team || found;
            if (!targetTeam) {
              console.warn('[TeamManagement] 找不到匹配的团队:', propTeamId, '可用团队:', teamsData);
            }
          }
          const first = targetTeam || teamsData[0]?.Team || teamsData[0];
          if (!first) {
            setMyTeam(null);
            return;
          }
          const members = (first.Members || []).map((m) => ({
            id: m.User.UserID,
            name: m.User.UserName,
            role: m.IsCaptain ? 'CAPTAIN' : 'MEMBER',
            joinDate: m.JoinedAt
          }));
          const nextTeam = {
            id: first.TeamID,
            name: first.TeamName,
            game: first.Game?.GameName || '未指定',
            members,
            tournaments: first.TournamentsView || []
          };
          setMyTeam(nextTeam);

          // 设置当前用户（从登录信息或第一个成员推断）
          const storedUserName = localStorage.getItem('userName');
          const me = members.find(m => m.name === storedUserName) || members[0];
          if (me) setCurrentUser(me);

          // 只有队长才能获取申请列表（后端接口仅对队长开放）
          if (nextTeam.id && me?.role === 'CAPTAIN') {
            try {
              const reqRes = await api.get(`/teams/${nextTeam.id}/requests?status=PENDING`);
              if (reqRes.data.success) {
                setApplications((reqRes.data.data || []).map((r) => ({
                  id: r.RequestID,
                  user: {
                    id: r.TargetUser.UserID,
                    name: r.TargetUser.UserName,
                    rank: r.TargetUser.Rank,
                    mainRole: r.TargetUser.MainRole
                  },
                  type: r.Type,
                  message: r.Message || '',
                  recommender: r.Initiator?.UserName || ''
                })));
              }
            } catch (e) {
              console.error('获取申请单失败:', e);
            }
          }
        }
      } catch (error) {
        console.error('获取队伍看板失败:', error);
      }
    };
    fetchDashboard();
  }, [propTeamId]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.data.success) {
          const normalized = (res.data.data || []).map(u => ({
            id: u.UserID,
            name: u.UserName,
            rank: u.Rank,
            mainRole: u.MainRole
          }));
          setSearchResults(normalized.filter(u =>
            !myTeam?.members.find(m => m.id === u.id) &&
            !pendingInvites.find(p => p.id === u.id) &&
            !applications.find(a => a.user.id === u.id)
          ));
        }
      } catch (error) {
        console.error('搜索用户失败:', error);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, myTeam, pendingInvites, applications]);

  
  // 控制赛程面版的折叠/展开
  const [expandedBrackets, setExpandedBrackets] = useState({});

  const toggleBracket = (tournamentId) => {
    setExpandedBrackets(prev => ({
      ...prev,
      [tournamentId]: !prev[tournamentId]
    }));
  };

  const handleApprove = async (appId, user) => {
    try {
      await api.put(`/teams/requests/${appId}`, { action: 'APPROVE' });
      setMyTeam({
        ...myTeam,
        members: [...myTeam.members, { ...user, role: 'MEMBER', joinDate: 'TODAY' }]
      });
      setApplications(applications.filter(a => a.id !== appId));
    } catch (error) {
      showAlert(error.response?.data?.error || '审批失败');
    }
  };

  const handleReject = async (appId) => {
    try {
      await api.put(`/teams/requests/${appId}`, { action: 'REJECT' });
      setApplications(applications.filter(a => a.id !== appId));
    } catch (error) {
      showAlert(error.response?.data?.error || '拒绝失败');
    }
  };

  const handleKick = async (memberId) => {
    try {
      await api.delete(`/teams/${myTeam.id}/members/${memberId}`);
      setMyTeam({
        ...myTeam,
        members: myTeam.members.filter(m => m.id !== memberId)
      });
    } catch (error) {
      showAlert(error.response?.data?.error || '踢人失败');
    }
  };

  const handleLeave = () => {
    if(confirm("CONFIRM LEAVE TEAM?")) {
      api.delete(`/teams/${myTeam.id}/leave`)
        .then(() => {
          setMyTeam({
            ...myTeam,
            members: myTeam.members.filter(m => m.id !== currentUser.id)
          });
          showAlert("You have left the team.");
        })
        .catch((error) => showAlert(error.response?.data?.error || '退出失败'));
    }
  };

  const handleDisband = () => {
    if(confirm("DANGER: DISBAND TEAM?")) {
      api.delete(`/teams/${myTeam.id}`)
        .then(() => setMyTeam(null))
        .catch((error) => showAlert(error.response?.data?.error || '解散失败'));
    }
  };

  const handleInvite = async (user) => {
    if (!pendingInvites.find(u => u.id === user.id)) {
      try {
        await api.post(`/teams/${myTeam.id}/invite`, { targetUserId: user.id });
        setPendingInvites([...pendingInvites, { ...user, invitedBy: currentRole }]);
        setSearchQuery('');
      } catch (error) {
        showAlert(error.response?.data?.error || '邀请失败');
      }
    }
  };

  // 跳转到独立约赛页面
  const navigateToMatch = (matchId) => {
    if (onNavigateMatch) {
      onNavigateMatch(matchId);
    }
  };

  const handleCancelSignup = async (tournamentId) => {
    if (!confirm('确认取消报名该赛事吗？')) return;
    try {
      await api.delete(`/tournaments/${tournamentId}/signup/${myTeam.id}`);
      showAlert('已取消报名');
      // 重新刷新页面数据
      window.location.reload();
    } catch (error) {
      showAlert(error.response?.data?.error || '取消报名失败');
    }
  };

  if (!myTeam) {
    return (
      <div className="min-h-[80vh] bg-white text-gray-900 font-sans p-12 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-black  text-gray-300">NO ACTIVE TEAM</h1>
          <p className="font-bold text-gray-500 mt-4 tracking-widest">Return to Teams Directory to join or create one.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans p-6 md:p-12 selection:bg-[#660874] selection:text-white pb-32">
      <div className="max-w-7xl mx-auto animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between md:items-end border-b-4 border-black pb-6 mb-12 gap-6">
          <div>
            {onBack && (
              <button
                onClick={onBack}
                className="mb-2 inline-flex items-center gap-2 text-xs font-bold tracking-widest text-gray-600 border border-gray-300 px-3 py-1 hover:bg-gray-50 transition-colors"
              >
                ← BACK TO TEAM LIST
              </button>
            )}
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-black text-white text-[10px] font-bold px-2 py-1  tracking-widest">{myTeam.game}</span>
              <span className="text-[#660874] font-bold text-xs  tracking-widest">● MY TEAM DASHBOARD</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter ">{myTeam.name}</h1>
          </div>
          {currentRole === 'CAPTAIN' ? (
            <button onClick={handleDisband} className="text-xs font-bold  tracking-widest text-red-500 hover:text-white hover:bg-red-500 border border-red-500 px-4 py-2 transition-colors">DISBAND SQUAD</button>
          ) : (
            <button onClick={handleLeave} className="text-xs font-bold  tracking-widest text-red-500 hover:text-white hover:bg-red-500 border border-red-500 px-4 py-2 transition-colors">LEAVE SQUAD</button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          
          {/* ========================================== */}
          {/* 左侧：队伍名单 & 已报名赛事                  */}
          {/* ========================================== */}
          <section className="lg:col-span-7 space-y-16">
            
            {/* 1. 队伍名单 */}
            <div>
              <h2 className="text-2xl font-black tracking-tight  border-b border-black pb-4 mb-6 flex justify-between items-end">
                <span>Current Roster</span>
                <span className="text-sm font-bold text-gray-400">{myTeam.members.length} MEMBERS</span>
              </h2>
              <div className="flex flex-col border-t border-black">
                {myTeam.members.map((member, index) => (
                  <div key={member.id} className="flex items-center justify-between border-b border-gray-200 py-5 group hover:bg-gray-50 px-2 transition-colors">
                    <div className="flex items-center gap-6">
                      <span className="text-3xl font-black text-gray-200 group-hover:text-gray-300 transition-colors w-8">{index < 9 ? `0${index + 1}` : index + 1}</span>
                      <div>
                        <h3 className="text-xl font-bold  flex items-center gap-2">
                          {member.name}
                          {member.role === 'CAPTAIN' && <span className="bg-[#660874] text-white text-[10px] px-1.5 py-0.5 rounded-sm" title="Captain">C</span>}
                          {currentUser && member.id === currentUser.id && <span className="text-xs font-bold text-gray-400  tracking-widest ml-2">(YOU)</span>}
                        </h3>
                        <p className="text-xs font-bold text-gray-400  tracking-widest mt-1">JOINED: {member.joinDate}</p>
                      </div>
                    </div>
                    {currentRole === 'CAPTAIN' && member.role !== 'CAPTAIN' && (
                      <button onClick={() => handleKick(member.id)} className="text-xs font-bold  tracking-widest text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">KICK</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 2. 已报名的赛事 & 赛程列表展开 */}
            <div>
              <h2 className="text-2xl font-black tracking-tight  border-b border-black pb-4 mb-6 flex justify-between items-end">
                <span>Active Deployments</span>
                <span className="text-sm font-bold text-gray-400">{myTeam.tournaments.length} TOURNAMENTS</span>
              </h2>
              
              <div className="flex flex-col gap-6">
                {myTeam.tournaments.length === 0 ? (
                  <p className="text-xs font-bold text-gray-400  tracking-widest py-8 text-center border-2 border-dashed border-gray-200">
                    NO ACTIVE TOURNAMENT DEPLOYMENTS.
                  </p>
                ) : myTeam.tournaments.map(t => (
                  <div key={t.id} className="border-2 border-black bg-white group hover:shadow-[4px_4px_0_0_#000] transition-all">
                    
                    {/* 卡片头部信息 */}
                    <div className="p-5 flex flex-col md:flex-row justify-between md:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5  tracking-widest ${
                            t.status === 'ONGOING' ? 'bg-yellow-300 text-black' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {t.status}
                          </span>
                          {currentRole === 'CAPTAIN' && t.isCaptainActionRequired && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-red-600  tracking-widest border border-red-600 px-2 py-0.5">
                              <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></span>
                              ACTION REQUIRED
                            </span>
                          )}
                        </div>
                        <h4 className="text-xl font-black  truncate max-w-sm">{t.name}</h4>
                        <p className="text-xs font-bold text-gray-500  tracking-widest mt-1">
                          NEXT: <span className={t.status === 'ONGOING' ? 'text-black' : ''}>{t.nextMatch}</span>
                        </p>
                      </div>
                      
                      <div className="flex flex-col md:flex-row gap-3">
                        <button
                          onClick={() => toggleBracket(t.id)}
                          className={`w-full md:w-auto border-2 px-4 py-3 text-xs font-bold  tracking-widest transition-colors ${
                            expandedBrackets[t.id]
                            ? 'bg-black text-white border-black'
                            : 'border-black hover:bg-black hover:text-white'
                          }`}
                        >
                          {expandedBrackets[t.id] ? 'CLOSE BRACKET' : 'VIEW BRACKET'}
                        </button>
                        {currentRole === 'CAPTAIN' && t.status === 'REGISTRATION' && (
                          <button
                            onClick={() => handleCancelSignup(t.id)}
                            className="w-full md:w-auto border-2 border-red-500 text-red-500 px-4 py-3 text-xs font-bold tracking-widest hover:bg-red-500 hover:text-white transition-colors"
                          >
                            CANCEL SIGNUP
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 🚀 展开的赛程列表 (手风琴) */}
                    {expandedBrackets[t.id] && (
                      <div className="border-t-2 border-dashed border-gray-200 bg-gray-50 p-5 animate-fade-in">
                        <h5 className="text-[10px] font-black  tracking-widest text-gray-500 mb-4">MATCH SCHEDULE & RESULTS</h5>
                        
                        <div className="flex flex-col gap-3">
                          {t.matches.map(m => (
                            <div key={m.id} className="border border-gray-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-black transition-colors">
                              
                              {/* 比赛基本信息 */}
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] bg-black text-white px-1.5 py-0.5  tracking-widest">{m.round}</span>
                                  {m.status === 'FINISHED' && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5  font-bold tracking-widest">FINISHED</span>}
                                  {m.status === 'PENDING' && <span className="text-[10px] bg-yellow-100 text-yellow-800 border border-yellow-800 px-1.5 py-0.5  font-bold tracking-widest">PENDING TIME</span>}
                                </div>
                                <div className="font-bold  text-sm mt-2">VS. {m.opponent}</div>
                                <div className="text-[10px] font-bold text-gray-500  tracking-widest mt-1">TIME: {m.time}</div>
                              </div>

                              {/* 比赛结果或操作按钮区 */}
                              <div className="flex items-center justify-end">
                                {/* 已完赛展示比分 */}
                                {m.status === 'FINISHED' && (
                                  <div className="text-right">
                                    <div className="text-2xl font-black  tracking-tight">{m.score}</div>
                                    <div className={`text-[10px] font-bold  tracking-widest ${m.result === 'WIN' ? 'text-[#660874]' : 'text-gray-400'}`}>
                                      {m.result === 'WIN' ? 'VICTORY' : 'DEFEAT'}
                                    </div>
                                  </div>
                                )}
                                
                                {/* 待定档且我是队长：展示强力交互按钮 */}
                                {m.status === 'PENDING' && currentRole === 'CAPTAIN' && m.pendingAction === 'PROPOSE' && (
                                  <button onClick={() => navigateToMatch(m.id)} className="bg-yellow-400 text-black border-2 border-black px-4 py-2 text-xs font-black  tracking-widest hover:bg-black hover:text-yellow-400 transition-colors shadow-[2px_2px_0_0_#000] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5">
                                    PROPOSE TIME
                                  </button>
                                )}

                                {m.status === 'PENDING' && currentRole === 'CAPTAIN' && m.pendingAction === 'ACCEPT' && (
                                  <button onClick={() => navigateToMatch(m.id)} className="bg-[#660874] text-white border-2 border-black px-4 py-2 text-xs font-black  tracking-widest hover:bg-black hover:text-[#660874] transition-colors shadow-[2px_2px_0_0_#000] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5">
                                    REVIEW PROPOSAL
                                  </button>
                                )}

                                {/* 待定档但我是普通队员：展示锁定状态 */}
                                {m.status === 'PENDING' && currentRole === 'MEMBER' && (
                                  <div className="flex items-center gap-2 text-gray-400 px-3 py-2 border-2 border-dashed border-gray-200">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                    <span className="text-[10px] font-bold  tracking-widest">AWAITING CAPTAIN</span>
                                  </div>
                                )}
                              </div>
                              
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </section>

          {/* ========================================== */}
          {/* 右侧：招募与申请管理                        */}
          {/* ========================================== */}
          <aside className="lg:col-span-5 space-y-12">
            {currentRole === 'CAPTAIN' && (
              <section className="animate-fade-in">
                <div className="bg-gray-50 border border-black p-6 relative shadow-sm">
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#660874]"></div>
                  <h2 className="text-lg font-black tracking-tight  border-b border-gray-300 pb-4 mb-4 flex justify-between items-center">
                    Pending Applications
                    {applications.length > 0 && <span className="bg-[#660874] text-white text-[10px] px-2 py-0.5">{applications.length} PENDING</span>}
                  </h2>
                  {applications.length === 0 ? (
                    <p className="text-xs font-bold text-gray-400  tracking-widest py-4 text-center">NO PENDING APPLICATIONS.</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {applications.map(app => (
                        <div key={app.id} className="flex flex-col bg-white border border-gray-200 p-4 gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold  text-base">{app.user.name}</span>
                              <span className="text-[10px] font-bold text-gray-500  tracking-widest border border-gray-300 px-1">{app.user.rank}</span>
                            </div>
                            <p className="text-[10px] font-bold text-gray-500  tracking-widest leading-relaxed">
                              {app.type === 'APPLY' ? `APPLIED: "${app.message}"` : `RECOMMENDED BY ${app.recommender}: "${app.message}"`}
                            </p>
                          </div>
                          <div className="flex gap-2 w-full mt-1">
                            <button onClick={() => handleApprove(app.id, app.user)} className="flex-1 bg-black text-white text-[10px] font-bold px-2 py-2  hover:bg-[#660874] transition-colors">APPROVE</button>
                            <button onClick={() => handleReject(app.id)} className="flex-1 border border-black text-black text-[10px] font-bold px-2 py-2  hover:bg-gray-100 transition-colors">REJECT</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}
            
            <section>
              <h2 className="text-xl font-bold tracking-tight  border-b border-black pb-4 mb-6">Recruitment Radar</h2>
              <div className="relative group mb-6">
                <input type="text" placeholder="SEARCH BY ID OR NAME..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full border-b-2 border-gray-200 focus:border-[#660874] py-3 px-4 outline-none font-bold  tracking-wider text-sm transition-colors bg-transparent"/>
              </div>
              {searchQuery && (
                <div className="bg-white border border-black p-4 max-h-64 overflow-y-auto shadow-[4px_4px_0_0_#000] absolute z-10 w-full md:w-auto left-6 right-6 md:left-auto md:right-auto md:w-[400px]">
                  {searchResults.length === 0 ? (
                    <p className="text-center text-xs font-bold text-gray-400  tracking-widest py-4">NO AGENTS FOUND.</p>
                  ) : searchResults.map(user => (
                    <div key={user.id} className="flex justify-between items-center py-3 border-b border-gray-200 last:border-0">
                      <div>
                        <p className="font-bold ">{user.name}</p>
                        <p className="text-[10px] font-bold text-gray-500  tracking-widest">{user.rank} / {user.mainRole}</p>
                      </div>
                      <button onClick={() => handleInvite(user)} className="bg-black text-white text-xs font-bold px-3 py-1.5  hover:bg-[#660874] transition-colors">
                        {currentRole === 'CAPTAIN' ? 'INVITE' : 'RECOMMEND'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xl font-bold tracking-tight  border-b border-black pb-4 mb-6 flex justify-between items-center">Outgoing Invites</h2>
              <div className="flex flex-col gap-3">
                {pendingInvites.length === 0 ? (
                  <p className="text-xs font-bold text-gray-400  tracking-widest py-4 border-2 border-dashed border-gray-200 text-center">NO OUTGOING INVITATIONS.</p>
                ) : pendingInvites.map(invite => (
                  <div key={invite.id} className="flex justify-between items-center border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                      <div>
                        <span className="font-bold  text-sm block">{invite.name}</span>
                        {currentRole === 'CAPTAIN' && invite.invitedBy === 'MEMBER' && <span className="text-[10px] font-bold text-[#660874] ">Recommended by Member</span>}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-gray-500  tracking-widest">WAITING...</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}