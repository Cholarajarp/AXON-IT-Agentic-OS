import type { FastifyInstance } from 'fastify';
import { checkConnection } from '../db/connection.js';

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health/live', async () => ({
    status: 'live',
    timestamp: new Date().toISOString(),
    services: {
      api: 'running',
    },
  }));

  app.get('/health', async (_req, reply) => {
    const dbHealthy = await checkConnection();
    const status = dbHealthy ? 'healthy' : 'degraded';
    reply.status(200).send({
      status,
      timestamp: new Date().toISOString(),
      liveness: 'live',
      readiness: dbHealthy ? 'ready' : 'not-ready',
      services: {
        database: dbHealthy ? 'connected' : 'disconnected',
        api: 'running',
      },
      readyUrl: '/api/v1/health/ready',
    });
  });

  app.get('/health/ready', async (_req, reply) => {
    const dbHealthy = await checkConnection();
    reply.status(dbHealthy ? 200 : 503).send({
      status: dbHealthy ? 'ready' : 'not-ready',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? 'connected' : 'disconnected',
        api: 'running',
      },
    });
  });
}
