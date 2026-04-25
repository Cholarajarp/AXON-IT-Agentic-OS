import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { workspaceSettings } from '../workspace-settings/index.js';

const workspaceSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  tenantId: z.string().min(2).max(80).optional(),
  region: z.string().min(2).max(80).optional(),
  timezone: z.string().min(2).max(80).optional(),
});

const securitySchema = z.object({
  requireSso: z.boolean().optional(),
  twoFactorAuth: z.boolean().optional(),
  tamperEvidentAuditLog: z.boolean().optional(),
  encryptedProviderStorage: z.boolean().optional(),
});

const notificationsSchema = z.object({
  emailDigests: z.boolean().optional(),
  slackAlerts: z.boolean().optional(),
  pushToMobile: z.boolean().optional(),
});

const settingsUpdateSchema = z.object({
  workspace: workspaceSchema.optional(),
  security: securitySchema.optional(),
  notifications: notificationsSchema.optional(),
}).refine((value) => Boolean(value.workspace || value.security || value.notifications), {
  message: 'At least one settings section is required',
});

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.get('/settings', async () => workspaceSettings.get());

  app.patch('/settings', async (request, reply) => {
    const parsed = settingsUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) return validationError(reply, parsed.error.issues);
    return workspaceSettings.update(parsed.data);
  });
}

function validationError(reply: FastifyReply, issues: z.ZodIssue[]) {
  return reply.status(400).send({
    message: 'Invalid workspace settings request',
    issues,
  });
}
