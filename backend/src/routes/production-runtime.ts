import type { FastifyInstance } from 'fastify';
import { productionRuntime } from '../production-runtime/index.js';

export async function registerProductionRuntimeRoutes(app: FastifyInstance) {
  app.get('/production-runtime/status', async () => productionRuntime.status());
  app.post('/production-runtime/verify', async () => productionRuntime.status());
}
