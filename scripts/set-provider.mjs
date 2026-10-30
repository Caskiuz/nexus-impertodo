import fs from 'node:fs';

// Local dev uses SQLite (file:./dev.db). Vercel/Neon uses PostgreSQL.
// This script rewrites the datasource provider before `prisma generate` / `db push`.
try {
  process.loadEnvFile('.env');
} catch {
  /* no .env (Vercel provides real env vars) */
}

const schemaPath = new URL('../prisma/schema.prisma', import.meta.url);
const url = process.env.DATABASE_URL || 'file:./dev.db';
const provider = url.startsWith('file:') ? 'sqlite' : 'postgresql';

let schema = fs.readFileSync(schemaPath, 'utf8');
const next = schema.replace(/(datasource db \{[^}]*?provider\s*=\s*)"(sqlite|postgresql)"/, `$1"${provider}"`);
if (next !== schema) {
  fs.writeFileSync(schemaPath, next);
  console.log(`Prisma datasource provider -> ${provider}`);
} else {
  console.log(`Prisma datasource provider already ${provider}`);
}
