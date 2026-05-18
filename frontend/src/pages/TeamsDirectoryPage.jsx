import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePublicData } from '../hooks/usePublicData';
import { useAuth } from '../hooks/useAuth';

export default function TeamsDirectoryPage() {
  const navigate = useNavigate();
  const { teams, gameFilters, loading, error } = usePublicData();
  const { isLoggedIn } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  const filtered = teams.filter(t => {
    const matchesSearch =
      !searchQuery.trim() ||
      t.TeamName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGame =
      activeFilter === 'ALL' ||
      (t.Game?.GameName || '未指定') === activeFilter;
    return matchesSearch && matchesGame;
  });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-center py-20 text-gray-400 font-bold tracking-widest">LOADING...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between md:items-end border-b border-black pb-4 mb-8 gap-4">
          <h2 className="text-3xl font-black tracking-tight">Teams Directory</h2>
          {isLoggedIn && (
            <button
              onClick={() => navigate('/teams/create')}
              className="bg-[#660874] text-white px-6 py-2 font-bold text-sm hover:opacity-90 transition-opacity w-fit"
            >
              + 组建新队伍
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="w-full md:w-1/2 relative group">
            <input
              type="text"
              placeholder="SEARCH TEAMS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border-b-2 border-gray-200 focus:border-black py-2 pl-2 pr-4 outline-none font-bold tracking-wider text-sm transition-colors bg-transparent"
            />
          </div>
          <div className="relative w-full md:w-auto">
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="w-full md:w-auto flex items-center justify-between gap-6 border border-black bg-white px-4 py-3 font-bold text-xs"
            >
              <span>
                GAME:{' '}
                <span className={activeFilter !== 'ALL' ? 'text-[#660874]' : ''}>{activeFilter}</span>
              </span>
              <span>↓</span>
            </button>
            {isFilterDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsFilterDropdownOpen(false)}></div>
                <div className="absolute top-full right-0 w-full md:w-48 bg-white border border-black z-30 mt-1 max-h-48 overflow-y-auto shadow-xl">
                  {gameFilters.map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        setActiveFilter(g);
                        setIsFilterDropdownOpen(false);
                      }}
                      className={`block w-full text-left px-4 py-3 text-xs font-bold hover:bg-gray-100 border-b border-gray-100 ${
                        activeFilter === g ? 'bg-black text-white' : ''
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-black">
          {filtered.length === 0 ? (
            <div className="py-20 text-center text-gray-400 font-medium tracking-widest">No Teams Found.</div>
          ) : (
            filtered.map((t) => (
              <div
                key={t.TeamID}
                className="border-b border-gray-200 py-6 flex flex-col md:flex-row justify-between md:items-center gap-6 group hover:bg-gray-50 px-2 transition-colors cursor-pointer"
                onClick={() => navigate(`/teams/${t.TeamID}`)}
              >
                <div className="flex-1">
                  <h3 className="text-2xl font-black mb-2 group-hover:underline underline-offset-4 decoration-2">
                    {t.TeamName}
                  </h3>
                  <div className="text-[10px] font-bold text-gray-400 space-x-4 tracking-wider">
                    <span className="text-black border border-black px-1">{t.Game?.GameName || '未指定'}</span>
                  </div>
                </div>
                <div className="flex items-center md:justify-end md:w-1/3">
                  <span className="text-sm font-bold tracking-wider text-black opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    VIEW DETAILS →
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
