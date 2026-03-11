// src/components/TeamManagement.jsx
import React, { useState } from 'react';

// === 模拟数据 (后续可替换为我们刚写的真实 API 请求) ===
const mockUsersDatabase = [
  { id: 'U001', name: 'Faker_Fan', rank: '钻石', mainRole: '中单' },
  { id: 'U002', name: 'RushB_P90', rank: '大地球', mainRole: '突破手' },
  { id: 'U003', name: 'TenZ_Clone', rank: '神话', mainRole: '决斗者' },
];

const initialTeam = {
  id: 'TM999',
  name: '清华不败之师',
  game: '三角洲行动',
  members: [
    { id: 'ME01', name: 'Captain_A', role: 'CAPTAIN', joinDate: '2026.01.01' },
    { id: 'ME02', name: 'Member_B', role: 'MEMBER', joinDate: '2026.02.15' },
    { id: 'ME03', name: 'Sniper_God', role: 'MEMBER', joinDate: '2026.03.10' }
  ]
};

const initialApplications = [
  { id: 'A01', user: { id: 'U004', name: 'Sleepy_Cat', rank: '白银', mainRole: '辅助' }, type: 'APPLY', message: "请求加入队伍！" },
  { id: 'A02', user: { id: 'U005', name: 'AimBot_Pro', rank: '神话', mainRole: '决斗者' }, type: 'INVITE_ACCEPTED', recommender: 'Member_B', message: "Member_B 邀请了我" }
];

