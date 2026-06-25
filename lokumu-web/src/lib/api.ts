export type HealthStatus = {
  status: 'ok' | 'degraded' | 'down';
  ollama: boolean;
  database: boolean;
  embeddings: boolean;
  chunksCount: number;
};

export type CommunityStats = {
  totalContributions: number;
  approved: number;
  pending: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_URL}/health`, { cache: 'no-store' });
  return parseJson<HealthStatus>(response);
}

export async function fetchCommunityStats(): Promise<CommunityStats> {
  const response = await fetch(`${API_URL}/community/stats`, { cache: 'no-store' });
  return parseJson<CommunityStats>(response);
}
