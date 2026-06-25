'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchHealth, HealthStatus } from '../../lib/api';

const STATUS_STYLES: Record<HealthStatus['status'], string> = {
  ok: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  degraded: 'bg-amber-100 text-amber-700 border-amber-300',
  down: 'bg-red-100 text-red-700 border-red-300',
};

export function OfflineBadge() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const status = await fetchHealth();
        if (!mounted) return;
        setHealth(status);
        setError(null);
      } catch {
        if (!mounted) return;
        setHealth({
          status: 'down',
          ollama: false,
          database: false,
          embeddings: false,
          chunksCount: 0,
        });
        setError('API indisponible');
      }
    };

    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 10_000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const status = useMemo(() => health?.status ?? 'down', [health]);
  const label =
    status === 'ok' ? 'Systeme pret' : status === 'degraded' ? 'Mode degrade' : 'Hors ligne';

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      <span>{label}</span>
      {error ? <span className="opacity-80">({error})</span> : null}
    </div>
  );
}
