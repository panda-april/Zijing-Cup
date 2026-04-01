import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { showAlert } from '../components/CustomAlert';

// 通知类型文字映射
const NOTIFICATION_TITLES = {
  PENDING_MATCH: '等待约赛',
  PROPOSAL_SENT: '等待对手回应',
  PROPOSAL_RECEIVED: '新约赛邀请',
  PROPOSAL_REJECTED: '约赛被拒绝',
  TEAM_REQUEST: '队伍申请'
};

export default function MessageCenter({ onBack, onNavigateMatch }) {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingProposals, setPendingProposals] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        // 获取所有待处理的通知 + 系统通知
        const [reqRes, propRes, notifRes] = await Promise.allSettled([
          api.get('/me/notifications/requests'),
          api.get('/me/notifications/proposals'),
          api.get('/notifications')
        ]);

        if (reqRes.status === 'fulfilled' && reqRes.value.data.success) {
          setPendingRequests(reqRes.value.data.data || []);
        }
        if (propRes.status === 'fulfilled' && propRes.value.data.success) {
          setPendingProposals(propRes.value.data.data || []);
        }
        if (notifRes.status === 'fulfilled' && notifRes.value.data.success) {
          setNotifications(notifRes.value.data.data || []);
        }
      } catch (err) {
        setError('获取消息失败');
        console.error('获取消息失败:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, []);

  // 标记通知已读
  const markAsRead = async (notificationId) => {
    try {
      await api.post(`/notifications/${notificationId}/read`);
      setNotifications(prev => prev.map(n =>
        n.NotificationID === notificationId ? { ...n, IsRead: true } : n
      ));
    } catch (err) {
      console.error('标记已读失败:', err);
    }
  };

  // 计算总未读数
  const totalUnread =
    pendingRequests.length +
    pendingProposals.length +
    notifications.filter(n => !n.IsRead).length;

  const handleRequestAction = async (requestId, action, teamName, request) => {
    try {
      // 后端只接受 APPROVE / REJECT，不是 APPROVED / REJECTED
      const backendAction = action === 'APPROVED' ? 'APPROVE' : 'REJECT';
      await api.put(`/teams/requests/${requestId}`, { action: backendAction });
      // 刷新列表
      setPendingRequests(prev => prev.filter(r => r.requestId !== requestId));
      showAlert(`${action === 'APPROVED' ? (request.type === 'INVITE' ? '接受' : '批准') : '拒绝'}成功`);
    } catch (err) {
      console.error('处理申请失败:', err);
      showAlert('处理失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleProposalAction = async (proposalId, matchId, action, proposedTime) => {
    try {
      // 简化处理：直接使用第一个提议时间，用户不需要额外选择
      let sendTime = action === 'ACCEPTED' ? proposedTime : null;
      await api.put(`/match-proposals/${proposalId}/respond`, {
        action: action === 'ACCEPTED' ? 'ACCEPT' : 'REJECT',
        selectedTime: sendTime
      });
      // 刷新列表
      setPendingProposals(prev => prev.filter(p => p.proposalId !== proposalId));
      showAlert(`${action === 'ACCEPTED' ? '接受' : '拒绝'}成功`);
    } catch (err) {
      console.error('处理提议失败:', err);
      showAlert('处理失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const getRequestTypeText = (type) => {
    const map = {
      'APPLY': '申请加入队伍',
      'INVITE': '邀请你加入队伍',
      'RECOMMEND': '推荐加入队伍'
    };
    return map[type] || type;
  };

  const getRequestStatusBadge = (type, isInitiator) => {
    if (type === 'INVITE' && !isInitiator) return '你收到邀请';
    if (type === 'APPLY' && isInitiator) return '你发起申请';
    if (type === 'APPLY' && !isInitiator) return '待你审批';
    return '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-black border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-sm font-bold text-gray-500">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 标题区域 */}
        <div className="flex flex-col md:flex-row justify-between md:items-end border-b border-black pb-4 mb-8 gap-4">
          <h2 className="text-3xl font-black tracking-tight">Message Center</h2>
          {totalUnread > 0 && (
            <span className="bg-[#660874] text-white px-3 py-1 text-sm font-black rounded">
              {totalUnread} 条新消息
            </span>
          )}
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-600 text-sm font-bold">
            {error}
          </div>
        )}

        {/* 系统通知区域 */}
        <div className="mb-12">
          <h3 className="text-xl font-black tracking-tight border-b border-black pb-3 mb-6">系统通知</h3>
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-gray-400 font-medium tracking-wider">
              暂无系统通知
            </div>
          ) : (
            <div className="border-t border-black">
              {notifications.map((notif) => (
                <div
                  key={notif.NotificationID}
                  className={`border-b border-gray-200 py-6 px-2 transition-colors ${
                    notif.IsRead ? 'bg-white hover:bg-gray-50' : 'bg-yellow-50 hover:bg-yellow-100'
                  } ${notif.MatchID ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (!notif.IsRead) markAsRead(notif.NotificationID);
                    if (notif.MatchID && onNavigateMatch) {
                      onNavigateMatch(notif.MatchID);
                    }
                  }}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-black">
                          {notif.Title}
                        </h4>
                        {!notif.IsRead && (
                          <span className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></span>
                        )}
                        {notif.MatchID && (
                          <span className="text-[10px] font-bold bg-yellow-400 text-black px-2 py-0.5">
                            点击进入约赛 →
                          </span>
                        )}
                        <span className="text-[10px] font-bold bg-black text-white px-2 py-0.5">
                          {notif.Type}
                        </span>
                      </div>
                      {notif.Description && (
                        <p className="text-sm text-gray-600 mb-1">
                          {notif.Description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 font-bold tracking-wider">
                        {new Date(notif.CreatedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 队伍邀请/申请列表 */}
        <div className="mb-12">
          <h3 className="text-xl font-black tracking-tight border-b border-black pb-3 mb-6">队伍通知</h3>
          {pendingRequests.length === 0 ? (
            <div className="py-12 text-center text-gray-400 font-medium tracking-wider">
              暂无队伍通知
            </div>
          ) : (
            <div className="border-t border-black">
              {pendingRequests.map((req) => (
                <div key={req.requestId} className="border-b border-gray-200 py-6 px-2 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-xl font-black">{req.teamName}</h4>
                        <span className="text-[10px] font-bold bg-black text-white px-2 py-0.5">
                          {getRequestTypeText(req.type)}
                        </span>
                        <span className="text-[10px] font-bold bg-[#660874] text-white px-2 py-0.5">
                          {getRequestStatusBadge(req.type, req.isInitiator)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        {req.userName}
                        {req.message && ` - ${req.message}`}
                      </p>
                      <p className="text-xs text-gray-400 font-bold tracking-wider">
                        发起时间: {new Date(req.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {/* 后端只返回需要当前用户处理的通知，直接显示按钮 */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRequestAction(req.requestId, 'APPROVED', req.teamName, req)}
                        className="bg-black text-white px-4 py-2 text-xs font-bold hover:bg-[#660874] transition-colors"
                      >
                        {req.type === 'INVITE' ? '接受' : '批准'}
                      </button>
                      <button
                        onClick={() => handleRequestAction(req.requestId, 'REJECTED', req.teamName, req)}
                        className="border border-red-500 text-red-500 px-4 py-2 text-xs font-bold hover:bg-red-500 hover:text-white transition-colors"
                      >
                        {req.type === 'INVITE' ? '拒绝' : '拒绝'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 比赛提议列表 */}
        <div>
          <h3 className="text-xl font-black tracking-tight border-b border-black pb-3 mb-6">比赛安排通知</h3>
          {pendingProposals.length === 0 ? (
            <div className="py-12 text-center text-gray-400 font-medium tracking-wider">
              暂无比赛安排通知
            </div>
          ) : (
            <div className="border-t border-black">
              {pendingProposals.map((prop) => (
                <div key={prop.proposalId} className="border-b border-gray-200 py-6 px-2 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-xl font-black">{prop.tournamentName}</h4>
                        <span className="text-[10px] font-bold bg-black text-white px-2 py-0.5">
                          {prop.roundName}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {prop.opponentTeam} - 提议时间: {new Date(prop.proposedTime).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400 font-bold tracking-wider">
                        对战队伍: {prop.myTeam} | 发起方: {prop.isInitiator ? '我方' : '对方'}
                      </p>
                    </div>
                    {!prop.isInitiator && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleProposalAction(prop.proposalId, prop.matchId, 'ACCEPTED', prop.proposedTime)}
                          className="bg-black text-white px-4 py-2 text-xs font-bold hover:bg-[#660874] transition-colors"
                        >
                          接受
                        </button>
                        <button
                          onClick={() => handleProposalAction(prop.proposalId, prop.matchId, 'REJECTED', prop.proposedTime)}
                          className="border border-red-500 text-red-500 px-4 py-2 text-xs font-bold hover:bg-red-500 hover:text-white transition-colors"
                        >
                          拒绝
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
