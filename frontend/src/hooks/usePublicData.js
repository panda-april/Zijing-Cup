import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';

export function usePublicData() {
  const [tournaments, setTournaments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [historyMatches, setHistoryMatches] = useState([]);
  const [gameFilters, setGameFilters] = useState(['ALL']);
  const [historyFilter, setHistoryFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tourRes, teamRes, recentRes, upcomingRes, gamesRes] =
        await Promise.allSettled([
          api.get('/tournaments'),
          api.get('/teams'),
          api.get('/matches/recent'),
          api.get('/matches/upcoming'),
          api.get('/games'),
        ]);

      if (tourRes.status === 'fulfilled' && tourRes.value.data?.success) {
        setTournaments(tourRes.value.data.data);
      }
      if (teamRes.status === 'fulfilled' && teamRes.value.data?.success) {
        setTeams(teamRes.value.data.data);
      }
      if (recentRes.status === 'fulfilled' && recentRes.value.data?.success) {
        setRecentMatches(recentRes.value.data.data);
      }
      if (upcomingRes.status === 'fulfilled' && upcomingRes.value.data?.success) {
        setUpcomingMatches(upcomingRes.value.data.data);
      }
      if (gamesRes.status === 'fulfilled' && gamesRes.value.data?.success) {
        setGameFilters(['ALL', ...gamesRes.value.data.data.map((g) => g.GameName)]);
      }
    } catch (error) {
      console.error('[usePublicData] fetch failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (gameFilter = 'ALL') => {
    setHistoryFilter(gameFilter);
    try {
      const query = gameFilter !== 'ALL' ? `?game=${encodeURIComponent(gameFilter)}` : '';
      const res = await api.get(`/matches/history${query}`);
      if (res.data.success) {
        setHistoryMatches(res.data.data);
      }
    } catch (error) {
      console.error('获取历史战绩失败:', error);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchAll();
    }
  }, [fetchAll]);

  return {
    tournaments,
    teams,
    recentMatches,
    upcomingMatches,
    historyMatches,
    gameFilters,
    historyFilter,
    loading,
    refreshAll: fetchAll,
    fetchHistory,
  };
}
