import React, { useState, useEffect } from 'react';
import api from './utils/api'; // 真实接入本地配置好的 Axios 实例

// === 1. 暂未开发后端接口的占位数据 (Mock Data) ===
const mockRecentMatches = [
  { id: 'M01', tournament: '三角洲迎新赛', teamA: '清华不败之师', scoreA: 3, teamB: '摸鱼小分队', scoreB: 1, time: '2小时前' },
  { id: 'M02', tournament: '三角洲迎新赛', teamA: '银河战舰', scoreA: 2, teamB: '重在参与', scoreB: 0, time: '5小时前' },
];
const mockUpcomingMatches = [
  { id: 'M04', tournament: '联合锦标赛', teamA: '计科一班', teamB: '软件工程', time: '今晚 20:00' },
];
const mockHistoryMatches = [
  { id: 'H01', tournament: '三角洲迎新赛决赛', game: '三角洲行动', teamA: '清华不败之师', scoreA: 3, teamB: '摸鱼小分队', scoreB: 1, date: '2026.03.08' },
  { id: 'H02', tournament: '联合锦标赛淘汰赛', game: '无畏契约', teamA: '银河战舰', scoreA: 13, teamB: '计科一班', scoreB: 11, date: '2026.03.07' },
];

const GAMES = ['ALL', '三角洲行动', '无畏契约', 'CS2', '英雄联盟', 'DOTA 2', '守望先锋'];

