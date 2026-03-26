import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api'; //

export default function CreateTeam({ onCancel, onSuccess }) {
  // === 1. 真实数据状态 ===
  const [games, setGames] = useState([]);
  const [tournaments, setTournaments] = useState([]); // 存放从后端拉取的真实赛事
  const [searchResults, setSearchResults] = useState([]); // 存放真实的搜索结果

  // === 2. 表单核心状态 ===
  const [formData, setFormData] = useState({
    name: '',
    game: '',
    tournamentId: '', // 快捷报名赛事
  });

  // 快捷邀请名单 (建队成功后一并发出邀请)
  const [initialRecruits, setInitialRecruits] = useState([]);
  
  // 招募雷达搜索状态
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // === 3. 初始化：拉取真实的游戏列表和赛事列表 ===
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await api.get('/games');
        if (res.data.success) {
          const list = res.data.data;
          setGames(list);
          if (list.length > 0) setFormData(f => ({ ...f, game: list[0].GameName }));
        }
      } catch (error) {
        console.error("获取游戏列表失败:", error);
      }
    };
    const fetchTournaments = async () => {
      try {
        const res = await api.get('/tournaments');
        if (res.data.success) {
          setTournaments(res.data.data);
        }
      } catch (error) {
        console.error("获取赛事列表失败:", error);
      }
    };
    fetchGames();
    fetchTournaments();
  }, []);

  // === 4. 动态过滤逻辑 ===
  // 根据当前选中的游戏，过滤出可以报名的赛事 (假设有 GameName 字段)
  const availableTournaments = useMemo(() => {
    return tournaments.filter(t => t.Game?.GameName === formData.game);
  }, [tournaments, formData.game]);

  // 当切换游戏时，清空已选的赛事
  const handleGameChange = (game) => {
    setFormData({ ...formData, game, tournamentId: '' });
  };

  // === 5. 雷达搜索：防抖与真实接口调用 ===
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      
      setIsSearching(true);
      try {
        // 调用我们刚刚写好的搜索接口
        const res = await api.get(`/users/search?q=${searchQuery}`);
        if (res.data.success) {
          // 过滤掉自己和已经添加到预备名单的人
          const filtered = res.data.data.filter(u => 
            !initialRecruits.find(r => r.UserID === u.UserID)
          );
          setSearchResults(filtered);
        }
      } catch (error) {
        console.error("搜索玩家失败:", error);
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms 防抖

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, initialRecruits]);

  // === 6. 操作交互逻辑 ===
  const handleAddRecruit = (user) => {
    setInitialRecruits([...initialRecruits, user]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveRecruit = (userId) => {
    setInitialRecruits(initialRecruits.filter(u => u.UserID !== userId));
  };

  // === 7. 提交建队 (核心真实调用) ===
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return alert('请输入队伍代号');
    
    setIsSubmitting(true);

    const payload = {
      TeamName: formData.name,
      GameName: formData.game,
      TargetTournamentID: formData.tournamentId, 
      InitialInvites: initialRecruits.map(u => u.UserID) 
    };

    try {
      // 发送真实的创建队伍请求
      const res = await api.post('/teams', payload);
      
      if (res.data.success) {
        alert(`队伍 [${formData.name}] 组建成功！`);
        if (onSuccess) onSuccess(); // 通知父组件跳转回大厅或管理页
      }
    } catch (error) {
      alert(error.response?.data?.error || "建队失败，请检查网络");
    } finally {
      setIsSubmitting(false);
    }
  };

  // === 8. 视图渲染 ===
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans p-6 md:p-12 selection:bg-[#660874] selection:text-white pb-32">
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      <div className="max-w-7xl mx-auto animate-slide-up">
        
        {/* 头部标题区 */}
        <div className="flex flex-col md:flex-row justify-between md:items-end border-b-4 border-black pb-6 mb-12 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-[#660874] text-white text-[10px] font-bold px-2 py-1  tracking-widest">
                OPERATION CENTER
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter ">Establish Squad.</h1>
          </div>
          
          <button 
            onClick={onCancel}
            className="text-xs font-bold  tracking-widest text-gray-400 hover:text-black transition-colors"
          >
            ← ABORT OPERATION
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          
          <section className="lg:col-span-7 space-y-12">
            
            {/* 1. 队伍代号 */}
            <div>
              <label className="block text-sm font-bold  tracking-widest text-gray-500 mb-4 border-b border-gray-200 pb-2">
                01. SQUAD DESIGNATION (代号)
              </label>
              <input 
                type="text" 
                required
                maxLength={20}
                placeholder="ENTER SQUAD NAME..." 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full border-b-4 border-black py-4 text-4xl font-black  tracking-wider outline-none focus:border-[#660874] transition-colors bg-transparent placeholder-gray-200"
              />
            </div>

            {/* 2. 目标项目 */}
            <div>
              <label className="block text-sm font-bold  tracking-widest text-gray-500 mb-4 border-b border-gray-200 pb-2">
                02. COMBAT ZONE (项目)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {games.map(g => (
                  <button
                    key={g.GameID}
                    type="button"
                    onClick={() => handleGameChange(g.GameName)}
                    className={`py-3 px-2 border-2 font-bold  tracking-widest text-[10px] md:text-xs transition-all ${
                      formData.game === g.GameName
                      ? 'border-[#660874] bg-[#660874] text-white shadow-[4px_4px_0_0_#000]'
                      : 'border-black text-black hover:bg-gray-50'
                    }`}
                  >
                    {g.GameName}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. 快捷报赛 (可选) */}
            <div>
              <label className="block text-sm font-bold  tracking-widest text-gray-500 mb-4 border-b border-gray-200 pb-2 flex justify-between items-end">
                <span>03. RAPID DEPLOYMENT (报赛)</span>
                <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5">OPTIONAL / 可选</span>
              </label>
              
              {availableTournaments.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 py-8 text-center text-gray-400 font-bold text-xs  tracking-widest">
                  NO ACTIVE TOURNAMENTS FOR THIS GAME.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, tournamentId: ''})}
                    className={`text-left p-4 border-2 transition-all ${
                      formData.tournamentId === '' ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-500 hover:border-black'
                    }`}
                  >
                    <div className="font-bold  tracking-widest text-sm">暂不参加任何赛事</div>
                    <div className="text-[10px] mt-1 opacity-70  tracking-widest">Just build the team first.</div>
                  </button>

                  {availableTournaments.map(t => (
                    <button
                      key={t.TournamentID}
                      type="button"
                      onClick={() => setFormData({...formData, tournamentId: t.TournamentID})}
                      className={`text-left p-4 border-2 transition-all ${
                        formData.tournamentId === t.TournamentID ? 'border-[#660874] bg-[#660874] text-white shadow-[4px_4px_0_0_#000]' : 'border-gray-200 hover:border-black'
                      }`}
                    >
                      <div className="font-bold  tracking-widest text-sm flex justify-between">
                        {t.TournamentName}
                        <span className="text-[10px] bg-white text-black px-1 py-0.5">报名中</span>
                      </div>
                      <div className="text-[10px] mt-2 opacity-70  tracking-widest">Target Game: {t.Game?.GameName}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </section>

          <aside className="lg:col-span-5 space-y-12">
            <div className="bg-gray-50 border border-black p-6 md:p-8 relative shadow-xl">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#660874]"></div>
              
              <h2 className="text-xl font-black tracking-tight  border-b border-gray-300 pb-4 mb-6 flex justify-between items-center">
                <span>04. Initial Roster</span>
                <span className="text-sm font-bold text-gray-400">{initialRecruits.length}/4</span>
              </h2>

              <div className="relative group mb-8">
                <svg className="w-5 h-5 absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#660874] transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="square" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                <input 
                  type="text" 
                  placeholder="SEARCH RECRUITS (ID / NAME)..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border-b-2 border-gray-200 focus:border-[#660874] py-3 pl-8 pr-4 outline-none font-bold  tracking-wider text-sm transition-colors bg-transparent"
                />

                {/* 搜索结果浮层 */}
                {searchQuery && (
                  <div className="absolute top-full left-0 w-full bg-white border border-black p-2 max-h-48 overflow-y-auto shadow-2xl z-20 mt-1">
                    {isSearching ? (
                       <p className="text-center text-[10px] font-bold text-gray-400  tracking-widest py-4">SCANNING...</p>
                    ) : searchResults.length === 0 ? (
                      <p className="text-center text-[10px] font-bold text-gray-400  tracking-widest py-4">NO AGENTS FOUND.</p>
                    ) : searchResults.map(user => (
                      <div key={user.UserID} className="flex justify-between items-center py-2 px-2 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <div>
                          <p className="font-bold  text-xs">{user.UserName}</p>
                          <p className="text-[10px] font-bold text-gray-500  tracking-widest">{user.Rank || '未定级'} / {user.MainRole || '补位'}</p>
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleAddRecruit(user)}
                          className="bg-black text-white text-[10px] font-bold px-3 py-1.5  hover:bg-[#660874] transition-colors"
                        >
                          ADD
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 min-h-[160px]">
                <div className="flex items-center justify-between border-b-2 border-black pb-3 opacity-50">
                   <div className="flex items-center gap-4">
                     <span className="text-xl font-black text-gray-300">C</span>
                     <span className="font-bold  text-sm">YOU (CAPTAIN)</span>
                   </div>
                </div>

                {initialRecruits.length === 0 && (
                  <p className="text-[10px] font-bold text-gray-400  tracking-widest py-6 text-center border-2 border-dashed border-gray-200 mt-2">
                    NO ADDITIONAL RECRUITS SELECTED.
                  </p>
                )}

                {initialRecruits.map((recruit, idx) => (
                  <div key={recruit.UserID} className="flex justify-between items-center border border-gray-200 p-3 bg-white">
                    <div className="flex items-center gap-4">
                      <span className="text-xl font-black text-gray-200 w-6">0{idx + 1}</span>
                      <div>
                        <span className="font-bold  text-sm block">{recruit.UserName}</span>
                        <span className="text-[10px] font-bold text-gray-500  tracking-widest">{recruit.MainRole || '补位'}</span>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => handleRemoveRecruit(recruit.UserID)}
                      className="text-[10px] font-bold text-gray-400 hover:text-red-500  tracking-widest transition-colors"
                    >
                      REMOVE
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-black text-white py-6 font-black  tracking-widest text-lg hover:bg-[#660874] transition-colors flex items-center justify-center gap-3 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-[#660874] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
              <span className="relative z-10 flex items-center gap-3">
                {isSubmitting ? 'DEPLOYING...' : 'INITIALIZE SQUAD'}
                {!isSubmitting && <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>}
              </span>
            </button>

          </aside>
        </form>
      </div>
    </div>
  );
}