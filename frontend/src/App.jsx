import React, { useState, useEffect } from 'react';
import api from './utils/api'; // 真实接入本地配置好的 Axios 实例

// 引入自定义弹窗组件
import CustomAlert from './components/CustomAlert';
import { showAlert } from './components/CustomAlert';

// 引入我们刚刚做好的三个核心页面
import TeamManagement from './pages/TeamManagement';
import TeamListSelect from './pages/TeamListSelect';
import CreateTeam from './pages/CreateTeam';
import TournamentDetails from './pages/TournamentDetail';
import AdminConsole from './pages/AdminConsole';
import MessageCenter from './pages/MessageCenter';
import ProfileEdit from './pages/ProfileEdit';
import MatchScheduling from './pages/MatchScheduling';

export default function App() {
  // === 2. 全局交互与鉴权状态 ===
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('DASHBOARD');

  // 用于在点击”赛事详情”时，把 ID 传给详情页
  const [selectedTournamentId, setSelectedTournamentId] = useState(null);

  // 用于约赛页面：保存当前选中的比赛ID
  const [selectedMatchId, setSelectedMatchId] = useState(null);

  // 团队管理相关状态
  const [myTeams, setMyTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  // 登录弹窗状态
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true); // true=登录, false=注册
  const [loginForm, setLoginForm] = useState({
    userName: '',
    password: '',
    confirmPassword: '',
    rank: '',
    mainRole: '',
    intro: ''
  });
  const [loginError, setLoginError] = useState('');

  // === 3. 真实数据状态 ===
  const [tournaments, setTournaments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [historyMatches, setHistoryMatches] = useState([]);
  const [gameFilters, setGameFilters] = useState(['ALL']);

  // === 4. 各页面独立筛选状态 ===
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  const [historyActiveFilter, setHistoryActiveFilter] = useState('ALL');
  const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false);

  // === 数据获取函数（必须在 useEffect 之前定义）===
  const fetchPublicData = React.useCallback(async () => {
    try {
      console.log('[fetchPublicData] 开始获取数据...');
      // 使用 allSettled 避免一个请求失败导致全部失败
      const [tourRes, teamRes, recentRes, upcomingRes, gamesRes] = await Promise.allSettled([
        api.get('/tournaments'),
        api.get('/teams'),
        api.get('/matches/recent'),
        api.get('/matches/upcoming'),
        api.get('/games')
      ]);

      // 处理每个请求的结果
      if (tourRes.status === 'fulfilled' && tourRes.value.data?.success) {
        console.log('[fetchPublicData] tournaments:', tourRes.value.data.data.length);
        setTournaments(tourRes.value.data.data);
      } else {
        console.error('[fetchPublicData] Tournaments fetch failed:', tourRes);
      }

      if (teamRes.status === 'fulfilled' && teamRes.value.data?.success) {
        const teamsData = teamRes.value.data.data;
        console.log('[fetchPublicData] teams loaded:', teamsData.length, teamsData);
        setTeams(teamsData);
      } else {
        console.error('[fetchPublicData] Teams fetch failed:', teamRes);
      }

      if (recentRes.status === 'fulfilled' && recentRes.value.data?.success) {
        setRecentMatches(recentRes.value.data.data);
      }

      if (upcomingRes.status === 'fulfilled' && upcomingRes.value.data?.success) {
        setUpcomingMatches(upcomingRes.value.data.data);
      }

      if (gamesRes.status === 'fulfilled' && gamesRes.value.data?.success) {
        setGameFilters(['ALL', ...gamesRes.value.data.data.map(g => g.GameName)]);
      }

    } catch (error) {
      console.error("[fetchPublicData] 数据拉取失败:", error);
    }
  }, []);

  // === 5. 初始化加载与真实数据抓取 ===
  useEffect(() => {
    // 检查本地是否已有 Token (保持登录状态)
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('userName');
    const storedRole = localStorage.getItem('userRole');
    if (token && storedUser) {
      setIsLoggedIn(true);
      setUserName(storedUser);
      setUserRole(storedRole || '');
    }

    // 从 Node.js 后端拉取真实的公共数据
    fetchPublicData();
  }, [activeTab, fetchPublicData]);

  // 监听 token 过期事件（由 api.js 拦截器触发）
  useEffect(() => {
    const onAuthExpired = () => {
      setIsLoggedIn(false);
      setUserName('');
      setUserRole('');
      setIsSidebarOpen(false);
      setActiveTab('DASHBOARD');
      setLoginError('登录身份已过期，请重新登录');
      setShowLoginModal(true);
    };
    window.addEventListener('auth:expired', onAuthExpired);
    return () => window.removeEventListener('auth:expired', onAuthExpired);
  }, []);

  // History 页数据拉取（初次进入 + 切换游戏过滤器时触发）
  useEffect(() => {
    if (activeTab !== 'HISTORY') return;
    const fetchHistory = async () => {
      try {
        const query = historyActiveFilter !== 'ALL' ? `?game=${encodeURIComponent(historyActiveFilter)}` : '';
        const res = await api.get(`/matches/history${query}`);
        if (res.data.success) setHistoryMatches(res.data.data);
      } catch (error) {
        console.error('获取历史战绩失败:', error);
      }
    };
    fetchHistory();
  }, [activeTab, historyActiveFilter]);

  // === 6. 核心业务逻辑 ===
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await api.post('/users/login', {
        userName: loginForm.userName,
        password: loginForm.password
      });

      localStorage.setItem('token', res.data.token);
      localStorage.setItem('userName', res.data.data.UserName);
      localStorage.setItem('userRole', res.data.data.UserRole);

      setIsLoggedIn(true);
      setUserName(res.data.data.UserName);
      setUserRole(res.data.data.UserRole);
      setShowLoginModal(false);

    } catch (err) {
      setLoginError(err.response?.data?.error || '登录失败，请检查网络或账号密码');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');

    // 前端校验
    if (!loginForm.userName || !loginForm.password) {
      setLoginError('用户名和密码不能为空');
      return;
    }
    if (loginForm.password !== loginForm.confirmPassword) {
      setLoginError('两次输入的密码不一致');
      return;
    }
    if (loginForm.password.length < 6) {
      setLoginError('密码长度至少6位');
      return;
    }

    try {
      await api.post('/users/register', {
        userName: loginForm.userName,
        password: loginForm.password,
        rank: loginForm.rank || null,
        mainRole: loginForm.mainRole || null,
        intro: loginForm.intro || null,
        role: 'audience' // 新注册用户默认为观众
      });

      // 注册成功，自动登录
      const res = await api.post('/users/login', {
        userName: loginForm.userName,
        password: loginForm.password
      });

      localStorage.setItem('token', res.data.token);
      localStorage.setItem('userName', res.data.data.UserName);
      localStorage.setItem('userRole', res.data.data.UserRole);

      setIsLoggedIn(true);
      setUserName(res.data.data.UserName);
      setUserRole(res.data.data.UserRole);
      setShowLoginModal(false);
    } catch (error) {
      setLoginError(error.response?.data?.error || '注册失败，请稍后再试');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    setIsLoggedIn(false);
    setUserName('');
    setUserRole('');
    setIsSidebarOpen(false);
    setActiveTab('DASHBOARD');
  };

  // === 7. 子组件渲染 ===

  const renderLoginModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border-2 border-black w-full max-w-md p-8 shadow-2xl relative">
        <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h2 className="text-3xl font-black tracking-tight mb-8">
          {isLoginMode ? (<>Access<br />Account.</>) : (<>Create<br />Account.</>)}
        </h2>

        <form onSubmit={isLoginMode ? handleLoginSubmit : handleRegisterSubmit} className="flex flex-col gap-6">
          <div>
            <label className="block text-xs font-bold tracking-widest text-gray-500 mb-2">Username</label>
            <input
              type="text" required
              value={loginForm.userName} onChange={e => setLoginForm({ ...loginForm, userName: e.target.value })}
              className="w-full border-b-2 border-gray-200 focus:border-black py-2 outline-none font-bold transition-colors bg-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widest text-gray-500 mb-2">Password</label>
            <input
              type="password" required
              value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
              className="w-full border-b-2 border-gray-200 focus:border-black py-2 outline-none transition-colors bg-transparent"
            />
          </div>
          {!isLoginMode && (
            <>
              <div>
                <label className="block text-xs font-bold tracking-widest text-gray-500 mb-2">Confirm Password</label>
                <input
                  type="password" required
                  value={loginForm.confirmPassword} onChange={e => setLoginForm({ ...loginForm, confirmPassword: e.target.value })}
                  className="w-full border-b-2 border-gray-200 focus:border-black py-2 outline-none transition-colors bg-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold tracking-widest text-gray-500 mb-2">Rank / 段位 (可选)</label>
                  <input
                    type="text"
                    value={loginForm.rank} onChange={e => setLoginForm({ ...loginForm, rank: e.target.value })}
                    className="w-full border-b-2 border-gray-200 focus:border-black py-2 outline-none font-bold transition-colors bg-transparent"
                    placeholder="e.g. Diamond"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest text-gray-500 mb-2">Main Role / 主位置 (可选)</label>
                  <input
                    type="text"
                    value={loginForm.mainRole} onChange={e => setLoginForm({ ...loginForm, mainRole: e.target.value })}
                    className="w-full border-b-2 border-gray-200 focus:border-black py-2 outline-none font-bold transition-colors bg-transparent"
                    placeholder="e.g. Carry"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold tracking-widest text-gray-500 mb-2">Introduction / 个人介绍 (可选)</label>
                <textarea
                  value={loginForm.intro} onChange={e => setLoginForm({ ...loginForm, intro: e.target.value })}
                  className="w-full border-b-2 border-gray-200 focus:border-black py-2 outline-none font-bold transition-colors bg-transparent resize-none h-20"
                  placeholder="简单介绍一下自己..."
                />
              </div>
            </>
          )}
          {loginError && <p className="text-red-600 text-xs font-bold ">{loginError}</p>}
          <button type="submit" className="mt-4 bg-[#660874] text-white py-4 font-black tracking-widest hover:opacity-90 transition-opacity">
            {isLoginMode ? 'Sign In' : 'Create Account'}
          </button>
          <div className="text-center pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setLoginError('');
              }}
              className="text-xs font-bold text-gray-500 hover:text-black transition-colors tracking-widest"
            >
              {isLoginMode ? 'Don\'t have an account? → Create one' : 'Already have an account? → Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 animate-fade-in">
      <section className="lg:col-span-8">
        <div className="border-b border-black pb-4 mb-8">
          <h2 className="text-3xl font-black tracking-tight ">Tournaments</h2>
        </div>
        <div className="flex flex-col">
          {tournaments.length === 0 ? (
            <p className="py-10 text-gray-400 font-bold tracking-widest text-sm text-center">No Tournaments Yet.</p>
          ) : tournaments.map((t) => (
            <div key={t.TournamentID} className="border-b border-gray-200 py-8 group cursor-pointer">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-3">
                <h3 className="text-2xl font-bold group-hover:underline underline-offset-4 decoration-2">{t.TournamentName}</h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold border border-black px-2 py-1 ">{t.Game?.GameName || '未指定'}</span>
                  <span className="text-xs font-bold px-2 py-1 bg-black text-white">报名中</span>
                </div>
              </div>
              <div className="flex justify-between items-center text-sm font-medium">
                <p className="text-gray-500">最高规模: <span className="text-black font-bold">{t.MaxTeamSize || 0} 支队伍</span></p>
                {/* 🚀 跳转到详情页 */}
                <button 
                  onClick={() => {
                    setSelectedTournamentId(t.TournamentID);
                    setActiveTab('TOURNAMENT_DETAILS');
                  }}
                  className="text-black opacity-0 group-hover:opacity-100 transition-opacity font-bold"
                >
                  Details →
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <aside className="lg:col-span-4 space-y-16">
        <section>
          <h2 className="text-xl font-bold border-b border-black pb-4 mb-6 ">Recent Results</h2>
          <div className="flex flex-col border-t border-gray-100">
            {recentMatches.length === 0 ? (
              <p className="py-6 text-gray-400 font-bold tracking-widest text-xs text-center">No Recent Results.</p>
            ) : recentMatches.map((m) => (
              <div key={m.id} className="py-4 border-b border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold mb-2">{m.tournament} / {m.time}</p>
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-sm ${m.winnerA ? 'font-bold text-black' : 'text-gray-400'}`}>{m.teamA}</span>
                  <span className={`font-black ${m.winnerA ? 'text-[#660874]' : 'text-gray-300'}`}>{m.scoreA ?? '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${m.winnerA === false ? 'font-bold text-black' : 'text-gray-400'}`}>{m.teamB}</span>
                  <span className={`font-black ${m.winnerA === false ? 'text-[#660874]' : 'text-gray-300'}`}>{m.scoreB ?? '-'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-xl font-bold border-b border-black pb-4 mb-6 ">Upcoming Matches</h2>
          <div className="flex flex-col border-t border-gray-100">
            {upcomingMatches.length === 0 ? (
              <p className="py-6 text-gray-400 font-bold tracking-widest text-xs text-center">No Upcoming Matches.</p>
            ) : upcomingMatches.map((m) => (
              <div key={m.id} className="py-4 border-b border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] font-bold bg-black text-white px-2 py-0.5  tracking-wider">{m.time}</span>
                  <span className="text-xs text-gray-500 font-bold truncate">{m.tournament}</span>
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

  const renderTeams = () => {
    // 调试：检查渲染时的实际数据
    console.log('[renderTeams] teams:', teams, 'activeFilter:', activeFilter, 'searchQuery:', searchQuery);
    // 先直接显示所有队伍，不做任何过滤
    const filtered = teams || [];
    return (
      <div className="animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between md:items-end border-b border-black pb-4 mb-8 gap-4">
          <h2 className="text-3xl font-black tracking-tight ">Teams Directory</h2>
          {/* 跳转到建队页 */}
          {isLoggedIn && (
            <button 
              onClick={() => setActiveTab('CREATE_TEAM')}
              className="bg-[#660874] text-white px-6 py-2 font-bold text-sm hover:opacity-90 transition-opacity w-fit"
            >
              + 组建新队伍
            </button>
          )}
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="w-full md:w-1/2 relative group">
            <input
              type="text" placeholder="SEARCH TEAMS..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border-b-2 border-gray-200 focus:border-black py-2 pl-2 pr-4 outline-none font-bold tracking-wider text-sm transition-colors bg-transparent"
            />
          </div>
          <div className="relative w-full md:w-auto">
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="w-full md:w-auto flex items-center justify-between gap-6 border border-black bg-white px-4 py-3 font-bold text-xs "
            >
              <span>GAME: <span className={activeFilter !== 'ALL' ? 'text-[#660874]' : ''}>{activeFilter}</span></span>
              <span>↓</span>
            </button>
            {isFilterDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsFilterDropdownOpen(false)}></div>
                <div className="absolute top-full right-0 w-full md:w-48 bg-white border border-black z-30 mt-1 max-h-48 overflow-y-auto shadow-xl">
                  {gameFilters.map(g => (
                    <button key={g} onClick={() => { setActiveFilter(g); setIsFilterDropdownOpen(false); }} className={`block w-full text-left px-4 py-3 text-xs font-bold  hover:bg-gray-100 border-b border-gray-100 ${activeFilter === g ? 'bg-black text-white' : ''}`}>{g}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="border-t border-black">
          {filtered.length === 0 ? (
            <div className="py-20 text-center text-gray-400 font-medium tracking-widest">No Teams Found.</div>
          ) : filtered.map(t => (
            <div key={t.TeamID} className="border-b border-gray-200 py-6 flex flex-col md:flex-row justify-between md:items-center gap-6 group hover:bg-gray-50 px-2 transition-colors">
              <div className="flex-1">
                <h3 className="text-2xl font-black mb-2 group-hover:underline underline-offset-4 decoration-2">{t.TeamName}</h3>
                <div className="text-[10px] font-bold text-gray-400 space-x-4  tracking-wider">
                  <span className="text-black border border-black px-1">{t.Game?.GameName || '未指定'}</span>
                </div>
              </div>
              <div className="flex items-center md:justify-end md:w-1/3">
                <button className="text-sm font-bold  tracking-wider text-black opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  VIEW DETAILS →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderHistory = () => {
    const filtered = historyMatches.filter(h =>
      historyActiveFilter === 'ALL' || h.game === historyActiveFilter
    );
    return (
      <div className="animate-fade-in">
        <div className="border-b border-black pb-4 mb-8">
          <h2 className="text-3xl font-black tracking-tight ">History</h2>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="w-full md:w-1/2 relative group">
            <input
              type="text" placeholder="SEARCH HISTORY..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border-b-2 border-gray-200 focus:border-black py-2 pl-2 pr-4 outline-none font-bold tracking-wider text-sm transition-colors bg-transparent"
            />
          </div>
          <div className="relative w-full md:w-auto">
            <button
              onClick={() => setIsHistoryDropdownOpen(!isHistoryDropdownOpen)}
              className="w-full md:w-auto flex items-center justify-between gap-6 border border-black bg-white px-4 py-3 font-bold text-xs"
            >
              <span>GAME: <span className={historyActiveFilter !== 'ALL' ? 'text-[#660874]' : ''}>{historyActiveFilter}</span></span>
              <span>↓</span>
            </button>
            {isHistoryDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsHistoryDropdownOpen(false)}></div>
                <div className="absolute top-full right-0 w-full md:w-48 bg-white border border-black z-30 mt-1 max-h-48 overflow-y-auto shadow-xl">
                  {gameFilters.map(g => (
                    <button key={g} onClick={() => { setHistoryActiveFilter(g); setIsHistoryDropdownOpen(false); }} className={`block w-full text-left px-4 py-3 text-xs font-bold hover:bg-gray-100 border-b border-gray-100 ${historyActiveFilter === g ? 'bg-black text-white' : ''}`}>{g}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="border-t border-black">
          {filtered.map(h => (
            <div key={h.id} className="border-b border-gray-100 py-8 group hover:bg-gray-50 transition-colors px-2">
              <div className="text-[10px] font-bold text-gray-400 mb-4 space-x-2">
                <span className="text-black border border-black px-1">{h.game}</span>
                <span>{h.date}</span>
                <span>/</span>
                <span className="text-black">{h.tournament}</span>
              </div>
              <div className="flex items-center gap-8">
                <span className={`text-2xl font-black flex-1 text-right ${h.scoreA > h.scoreB ? 'text-black' : 'text-gray-300'}`}>{h.teamA}</span>
                <div className="bg-gray-100 px-6 py-2 text-3xl font-black flex gap-4">
                  <span className={h.scoreA > h.scoreB ? 'text-[#660874]' : 'text-gray-400'}>{h.scoreA}</span>
                  <span className="text-gray-300">-</span>
                  <span className={h.scoreB > h.scoreA ? 'text-[#660874]' : 'text-gray-400'}>{h.scoreB}</span>
                </div>
                <span className={`text-2xl font-black flex-1 ${h.scoreB > h.scoreA ? 'text-black' : 'text-gray-300'}`}>{h.teamB}</span>
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

      {showLoginModal && renderLoginModal()}

      <nav className="bg-white border-b border-black p-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-baseline gap-8">
            <h1 onClick={() => setActiveTab('DASHBOARD')} className="text-2xl font-black tracking-tighter cursor-pointer hover:opacity-70 transition-opacity">
              Zijing Cup.
            </h1>
            <div className="hidden md:flex gap-6 text-sm font-bold text-gray-500">
              <button onClick={() => setActiveTab('DASHBOARD')} className={`tracking-widest transition-colors ${activeTab === 'DASHBOARD' ? 'text-black border-b-2 border-black pb-0.5' : 'hover:text-black'}`}>赛事总览</button>
              <button onClick={() => setActiveTab('TEAMS')} className={`tracking-widest transition-colors ${activeTab === 'TEAMS' ? 'text-black border-b-2 border-black pb-0.5' : 'hover:text-black'}`}>参赛队伍</button>
              <button onClick={() => setActiveTab('HISTORY')} className={`tracking-widest transition-colors ${activeTab === 'HISTORY' ? 'text-black border-b-2 border-black pb-0.5' : 'hover:text-black'}`}>历史战绩</button>
            </div>
          </div>

          <div>
            {isLoggedIn ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold  tracking-wider">{userName}</span>
                <button onClick={() => setIsSidebarOpen(true)} className="p-1 hover:text-[#660874] hover:bg-gray-50 transition-colors">
                  <svg className="w-6 h-6 text-current" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M3 6h18M3 12h18M3 18h18"></path></svg>
                </button>
              </div>
            ) : (
              <button onClick={() => {
                setIsLoginMode(true);
                setShowLoginModal(true);
              }} className="bg-black text-white px-5 py-2 font-bold tracking-widest text-xs hover:bg-[#660874] transition-colors">
                SIGN IN
              </button>
            )}
          </div>
        </div>
      </nav>

      {isSidebarOpen && <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-30 transition-opacity" onClick={() => setIsSidebarOpen(false)}></div>}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white border-l border-black z-40 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-8 h-full flex flex-col">
          <div className="flex justify-between items-start mb-12">
            <div>
              <p className="text-[10px] text-gray-500 font-bold tracking-widest mb-1">Account</p>
              <p className="text-xl font-black ">{userName}</p>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-black transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            {userRole === 'administrator' ? (
              <button
                onClick={() => {
                  setActiveTab('ADMIN_CONSOLE');
                  setIsSidebarOpen(false);
                }}
                className="text-left py-3 text-lg font-bold  tracking-wider hover:pl-2 hover:text-[#660874] text-gray-500 transition-all"
              >
                管理员界面
              </button>
            ) : (
              <>
                {/* 🚀 跳转到团队管理 */}
                <button
                  onClick={async () => {
                    // 加载用户团队列表
                    try {
                      const res = await api.get('/me/team-dashboard');
                      if (res.data.success) {
                        const teamsData = res.data.data || [];
                        setMyTeams(teamsData);
                        // 如果只有一个团队，直接进入管理页面；否则显示列表
                        if (teamsData.length === 1) {
                          setSelectedTeamId(teamsData[0].Team?.TeamID);
                        }
                      }
                    } catch (err) {
                      console.error('获取团队列表失败:', err);
                    }
                    setActiveTab('TEAM_MANAGEMENT');
                    setIsSidebarOpen(false);
                  }}
                  className="text-left py-3 text-lg font-bold  tracking-wider hover:pl-2 hover:text-[#660874] text-gray-500 transition-all"
                >
                  团队管理
                </button>
                <button
                  onClick={() => {
                    setActiveTab('MESSAGE_CENTER');
                    setIsSidebarOpen(false);
                  }}
                  className="text-left py-3 text-lg font-bold  tracking-wider hover:pl-2 hover:text-[#660874] text-gray-500 transition-all"
                >
                  消息中心
                  {/* TODO: 统计未读消息数量 */}
                  {/* <span className="bg-[#660874] text-white text-xs font-black px-2 py-0.5 ml-2">2</span> */}
                </button>
              </>
            )}
            {/* 个人信息编辑 - 对所有登录用户可见 */}
            <button
              onClick={() => {
                setActiveTab('PROFILE_EDIT');
                setIsSidebarOpen(false);
              }}
              className="text-left py-3 text-lg font-bold  tracking-wider hover:pl-2 hover:text-[#660874] text-gray-500 transition-all"
            >
              个人信息
            </button>
          </div>
          <div className="mt-auto border-t border-black pt-6">
            <button onClick={handleLogout} className="w-full text-left py-2 font-bold tracking-widest text-red-600 hover:bg-red-50 transition-colors">Logout</button>
          </div>
        </div>
      </div>

      {/* 🚀 主内容路由区，取消了全屏页面的边距限制 */}
      <main className={
        ['TEAM_MANAGEMENT', 'CREATE_TEAM', 'TOURNAMENT_DETAILS', 'ADMIN_CONSOLE', 'MESSAGE_CENTER', 'PROFILE_EDIT', 'MATCH_SCHEDULING'].includes(activeTab)
          ? 'w-full'
          : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'
      }>
        {/* 基础大厅页面 */}
        {activeTab === 'DASHBOARD' && renderDashboard()}
        {activeTab === 'TEAMS' && renderTeams()}
        {activeTab === 'HISTORY' && renderHistory()}

        {/* 挂载的新页面组件 */}
        {activeTab === 'TEAM_MANAGEMENT' && !selectedTeamId && (
          <TeamListSelect
            teams={myTeams}
            onSelectTeam={(team) => {
              // 处理两种可能的数据结构
              const teamId = team.Team?.TeamID || team.TeamID;
              setSelectedTeamId(teamId);
            }}
            onCreateTeam={() => setActiveTab('CREATE_TEAM')}
            onBack={() => setActiveTab('DASHBOARD')}
          />
        )}
        {activeTab === 'TEAM_MANAGEMENT' && selectedTeamId && (
          <TeamManagement
            teamId={selectedTeamId}
            onBack={() => setSelectedTeamId(null)}
            onNavigateMatch={(matchId) => {
              setSelectedMatchId(matchId);
              setActiveTab('MATCH_SCHEDULING');
            }}
          />
        )}
        {activeTab === 'CREATE_TEAM' && (
          <CreateTeam
            onCancel={() => setActiveTab('TEAMS')}
            onSuccess={async () => {
              fetchPublicData();
              // 重新加载用户自己的团队列表
              try {
                const res = await api.get('/me/team-dashboard');
                if (res.data.success) {
                  const teamsData = res.data.data || [];
                  setMyTeams(teamsData);
                  if (teamsData.length === 1) {
                    const teamId = teamsData[0].Team?.TeamID || teamsData[0].TeamID;
                    setSelectedTeamId(teamId);
                  }
                }
              } catch (err) {
                console.error('获取团队列表失败:', err);
              }
              setActiveTab('TEAM_MANAGEMENT');
            }}
          />
        )}
        {activeTab === 'TOURNAMENT_DETAILS' && (
          <TournamentDetails
            tournamentId={selectedTournamentId}
            onBack={() => setActiveTab('DASHBOARD')}
          />
        )}
        {activeTab === 'ADMIN_CONSOLE' && <AdminConsole />}
        {activeTab === 'MESSAGE_CENTER' && <MessageCenter
          onBack={() => setActiveTab('DASHBOARD')}
          onNavigateMatch={(matchId) => {
            setSelectedMatchId(matchId);
            setActiveTab('MATCH_SCHEDULING');
          }}
        />}
        {activeTab === 'PROFILE_EDIT' && <ProfileEdit onBack={() => setActiveTab('DASHBOARD')} />}
        {activeTab === 'MATCH_SCHEDULING' && <MatchScheduling
          matchId={selectedMatchId}
          onBack={() => {
            setSelectedMatchId(null);
            setActiveTab('MESSAGE_CENTER');
          }}
        />}
      </main>
      <CustomAlert />
    </div>
  );
}