export default function App() {
  // === 2. 全局交互与鉴权状态 ===
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('DASHBOARD');

  // 登录弹窗状态
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ userName: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // === 3. 真实数据状态 ===
  const [tournaments, setTournaments] = useState([]);
  const [teams, setTeams] = useState([]);

  // === 4. 各页面独立筛选状态 ===
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyActiveFilter, setHistoryActiveFilter] = useState('ALL');
  const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false);

  // === 5. 初始化加载与真实数据抓取 ===
  useEffect(() => {
    // 检查本地是否已有 Token (保持登录状态)
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('userName');
    if (token && storedUser) {
      setIsLoggedIn(true);
      setUserName(storedUser);
    }

    // 从 Node.js 后端拉取真实的公共数据
    fetchPublicData();
  }, []);

  const fetchPublicData = async () => {
    try {
      // 拉取真实的赛事列表
      const tourRes = await api.get('/tournaments');
      if (tourRes.data.success) setTournaments(tourRes.data.data);

      // 拉取真实的队伍列表
      const teamRes = await api.get('/teams');
      if (teamRes.data.success) setTeams(teamRes.data.data);

    } catch (error) {
      console.error("数据拉取失败，请确保 Node.js 后端服务已启动并在 3000 端口运行:", error);
    }
  };

  // === 6. 核心业务逻辑 ===
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      // 真实调用登录接口
      const res = await api.post('/users/login', loginForm);

      // 登录成功，存储凭证
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('userName', res.data.data.UserName);

      setIsLoggedIn(true);
      setUserName(res.data.data.UserName);
      setShowLoginModal(false); // 关闭弹窗

    } catch (err) {
      setLoginError(err.response?.data?.error || '登录失败，请检查网络或账号密码');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    setIsLoggedIn(false);
    setUserName('');
    setIsSidebarOpen(false);
    setActiveTab('DASHBOARD');
  };

  // === 7. 子组件渲染 ===

  // 极简登录弹窗
  const renderLoginModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border-2 border-black w-full max-w-md p-8 shadow-2xl relative">
        <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h2 className="text-3xl font-black uppercase tracking-tight mb-8">Access<br />Account.</h2>

        <form onSubmit={handleLoginSubmit} className="flex flex-col gap-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Username</label>
            <input
              type="text" required
              value={loginForm.userName} onChange={e => setLoginForm({ ...loginForm, userName: e.target.value })}
              className="w-full border-b-2 border-gray-200 focus:border-black py-2 outline-none font-bold uppercase transition-colors bg-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Password</label>
            <input
              type="password" required
              value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
              className="w-full border-b-2 border-gray-200 focus:border-black py-2 outline-none transition-colors bg-transparent"
            />
          </div>
          {loginError && <p className="text-red-600 text-xs font-bold uppercase">{loginError}</p>}
          <button type="submit" className="mt-4 bg-[#660874] text-white py-4 font-black uppercase tracking-widest hover:opacity-90 transition-opacity">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );

  // 赛事大厅视图
  const renderDashboard = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 animate-fade-in">
      <section className="lg:col-span-8">
        <div className="border-b border-black pb-4 mb-8">
          <h2 className="text-3xl font-black tracking-tight uppercase">Tournaments</h2>
        </div>
        <div className="flex flex-col">
          {tournaments.length === 0 ? (
            <p className="py-10 text-gray-400 font-bold uppercase tracking-widest text-sm text-center">No Tournaments Yet.</p>
          ) : tournaments.map((t) => (
            <div key={t.TournamentID} className="border-b border-gray-200 py-8 group cursor-pointer">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-3">
                <h3 className="text-2xl font-bold group-hover:underline underline-offset-4 decoration-2">{t.TournamentName}</h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold border border-black px-2 py-1 uppercase">{t.Game?.GameName || '未指定'}</span>
                  <span className="text-xs font-bold px-2 py-1 uppercase bg-black text-white">进行中</span>
                </div>
              </div>
              <div className="flex justify-between items-center text-sm font-medium">
                <p className="text-gray-500">最高规模: <span className="text-black font-bold">{t.MaxTeamSize || 0} 支队伍</span></p>
                <span className="text-black opacity-0 group-hover:opacity-100 transition-opacity uppercase font-bold">Details →</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      <aside className="lg:col-span-4 space-y-16">
        <section>
          <h2 className="text-xl font-bold border-b border-black pb-4 mb-6 uppercase">Recent Results</h2>
          <div className="flex flex-col border-t border-gray-100">
            {mockRecentMatches.map((m) => (
              <div key={m.id} className="py-4 border-b border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">{m.tournament} / {m.time}</p>
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-sm ${m.scoreA > m.scoreB ? 'font-bold text-black' : 'text-gray-400'}`}>{m.teamA}</span>
                  <span className={`font-black ${m.scoreA > m.scoreB ? 'text-[#660874]' : 'text-gray-300'}`}>{m.scoreA}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${m.scoreB > m.scoreA ? 'font-bold text-black' : 'text-gray-400'}`}>{m.teamB}</span>
                  <span className={`font-black ${m.scoreB > m.scoreA ? 'text-[#660874]' : 'text-gray-300'}`}>{m.scoreB}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-xl font-bold border-b border-black pb-4 mb-6 uppercase">Upcoming Matches</h2>
          <div className="flex flex-col border-t border-gray-100">
            {mockUpcomingMatches.map((m) => (
              <div key={m.id} className="py-4 border-b border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] font-bold bg-black text-white px-2 py-0.5 uppercase tracking-wider">{m.time}</span>
                  <span className="text-xs text-gray-500 font-bold uppercase truncate">{m.tournament}</span>
                </div>
                <div className="flex flex-col gap-1 mt-3 text-sm font-bold">
                  <span className="text-black">{m.teamA}</span>
                  <span className="text-[10px] text-gray-400 font-medium">vs</span>
                  <span className="text-black">{m.teamB}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );

  // 队伍列表视图
  const renderTeams = () => {
    // 过滤逻辑 (基于真实的队伍字段)
    const filtered = teams.filter(t =>
      (activeFilter === 'ALL' || t.Game?.GameName === activeFilter) &&
      (t.TeamName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    return (
      <div className="animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between md:items-end border-b border-black pb-4 mb-8 gap-4">
          <h2 className="text-3xl font-black tracking-tight uppercase">Teams Directory</h2>
          {isLoggedIn && <button className="bg-[#660874] text-white px-6 py-2 font-bold text-sm hover:opacity-90 transition-opacity w-fit">+ 组建新队伍</button>}
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="w-full md:w-1/2 relative group">
            <input
              type="text" placeholder="SEARCH TEAMS..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border-b-2 border-gray-200 focus:border-black py-2 pl-2 pr-4 outline-none font-bold uppercase tracking-wider text-sm transition-colors bg-transparent"
            />
          </div>
          <div className="relative w-full md:w-auto">
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="w-full md:w-auto flex items-center justify-between gap-6 border border-black bg-white px-4 py-3 font-bold text-xs uppercase"
            >
              <span>GAME: <span className={activeFilter !== 'ALL' ? 'text-[#660874]' : ''}>{activeFilter}</span></span>
              <span>↓</span>
            </button>
            {isFilterDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsFilterDropdownOpen(false)}></div>
                <div className="absolute top-full right-0 w-full md:w-48 bg-white border border-black z-30 mt-1 max-h-48 overflow-y-auto shadow-xl">
                  {GAMES.map(g => (
                    <button key={g} onClick={() => { setActiveFilter(g); setIsFilterDropdownOpen(false); }} className={`block w-full text-left px-4 py-3 text-xs font-bold uppercase hover:bg-gray-100 border-b border-gray-100 ${activeFilter === g ? 'bg-black text-white' : ''}`}>{g}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="border-t border-black">
          {filtered.length === 0 ? (
            <div className="py-20 text-center text-gray-400 font-medium uppercase tracking-widest">No Teams Found.</div>
          ) : filtered.map(t => (
            <div key={t.TeamID} className="border-b border-gray-200 py-6 flex flex-col md:flex-row justify-between md:items-center gap-6 group hover:bg-gray-50 px-2 transition-colors">
              <div className="flex-1">
                <h3 className="text-2xl font-black uppercase mb-2 group-hover:underline underline-offset-4 decoration-2">{t.TeamName}</h3>
                <div className="text-[10px] font-bold text-gray-400 space-x-4 uppercase tracking-wider">
                  <span className="text-black border border-black px-1">{t.Game?.GameName || '未指定'}</span>
                </div>
              </div>
              <div className="flex items-center md:justify-end md:w-1/3">
                <button className="text-sm font-bold uppercase tracking-wider text-black opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  VIEW DETAILS →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 历史战绩视图 (占位)
  const renderHistory = () => {
    const filtered = mockHistoryMatches.filter(h => (historyActiveFilter === 'ALL' || h.game === historyActiveFilter));
    return (
      <div className="animate-fade-in">
        <div className="border-b border-black pb-4 mb-8">
          <h2 className="text-3xl font-black tracking-tight uppercase">History</h2>
        </div>
        <div className="flex justify-end mb-12">
          <div className="relative w-full md:w-48">
            <button onClick={() => setIsHistoryDropdownOpen(!isHistoryDropdownOpen)} className="w-full flex justify-between items-center border border-black px-4 py-2 font-bold text-xs uppercase">
              GAME: <span className={historyActiveFilter !== 'ALL' ? 'text-[#660874]' : ''}>{historyActiveFilter}</span>
              <span>↓</span>
            </button>
            {isHistoryDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsHistoryDropdownOpen(false)}></div>
                <div className="absolute top-full right-0 w-full bg-white border border-black z-30 mt-1 max-h-48 overflow-y-auto">
                  {GAMES.map(g => (
                    <button key={g} onClick={() => { setHistoryActiveFilter(g); setIsHistoryDropdownOpen(false); }} className={`block w-full text-left px-4 py-2 text-xs font-bold uppercase hover:bg-gray-100 border-b border-gray-100 ${historyActiveFilter === g ? 'bg-black text-white' : ''}`}>{g}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="border-t border-black">
          {filtered.map(h => (
            <div key={h.id} className="border-b border-gray-100 py-8 group hover:bg-gray-50 transition-colors px-2">
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-4 space-x-2">
                <span className="text-black border border-black px-1">{h.game}</span>
                <span>{h.date}</span>
                <span>/</span>
                <span className="text-black">{h.tournament}</span>
              </div>
              <div className="flex items-center gap-8">
                <span className={`text-2xl font-black uppercase flex-1 text-right ${h.scoreA > h.scoreB ? 'text-black' : 'text-gray-300'}`}>{h.teamA}</span>
                <div className="bg-gray-100 px-6 py-2 text-3xl font-black flex gap-4">
                  <span className={h.scoreA > h.scoreB ? 'text-[#660874]' : 'text-gray-400'}>{h.scoreA}</span>
                  <span className="text-gray-300">-</span>
                  <span className={h.scoreB > h.scoreA ? 'text-[#660874]' : 'text-gray-400'}>{h.scoreB}</span>
                </div>
                <span className={`text-2xl font-black uppercase flex-1 ${h.scoreB > h.scoreA ? 'text-black' : 'text-gray-300'}`}>{h.teamB}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // === 8. 页面主骨架 ===
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans relative overflow-x-hidden selection:bg-[#660874] selection:text-white">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
      `}</style>

      {/* 挂载登录弹窗 */}
      {showLoginModal && renderLoginModal()}

      {/* 极简导航栏 */}
      <nav className="bg-white border-b border-black p-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-baseline gap-8">
            <h1 onClick={() => setActiveTab('DASHBOARD')} className="text-2xl font-black tracking-tighter uppercase cursor-pointer hover:opacity-70 transition-opacity">
              Zijing Cup.
            </h1>
            <div className="hidden md:flex gap-6 text-sm font-bold text-gray-500">
              <button onClick={() => setActiveTab('DASHBOARD')} className={`uppercase tracking-widest transition-colors ${activeTab === 'DASHBOARD' ? 'text-black border-b-2 border-black pb-0.5' : 'hover:text-black'}`}>赛事总览</button>
              <button onClick={() => setActiveTab('TEAMS')} className={`uppercase tracking-widest transition-colors ${activeTab === 'TEAMS' ? 'text-black border-b-2 border-black pb-0.5' : 'hover:text-black'}`}>参赛队伍</button>
              <button onClick={() => setActiveTab('HISTORY')} className={`uppercase tracking-widest transition-colors ${activeTab === 'HISTORY' ? 'text-black border-b-2 border-black pb-0.5' : 'hover:text-black'}`}>历史战绩</button>
            </div>
          </div>

          <div>
            {isLoggedIn ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold uppercase tracking-wider">{userName}</span>
                <button onClick={() => setIsSidebarOpen(true)} className="p-1 hover:text-[#660874] hover:bg-gray-50 transition-colors">
                  <svg className="w-6 h-6 text-current" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M3 6h18M3 12h18M3 18h18"></path></svg>
                </button>
              </div>
            ) : (
              <button onClick={() => setShowLoginModal(true)} className="bg-black text-white px-5 py-2 font-bold uppercase tracking-widest text-xs hover:bg-[#660874] transition-colors">
                SIGN IN
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* 极简右侧边栏 */}
      {isSidebarOpen && <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-30 transition-opacity" onClick={() => setIsSidebarOpen(false)}></div>}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white border-l border-black z-40 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-8 h-full flex flex-col">
          <div className="flex justify-between items-start mb-12">
            <div>
              <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase mb-1">Account</p>
              <p className="text-xl font-black uppercase">{userName}</p>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-black transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <button className="text-left py-3 text-lg font-bold uppercase tracking-wider hover:pl-2 hover:text-[#660874] text-gray-500 transition-all">团队管理</button>
            <button className="text-left py-3 text-lg font-bold uppercase tracking-wider hover:pl-2 hover:text-[#660874] text-gray-500 transition-all">战书通知 <span className="bg-[#660874] text-white text-xs font-black px-2 py-0.5 ml-2">2</span></button>
          </div>
          <div className="mt-auto border-t border-black pt-6">
            <button onClick={handleLogout} className="w-full text-left py-2 font-bold uppercase tracking-widest text-red-600 hover:bg-red-50 transition-colors">Logout</button>
          </div>
        </div>
      </div>

      {/* 主内容路由区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {activeTab === 'DASHBOARD' && renderDashboard()}
        {activeTab === 'TEAMS' && renderTeams()}
        {activeTab === 'HISTORY' && renderHistory()}
      </main>
    </div>
  );
}