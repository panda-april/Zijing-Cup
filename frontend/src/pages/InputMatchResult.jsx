import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { showAlert } from '../components/CustomAlert';

export default function InputMatchResult({ matchId, onCancel, onSuccess }) {
  const [matchData, setMatchData] = useState(null);
  const [results, setResults] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchMatch = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/matches/${matchId}`);
        if (!res.data.success) return;
        const m = res.data.data;
        const normalized = {
          id: m.MatchID,
          tournament: m.Tournament?.TournamentName || 'UNKNOWN',
          game: m.Tournament?.Game?.GameName || 'UNKNOWN',
          type: m.MatchType || 'H2H',
          round: m.MatchName,
          time: m.MatchTime ? new Date(m.MatchTime).toLocaleString() : '待定',
          participants: (m.MatchParticipations || []).map((p) => ({
            id: p.TeamID,
            name: p.Team?.TeamName || 'UNKNOWN'
          }))
        };
        setMatchData(normalized);

        const initial = {};
        if (normalized.type === 'H2H') {
          normalized.participants.forEach(p => {
            initial[p.id] = { score: '', isWinner: false };
          });
        } else {
          normalized.participants.forEach((p, idx) => {
            initial[p.id] = { rank: idx + 1, score: '' };
          });
        }
        setResults(initial);
      } catch (error) {
        console.error('拉取比赛详情失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    if (matchId) fetchMatch();
  }, [matchId]);

  // === 3. 交互逻辑 ===

  // H2H: 更新比分
  const handleH2HScoreChange = (teamId, value) => {
    setResults(prev => ({ ...prev, [teamId]: { ...prev[teamId], score: value } }));
  };

  // H2H: 钦定胜者
  const handleH2HWinnerSelect = (winnerId) => {
    setResults(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        next[id].isWinner = (id === winnerId);
      });
      return next;
    });
  };

  // Lobby: 更新排名与积分
  const handleLobbyChange = (teamId, field, value) => {
    setResults(prev => ({ ...prev, [teamId]: { ...prev[teamId], [field]: value } }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 基础校验
    if (matchData.type === 'H2H') {
      const hasWinner = Object.values(results).some(r => r.isWinner);
      if (!hasWinner) return showAlert("必须明确指定一支胜出队伍！");
    }

    setIsSubmitting(true);
    
    const payload = {
      results: Object.keys(results).map(teamId => ({
        teamId,
        ...results[teamId]
      }))
    };
    try {
      await api.post(`/matches/${matchData.id}/results`, payload);
      showAlert(`比赛 [${matchData.id}] 成绩已锁定，积分榜已更新！`);
      if (onSuccess) onSuccess();
    } catch (error) {
      showAlert(error.response?.data?.error || '赛果提交失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // === 4. 视图渲染 ===

  if (isLoading) {
    return (
      <div className="min-h-full bg-gray-100 flex items-center justify-center p-12">
        <p className="font-black  tracking-widest text-gray-400 animate-pulse">LOADING MATCH DATA...</p>
      </div>
    );
  }

  if (!matchData) {
    return (
      <div className="min-h-full bg-gray-100 flex flex-col items-center justify-center p-12 gap-4">
        <p className="font-black  tracking-widest text-red-500">MATCH NOT FOUND.</p>
        <button onClick={onCancel} className="text-xs font-bold  tracking-widest text-gray-400 hover:text-black">← GO BACK</button>
      </div>
    );
  }

  // 渲染 1v1 对抗赛录入 UI
  const renderH2HInput = () => {
    const teamA = matchData.participants[0];
    const teamB = matchData.participants[1];
    const resA = results[teamA.id];
    const resB = results[teamB.id];

    return (
      <div className="bg-white border-2 border-black p-8 shadow-[4px_4px_0_0_#000]">
        <h3 className="text-xl font-black  border-b-2 border-black pb-4 mb-8 text-center">Head-to-Head Resolution</h3>
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          
          {/* Team A */}
          <div className="flex-1 w-full">
            <div className={`border-4 p-6 transition-colors ${resA.isWinner ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'}`}>
              <h4 className="text-2xl font-black  text-center truncate mb-6">{teamA.name}</h4>
              <label className="block text-[10px] font-bold  tracking-widest text-gray-500 mb-2 text-center">FINAL SCORE</label>
              <input 
                type="number" required placeholder="0"
                value={resA.score} onChange={(e) => handleH2HScoreChange(teamA.id, e.target.value)}
                className="w-full text-center text-6xl font-black bg-gray-100 border-b-4 border-black py-4 outline-none focus:bg-yellow-200 transition-colors"
              />
              <button 
                type="button" onClick={() => handleH2HWinnerSelect(teamA.id)}
                className={`w-full mt-6 py-4 font-black  tracking-widest text-sm transition-all border-2 ${resA.isWinner ? 'bg-yellow-400 border-black text-black' : 'bg-white border-gray-300 text-gray-400 hover:border-black hover:text-black'}`}
              >
                {resA.isWinner ? '✓ DECLARED WINNER' : 'MARK AS WINNER'}
              </button>
            </div>
          </div>

          <div className="text-2xl font-black text-gray-300  tracking-widest">VS</div>

          {/* Team B */}
          <div className="flex-1 w-full">
            <div className={`border-4 p-6 transition-colors ${resB.isWinner ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'}`}>
              <h4 className="text-2xl font-black  text-center truncate mb-6">{teamB.name}</h4>
              <label className="block text-[10px] font-bold  tracking-widest text-gray-500 mb-2 text-center">FINAL SCORE</label>
              <input 
                type="number" required placeholder="0"
                value={resB.score} onChange={(e) => handleH2HScoreChange(teamB.id, e.target.value)}
                className="w-full text-center text-6xl font-black bg-gray-100 border-b-4 border-black py-4 outline-none focus:bg-yellow-200 transition-colors"
              />
              <button 
                type="button" onClick={() => handleH2HWinnerSelect(teamB.id)}
                className={`w-full mt-6 py-4 font-black  tracking-widest text-sm transition-all border-2 ${resB.isWinner ? 'bg-yellow-400 border-black text-black' : 'bg-white border-gray-300 text-gray-400 hover:border-black hover:text-black'}`}
              >
                {resB.isWinner ? '✓ DECLARED WINNER' : 'MARK AS WINNER'}
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  };

  // 渲染大厅混战录入 UI (表格)
  const renderLobbyInput = () => {
    return (
      <div className="bg-white border-2 border-black shadow-[4px_4px_0_0_#000]">
        <div className="p-6 border-b-2 border-black flex justify-between items-center bg-gray-50">
          <h3 className="text-xl font-black ">Lobby Standings Input</h3>
          <span className="text-xs font-bold text-gray-500  tracking-widest">{matchData.participants.length} SQUADS</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black text-yellow-400">
                <th className="p-4 text-[10px] font-black  tracking-widest w-24">Final Rank</th>
                <th className="p-4 text-[10px] font-black  tracking-widest">Squad Name</th>
                <th className="p-4 text-[10px] font-black  tracking-widest w-64 border-l border-gray-800">Score / Metrics (积分/击杀等)</th>
              </tr>
            </thead>
            <tbody>
              {matchData.participants.map((team, idx) => (
                <tr key={team.id} className="border-b border-gray-200 hover:bg-yellow-50 focus-within:bg-yellow-50 transition-colors group">
                  <td className="p-2 border-r border-gray-200">
                    <input 
                      type="number" required min="1"
                      value={results[team.id].rank} 
                      onChange={(e) => handleLobbyChange(team.id, 'rank', e.target.value)}
                      className="w-full text-center font-black text-lg bg-transparent outline-none py-2"
                    />
                  </td>
                  <td className="p-4 font-bold ">{team.name}</td>
                  <td className="p-0 border-l border-gray-200 relative">
                    <input 
                      type="text" required placeholder="e.g. 3450 积分"
                      value={results[team.id].score} 
                      onChange={(e) => handleLobbyChange(team.id, 'score', e.target.value)}
                      className="w-full h-full absolute inset-0 px-4 font-bold  tracking-wider text-sm bg-transparent outline-none focus:border-2 focus:border-black focus:bg-white"
                    />
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
    <div className="min-h-full bg-gray-100 text-gray-900 font-sans p-6 md:p-12 selection:bg-black selection:text-yellow-300 pb-32">
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-in { animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      <div className="max-w-4xl mx-auto animate-slide-in">
        
        {/* === 顶部控制台头部 === */}
        <div className="border-b-4 border-black pb-6 mb-10 flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-yellow-400 text-black text-[10px] font-black px-2 py-1  tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                RESULTS TERMINAL
              </span>
              <span className="text-gray-500 font-bold text-xs  tracking-widest">
                ● AWAITING INPUT
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter  leading-tight">Submit Result.</h1>
          </div>
          
          <button 
            type="button" onClick={onCancel}
            className="text-xs font-bold  tracking-widest text-gray-400 hover:text-black transition-colors"
          >
            ← ABORT ENTRY
          </button>
        </div>

        {/* === 赛事上下文信息 (防呆设计) === */}
        <div className="bg-black text-white p-6 mb-10 flex flex-wrap gap-x-12 gap-y-4 shadow-[4px_4px_0_0_#eab308]">
          <div>
            <p className="text-[10px] text-gray-400 font-bold  tracking-widest mb-1">MATCH ID</p>
            <p className="font-mono font-bold">{matchData.id}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold  tracking-widest mb-1">TOURNAMENT</p>
            <p className="font-bold  text-yellow-400">{matchData.tournament}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold  tracking-widest mb-1">PHASE & GAME</p>
            <p className="font-bold ">{matchData.round} / {matchData.game}</p>
          </div>
        </div>

        {/* === 表单核心区 === */}
        <form onSubmit={handleSubmit} className="space-y-10">
          
          {/* 动态渲染输入区域 */}
          {matchData.type === 'H2H' ? renderH2HInput() : renderLobbyInput()}

          {/* 核对与提交区 (移除了原来的极端红色警告) */}
          <div className="border-2 border-black p-6 bg-yellow-50 flex flex-col md:flex-row items-center gap-8 shadow-[4px_4px_0_0_#000]">
            <div className="flex-1">
              <h4 className="text-sm font-black  text-black mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                VERIFICATION REQUIRED (请核对赛果)
              </h4>
              <p className="text-xs font-bold text-gray-600  leading-relaxed">
                Submitting this form will update the global tournament standings. Please double-check all entries to ensure accuracy before proceeding.
              </p>
            </div>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full md:w-auto bg-black text-yellow-400 px-10 py-6 font-black  tracking-widest text-sm hover:bg-yellow-400 hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 border-2 border-transparent hover:border-black"
            >
              {isSubmitting ? 'SUBMITTING...' : 'CONFIRM & SUBMIT'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}