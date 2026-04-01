import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { showAlert } from '../components/CustomAlert';
import CreateTournament from './DeployTournament';
import TournamentEdit from './TournamentEdit';

export default function AdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('OVERVIEW');
  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [showEditTournament, setShowEditTournament] = useState(false);
  const [editingTournamentId, setEditingTournamentId] = useState(null);
  const [newGameName, setNewGameName] = useState('');
  const [newGameType, setNewGameType] = useState('H2H');
  const [games, setGames] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [pendingResults, setPendingResults] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [systemStats, setSystemStats] = useState({
    totalUsers: 0,
    totalTeams: 0,
    activeTournaments: 0,
    pendingMatches: 0
  });

  useEffect(() => {
    const loadAdminData = async () => {
      try {
        const [gamesRes, tournamentsRes, teamsRes, logsRes, statsRes] = await Promise.all([
          api.get('/games'),
          api.get('/tournaments'),
          api.get('/teams'),
          api.get('/admin/logs?limit=50'),
          api.get('/admin/stats')
        ]);

        const gameList = gamesRes.data?.data || [];
        const tournamentList = tournamentsRes.data?.data || [];
        const teamList = teamsRes.data?.data || [];
        const logs = logsRes.data?.data || [];

        setGames(gameList.map(g => ({
          id: g.GameID,
          name: g.GameName,
          type: g.GameType || 'H2H',
          teamsCount: teamList.filter(t => t.GameID === g.GameID).length
        })));

        setTournaments(tournamentList.map(t => ({
          id: t.TournamentID,
          name: t.TournamentName,
          game: t.Game?.GameName || '未指定',
          status: t.Status,
          maxTeams: t.MaxTeamSize,
          enrolled: t.CurrentTeams
        })));

        const pending = [];
        for (const t of tournamentList) {
          const detail = await api.get(`/tournaments/${t.TournamentID}`);
          const matches = detail.data?.data?.MatchInfos || [];
          matches
            .filter(m => m.Status !== 'Finished')
            .forEach(m => {
              pending.push({
                id: m.MatchID,
                tournament: t.TournamentName,
                round: m.MatchName,
                type: m.MatchType,
                teamsCount: m.MatchParticipations?.length || 0,
                teamA: m.MatchParticipations?.[0]?.Team?.TeamName,
                teamB: m.MatchParticipations?.[1]?.Team?.TeamName,
                time: m.MatchTime ? new Date(m.MatchTime).toLocaleString() : '待定'
              });
            });
        }
        setPendingResults(pending);

        setAdminLogs(logs.map(l => ({
          id: l.LogID,
          admin: l.Admin?.UserName || l.AdminID || 'SYSTEM',
          action: l.ActionType,
          target: l.TargetID,
          time: new Date(l.CreatedAt).toLocaleString(),
          detail: l.Details
        })));

        setSystemStats(
          statsRes.data?.data || {
            totalUsers: 0,
            totalTeams: teamList.length,
            activeTournaments: tournamentList.filter(t => t.Status !== 'COMPLETED').length,
            pendingMatches: pending.length
          }
        );
      } catch (error) {
        console.error('管理员面板数据加载失败:', error);
      }
    };
    loadAdminData();
  }, []);

  // 模拟操作
  const handleAddGame = async (e) => {
    e.preventDefault();
    if(!newGameName) return;
    try {
      const res = await api.post('/games', { gameName: newGameName, gameType: newGameType });
      const newGame = res.data?.data;
      setGames([...games, { id: newGame.GameID, name: newGame.GameName, teamsCount: 0 }]);
      showAlert(`成功添加新比赛项目: ${newGameName}`);
      setNewGameName('');
      setNewGameType('H2H');
    } catch (error) {
      showAlert(error.response?.data?.error || '新增项目失败');
    }
  };

  // 软停用项目（推荐方式）
  const handleDeactivateGame = async (gameId, gameName) => {
    if (window.confirm(`WARNING: 确定要停用项目 [${gameName}] 吗？\n项目停用后不会再出现在选择列表中，但数据仍保留在数据库中。`)) {
      try {
        await api.put(`/games/${gameId}/deactivate`, { isActive: false });
        setGames(games.filter(g => g.id !== gameId));
        showAlert('项目已停用');
      } catch (error) {
        showAlert(error.response?.data?.error || '停用失败');
      }
    }
  };

  // 彻底删除项目（仅当无关联数据时允许）
  const handleHardDeleteGame = async (gameId, gameName) => {
    if (window.confirm(`EXTREME DANGER: 确定要彻底删除项目 [${gameName}] 吗？\n此操作不可恢复！\n确认：该项目下没有队伍和赛事，删除只是为了清理手滑输入的错误数据。`)) {
      if (!window.confirm(`二次确认：你确定要彻底删除 [${gameName}] 吗？`)) return;
      try {
        await api.delete(`/games/${gameId}`);
        setGames(games.filter(g => g.id !== gameId));
        showAlert('项目已彻底删除');
      } catch (error) {
        showAlert(error.response?.data?.error || '删除失败');
      }
    }
  };

  const handleCreateTournament = () => {
    setShowCreateTournament(true);
  };

  const handleInputResult = (matchId) => {
    showAlert(`将打开比赛 [${matchId}] 的赛果录入面版`);
  };

  // === 1. 子视图：系统总览 ===
  const renderOverview = () => (
    <div className="space-y-12 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="border-2 border-black p-6 bg-white shadow-[4px_4px_0_0_#000]">
          <p className="text-[10px] font-bold text-gray-500  tracking-widest mb-2">Total Users</p>
          <p className="text-4xl font-black">{systemStats.totalUsers}</p>
        </div>
        <div className="border-2 border-black p-6 bg-white shadow-[4px_4px_0_0_#000]">
          <p className="text-[10px] font-bold text-gray-500  tracking-widest mb-2">Total Teams</p>
          <p className="text-4xl font-black">{systemStats.totalTeams}</p>
        </div>
        <div className="border-2 border-black p-6 bg-white shadow-[4px_4px_0_0_#000]">
          <p className="text-[10px] font-bold text-gray-500  tracking-widest mb-2">Active Tournaments</p>
          <p className="text-4xl font-black text-[#660874]">{systemStats.activeTournaments}</p>
        </div>
        <div className="border-2 border-black p-6 bg-yellow-300 shadow-[4px_4px_0_0_#000]">
          <p className="text-[10px] font-bold text-black  tracking-widest mb-2">Pending Match Results</p>
          <p className="text-4xl font-black text-black">{systemStats.pendingMatches}</p>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-black  border-b-2 border-black pb-2 mb-6">System Action Logs</h3>
        <div className="overflow-x-auto border-2 border-black bg-white">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-black">
                <th className="p-4 text-[10px] font-bold text-gray-500  tracking-widest border-r border-gray-300 w-32">Timestamp</th>
                <th className="p-4 text-[10px] font-bold text-gray-500  tracking-widest border-r border-gray-300 w-32">Admin ID</th>
                <th className="p-4 text-[10px] font-bold text-gray-500  tracking-widest border-r border-gray-300 w-40">Action</th>
                <th className="p-4 text-[10px] font-bold text-gray-500  tracking-widest">Details</th>
              </tr>
            </thead>
            <tbody>
              {adminLogs.map((log) => (
                <tr key={log.id} className="border-b border-gray-200 hover:bg-yellow-50 transition-colors">
                  <td className="p-4 text-xs font-bold font-mono border-r border-gray-200">{log.time}</td>
                  <td className="p-4 text-xs font-bold border-r border-gray-200">{log.admin}</td>
                  <td className="p-4 border-r border-gray-200">
                    <span className="text-[10px] font-bold bg-black text-white px-2 py-1 ">{log.action}</span>
                  </td>
                  <td className="p-4 text-xs font-medium text-gray-600">{log.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // === 2. 子视图：赛事管理 ===
  const renderTournaments = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-6">
        <h3 className="text-2xl font-black ">Tournament Control</h3>
        <button onClick={handleCreateTournament} className="bg-[#660874] text-white px-6 py-3 font-bold text-xs  hover:opacity-90 transition-opacity shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1">
          + DEPLOY NEW TOURNAMENT
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {tournaments.map(t => (
          <div key={t.id} className="border-2 border-black bg-white p-6 flex flex-col md:flex-row justify-between md:items-center gap-6 group hover:shadow-[4px_4px_0_0_#000] transition-shadow">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-[10px] font-bold px-2 py-1  ${t.status === 'ONGOING' ? 'bg-yellow-300 text-black' : t.status === 'COMPLETED' ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-800'}`}>
                  {t.status}
                </span>
                <span className="text-xs font-bold text-gray-500  tracking-widest">{t.game}</span>
              </div>
              <h4 className="text-xl font-black ">{t.name}</h4>
              <p className="text-xs font-bold text-gray-500 mt-2">ENROLLED SQUADS: <span className="text-black">{t.enrolled} / {t.maxTeams}</span></p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditingTournamentId(t.id);
                  setShowEditTournament(true);
                }}
                className="border-2 border-black px-4 py-2 text-xs font-bold  hover:bg-black hover:text-white transition-colors"
              >
                EDIT DETAILS
              </button>
              {t.status !== 'COMPLETED' && (
                <button className="border-2 border-red-500 text-red-500 px-4 py-2 text-xs font-bold  hover:bg-red-500 hover:text-white transition-colors">
                  FORCE END
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // === 3. 子视图：赛果录入 ===
  const renderResults = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="border-b-2 border-black pb-4 mb-6">
        <h3 className="text-2xl font-black ">Results Operations</h3>
        <p className="text-xs font-bold text-gray-500  tracking-widest mt-2">Matches awaiting admin confirmation and result input.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {pendingResults.map(m => (
          <div key={m.id} className="border-2 border-black bg-white p-6 relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-400"></div>
            <div className="pl-4 flex-1">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] font-bold bg-black text-white px-2 py-1 ">{m.round}</span>
                  <p className="text-xs font-bold text-gray-400  mt-2">{m.tournament}</p>
                </div>
                <span className="text-[10px] font-bold border border-gray-300 px-2 py-1">{m.time}</span>
              </div>
              
              {m.type === 'LOBBY' ? (
                <div className="py-4 text-center border-y border-dashed border-gray-200 my-4">
                  <p className="text-lg font-black ">MULTI-SQUAD LOBBY</p>
                  <p className="text-xs font-bold text-gray-500">{m.teamsCount} Squads Participated</p>
                </div>
              ) : (
                <div className="flex justify-between items-center py-4 my-4 border-y border-dashed border-gray-200">
                  <span className="font-bold  text-lg flex-1 text-right">{m.teamA}</span>
                  <span className="px-4 text-xs font-bold text-gray-400">VS</span>
                  <span className="font-bold  text-lg flex-1 text-left">{m.teamB}</span>
                </div>
              )}

              <button 
                onClick={() => handleInputResult(m.id)}
                className="w-full bg-yellow-300 border-2 border-black text-black py-3 font-black  tracking-widest text-sm hover:bg-black hover:text-white transition-colors"
              >
                INPUT MATCH RESULTS
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // === 4. 子视图：游戏项目管理 ===
  const renderGames = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="border-b-2 border-black pb-4 mb-6">
        <h3 className="text-2xl font-black ">Supported Games</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-8">
          <table className="w-full text-left border-collapse border-2 border-black bg-white">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-black">
                <th className="p-4 text-[10px] font-bold text-gray-500  tracking-widest border-r border-gray-300">Title</th>
                <th className="p-4 text-[10px] font-bold text-gray-500  tracking-widest border-r border-gray-300">Match Type</th>
                <th className="p-4 text-[10px] font-bold text-gray-500  tracking-widest w-32 text-right border-r border-gray-300">Active Teams</th>
                <th className="p-4 text-[10px] font-bold text-gray-500  tracking-widest w-24 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {games.map(g => (
                <tr key={g.id} className="border-b border-gray-200 hover:bg-gray-50 group transition-colors">
                  <td className="p-4 text-sm font-black  border-r border-gray-200">{g.name}</td>
                  <td className="p-4 text-sm font-bold  border-r border-gray-200">
                    <span className={`text-[10px] font-bold px-2 py-1 ${g.type === 'LOBBY' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                      {g.type === 'LOBBY' ? 'Lobby (多人混战)' : 'H2H (一对一)'}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-bold text-right text-[#660874] border-r border-gray-200">{g.teamsCount}</td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col">
                      {/* 停用按钮：平时隐藏，鼠标悬停到该行时显示 */}
                      <button
                        onClick={() => handleDeactivateGame(g.id, g.name)}
                        className="text-[10px] font-bold text-gray-400 hover:text-white hover:bg-orange-600 px-2 py-1  tracking-widest transition-all opacity-0 group-hover:opacity-100 mb-1"
                      >
                        DEACTIVATE
                      </button>
                      {g.teamsCount === 0 && (
                        <button
                          onClick={() => handleHardDeleteGame(g.id, g.name)}
                          className="text-[10px] font-bold text-gray-400 hover:text-white hover:bg-red-600 px-2 py-1  tracking-widest transition-all opacity-0 group-hover:opacity-100"
                        >
                          HARD DELETE
                        </button>
                      )}
                      {/* 占位保持行高一致 */}
                      {g.teamsCount > 0 && <div className="h-[18px]"></div>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:col-span-4">
          <form onSubmit={handleAddGame} className="border-2 border-black bg-white p-6 shadow-[4px_4px_0_0_#000]">
            <h4 className="text-sm font-black  border-b-2 border-black pb-2 mb-4">Register New Game</h4>
            <div className="mb-4">
              <label className="block text-[10px] font-bold  tracking-widest text-gray-500 mb-2">Game Title</label>
              <input
                type="text" required placeholder="e.g. DOTA 2"
                value={newGameName} onChange={e => setNewGameName(e.target.value)}
                className="w-full border-b-2 border-gray-200 focus:border-black py-2 outline-none font-bold transition-colors bg-transparent"
              />
            </div>
            <div className="mb-6">
              <label className="block text-[10px] font-bold  tracking-widest text-gray-500 mb-2">Default Match Type</label>
              <select
                value={newGameType}
                onChange={e => setNewGameType(e.target.value)}
                className="w-full border-b-2 border-gray-200 focus:border-black py-2 outline-none font-bold transition-colors bg-transparent"
              >
                <option value="H2H">H2H (Head-to-Head 一对一)</option>
                <option value="LOBBY">Lobby (多人混战)</option>
              </select>
            </div>
            <button type="submit" className="w-full bg-black text-white py-3 font-bold text-xs  tracking-widest hover:bg-[#660874] transition-colors">
              ADD GAME TO SYSTEM
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans selection:bg-yellow-300 selection:text-black flex flex-col md:flex-row">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
      `}</style>

      {/* 左侧黑黄侧边栏 */}
      <aside className="w-full md:w-64 bg-black text-white flex flex-col border-r-4 border-[#660874] shrink-0 min-h-fit md:min-h-screen sticky top-0 z-20">
        <div className="p-6 border-b border-gray-800 bg-yellow-400 text-black">
          <p className="text-[10px] font-black  tracking-widest mb-1 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
            DIRECTOR OVERRIDE
          </p>
          <h1 className="text-2xl font-black tracking-tighter  leading-none">Admin<br/>Console.</h1>
        </div>

        <nav className="flex-1 flex flex-row md:flex-col overflow-x-auto md:overflow-visible">
          {[
            { id: 'OVERVIEW', label: 'System Overview', sub: '系统总览' },
            { id: 'TOURNAMENTS', label: 'Tournaments', sub: '赛事控制' },
            { id: 'RESULTS', label: 'Match Results', sub: '赛果录入' },
            { id: 'GAMES', label: 'Game Titles', sub: '项目管理' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-left p-6 border-b border-gray-800 transition-all min-w-[160px] md:min-w-0 ${
                activeTab === tab.id 
                ? 'bg-gray-900 border-l-4 border-l-yellow-400 pl-5' 
                : 'hover:bg-gray-900 text-gray-400 hover:text-white'
              }`}
            >
              <div className="font-black  tracking-wider text-sm">{tab.label}</div>
              <div className="text-[10px] font-bold opacity-50 mt-1  tracking-widest">{tab.sub}</div>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-gray-800 mt-auto">
          <button 
            onClick={onLogout}
            className="w-full border-2 border-gray-700 text-gray-400 py-3 font-bold text-xs  tracking-widest hover:border-red-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
          >
            EXIT TERMINAL
          </button>
        </div>
      </aside>

      {/* 右侧内容操作区 */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-12">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'OVERVIEW' && renderOverview()}
            {activeTab === 'RESULTS' && renderResults()}
            {activeTab === 'GAMES' && renderGames()}
            {activeTab === 'TOURNAMENTS' && (
              <>
                {showCreateTournament ? (
                  <CreateTournament
                    embedded={true}
                    onCancel={() => setShowCreateTournament(false)}
                    onSuccess={() => {
                      setShowCreateTournament(false);
                      // 刷新赛事列表
                      api.get('/tournaments').then(res => {
                        const list = res.data?.data || [];
                        setTournaments(list.map(t => ({
                          id: t.TournamentID,
                          name: t.TournamentName,
                          game: t.Game?.GameName || '未指定',
                          status: t.Status,
                          maxTeams: t.MaxTeamSize,
                          enrolled: t.CurrentTeams
                        })));
                      }).catch(() => {});
                    }}
                  />
                ) : showEditTournament ? (
                  <TournamentEdit
                    tournamentId={editingTournamentId}
                    onCancel={() => {
                      setShowEditTournament(false);
                      setEditingTournamentId(null);
                    }}
                    onSuccess={() => {
                      setShowEditTournament(false);
                      setEditingTournamentId(null);
                      // 刷新赛事列表
                      api.get('/tournaments').then(res => {
                        const list = res.data?.data || [];
                        setTournaments(list.map(t => ({
                          id: t.TournamentID,
                          name: t.TournamentName,
                          game: t.Game?.GameName || '未指定',
                          status: t.Status,
                          maxTeams: t.MaxTeamSize,
                          enrolled: t.CurrentTeams
                        })));
                      }).catch(() => {});
                    }}
                  />
                ) : (
                  renderTournaments()
                )}
              </>
            )}
          </div>
        </div>
      </main>

    </div>
  );
}