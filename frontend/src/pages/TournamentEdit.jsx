import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { showAlert } from '../components/CustomAlert';
import MatchDeploy from './MatchDeploy';

const STATUS_OPTIONS = [
  { value: 'REGISTRATION', label: '报名中', color: 'bg-green-400' },
  { value: 'ONGOING', label: '进行中', color: 'bg-yellow-400' },
  { value: 'COMPLETED', label: '已完赛', color: 'bg-gray-400' }
];

const FORMATS = ['单败淘汰赛 (BO1)', '单败淘汰赛 (BO3)', '双败淘汰赛', '大厅积分突围赛', '小组单循环赛'];
const PRESET_SIZES = [8, 16, 32, 64];

export default function EditTournament({ tournamentId = 'T002', onCancel, onSuccess }) {
  // 核心导航状态
  const [activeTab, setActiveTab] = useState('PARAMETERS'); // PARAMETERS, ROSTER, MATCHES

  // 表单与数据状态
  const [formData, setFormData] = useState({
    name: '',
    status: 'REGISTRATION',
    maxTeams: 16,
    format: FORMATS[0],
    prizePool: '',
    description: ''
  });

  const [gameId, setGameId] = useState('');
  const [gameName, setGameName] = useState('');
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // 搜索队伍状态
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  // 防抖定时器
  const searchTimeoutRef = React.useRef(null);
  // 控制新建比赛面板显示
  const [showMatchDeploy, setShowMatchDeploy] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/tournaments/${tournamentId}`);
        if (res.data.success) {
          const t = res.data.data;
          setFormData({
            name: t.TournamentName,
            status: t.Status || 'REGISTRATION',
            maxTeams: t.MaxTeamSize,
            format: t.Format || FORMATS[0],
            prizePool: t.PrizePool || '',
            description: t.Description || ''
          });
          setGameId(t.GameID);
          setGameName(t.Game?.GameName || '未指定');
          setTeams((t.SignUps || []).map(s => ({
            id: s.Team.TeamID,
            name: s.Team.TeamName,
            captain: s.Team.Captain?.UserName || 'UNKNOWN',
            joinDate: s.SignUpTime
          })));
          setMatches((t.MatchInfos || []).map(m => ({
            id: m.MatchID,
            round: m.MatchName,
            type: m.MatchType,
            time: m.MatchTime,
            status: m.Status,
            summary: `${(m.MatchParticipations || []).length} 参赛队`
          })));
        }
      } catch (error) {
        console.error('获取赛事编辑详情失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
    // 清理防抖定时器
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [tournamentId]);

  // === 交互逻辑 ===

  const handleSaveChanges = async (e) => {
    e.preventDefault();
    if (!formData.name) return showAlert("赛事名称不能为空");
    setIsSubmitting(true);

    try {
      await api.put(`/tournaments/${tournamentId}`, {
        tournamentName: formData.name,
        status: formData.status,
        maxTeamSize: formData.maxTeams,
        format: formData.format,
        prizePool: formData.prizePool,
        description: formData.description
      });
      showAlert("赛事信息更新成功");
      if (onSuccess) onSuccess();
    } catch (error) {
      showAlert(error.response?.data?.error || '更新失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKickTeam = async (teamId, teamName) => {
    if (window.confirm(`DANGER: 确定要将队伍 [${teamName}] 强制踢出本赛事吗？此操作将彻底删除他们的报名记录！`)) {
      try {
        await api.delete(`/tournaments/${tournamentId}/signup/${teamId}`);
        setTeams(teams.filter(t => t.id !== teamId));
      } catch (error) {
        showAlert(error.response?.data?.error || '踢出失败');
      }
    }
  };

  // 搜索可添加的队伍
  const handleSearchTeams = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/admin/tournaments/${tournamentId}/search-teams`, {
        params: { query: searchQuery.trim() }
      });
      if (res.data.success) {
        setSearchResults(res.data.data || []);
      }
    } catch (error) {
      console.error('搜索失败:', error);
      showAlert(error.response?.data?.error || '搜索失败');
    }
  };

  const handleAddTeam = async (teamId, teamName) => {
    if (teams.length >= formData.maxTeams) {
      showAlert(`赛事已达到最大队伍数限制 (${formData.maxTeams})`);
      return;
    }
    if (window.confirm(`确定要将队伍 [${teamName}] 添加到本赛事吗？`)) {
      try {
        await api.post(`/admin/tournaments/${tournamentId}/add-team`, { teamId });
        // 刷新队伍列表
        const res = await api.get(`/tournaments/${tournamentId}/roster`);
        if (res.data.success) {
          const newTeams = res.data.data.map(t => ({
            id: t.TeamID,
            name: t.TeamName,
            captain: t.Captain?.UserName || 'UNKNOWN',
            joinDate: new Date().toLocaleDateString()
          }));
          setTeams(newTeams);
          setSearchResults([]);
          setSearchQuery('');
        }
      } catch (error) {
        showAlert(error.response?.data?.error || '添加失败');
      }
    }
  };

  const handleDestroyTournament = () => {
    if (window.confirm(`🔥🔥🔥 EXTREME DANGER: 你即将彻底抹除该赛事的所有数据（含比赛记录、报名数据）！\n请在确认后输入管理员密码... (模拟操作)`)) {
      showAlert("赛事已从系统中强制抹除。");
      if (onCancel) onCancel();
    }
  };

  const handleCreateMatch = () => {
    setShowMatchDeploy(true);
  };

  const handleDeleteMatch = async (matchId) => {
    if (window.confirm(`确定要删除比赛记录 [${matchId}] 吗？`)) {
      try {
        await api.delete(`/matches/${matchId}`);
        setMatches(matches.filter(m => m.id !== matchId));
      } catch (error) {
        showAlert(error.response?.data?.error || '删除比赛失败');
      }
    }
  };

  // === 视图渲染 ===

  // 1. 参数编辑视图
  const renderParameters = () => (
    <div className="animate-fade-in">
      <form onSubmit={handleSaveChanges} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* 左侧：核心参数区域 */}
        <section className="lg:col-span-7 space-y-8">
          {/* 1. 赛事名称 */}
          <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0_0_#000]">
            <label className="block text-xs font-black tracking-widest text-black mb-4">
              01. TOURNAMENT TITLE (赛事名称)
            </label>
            <input
              required
              type="text"
              maxLength={40}
              placeholder="e.g. 2026 首届紫荆杯 CS2 挑战赛"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full border-b-4 border-gray-200 py-3 text-2xl font-black tracking-wider outline-none focus:border-yellow-400 transition-colors bg-transparent"
            />
          </div>

          {/* 2. 赛事状态 + 规模 两行 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {/* 赛事状态 */}
            <div className="bg-white border-2 border-black p-6">
              <label className="block text-xs font-black tracking-widest text-black mb-4">
                02. CURRENT STATUS (当前状态)
              </label>
              <div className="grid grid-cols-3 gap-3">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({...formData, status: opt.value})}
                    className={`p-3 text-[10px] font-bold tracking-widest border-2 transition-colors ${
                      formData.status === opt.value
                      ? `border-black ${opt.color} text-black`
                      : 'border-gray-200 text-gray-400 hover:border-black hover:text-black'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 最大队伍数 */}
            <div className="bg-white border-2 border-black p-6">
              <label className="block text-xs font-black tracking-widest text-black mb-4">
                03. CAPACITY (赛事规模)
              </label>
              {/* 自由输入 */}
              <div className="flex items-end gap-4 mb-4">
                <input
                  type="number"
                  min="2"
                  max="999"
                  required
                  value={formData.maxTeams}
                  onChange={e => setFormData({...formData, maxTeams: parseInt(e.target.value) || ''})}
                  className="w-full border-b-4 border-black py-2 text-4xl font-black outline-none focus:border-yellow-400 transition-colors bg-transparent"
                />
                <span className="text-sm font-bold tracking-widest text-gray-500 pb-2">SQUADS</span>
              </div>
              {/* 快捷预设 */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 tracking-widest mr-1">PRESETS:</span>
                {PRESET_SIZES.map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setFormData({...formData, maxTeams: size})}
                    className={`px-3 py-1 border-2 font-bold text-[10px] transition-all ${
                      formData.maxTeams === size ? 'border-black bg-black text-yellow-300' : 'border-gray-200 text-gray-500 hover:border-black hover:text-black'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. 赛制 */}
          <div className="bg-white border-2 border-black p-6">
            <label className="block text-xs font-black tracking-widest text-black mb-4">
              04. FORMAT (赛制)
            </label>
            <div className="grid grid-cols-1 gap-2">
              {FORMATS.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormData({...formData, format: f})}
                  className={`w-full text-left px-4 py-2 border-2 font-bold text-xs transition-all flex justify-between items-center ${
                    formData.format === f
                    ? 'border-black bg-black text-yellow-300'
                    : 'border-gray-200 text-gray-500 hover:border-black hover:text-black hover:bg-gray-50'
                  }`}
                >
                  <span>{f}</span>
                  {formData.format === f && (
                    <svg className="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="square" d="M5 13l4 4L19 7"></path></svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 右侧：奖金池 + 描述 + 保存按钮 */}
        <aside className="lg:col-span-5 space-y-8 flex flex-col">
          {/* 奖金池 */}
          <div className="bg-white border-2 border-black p-6 flex-1 flex flex-col">
            <label className="block text-xs font-black tracking-widest text-black mb-4">
              05. PRIZE POOL (奖金池/奖励)
            </label>
            <input
              type="text"
              placeholder="e.g. ¥ 10,000 + 冠军奖杯"
              value={formData.prizePool}
              onChange={e => setFormData({...formData, prizePool: e.target.value})}
              className="w-full border-b-2 border-gray-200 py-2 text-sm font-bold tracking-wider outline-none focus:border-yellow-400 transition-colors bg-transparent"
            />
          </div>

          {/* 赛事规则描述 */}
          <div className="bg-white border-2 border-black p-6 flex-1 flex flex-col">
            <label className="block text-xs font-black tracking-widest text-black mb-4">
              06. INTELLIGENCE (规则与详情)
            </label>
            <textarea
              required
              placeholder="Describe tournament rules, schedule, and requirements here..."
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full flex-1 min-h-[250px] border-2 border-gray-200 p-4 text-sm font-medium outline-none focus:border-black transition-colors resize-none placeholder-gray-300"
            ></textarea>
          </div>

          {/* 保存按钮 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-yellow-400 border-2 border-black text-black py-6 font-black tracking-widest text-lg hover:bg-black hover:text-yellow-400 transition-colors flex items-center justify-center gap-3 shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="relative z-10 flex items-center gap-3">
              {isSubmitting ? 'UPDATING...' : 'SAVE CHANGES'}
              {!isSubmitting && <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>}
            </span>
          </button>
        </aside>

        {/* 危险区域：全宽度 */}
        <div className="lg:col-span-12">
          <div className="border-2 border-red-600 p-6 bg-red-50 mt-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-600"></div>
            <div>
              <h3 className="text-sm font-black text-red-600 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.7 5c-.83 1.7-1.66 2.5-3.464 2.5z"></path></svg>
                Danger Zone
              </h3>
              <p className="text-xs font-bold text-gray-600 leading-relaxed max-w-2xl">
                Actions here are irreversible. Deleting a tournament will permanently erase all associated matches, bracket data, and enrolled teams.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDestroyTournament}
              className="w-full md:w-auto border-2 border-red-600 text-red-600 px-8 py-3 text-xs font-black tracking-widest hover:bg-red-600 hover:text-white transition-colors"
            >
              DESTROY TOURNAMENT
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  // 2. 参赛名单视图
  const renderRoster = () => (
    <div className="bg-white border-2 border-black p-8 shadow-[4px_4px_0_0_#000] animate-fade-in">
      <h2 className="text-2xl font-black tracking-tight  border-b-2 border-black pb-4 mb-8 flex justify-between items-center">
        Enrolled Roster
        <span className="text-sm font-bold text-gray-500">{teams.length} / {formData.maxTeams}</span>
      </h2>

      {/* 搜索添加队伍区域 */}
      <div className="mb-8 p-6 border-2 border-dashed border-gray-300 bg-gray-50">
        <h3 className="text-sm font-black tracking-widest mb-4">ADMIN ADD TEAM</h3>
        <div className="flex gap-3 items-stretch">
          <input
            type="text"
            placeholder="输入队伍名称关键词自动搜索..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              // 防抖：300ms 后搜索，避免频繁请求
              if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
              }
              if (!e.target.value.trim()) {
                setSearchResults([]);
                return;
              }
              searchTimeoutRef.current = setTimeout(() => {
                handleSearchTeams();
              }, 300);
            }}
            className="flex-1 border-2 border-gray-200 px-4 py-2 text-sm font-bold outline-none focus:border-black transition-colors bg-white"
          />
        </div>

        {/* 搜索结果 */}
        {searchResults.length > 0 && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <p className="text-[10px] font-bold text-gray-500 tracking-widest mb-3">SEARCH RESULTS ({searchResults.length}):</p>
            <div className="space-y-2">
              {searchResults.map(team => (
                <div key={team.TeamID} className="flex items-center justify-between p-3 bg-white border-2 border-gray-200">
                  <div>
                    <p className="text-sm font-black">{team.TeamName}</p>
                    <p className="text-[10px] font-bold text-gray-500">Captain: {team.Captain?.UserName || 'Unknown'}</p>
                  </div>
                  <button
                    onClick={() => handleAddTeam(team.TeamID, team.TeamName)}
                    className="bg-black text-white px-3 py-1 text-[10px] font-bold tracking-widest hover:bg-[#660874] transition-colors"
                  >
                    ADD TO TOURNAMENT
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {searchQuery && searchResults.length === 0 && (
          <p className="mt-4 text-xs font-bold text-gray-400 text-center py-4">No matching teams found that are not already enrolled.</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.length === 0 ? (
          <p className="col-span-full text-xs font-bold text-gray-400  tracking-widest py-12 text-center border-2 border-dashed border-gray-200">
            NO SQUADS ENROLLED YET.
          </p>
        ) : teams.map((team, idx) => (
            <div key={team.id} className="border-2 border-gray-200 p-5 group hover:border-black transition-colors relative flex flex-col h-full bg-gray-50 hover:bg-white">
              <div className="flex items-start justify-between mb-4">
                <span className="text-3xl font-black text-gray-200 group-hover:text-[#660874] transition-colors leading-none">
                  {idx < 9 ? `0${idx + 1}` : idx + 1}
                </span>
                <span className="text-[10px] font-bold bg-black text-white px-2 py-0.5  tracking-widest">
                  {team.id}
                </span>
              </div>
              <h4 className="font-black  text-lg mb-2">{team.name}</h4>
              <p className="text-[10px] font-bold text-gray-500  tracking-widest mb-4">
                Captain: {team.captain}<br/>
                Joined: {team.joinDate}
              </p>

              <button
                onClick={() => handleKickTeam(team.id, team.name)}
                className="mt-auto w-full border-2 border-red-200 text-red-500 text-xs font-bold py-2  hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
              >
                KICK SQUAD
              </button>
            </div>
          ))}
      </div>
    </div>
  );

  // 3. 赛程管控视图
  const renderMatches = () => {
    if (showMatchDeploy) {
      return (
        <MatchDeploy
          embedded={true}
          tournamentId={tournamentId}
          tournamentName={formData.name}
          enrolledTeams={teams}
          onCancel={async () => {
            setShowMatchDeploy(false);
            // 刷新比赛列表
            try {
              const res = await api.get(`/tournaments/${tournamentId}/matches`);
              if (res.data.success) {
                const newMatches = res.data.data.map(m => ({
                  id: m.MatchID,
                  round: m.MatchName,
                  type: m.MatchType,
                  time: m.MatchTime,
                  status: m.Status,
                  summary: `${(m.MatchParticipations || []).length} 参赛队`
                }));
                setMatches(newMatches);
              }
            } catch(e) {
              // ignore
            }
          }}
          onSuccess={async () => {
            setShowMatchDeploy(false);
            // 刷新比赛列表
            try {
              const res = await api.get(`/tournaments/${tournamentId}/matches`);
              if (res.data.success) {
                const newMatches = res.data.data.map(m => ({
                  id: m.MatchID,
                  round: m.MatchName,
                  type: m.MatchType,
                  time: m.MatchTime,
                  status: m.Status,
                  summary: `${(m.MatchParticipations || []).length} 参赛队`
                }));
                setMatches(newMatches);
              }
            } catch(e) {
              // ignore
            }
          }}
        />
      );
    }

    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight ">Matches Configuration</h2>
            <p className="text-xs font-bold text-gray-500  tracking-widest mt-2">Create and manage match brackets for this tournament.</p>
          </div>
          <button
            onClick={handleCreateMatch}
            className="bg-black text-yellow-400 px-6 py-4 font-black text-sm  tracking-widest hover:bg-gray-800 transition-colors shadow-[4px_4px_0_0_#eab308] hover:shadow-none hover:translate-x-1 hover:translate-y-1 whitespace-nowrap"
          >
            + DEPLOY NEW MATCH
          </button>
        </div>

        <div className="bg-white border-2 border-black shadow-[4px_4px_0_0_#000]">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-black">
                <th className="p-4 text-[10px] font-bold text-gray-500  tracking-widest border-r border-gray-300 w-24">Match ID</th>
                <th className="p-4 text-[10px] font-bold text-gray-500  tracking-widest border-r border-gray-300 w-32">Round / Type</th>
                <th className="p-4 text-[10px] font-bold text-gray-500  tracking-widest border-r border-gray-300 w-40">Schedule</th>
                <th className="p-4 text-[10px] font-bold text-gray-500  tracking-widest border-r border-gray-300">Summary</th>
                <th className="p-4 text-[10px] font-bold text-gray-500  tracking-widest border-r border-gray-300 w-32 text-center">Status</th>
                <th className="p-4 text-[10px] font-bold text-gray-500  tracking-widest w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {matches.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-xs font-bold text-gray-400  tracking-widest border-t border-gray-200">
                    NO MATCHES DEPLOYED YET.
                  </td>
                </tr>
              ) : matches.map((m) => (
                  <tr key={m.id} className="border-b border-gray-200 hover:bg-yellow-50 transition-colors group">
                    <td className="p-4 text-xs font-bold font-mono border-r border-gray-200">{m.id}</td>
                    <td className="p-4 border-r border-gray-200">
                      <div className="font-bold  text-xs">{m.round}</div>
                      <div className="text-[10px] text-gray-500 font-bold  mt-1">{m.type}</div>
                    </td>
                    <td className="p-4 text-xs font-bold text-gray-600 border-r border-gray-200">{m.time}</td>
                    <td className="p-4 text-sm font-bold  border-r border-gray-200">{m.summary}</td>
                    <td className="p-4 text-center border-r border-gray-200">
                      <span className={`text-[10px] font-bold px-2 py-1  tracking-widest ${m.status === 'FINISHED' ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-800'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="p-4 text-center flex flex-col gap-2">
                      <button className="text-[10px] font-bold text-gray-400 hover:text-black  tracking-widest transition-colors">EDIT</button>
                      <button onClick={() => handleDeleteMatch(m.id)} className="text-[10px] font-bold text-gray-400 hover:text-red-600  tracking-widest transition-colors">DELETE</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-full selection:bg-black selection:text-yellow-300 pb-32">
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-in { animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
      `}</style>

      <div className="max-w-7xl mx-auto animate-slide-in">

        {/* === 顶部控制台头部 === */}
        <div className="border-b-4 border-black pb-6 mb-8 flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-yellow-400 text-black text-[10px] font-black px-2 py-1  tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                DIRECTOR OVERRIDE
              </span>
              <span className="text-gray-500 font-bold text-xs  tracking-widest">
                ● TOURNAMENT CONTROL HUB
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter ">{formData.name}</h1>
          </div>

          <button onClick={onCancel} className="text-xs font-bold  tracking-widest text-gray-400 hover:text-black transition-colors">
            ← BACK TO DASHBOARD
          </button>
        </div>

        {/* === 内部超级选项卡 Tabs === */}
        <div className="flex overflow-x-auto border-b-4 border-black mb-10 gap-2 pb-2">
          {[
            { id: 'PARAMETERS', label: '1. Parameters', sub: '参数设定' },
            { id: 'ROSTER', label: '2. Roster', sub: `参赛名单 (${teams.length})` },
            { id: 'MATCHES', label: '3. Matches', sub: `赛程安排 (${matches.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-8 py-4  tracking-widest transition-all border-2 border-transparent ${
                activeTab === tab.id
                ? 'bg-black text-yellow-400 border-black font-black'
                : 'text-gray-500 hover:border-black hover:text-black font-bold'
              }`}
            >
              <div className="text-sm md:text-base">{tab.label}</div>
              <div className="text-[10px] opacity-70 mt-1">{tab.sub}</div>
            </button>
          ))}
        </div>

        {/* === 模块内容挂载区 === */}
        {activeTab === 'PARAMETERS' && renderParameters()}
        {activeTab === 'ROSTER' && renderRoster()}
        {activeTab === 'MATCHES' && renderMatches()}

      </div>
    </div>
  );
}
