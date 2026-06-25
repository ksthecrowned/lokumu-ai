'use client';

import { useEffect, useState } from 'react';
import { CommunityStats as CommunityStatsType, fetchCommunityStats } from '../../lib/api';

export function CommunityStats() {
  const [stats, setStats] = useState<CommunityStatsType | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const next = await fetchCommunityStats();
        if (mounted) setStats(next);
      } catch {
        if (mounted) setStats(null);
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  if (!stats || stats.totalContributions === 0) {
    return <span>Corpus culturel chargé</span>;
  }

  return <span>{stats.approved} corrections de la communauté</span>;
}