export default function TeamManagement() {
  const [currentRole, setCurrentRole] = useState('CAPTAIN');
  const currentUser = currentRole === 'CAPTAIN' ? initialTeam.members[0] : initialTeam.members[1];

  const [myTeam, setMyTeam] = useState(initialTeam); 
  const [applications, setApplications] = useState(initialApplications);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingInvites, setPendingInvites] = useState([]);

  const handleApprove = (appId, user) => {
    setMyTeam({
      ...myTeam,
      members: [...myTeam.members, { ...user, role: 'MEMBER', joinDate: 'TODAY' }]
    });
    setApplications(applications.filter(a => a.id !== appId));
  };

  const handleReject = (appId) => {
    setApplications(applications.filter(a => a.id !== appId));
  };

  const handleKick = (memberId) => {
    setMyTeam({
      ...myTeam,
      members: myTeam.members.filter(m => m.id !== memberId)
    });
  };

  const handleLeave = () => {
    if(confirm("CONFIRM LEAVE TEAM?")) {
      setMyTeam({
        ...myTeam,
        members: myTeam.members.filter(m => m.id !== currentUser.id)
      });
      alert("You have left the team.");
    }
  };

  const handleDisband = () => {
    if(confirm("DANGER: DISBAND TEAM?")) {
      setMyTeam(null);
    }
  };

  const handleInvite = (user) => {
    if (!pendingInvites.find(u => u.id === user.id)) {
      setPendingInvites([...pendingInvites, { ...user, invitedBy: currentRole }]);
      setSearchQuery('');
    }
  };

  const searchResults = searchQuery.trim() === '' ? [] : mockUsersDatabase.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !myTeam?.members.find(m => m.id === u.id) &&
    !pendingInvites.find(p => p.id === u.id) &&
    !applications.find(a => a.user.id === u.id)
  );

  if (!myTeam) {
    return (
      <div className="min-h-[80vh] bg-white text-gray-900 font-sans p-12 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-black uppercase text-gray-300">NO ACTIVE TEAM</h1>
          <p className="font-bold text-gray-500 mt-4 tracking-widest">Return to Teams Directory to join or create one.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans p-6 md:p-12 selection:bg-[#660874] selection:text-white pb-32">
      {/* 开发者调试工具条 */}
      <div className="fixed top-0 left-0 w-full bg-yellow-300 text-black text-xs font-bold py-2 px-6 flex justify-between items-center z-50">
        <span className="uppercase tracking-widest">Dev Mode: Role Toggle</span>
        <div className="flex gap-4">
          <button onClick={() => setCurrentRole('CAPTAIN')} className={`px-3 py-1 border border-black ${currentRole === 'CAPTAIN' ? 'bg-black text-white' : ''}`}>BECOME CAPTAIN</button>
          <button onClick={() => setCurrentRole('MEMBER')} className={`px-3 py-1 border border-black ${currentRole === 'MEMBER' ? 'bg-black text-white' : ''}`}>BECOME MEMBER</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto animate-fade-in mt-12">
        <div className="flex flex-col md:flex-row justify-between md:items-end border-b-4 border-black pb-6 mb-12 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-black text-white text-[10px] font-bold px-2 py-1 uppercase tracking-widest">{myTeam.game}</span>
              <span className="text-[#660874] font-bold text-xs uppercase tracking-widest">● MY TEAM DASHBOARD</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase">{myTeam.name}</h1>
          </div>
          {currentRole === 'CAPTAIN' ? (
            <button onClick={handleDisband} className="text-xs font-bold uppercase tracking-widest text-red-500 hover:text-white hover:bg-red-500 border border-red-500 px-4 py-2 transition-colors">DISBAND SQUAD</button>
          ) : (
            <button onClick={handleLeave} className="text-xs font-bold uppercase tracking-widest text-red-500 hover:text-white hover:bg-red-500 border border-red-500 px-4 py-2 transition-colors">LEAVE SQUAD</button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <section className="lg:col-span-7 space-y-12">
            <div>
              <h2 className="text-2xl font-black tracking-tight uppercase border-b border-black pb-4 mb-6 flex justify-between items-end">
                <span>Current Roster</span>
                <span className="text-sm font-bold text-gray-400">{myTeam.members.length} MEMBERS</span>
              </h2>
              <div className="flex flex-col border-t border-black">
                {myTeam.members.map((member, index) => (
                  <div key={member.id} className="flex items-center justify-between border-b border-gray-200 py-5 group hover:bg-gray-50 px-2 transition-colors">
                    <div className="flex items-center gap-6">
                      <span className="text-3xl font-black text-gray-200 group-hover:text-gray-300 transition-colors w-8">{index < 9 ? `0${index + 1}` : index + 1}</span>
                      <div>
                        <h3 className="text-xl font-bold uppercase flex items-center gap-2">
                          {member.name}
                          {member.role === 'CAPTAIN' && <span className="bg-[#660874] text-white text-[10px] px-1.5 py-0.5 rounded-sm" title="Captain">C</span>}
                          {member.id === currentUser.id && <span className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">(YOU)</span>}
                        </h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">JOINED: {member.joinDate}</p>
                      </div>
                    </div>
                    {currentRole === 'CAPTAIN' && member.role !== 'CAPTAIN' && (
                      <button onClick={() => handleKick(member.id)} className="text-xs font-bold uppercase tracking-widest text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">KICK</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="lg:col-span-5 space-y-12">
            {currentRole === 'CAPTAIN' && (
              <section className="animate-fade-in">
                <div className="bg-gray-50 border border-black p-6 relative shadow-sm">
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#660874]"></div>
                  <h2 className="text-lg font-black tracking-tight uppercase border-b border-gray-300 pb-4 mb-4 flex justify-between items-center">
                    Pending Applications
                    {applications.length > 0 && <span className="bg-[#660874] text-white text-[10px] px-2 py-0.5">{applications.length} PENDING</span>}
                  </h2>
                  {applications.length === 0 ? (
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest py-4 text-center">NO PENDING APPLICATIONS.</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {applications.map(app => (
                        <div key={app.id} className="flex flex-col bg-white border border-gray-200 p-4 gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold uppercase text-base">{app.user.name}</span>
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border border-gray-300 px-1">{app.user.rank}</span>
                            </div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed">
                              {app.type === 'APPLY' ? `APPLIED: "${app.message}"` : `RECOMMENDED BY ${app.recommender}: "${app.message}"`}
                            </p>
                          </div>
                          <div className="flex gap-2 w-full mt-1">
                            <button onClick={() => handleApprove(app.id, app.user)} className="flex-1 bg-black text-white text-[10px] font-bold px-2 py-2 uppercase hover:bg-[#660874] transition-colors">APPROVE</button>
                            <button onClick={() => handleReject(app.id)} className="flex-1 border border-black text-black text-[10px] font-bold px-2 py-2 uppercase hover:bg-gray-100 transition-colors">REJECT</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}
            
            <section>
              <h2 className="text-xl font-bold tracking-tight uppercase border-b border-black pb-4 mb-6">Recruitment Radar</h2>
              <div className="relative group mb-6">
                <input type="text" placeholder="SEARCH BY ID OR NAME..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full border-b-2 border-gray-200 focus:border-[#660874] py-3 px-4 outline-none font-bold uppercase tracking-wider text-sm transition-colors bg-transparent"/>
              </div>
              {searchQuery && (
                <div className="bg-white border border-black p-4 max-h-64 overflow-y-auto shadow-xl absolute z-10 w-full md:w-auto left-6 right-6 md:left-auto md:right-auto md:w-[400px]">
                  {searchResults.length === 0 ? (
                    <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest py-4">NO AGENTS FOUND.</p>
                  ) : searchResults.map(user => (
                    <div key={user.id} className="flex justify-between items-center py-3 border-b border-gray-200 last:border-0">
                      <div>
                        <p className="font-bold uppercase">{user.name}</p>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{user.rank} / {user.mainRole}</p>
                      </div>
                      <button onClick={() => handleInvite(user)} className="bg-black text-white text-xs font-bold px-3 py-1.5 uppercase hover:bg-[#660874] transition-colors">
                        {currentRole === 'CAPTAIN' ? 'INVITE' : 'RECOMMEND'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xl font-bold tracking-tight uppercase border-b border-black pb-4 mb-6 flex justify-between items-center">Outgoing Invites</h2>
              <div className="flex flex-col gap-3">
                {pendingInvites.length === 0 ? (
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest py-4 border-2 border-dashed border-gray-200 text-center">NO OUTGOING INVITATIONS.</p>
                ) : pendingInvites.map(invite => (
                  <div key={invite.id} className="flex justify-between items-center border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                      <div>
                        <span className="font-bold uppercase text-sm block">{invite.name}</span>
                        {currentRole === 'CAPTAIN' && invite.invitedBy === 'MEMBER' && <span className="text-[10px] font-bold text-[#660874] uppercase">Recommended by Member</span>}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">WAITING...</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}