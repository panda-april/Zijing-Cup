import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { showAlert } from '../components/CustomAlert';

export default function MatchScheduling({ matchId, onBack }) {
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [opponentTeam, setOpponentTeam] = useState(null);
  const [isCaptain, setIsCaptain] = useState(false);
  const [selectedTime, setSelectedTime] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 新增提议时间
  const [proposedTimeInput, setProposedTimeInput] = useState('');

  useEffect(() => {
    const fetchMatchData = async () => {
      try {
        const [matchRes, proposalsRes] = await Promise.all([
          api.get(`/matches/${matchId}`),
          api.get(`/matches/${matchId}/proposals`)
        ]);

        if (matchRes.data.success) {
          const data = matchRes.data.data;
          setMatch(data);

          // 找到我方队伍和对手队伍
          const participations = data.MatchParticipations || [];
          // 获取当前用户对应的队伍（用户是其中一队队长）
          for (const p of participations) {
            if (p.Team && p.Team.Captain) {
              // 判断当前登录用户是不是这个队伍的队长
              // 这里我们通过 API 上下文来判断，后端会返回我们需要知道我是否是队长
              // 实际上，我们需要通过 /me/teams 获取用户所在队伍，然后看哪个队伍在这场比赛中
            }
          }

          // 获取我的队伍列表，找到我在这场比赛中的队伍
          const myTeamsRes = await api.get('/me/teams');
          if (myTeamsRes.data.success) {
            const myTeams = myTeamsRes.data.data;
            // 找到我作为成员且队长的队伍在这场比赛中
            const myParticipation = participations.find(p =>
              myTeams.some(mt => mt.TeamID === p.TeamID && mt.isCaptain)
            );
            if (myParticipation) {
              setMyTeam(myParticipation.Team);
              setIsCaptain(true);
              // 找到对手
              const opponent = participations.find(p => p.TeamID !== myParticipation.TeamID);
              if (opponent) {
                setOpponentTeam(opponent.Team);
              }
            } else {
              // 如果我不是队长，只是成员，也能找到我的队伍
              const myPart = participations.find(p =>
                myTeams.some(mt => mt.TeamID === p.TeamID)
              );
              if (myPart) {
                setMyTeam(myPart.Team);
                setIsCaptain(false);
                const opponent = participations.find(p => p.TeamID !== myPart.TeamID);
                if (opponent) {
                  setOpponentTeam(opponent.Team);
                }
              }
            }
          }
        }

        if (proposalsRes.data.success) {
          setProposals(proposalsRes.data.data || []);
        }
      } catch (err) {
        console.error('获取比赛信息失败:', err);
        showAlert('获取比赛信息失败');
      } finally {
        setLoading(false);
      }
    };

    fetchMatchData();
  }, [matchId]);

  const handlePropose = async () => {
    if (!proposedTimeInput) {
      showAlert('请选择提议时间');
      return;
    }
    if (!opponentTeam) {
      showAlert('无法获取对手队伍信息');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/matches/${matchId}/proposals`, {
        initiatorTeamId: myTeam.TeamID,
        responderTeamId: opponentTeam.TeamID,
        proposedTimes: [proposedTimeInput],
        message: newMessage || undefined
      });
      showAlert('约赛提议已发送，等待对手回应');
      // 刷新提议列表
      const res = await api.get(`/matches/${matchId}/proposals`);
      if (res.data.success) {
        setProposals(res.data.data || []);
      }
      setProposedTimeInput('');
      setNewMessage('');
    } catch (err) {
      showAlert(err.response?.data?.error || '发起约赛失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRespond = async (proposalId, action, time) => {
    setIsSubmitting(true);
    try {
      await api.put(`/match-proposals/${proposalId}/respond`, {
        action: action === 'ACCEPT' ? 'ACCEPT' : 'REJECT',
        selectedTime: action === 'ACCEPT' ? time : null
      });
      showAlert(action === 'ACCEPT' ? '已接受约赛' : '已拒绝约赛');
      // 刷新
      const res = await api.get(`/matches/${matchId}/proposals`);
      if (res.data.success) {
        setProposals(res.data.data || []);
      }
      // 刷新比赛信息
      const matchRes = await api.get(`/matches/${matchId}`);
      if (matchRes.data.success) {
        setMatch(matchRes.data.data);
      }
    } catch (err) {
      showAlert(err.response?.data?.error || '操作失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusText = () => {
    if (!match) return '';
    if (match.Status === 'Scheduled') return '已确定时间';
    if (match.Status === 'Finished') return '已完赛';
    return '等待协商';
  };

  if (loading) {
    return (
      <div className="min-h-full bg-gray-100 p-6 md:p-12">
        <div className="max-w-4xl mx-auto text-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-black border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-sm font-bold text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-full bg-gray-100 p-6 md:p-12">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border-2 border-red-200 p-8 text-center">
            <p className="font-bold text-red-600">比赛不存在或已删除</p>
            <button onClick={onBack} className="mt-4 bg-black text-white px-4 py-2 text-sm font-bold">返回</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-100 p-6 md:p-12 selection:bg-black selection:text-yellow-300">
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-in { animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      <div className="max-w-4xl mx-auto animate-slide-in">
        {/* 顶部导航 */}
        <div className="flex justify-between items-end border-b-4 border-black pb-4 mb-8">
          <div>
            <button onClick={onBack} className="text-xs font-bold tracking-widest text-gray-400 hover:text-black transition-colors mb-2 block text-left">
              ← BACK
            </button>
            <h1 className="text-4xl font-black tracking-tight">Match Scheduling</h1>
            <p className="text-sm font-bold text-gray-500 mt-1">{match.MatchName} · {match.Tournament?.TournamentName}</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 tracking-widest ${
            match.Status === 'Scheduled' ? 'bg-green-400 text-black' :
            match.Status === 'Finished' ? 'bg-gray-400 text-black' :
            'bg-yellow-400 text-black'
          }`}>
            {getStatusText()}
          </span>
        </div>

        {/* 对阵信息 */}
        <div className="bg-white border-2 border-black shadow-[4px_4px_0_0_#000] mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3">
            <div className="p-8 text-center border-b md:border-b-0 md:border-r border-gray-200">
              <p className="text-[10px] font-bold tracking-widest text-gray-500 mb-2">TEAM A</p>
              <h3 className="text-2xl font-black">{match?.MatchParticipations?.[0]?.Team?.TeamName || '?'}</h3>
              <p className="text-xs font-bold text-gray-400 mt-1">Captain: {match?.MatchParticipations?.[0]?.Team?.Captain?.UserName || '?'}</p>
            </div>
            <div className="p-8 text-center border-b md:border-b-0 md:border-r border-gray-200">
              <p className="text-[10px] font-bold tracking-widest text-gray-500 mb-2">VS</p>
            </div>
            <div className="p-8 text-center">
              <p className="text-[10px] font-bold tracking-widest text-gray-500 mb-2">TEAM B</p>
              <h3 className="text-2xl font-black">{match?.MatchParticipations?.[1]?.Team?.TeamName || '?'}</h3>
              <p className="text-xs font-bold text-gray-400 mt-1">Captain: {match?.MatchParticipations?.[1]?.Team?.Captain?.UserName || '?'}</p>
            </div>
          </div>
        </div>

        {/* 已确定时间 */}
        {match.Status === 'Scheduled' && match.MatchTime && (
          <div className="bg-green-50 border-2 border-green-600 p-6 mb-8">
            <h3 className="text-lg font-black text-green-800 mb-2">✓ 约赛已确认</h3>
            <p className="text-sm font-bold text-green-700">
              比赛时间: {new Date(match.MatchTime).toLocaleString()}
            </p>
          </div>
        )}

        {/* 提议列表 */}
        {proposals.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-black tracking-tight border-b-2 border-black pb-2 mb-4">历史提议</h3>
            <div className="space-y-3">
              {proposals.map((prop) => {
                const isPending = prop.Status === 'Pending';
                const isInitiatorMyTeam = prop.InitiatorTeamID === myTeam?.TeamID;
                return (
                  <div key={prop.ProposalID} className={`border-2 p-4 ${
                    isPending ? 'border-yellow-400 bg-yellow-50' :
                    prop.Status === 'Accepted' ? 'border-green-600 bg-green-50' :
                    'border-gray-300 bg-gray-50'
                  }`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold tracking-widest px-2 py-0.5 bg-black text-white">
                            {prop.Status.toUpperCase()}
                          </span>
                          <span className="text-xs font-bold text-gray-500">
                            {isInitiatorMyTeam ? '我方发起' : '对方发起'}
                          </span>
                        </div>
                        <p className="text-sm font-bold">
                          提议时间: {JSON.parse(prop.ProposedTimes).map(t => new Date(t).toLocaleString()).join(', ')}
                        </p>
                        {prop.Message && (
                          <p className="text-sm text-gray-600 mt-1">附言: {prop.Message}</p>
                        )}
                        <p className="text-[10px] font-bold text-gray-400 mt-1">
                          发起时间: {new Date(prop.CreatedAt).toLocaleString()}
                        </p>
                      </div>
                      {isPending && !isInitiatorMyTeam && isCaptain && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRespond(prop.ProposalID, 'ACCEPT', JSON.parse(prop.ProposedTimes)[0])}
                            disabled={isSubmitting}
                            className="bg-black text-white px-4 py-2 text-xs font-bold tracking-widest hover:bg-[#660874] transition-colors disabled:opacity-50"
                          >
                            ACCEPT
                          </button>
                          <button
                            onClick={() => handleRespond(prop.ProposalID, 'REJECT')}
                            disabled={isSubmitting}
                            className="border border-red-500 text-red-500 px-4 py-2 text-xs font-bold tracking-widest hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50"
                          >
                            REJECT
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 发起新提议 - 只有队长且未确定时间才能操作 */}
        {isCaptain && match.Status !== 'Scheduled' && match.Status !== 'Finished' && opponentTeam && (
          <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0_0_#000]">
            <h3 className="text-xl font-black tracking-tight mb-4">发起新约赛提议</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black tracking-widest text-gray-500 mb-2">选择时间</label>
                <input
                  type="datetime-local"
                  value={proposedTimeInput}
                  onChange={(e) => setProposedTimeInput(e.target.value)}
                  className="w-full border-2 border-gray-200 p-3 text-sm font-bold focus:border-black focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-black tracking-widest text-gray-500 mb-2">附言 (可选)</label>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="例如：请问这个时间你们可以吗？"
                  className="w-full border-2 border-gray-200 p-3 text-sm font-bold focus:border-black focus:outline-none transition-colors"
                />
              </div>
              <button
                onClick={handlePropose}
                disabled={isSubmitting || !proposedTimeInput}
                className="w-full bg-yellow-400 border-2 border-black text-black py-4 font-black tracking-widest text-lg hover:bg-black hover:text-yellow-400 transition-colors shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'SENDIND...' : `SEND PROPOSAL TO ${opponentTeam.TeamName}`}
              </button>
            </div>
          </div>
        )}

        {!isCaptain && match.Status !== 'Scheduled' && (
          <div className="bg-gray-50 border-2 border-gray-300 p-6 text-center">
            <p className="text-sm font-bold text-gray-500">仅队长可进行约赛操作</p>
          </div>
        )}
      </div>
    </div>
  );
}
