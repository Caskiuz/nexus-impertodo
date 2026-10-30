// Runs `prisma db push` against the DIRECT (non-pooled) Neon connection.
// Neon guidance: pooled connection for the app runtime, direct connection for schema migrations.
import { spawnSync } from 'node:child_process';

try {
  process.loadEnvFile('.env');
} catch {
  /* environments like Vercel inject variables directly */
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || 'file:./dev.db';
console.log(`prisma db push -> ${url.startsWith('file:') ? 'sqlite local' : 'direct (non-pooled) Neon connection'}`);

const result = spawnSync('npx', ['prisma', 'db', 'push'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
  shell: true
});

process.exit(result.status ?? 1);
