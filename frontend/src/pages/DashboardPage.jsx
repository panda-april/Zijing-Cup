import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePublicData } from '../hooks/usePublicData';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { tournaments, recentMatches, upcomingMatches, loading } = usePublicData();

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-center py-20 text-gray-400 font-bold tracking-widest">LOADING...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 animate-fade-in">
        <section className="lg:col-span-8">
          <div className="border-b border-black pb-4 mb-8">
            <h2 className="text-3xl font-black tracking-tight">Tournaments</h2>
          </div>
          <div className="flex flex-col">
            {tournaments.length === 0 ? (
              <p className="py-10 text-gray-400 font-bold tracking-widest text-sm text-center">
                No Tournaments Yet.
              </p>
            ) : (
              tournaments.map((t) => (
                <div
                  key={t.TournamentID}
                  className="border-b border-gray-200 py-8 group cursor-pointer hover:bg-gray-50 px-2 transition-colors"
                  onClick={() => navigate(`/tournaments/${t.TournamentID}`)}
                >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-3">
                    <h3 className="text-2xl font-bold group-hover:underline underline-offset-4 decoration-2">
                      {t.TournamentName}
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold border border-black px-2 py-1">
                        {t.Game?.GameName || '未指定'}
                      </span>
                      <span className="text-xs font-bold px-2 py-1 bg-black text-white">报名中</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium">
                    <p className="text-gray-500">
                      最高规模: <span className="text-black font-bold">{t.MaxTeamSize || 0} 支队伍</span>
                    </p>
                    <span className="text-black opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                      Details →
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="lg:col-span-4 space-y-16">
          <section>
            <h2 className="text-xl font-bold border-b border-black pb-4 mb-6">Recent Results</h2>
            <div className="flex flex-col border-t border-gray-100">
              {recentMatches.length === 0 ? (
                <p className="py-6 text-gray-400 font-bold tracking-widest text-xs text-center">
                  No Recent Results.
                </p>
              ) : (
                recentMatches.map((m) => (
                  <div key={m.id} className="py-4 border-b border-gray-100">
                    <p className="text-[10px] text-gray-400 font-bold mb-2">
                      {m.tournament} / {m.time}
                    </p>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-sm ${m.winnerA ? 'font-bold text-black' : 'text-gray-400'}`}>
                        {m.teamA}
                      </span>
                      <span className={`font-black ${m.winnerA ? 'text-[#660874]' : 'text-gray-300'}`}>
                        {m.scoreA ?? '-'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`text-sm ${m.winnerA === false ? 'font-bold text-black' : 'text-gray-400'}`}>
                        {m.teamB}
                      </span>
                      <span className={`font-black ${m.winnerA === false ? 'text-[#660874]' : 'text-gray-300'}`}>
                        {m.scoreB ?? '-'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold border-b border-black pb-4 mb-6">Upcoming Matches</h2>
            <div className="flex flex-col border-t border-gray-100">
              {upcomingMatches.length === 0 ? (
                <p className="py-6 text-gray-400 font-bold tracking-widest text-xs text-center">
                  No Upcoming Matches.
                </p>
              ) : (
                upcomingMatches.map((m) => (
                  <div key={m.id} className="py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] font-bold bg-black text-white px-2 py-0.5 tracking-wider">
                        {m.time}
                      </span>
                      <span className="text-xs text-gray-500 font-bold truncate">{m.tournament}</span>
                    </div>
                    <div className="flex flex-col gap-1 mt-3 text-sm font-bold">
                      <span className="text-black">{m.teamA}</span>
                      <span className="text-[10px] text-gray-400 font-medium">vs</span>
                      <span className="text-black">{m.teamB}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
