import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { showAlert } from '../components/CustomAlert';

const FORMATS = ['单败淘汰赛 (BO1)', '单败淘汰赛 (BO3)', '双败淘汰赛', '大厅积分突围赛', '小组单循环赛'];
const PRESET_SIZES = [8, 16, 32, 64];

export default function CreateTournament({ onCancel, onSuccess, embedded = false }) {
  const [games, setGames] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    gameId: '',
    maxTeams: 16,
    format: FORMATS[0],
    prizePool: '',
    description: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await api.get('/games');
        if (res.data.success) {
          const list = res.data.data || [];
          setGames(list);
          if (list.length > 0) {
            setFormData(prev => ({ ...prev, gameId: list[0].GameID }));
          }
        }
      } catch (error) {
        console.error('获取项目列表失败:', error);
      }
    };
    fetchGames();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return showAlert("赛事名称不能为空");
    if (!formData.gameId) return showAlert("请先选择项目");
    
    setIsSubmitting(true);

    try {
      await api.post('/tournaments', {
        tournamentName: formData.name,
        gameId: formData.gameId,
        maxTeamSize: Number(formData.maxTeams),
        format: formData.format,
        prizePool: formData.prizePool || null,
        description: formData.description,
        status: 'REGISTRATION'
      });
      showAlert(`赛事 [${formData.name}] 部署成功`);
      if (onSuccess) onSuccess();
    } catch (error) {
      showAlert(error.response?.data?.error || '赛事部署失败，请稍后再试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${embedded ? '' : 'min-h-full'} selection:bg-black selection:text-yellow-300 pb-32`}>
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-in { animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      <div className={`${embedded ? '' : 'max-w-6xl mx-auto'} animate-slide-in`}>
 
        {/* === 顶部控制台头部 === */}
        <div className="border-b-4 border-black pb-6 mb-10 flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-yellow-400 text-black text-[10px] font-black px-2 py-1  tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                DIRECTOR OVERRIDE
              </span>
              <span className="text-gray-500 font-bold text-xs  tracking-widest">
                ● TOURNAMENT DEPLOYMENT
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter ">Initialize Event.</h1>
          </div>
          
          <button 
            type="button"
            onClick={onCancel}
            className="text-xs font-bold  tracking-widest text-gray-400 hover:text-red-600 transition-colors"
          >
            ← ABORT INITIALIZATION
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* ========================================== */}
          {/* 左侧：赛事核心参数 */}
          {/* ========================================== */}
          <section className="lg:col-span-7 space-y-8">
            
            {/* 1. 赛事名称 */}
            <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0_0_#000]">
              <label className="block text-xs font-black  tracking-widest text-black mb-4">
                01. TOURNAMENT TITLE (赛事名称)
              </label>
              <input 
                type="text" 
                required
                maxLength={40}
                placeholder="e.g. 2026 首届紫荆杯 CS2 挑战赛" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full border-b-4 border-gray-200 py-3 text-2xl font-black tracking-wider outline-none focus:border-yellow-400 transition-colors bg-transparent placeholder-gray-300"
              />
            </div>

            {/* 2. 目标游戏项目 */}
            <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0_0_#000]">
              <label className="block text-xs font-black  tracking-widest text-black mb-4 flex justify-between items-center">
                <span>02. TARGET GAME (目标项目)</span>
                <span className="text-[10px] text-gray-400">SELECT ONE</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {games.map(game => (
                  <button
                    key={game.GameID}
                    type="button"
                    onClick={() => setFormData({...formData, gameId: game.GameID})}
                    className={`py-3 px-2 border-2 font-bold  tracking-widest text-[10px] transition-all flex flex-col items-center gap-1 ${
                      formData.gameId === game.GameID 
                      ? 'border-black bg-black text-yellow-300' 
                      : 'border-gray-200 text-gray-500 hover:border-black hover:text-black'
                    }`}
                  >
                    <span>{game.GameName}</span>
                    <span className={`text-[8px] px-1 ${formData.gameId === game.GameID ? 'bg-yellow-300 text-black' : 'bg-gray-100 text-gray-400'}`}>
                      {game.GameType || 'N/A'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. 赛事规模 & 赛制 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0_0_#000]">
                <label className="block text-xs font-black  tracking-widest text-black mb-4">
                  03. CAPACITY (规模)
                </label>
                
                {/* 自由输入的主力框 */}
                <div className="flex items-end gap-4 mb-4">
                  <input 
                    type="number" 
                    min="2"
                    max="999"
                    required
                    value={formData.maxTeams}
                    onChange={e => setFormData({...formData, maxTeams: parseInt(e.target.value) || ''})}
                    className="w-full border-b-4 border-black py-2 text-4xl font-black outline-none focus:border-yellow-400 transition-colors bg-transparent placeholder-gray-200"
                  />
                  <span className="text-sm font-bold  tracking-widest text-gray-500 pb-2">SQUADS</span>
                </div>

                {/* 快捷预设按钮组 */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400  tracking-widest mr-1">PRESETS:</span>
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

              <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0_0_#000]">
                <label className="block text-xs font-black  tracking-widest text-black mb-4">
                  04. FORMAT (赛制)
                </label>
                <div className="flex flex-col gap-2">
                  {FORMATS.map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormData({...formData, format: f})}
                      className={`w-full text-left px-4 py-2 border-2 font-bold text-xs  transition-all flex justify-between items-center ${
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
            </div>

          </section>

          {/* ========================================== */}
          {/* 右侧：奖金、规则与最终发布 */}
          {/* ========================================== */}
          <aside className="lg:col-span-5 space-y-8 flex flex-col">
            
            <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0_0_#000] flex-1 flex flex-col">
              {/* 奖金池 */}
              <div className="mb-8">
                <label className="block text-xs font-black  tracking-widest text-black mb-4">
                  05. PRIZE POOL (奖金池/奖励)
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. ¥ 10,000 + 冠军奖杯" 
                  value={formData.prizePool}
                  onChange={e => setFormData({...formData, prizePool: e.target.value})}
                  className="w-full border-b-2 border-gray-200 py-2 text-sm font-bold  tracking-wider outline-none focus:border-yellow-400 transition-colors bg-transparent placeholder-gray-300"
                />
              </div>

              {/* 赛事规则说明 */}
              <div className="flex-1 flex flex-col">
                <label className="block text-xs font-black  tracking-widest text-black mb-4 flex justify-between items-center">
                  <span>06. INTELLIGENCE (规则与详情)</span>
                </label>
                <textarea 
                  required
                  placeholder="Describe tournament rules, schedule, and requirements here..."
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full flex-1 min-h-[150px] border-2 border-gray-200 p-4 text-sm font-medium outline-none focus:border-black transition-colors resize-none placeholder-gray-300"
                ></textarea>
              </div>
            </div>

            {/* 发布按钮 */}
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-yellow-400 border-2 border-black text-black py-6 font-black  tracking-widest text-lg hover:bg-black hover:text-yellow-400 transition-colors flex items-center justify-center gap-3 relative overflow-hidden group shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="relative z-10 flex items-center gap-3">
                {isSubmitting ? 'BROADCASTING...' : 'CONFIRM & DEPLOY'}
                {!isSubmitting && <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>}
              </span>
            </button>

          </aside>
        </form>
      </div>
    </div>
  );
}