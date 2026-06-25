'use client';

import { useEffect, useState } from 'react';
import { fetchHealth, HealthStatus } from '../../lib/api';

const STATUS_STYLES: Record<HealthStatus['status'], string> = {
  ok: 'bg-emerald-100 text-emerald-800',
  degraded: 'bg-amber-100 text-amber-800',
  down: 'bg-red-100 text-red-800',
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
      ? 'Local'
      : status === 'degraded'
        ? 'Dégradé'
        : 'Hors ligne';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
      title={
        status === 'down'
          ? 'API injoignable — vérifiez que lokumu-api tourne sur le port 7001'
          : undefined
      }
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
