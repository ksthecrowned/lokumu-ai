'use client';

import { useEffect, useState } from 'react';
import { fetchHealth, HealthStatus } from '../../lib/api';

const STATUS_STYLES: Record<HealthStatus['status'], string> = {
  ok: 'bg-emerald-500/15 text-emerald-400',
  degraded: 'bg-amber-500/15 text-amber-400',
  down: 'bg-red-500/15 text-red-400',
};

export function OfflineBadge() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const status = await fetchHealth();
        if (mounted) setHealth(status);
      } catch {
        if (mounted) setHealth(null);
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), 10_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const status = health?.status ?? 'down';
  const label =
    status === 'ok'
      ? 'En ligne'
      : status === 'degraded'
        ? 'Degrade'
        : 'Hors ligne';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium sm:text-xs ${STATUS_STYLES[status]}`}
      title={
        status === 'down'
          ? 'API injoignable — verifiez que lokumu-api tourne sur le port 7001'
          : undefined
      }
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
