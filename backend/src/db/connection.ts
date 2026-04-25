import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://axon:axon@localhost:5432/axon';
const CONNECT_TIMEOUT_SECONDS = Number(process.env.DATABASE_CONNECT_TIMEOUT_SECONDS || 2);
const HEALTH_TIMEOUT_MS = Number(process.env.DATABASE_HEALTH_TIMEOUT_MS || 750);
const HEALTH_CACHE_MS = Number(process.env.DATABASE_HEALTH_CACHE_MS || 5000);

let lastHealthCheck: { checkedAt: number; healthy: boolean } | null = null;

export const sql = postgres(DATABASE_URL, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: CONNECT_TIMEOUT_SECONDS,
  transform: {
    undefined: null,
  },
});

export async function checkConnection(): Promise<boolean> {
  const now = Date.now();
  if (lastHealthCheck && now - lastHealthCheck.checkedAt < HEALTH_CACHE_MS) {
    return lastHealthCheck.healthy;
  }

  try {
    await Promise.race([
      sql`SELECT 1`,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database health check timed out')), HEALTH_TIMEOUT_MS);
      }),
    ]);
    lastHealthCheck = { checkedAt: Date.now(), healthy: true };
    return true;
  } catch {
    lastHealthCheck = { checkedAt: Date.now(), healthy: false };
    return false;
  }
}

export async function closeConnection(): Promise<void> {
  await sql.end();
}
