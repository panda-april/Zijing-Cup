import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  const [error, setError] = useState(null);
  const fetchedRef = useRef(false);
  const fetchIdRef = useRef(0);

  const fetchAll = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const [tourRes, teamRes, recentRes, upcomingRes, gamesRes] =
        await Promise.allSettled([
          api.get('/tournaments', { signal }),
          api.get('/teams', { signal }),
          api.get('/matches/recent', { signal }),
          api.get('/matches/upcoming', { signal }),
          api.get('/games', { signal }),
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
      if (error?.name !== 'CanceledError' && error?.code !== 'ERR_CANCELED') {
        console.error('[usePublicData] fetch failed:', error);
        setError('加载数据失败，请检查网络连接');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (gameFilter = 'ALL') => {
    setHistoryFilter(gameFilter);
    const fetchId = ++fetchIdRef.current;
    try {
      const query = gameFilter !== 'ALL' ? `?game=${encodeURIComponent(gameFilter)}` : '';
      const res = await api.get(`/matches/history${query}`);
      if (fetchId !== fetchIdRef.current) return;
      if (res.data.success) {
        setHistoryMatches(res.data.data);
      }
    } catch (error) {
      if (fetchId !== fetchIdRef.current) return;
      console.error('获取历史战绩失败:', error);
      setError('加载历史战绩失败');
    }
  }, []);

  // Initial fetch on mount with abort on unmount
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      const controller = new AbortController();
      fetchAll(controller.signal);
      return () => controller.abort();
    }
  }, [fetchAll]);

  return useMemo(() => ({
    tournaments,
    teams,
    recentMatches,
    upcomingMatches,
    historyMatches,
    gameFilters,
    historyFilter,
    loading,
    error,
    refreshAll: fetchAll,
    fetchHistory,
  }), [tournaments, teams, recentMatches, upcomingMatches, historyMatches, gameFilters, historyFilter, loading, error, fetchAll, fetchHistory]);
}
