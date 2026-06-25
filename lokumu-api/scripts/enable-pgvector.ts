import 'dotenv/config';
import { spawnSync } from 'child_process';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

const parsed = new URL(url);
const result = spawnSync(
  'psql',
  [
    '-h',
    parsed.hostname,
    '-p',
    parsed.port || '5432',
    '-U',
    decodeURIComponent(parsed.username),
    '-d',
    parsed.pathname.replace(/^\//, '').split('?')[0],
    '-f',
    'scripts/enable-pgvector.sql',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      PGPASSWORD: decodeURIComponent(parsed.password),
    },
    shell: process.platform === 'win32',
  },
);

process.exit(result.status ?? 1);
