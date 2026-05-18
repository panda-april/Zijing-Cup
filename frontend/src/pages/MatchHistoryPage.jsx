import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePublicData } from '../hooks/usePublicData';

export default function MatchHistoryPage() {
  const navigate = useNavigate();
  const { historyMatches, gameFilters, historyFilter, loading, error, fetchHistory } = usePublicData();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    fetchHistory(historyFilter);
  }, [historyFilter, fetchHistory]);

  const filtered = historyMatches.filter((h) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      h.teamA.toLowerCase().includes(q) ||
      h.teamB.toLowerCase().includes(q) ||
      h.tournament.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-center py-20 text-gray-400 font-bold tracking-widest">LOADING...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-center py-20 text-red-600 font-bold">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="animate-fade-in">
        <div className="border-b border-black pb-4 mb-8">
          <h2 className="text-3xl font-black tracking-tight">History</h2>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="w-full md:w-1/2 relative group">
            <input
              type="text"
              placeholder="SEARCH HISTORY..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border-b-2 border-gray-200 focus:border-black py-2 pl-2 pr-4 outline-none font-bold tracking-wider text-sm transition-colors bg-transparent"
            />
          </div>
          <div className="relative w-full md:w-auto">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full md:w-auto flex items-center justify-between gap-6 border border-black bg-white px-4 py-3 font-bold text-xs"
            >
              <span>
                GAME:{' '}
                <span className={historyFilter !== 'ALL' ? 'text-[#660874]' : ''}>{historyFilter}</span>
              </span>
              <span>↓</span>
            </button>
            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                <div className="absolute top-full right-0 w-full md:w-48 bg-white border border-black z-30 mt-1 max-h-48 overflow-y-auto shadow-xl">
                  {gameFilters.map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        fetchHistory(g);
                        setIsDropdownOpen(false);
                      }}
                      className={`block w-full text-left px-4 py-3 text-xs font-bold hover:bg-gray-100 border-b border-gray-100 ${
                        historyFilter === g ? 'bg-black text-white' : ''
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
            <div className="py-20 text-center text-gray-400 font-medium tracking-widest">No Matches Found.</div>
          ) : (
            filtered.map((h) => (
            <div key={h.id} className="border-b border-gray-100 py-8 group hover:bg-gray-50 transition-colors px-2">
              <div className="text-[10px] font-bold text-gray-400 mb-4 space-x-2">
                <span className="text-black border border-black px-1">{h.game}</span>
                <span>{h.date}</span>
                <span>/</span>
                <span className="text-black">{h.tournament}</span>
              </div>
              <div className="flex items-center gap-8">
                <span className={`text-2xl font-black flex-1 text-right ${h.scoreA > h.scoreB ? 'text-black' : 'text-gray-300'}`}>
                  {h.teamA}
                </span>
                <div className="bg-gray-100 px-6 py-2 text-3xl font-black flex gap-4">
                  <span className={h.scoreA > h.scoreB ? 'text-[#660874]' : 'text-gray-400'}>{h.scoreA}</span>
                  <span className="text-gray-300">-</span>
                  <span className={h.scoreB > h.scoreA ? 'text-[#660874]' : 'text-gray-400'}>{h.scoreB}</span>
                </div>
                <span className={`text-2xl font-black flex-1 ${h.scoreB > h.scoreA ? 'text-black' : 'text-gray-300'}`}>
                  {h.teamB}
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
