import React, { useEffect, useState } from 'react';
import api from '../utils/api';

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

  const [gameName, setGameName] = useState('');
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

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
  }, [tournamentId]);

  // === 交互逻辑 ===

  const handleSaveChanges = async (e) => {
    e.preventDefault();
    if (!formData.name) return alert("赛事名称不能为空");
    setIsSubmitting(true);

    try {
      await api.put(`/tournaments/${tournamentId}`, {
        tournamentName: formData.name,
        status: formData.status,
        maxTeamSize: Number(formData.maxTeams),
        format: formData.format,
        prizePool: formData.prizePool,
        description: formData.description
      });
      alert(`赛事 [${formData.name}] 参数更新成功！`);
      if (onSuccess) onSuccess();
    } catch (error) {
      alert(error.response?.data?.error || '赛事更新失败');
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
        alert(error.response?.data?.error || '踢出失败');
      }
    }
  };

  const handleDestroyTournament = () => {
    if (window.confirm(`🔥🔥🔥 EXTREME DANGER: 你即将彻底抹除该赛事的所有数据（含比赛记录、报名数据）！\n请在确认后输入管理员密码... (模拟操作)`)) {
      alert("赛事已从系统中强制抹除。");
      if (onCancel) onCancel(); 
    }
  };

  const handleCreateMatch = () => {
    alert("请在 MatchDeploy 页面创建比赛（本页暂未内嵌创建面板）。");
  };

  const handleDeleteMatch = async (matchId) => {
    if (window.confirm(`确定要删除比赛记录 [${matchId}] 吗？`)) {
      try {
        await api.delete(`/matches/${matchId}`);
        setMatches(matches.filter(m => m.id !== matchId));
      } catch (error) {
        alert(error.response?.data?.error || '删除比赛失败');
      }
    }
  };


  // === 子视图渲染 ===

  // 1. 参数修改视图
  const renderParameters = () => (
    <form onSubmit={handleSaveChanges} className="space-y-10 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8 flex flex-col">
          {/* 只读属性锁定区 */}
          <div className="bg-gray-200 border-2 border-dashed border-gray-400 p-6 flex justify-between items-center opacity-70">
            <div>
              <p className="text-[10px] font-bold text-gray-500  tracking-widest mb-1">LOCKED ATTRIBUTE (已锁定属性)</p>
              <p className="text-lg font-black  text-gray-600">{loading ? 'LOADING...' : gameName}</p>
            </div>
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          </div>

          {/* 赛事状态 */}
          <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0_0_#000]">
            <label className="block text-xs font-black  tracking-widest text-black mb-4">
              01. EVENT STATUS (赛事阶段控制)
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value} type="button"
                  onClick={() => setFormData({...formData, status: opt.value})}
                  className={`flex-1 py-4 border-2 font-black  tracking-widest text-xs transition-all flex justify-center items-center gap-2 ${
                    formData.status === opt.value ? 'border-black bg-black text-white shadow-inner' : 'border-gray-200 text-gray-400 hover:border-black hover:text-black'
                  }`}
                >
                  {formData.status === opt.value && <span className={`w-2 h-2 rounded-full ${opt.color} animate-pulse`}></span>}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 赛事名称 */}
          <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0_0_#000]">
            <label className="block text-xs font-black  tracking-widest text-black mb-4">
              02. TOURNAMENT TITLE (赛事名称)
            </label>
            <input 
              type="text" required maxLength={40}
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full border-b-4 border-gray-200 py-3 text-2xl font-black  tracking-wider outline-none focus:border-yellow-400 transition-colors bg-transparent"
            />
          </div>

          {/* 奖金池 */}
          <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0_0_#000]">
            <label className="block text-xs font-black  tracking-widest text-black mb-4">
              03. PRIZE POOL (奖金池)
            </label>
            <input 
              type="text" 
              value={formData.prizePool} onChange={e => setFormData({...formData, prizePool: e.target.value})}
              className="w-full border-b-4 border-gray-200 py-2 mt-1 text-sm font-bold  tracking-wider outline-none focus:border-yellow-400 transition-colors bg-transparent"
            />
          </div>
        </div>

        <div className="lg:col-span-5 space-y-8 flex flex-col">
          {/* 容量 */}
          <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0_0_#000]">
            <label className="block text-xs font-black  tracking-widest text-black mb-4">
              04. CAPACITY (扩缩容)
            </label>
            <div className="flex items-end gap-4 mb-2">
              <input 
                type="number" min={teams.length} max="999" required
                value={formData.maxTeams} onChange={e => setFormData({...formData, maxTeams: parseInt(e.target.value) || ''})}
                className="w-full border-b-4 border-black py-2 text-3xl font-black outline-none focus:border-yellow-400 transition-colors bg-transparent"
              />
              <span className="text-xs font-bold  tracking-widest text-gray-500 pb-2">SQUADS</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="text-[10px] font-bold text-gray-400  tracking-widest mr-1">PRESETS:</span>
              {PRESET_SIZES.map(size => (
                <button
                  key={size} type="button" onClick={() => setFormData({...formData, maxTeams: size})}
                  className={`px-3 py-1 border-2 font-bold text-[10px] transition-all ${formData.maxTeams === size ? 'border-black bg-black text-yellow-300' : 'border-gray-200 text-gray-500 hover:border-black hover:text-black'}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* 赛制 */}
          <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0_0_#000]">
            <label className="block text-xs font-black  tracking-widest text-black mb-4">
              05. FORMAT (赛制)
            </label>
            <div className="flex flex-col gap-2">
              {FORMATS.map(f => (
                <button
                  key={f} type="button" onClick={() => setFormData({...formData, format: f})}
                  className={`w-full text-left px-4 py-3 border-2 font-bold text-xs  transition-all flex justify-between items-center ${
                    formData.format === f ? 'border-black bg-black text-yellow-300' : 'border-gray-200 text-gray-500 hover:border-black hover:text-black hover:bg-gray-50'
                  }`}
                >
                  <span>{f}</span>
                  {formData.format === f && <svg className="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="square" d="M5 13l4 4L19 7"></path></svg>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 描述与提交 */}
      <div className="flex flex-col lg:flex-row gap-8 items-stretch">
        <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0_0_#000] flex-1 flex flex-col">
          <label className="block text-xs font-black  tracking-widest text-black mb-4">
            06. INTELLIGENCE (规则描述)
          </label>
          <textarea 
            required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
            className="w-full flex-1 min-h-[120px] border-2 border-gray-200 p-4 text-sm font-medium outline-none focus:border-black transition-colors resize-none"
          ></textarea>
        </div>

        <div className="lg:w-1/3 flex flex-col gap-4">
          <button 
            type="submit" disabled={isSubmitting}
            className="w-full h-full min-h-[120px] bg-yellow-400 border-2 border-black text-black font-black  tracking-widest text-lg hover:bg-black hover:text-yellow-400 transition-colors flex flex-col items-center justify-center gap-3 shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'UPDATING...' : 'SAVE CHANGES'}
            {!isSubmitting && <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M5 13l4 4L19 7"></path></svg>}
          </button>
        </div>
      </div>

      {/* 危险操作区 */}
      <div className="border-2 border-red-600 p-6 bg-red-50 mt-16 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="absolute top-0 left-0 w-full h-1 bg-red-600"></div>
        <div>
          <h3 className="text-sm font-black  text-red-600 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            Danger Zone
          </h3>
          <p className="text-xs font-bold text-gray-600  leading-relaxed max-w-2xl">
            Actions here are irreversible. Deleting a tournament will permanently erase all associated matches, bracket data, and enrolled teams.
          </p>
        </div>
        <button onClick={handleDestroyTournament} className="w-full md:w-auto bg-red-600 text-white px-8 py-4 font-black  tracking-widest text-xs hover:bg-red-700 transition-colors shadow-[4px_4px_0_0_#b91c1c] hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:bg-black whitespace-nowrap">
          DESTROY TOURNAMENT
        </button>
      </div>
    </form>
  );

  // 2. 参赛名单视图
  const renderRoster = () => (
    <div className="bg-white border-2 border-black p-8 shadow-[4px_4px_0_0_#000] animate-fade-in">
      <h2 className="text-2xl font-black tracking-tight  border-b-2 border-black pb-4 mb-8 flex justify-between items-center">
        Enrolled Roster
        <span className="text-sm font-bold text-gray-500">{teams.length} / {formData.maxTeams}</span>
      </h2>

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
  const renderMatches = () => (
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

  return (
    <div className="min-h-full bg-gray-100 text-gray-900 font-sans p-6 md:p-12 selection:bg-black selection:text-yellow-300 pb-32">
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