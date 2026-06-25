'use client';

import { useEffect, useState } from 'react';
import { CommunityStats as CommunityStatsType, fetchCommunityStats } from '../../lib/api';

export function CommunityStats() {
  const [stats, setStats] = useState<CommunityStatsType>({
    totalContributions: 0,
    approved: 0,
    pending: 0,
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const next = await fetchCommunityStats();
        if (mounted) {
          setStats(next);
        }
      } catch {
        // keep last known value when API is unavailable
      }
    };

    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 15_000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-white p-3 text-center shadow-soft">
      <StatCard label="Total" value={stats.totalContributions} />
      <StatCard label="Approved" value={stats.approved} />
      <StatCard label="Pending" value={stats.pending} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
