import { spawnSync } from 'node:child_process';

if (process.env.FIXTURES_ENABLED !== 'true') {
  console.error('Refusing to seed. Set FIXTURES_ENABLED=true explicitly for a development database.');
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(2);
}
const result = spawnSync('psql', [process.env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-f', 'apps/api/fixtures/development.sql'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
