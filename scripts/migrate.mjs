import { spawnSync } from 'node:child_process';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !/^postgres(ql)?:\/\//.test(databaseUrl)) {
  console.error('Set a PostgreSQL DATABASE_URL in .env.local.');
  process.exit(2);
}
const result = spawnSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', 'apps/api/migrations/0001_initial.sql'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
