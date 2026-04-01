import React, { useState } from 'react';
import api from '../utils/api';
import { showAlert } from '../components/CustomAlert';

export default function CreateMatch({
  tournamentId = null,
  tournamentName = '首届紫荆杯联合电竞锦标赛',
  enrolledTeams = [],
  matchToEdit = null, // 🚀 传入这个对象即代表进入”编辑模式”
  onCancel,
  onSuccess,
  embedded = false // 是否被嵌入在其他页面内部（去掉外层padding和bg）
}) {
  // 根据是否为编辑模式初始化表单
  const [formData, setFormData] = useState({
    type: matchToEdit?.type || matchToEdit?.MatchType || 'H2H', // H2H (1v1) 或 LOBBY (大厅混战)
    round: matchToEdit?.round || matchToEdit?.MatchName || ''
  });

  // 假设传入的 participants 是一组队伍 ID 的数组
  const [selectedTeams, setSelectedTeams] = useState(
    matchToEdit?.participants || matchToEdit?.MatchParticipations?.map(p => p.TeamID) || []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = !!matchToEdit;

  // === 交互逻辑 ===

  // 切换比赛类型时，如果从大厅切回1v1，自动截断多余的队伍
  const handleTypeChange = (type) => {
    setFormData({ ...formData, type });
    if (type === 'H2H' && selectedTeams.length > 2) {
      setSelectedTeams(selectedTeams.slice(0, 2));
    }
  };

  // 点击队伍卡片进行选中/取消选中
  const handleToggleTeam = (teamId) => {
    if (selectedTeams.includes(teamId)) {
      setSelectedTeams(selectedTeams.filter(id => id !== teamId));
    } else {
      if (formData.type === 'H2H' && selectedTeams.length >= 2) {
        return; // H2H 模式下最多选 2 支，超出无视（或可做替换逻辑）
      }
      setSelectedTeams([...selectedTeams, teamId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.round) return showAlert("请填写比赛轮次！");
    if (!tournamentId && !isEditMode) return showAlert('缺少 tournamentId，无法创建比赛');

    setIsSubmitting(true);
    try {
      if (isEditMode) {
        await api.put(`/matches/${matchToEdit.id || matchToEdit.MatchID}`, {
          matchName: formData.round,
          matchType: formData.type,
          maxTeamAmount: formData.type === 'H2H' ? 2 : selectedTeams.length
        });
      } else {
        await api.post(`/tournaments/${tournamentId}/matches`, {
          matchName: formData.round,
          matchType: formData.type,
          maxTeamAmount: formData.type === 'H2H' ? 2 : selectedTeams.length,
          participants: selectedTeams
        });
      }
      showAlert(`${isEditMode ? '修改' : '新比赛'} [${formData.round}] ${isEditMode ? '已保存！' : '部署成功！'}`);
      if (onSuccess) onSuccess();
    } catch (error) {
      showAlert(error.response?.data?.error || `${isEditMode ? '修改' : '部署'}比赛失败`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 辅助函数：根据 ID 获取队名
  const getTeamName = (id) => {
    const team = enrolledTeams.find(t => t.id === id || t.TeamID === id);
    return team?.name || team?.TeamName || 'UNKNOWN';
  };

  return (
    <div className={`${embedded ? '' : 'min-h-full bg-gray-100'} text-gray-900 font-sans ${embedded ? '' : 'p-6 md:p-12'} selection:bg-black selection:text-yellow-300 pb-32`}>
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-in { animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      <div className={`${embedded ? '' : 'max-w-6xl mx-auto'} animate-slide-in`}>
 
        {/* === 顶部头部 === */}
        <div className="border-b-4 border-black pb-6 mb-10 flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-yellow-400 text-black text-[10px] font-black px-2 py-1  tracking-widest flex items-center gap-2">
                {!isEditMode && <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>}
                {isEditMode ? 'MATCH MODIFICATION' : 'MATCH DEPLOYMENT'}
              </span>
              <span className="text-gray-500 font-bold text-xs  tracking-widest truncate max-w-xs md:max-w-md">
                {tournamentName}
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter ">
              {isEditMode ? 'Edit Match.' : 'Deploy Match.'}
            </h1>
          </div>
          
          <button 
            type="button" onClick={onCancel}
            className="text-xs font-bold  tracking-widest text-gray-400 hover:text-black transition-colors"
          >
            ← {isEditMode ? 'ABORT EDIT' : 'ABORT DEPLOYMENT'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* ========================================== */}
          {/* 左侧：比赛核心参数与预览 */}
          {/* ========================================== */}
          <div className="lg:col-span-7 space-y-8 flex flex-col">
            
            {/* 1. 结构与排期 */}
            <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0_0_#000]">
              <div className="flex justify-between items-center mb-6">
                <label className="block text-xs font-black  tracking-widest text-black">
                  01. MATCH PROTOCOL (比赛协议)
                </label>
              </div>

              {/* 比赛类型切换 */}
              <div className="flex gap-4 mb-8">
                <button
                  type="button"
                  onClick={() => handleTypeChange('H2H')}
                  className={`flex-1 py-4 border-2 font-black  tracking-widest text-xs transition-all flex flex-col items-center gap-1 ${
                    formData.type === 'H2H' ? 'border-black bg-black text-yellow-300' : 'border-gray-200 text-gray-400 hover:border-black hover:text-black'
                  }`}
                >
                  <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M4 4l16 16m0-16L4 20"></path></svg>
                  <span>Head-to-Head (1v1)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('LOBBY')}
                  className={`flex-1 py-4 border-2 font-black  tracking-widest text-xs transition-all flex flex-col items-center gap-1 ${
                    formData.type === 'LOBBY' ? 'border-black bg-black text-yellow-300' : 'border-gray-200 text-gray-400 hover:border-black hover:text-black'
                  }`}
                >
                  <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                  <span>Multi-Squad Lobby</span>
                </button>
              </div>

              {/* 轮次与时间 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500  tracking-widest mb-2">Round / Phase (轮次)</label>
                  <input 
                    type="text" required placeholder="e.g. 半决赛 / A组突围赛"
                    value={formData.round} onChange={e => setFormData({...formData, round: e.target.value})}
                    className="w-full border-b-4 border-gray-200 py-2 font-bold  transition-colors bg-transparent outline-none focus:border-yellow-400"
                  />
                </div>
                <div className="border-l-2 border-dashed border-gray-200 pl-6 flex flex-col justify-center">
                  <label className="block text-[10px] font-bold text-gray-500  tracking-widest mb-2">Schedule (排期状态)</label>
                  {/* 🚀 如果已有确认的时间，高亮展示；否则展示等待约赛 */}
                  {matchToEdit?.time ? (
                    <p className="text-sm font-black text-black  tracking-widest mt-1">
                      {matchToEdit.time}
                      <br/><span className="text-[10px] text-green-600 font-bold opacity-80">(已定档)</span>
                    </p>
                  ) : (
                    <p className="text-xs font-bold text-gray-400  tracking-widest mt-1">
                      PENDING NEGOTIATION
                      <br/><span className="text-[10px] opacity-80">(由参赛队长约赛定档)</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 2. 对阵预览雷达图 */}
            <div className="bg-gray-50 border-2 border-black p-6 shadow-[4px_4px_0_0_#000] flex-1 flex flex-col">
              <label className="block text-xs font-black  tracking-widest text-black mb-6">
                02. ENGAGEMENT PREVIEW (对阵预览)
              </label>

              {/* H2H 预览视图 */}
              {formData.type === 'H2H' && (
                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex items-center justify-between gap-4">
                    <div className={`flex-1 h-24 border-2 flex items-center justify-center font-black  text-center px-2 transition-colors ${selectedTeams[0] ? 'border-black bg-white text-black' : 'border-dashed border-gray-300 text-gray-400 bg-transparent'}`}>
                      {selectedTeams[0] ? getTeamName(selectedTeams[0]) : 'TBD (待定)'}
                    </div>
                    <div className="font-black text-gray-300 text-2xl  tracking-widest">VS</div>
                    <div className={`flex-1 h-24 border-2 flex items-center justify-center font-black  text-center px-2 transition-colors ${selectedTeams[1] ? 'border-black bg-white text-black' : 'border-dashed border-gray-300 text-gray-400 bg-transparent'}`}>
                      {selectedTeams[1] ? getTeamName(selectedTeams[1]) : 'TBD (待定)'}
                    </div>
                  </div>
                  <p className="text-center text-[10px] font-bold text-gray-400  mt-6 tracking-widest">
                    You can leave slots as "TBD" if teams are not yet determined.
                  </p>
                </div>
              )}

              {/* LOBBY 预览视图 */}
              {formData.type === 'LOBBY' && (
                <div className="flex-1 flex flex-col">
                  <div className="flex flex-wrap gap-2 content-start flex-1">
                    {selectedTeams.length === 0 ? (
                      <div className="w-full h-24 border-2 border-dashed border-gray-300 flex items-center justify-center">
                        <span className="font-bold text-xs text-gray-400  tracking-widest">NO SQUADS ASSIGNED YET.</span>
                      </div>
                    ) : selectedTeams.map(id => (
                      <div key={id} className="bg-black text-white px-3 py-1.5 text-[10px] font-bold  tracking-widest animate-fade-in">
                        {getTeamName(id)}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] font-bold text-gray-400  mt-4 tracking-widest border-t border-gray-200 pt-4">
                    TOTAL SQUADS ASSIGNED: <span className="text-black text-sm">{selectedTeams.length}</span>
                  </p>
                </div>
              )}
            </div>
            
          </div>

          {/* ========================================== */}
          {/* 右侧：参赛名单选择器 */}
          {/* ========================================== */}
          <div className="lg:col-span-5 space-y-8 flex flex-col">
            <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0_0_#000] flex-1 flex flex-col max-h-[600px]">
              <div className="flex justify-between items-center mb-6 border-b-2 border-black pb-4">
                <label className="block text-xs font-black  tracking-widest text-black">
                  03. ASSIGN COMBATANTS (指派队伍)
                </label>
                <span className="text-[10px] font-bold bg-yellow-100 text-yellow-800 px-2 py-1  tracking-widest">
                  {formData.type === 'H2H' ? 'MAX 2 SQUADS' : 'UNLIMITED'}
                </span>
              </div>

              {/* 名单选择列表 */}
              <div className="flex-1 overflow-y-auto pr-2 space-y-2 hide-scrollbar">
                {enrolledTeams.map(team => {
                  const isSelected = selectedTeams.includes(team.id);
                  const isDisabled = !isSelected && formData.type === 'H2H' && selectedTeams.length >= 2;

                  return (
                    <button
                      key={team.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleToggleTeam(team.id)}
                      className={`w-full text-left p-3 border-2 transition-all flex items-center justify-between group ${
                        isSelected 
                        ? 'border-black bg-yellow-300 text-black' 
                        : isDisabled 
                          ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-black'
                      }`}
                    >
                      <div>
                        <p className={`font-bold  text-sm ${isSelected ? 'text-black' : 'text-gray-700'}`}>
                          {team.name}
                        </p>
                        <p className={`text-[10px] font-bold  tracking-widest mt-1 ${isSelected ? 'text-gray-700' : 'text-gray-400'}`}>
                          CPT: {team.captain}
                        </p>
                      </div>
                      
                      {/* Checkbox 状态指示 */}
                      <div className={`w-5 h-5 border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'border-black bg-black text-white' : 'border-gray-300 group-hover:border-black'
                      }`}>
                        {isSelected && <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="square" d="M5 13l4 4L19 7"></path></svg>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 提交按钮 */}
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-black text-yellow-400 py-6 font-black  tracking-widest text-lg hover:bg-yellow-400 hover:text-black transition-colors flex items-center justify-center gap-3 relative overflow-hidden shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (isEditMode ? 'UPDATING...' : 'DEPLOYING...') : (isEditMode ? 'SAVE CHANGES' : 'INITIALIZE MATCH')}
              {!isSubmitting && <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="square" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}