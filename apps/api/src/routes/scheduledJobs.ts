import { FastifyInstance } from 'fastify';
import { getPrismaClient, Role } from '@job-scheduler/database';
import { CreateScheduledJobSchema } from '@job-scheduler/shared';
import { authenticate } from '../middleware/auth.js';
import { verifyQueueAccess } from '../middleware/rbac.js';
import cronParser from 'cron-parser';

function parseJsonField(val: any) {
  if (!val) return {};
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

export async function scheduledJobRoutes(fastify: FastifyInstance) {
  const prisma = getPrismaClient();

  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/scheduled-jobs?queueId=...
  fastify.get('/', async (request, reply) => {
    const { queueId } = request.query as { queueId?: string };

    if (queueId) {
      const allowed = await verifyQueueAccess(request, reply, queueId);
      if (!allowed) return;

      const scheduledJobs = await prisma.scheduledJob.findMany({
        where: { queueId },
        orderBy: { createdAt: 'desc' }
      });
      return reply.send({
        scheduledJobs: scheduledJobs.map((item) => ({
          ...item,
          payload: parseJsonField(item.payload)
        }))
      });
    }

    // All scheduled jobs user has access to
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: (request as any).user!.userId },
      select: { organizationId: true }
    });
    const orgIds = memberships.map((m) => m.organizationId);

    const scheduledJobs = await prisma.scheduledJob.findMany({
      where: {
        queue: { project: { organizationId: { in: orgIds } } }
      },
      include: {
        queue: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({
      scheduledJobs: scheduledJobs.map((item) => ({
        ...item,
        payload: parseJsonField(item.payload)
      }))
    });
  });

  // POST /api/v1/scheduled-jobs - Create recurring cron job
  fastify.post('/', async (request, reply) => {
    const parseResult = CreateScheduledJobSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid scheduled job payload',
          details: parseResult.error.flatten(),
          requestId: request.requestId
        }
      });
    }

    const { queueId, name, payload, cronExpression, timezone, priority, maxAttempts } = parseResult.data;

    const allowed = await verifyQueueAccess(request, reply, queueId, [Role.OWNER, Role.ADMIN]);
    if (!allowed) return;

    let nextRunAt: Date;
    try {
      const interval = cronParser.parseExpression(cronExpression, { tz: timezone });
      nextRunAt = interval.next().toDate();
    } catch (err) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_CRON',
          message: `Invalid cron expression "${cronExpression}". Example valid format: "0 0 * * *" or "*/15 * * * *"`,
          requestId: request.requestId
        }
      });
    }

    const scheduledJob = await prisma.scheduledJob.create({
      data: {
        queueId,
        name,
        payload: typeof payload === 'string' ? payload : JSON.stringify(payload || {}),
        cronExpression,
        timezone,
        priority: priority ?? 5,
        maxAttempts: maxAttempts ?? 3,
        nextRunAt
      }
    });

    return reply.status(201).send({
      scheduledJob: {
        ...scheduledJob,
        payload: parseJsonField(scheduledJob.payload)
      }
    });
  });

  // DELETE /api/v1/scheduled-jobs/:id
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const item = await prisma.scheduledJob.findUnique({ where: { id } });
    if (!item) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Scheduled job not found',
          requestId: request.requestId
        }
      });
    }

    const allowed = await verifyQueueAccess(request, reply, item.queueId, [Role.OWNER, Role.ADMIN]);
    if (!allowed) return;

    await prisma.scheduledJob.delete({ where: { id } });

    return reply.send({ message: 'Scheduled job deleted successfully' });
  });
}
