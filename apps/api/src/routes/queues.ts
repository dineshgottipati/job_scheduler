import { FastifyInstance } from 'fastify';
import { getPrismaClient, JobStatus, Role } from '@job-scheduler/database';
import { CreateQueueSchema, UpdateQueueSchema } from '@job-scheduler/shared';
import { authenticate } from '../middleware/auth.js';
import { verifyProjectAccess, verifyQueueAccess } from '../middleware/rbac.js';
import { broadcastWsEvent } from '../services/websocket.js';

export async function queueRoutes(fastify: FastifyInstance) {
  const prisma = getPrismaClient();

  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/queues?projectId=...
  fastify.get('/', async (request, reply) => {
    const { projectId } = request.query as { projectId?: string };

    if (projectId) {
      const allowed = await verifyProjectAccess(request, reply, projectId);
      if (!allowed) return;

      const queues = await prisma.queue.findMany({
        where: { projectId, deletedAt: null },
        include: { retryPolicy: true },
        orderBy: { createdAt: 'desc' }
      });
      return reply.send({ queues });
    }

    // Otherwise return all queues user has access to across orgs
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: (request as any).user!.userId },
      select: { organizationId: true }
    });
    const orgIds = memberships.map((m) => m.organizationId);

    const queues = await prisma.queue.findMany({
      where: {
        deletedAt: null,
        project: { organizationId: { in: orgIds } }
      },
      include: {
        project: { select: { id: true, name: true } },
        retryPolicy: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ queues });
  });

  // GET /api/v1/queues/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const allowed = await verifyQueueAccess(request, reply, id);
    if (!allowed) return;

    const queue = await prisma.queue.findUnique({
      where: { id },
      include: {
        project: true,
        retryPolicy: true
      }
    });

    if (!queue || queue.deletedAt) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Queue not found',
          requestId: request.requestId
        }
      });
    }

    return reply.send({ queue });
  });

  // GET /api/v1/queues/:id/stats
  fastify.get('/:id/stats', async (request, reply) => {
    const { id } = request.params as { id: string };
    const allowed = await verifyQueueAccess(request, reply, id);
    if (!allowed) return;

    const [
      queued,
      scheduled,
      running,
      completed,
      failed,
      deadLettered,
      executions
    ] = await Promise.all([
      prisma.job.count({ where: { queueId: id, status: JobStatus.QUEUED } }),
      prisma.job.count({ where: { queueId: id, status: JobStatus.SCHEDULED } }),
      prisma.job.count({ where: { queueId: id, status: JobStatus.RUNNING } }),
      prisma.job.count({ where: { queueId: id, status: JobStatus.COMPLETED } }),
      prisma.job.count({ where: { queueId: id, status: JobStatus.FAILED } }),
      prisma.job.count({ where: { queueId: id, status: JobStatus.DEAD_LETTER } }),
      prisma.jobExecution.findMany({
        where: { job: { queueId: id } },
        select: { durationMs: true, status: true, completedAt: true },
        take: 500,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const totalFinished = completed + failed + deadLettered;
    const successRatePercentage = totalFinished > 0 ? Math.round((completed / totalFinished) * 100) : 100;

    const completedExecutions = executions.filter((e) => e.durationMs !== null);
    const avgDurationMs = completedExecutions.length > 0
      ? Math.round(completedExecutions.reduce((acc, e) => acc + (e.durationMs || 0), 0) / completedExecutions.length)
      : 0;

    // Throughput per minute over last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 600000);
    const recentCompletedCount = executions.filter(
      (e) => e.status === 'COMPLETED' && e.completedAt && e.completedAt >= tenMinutesAgo
    ).length;
    const throughputPerMinute = Math.round((recentCompletedCount / 10) * 10) / 10;

    const stats = {
      queued,
      scheduled,
      running,
      completed,
      failed,
      deadLettered,
      throughputPerMinute,
      successRatePercentage,
      avgDurationMs
    };

    return reply.send({ stats });
  });

  // POST /api/v1/queues
  fastify.post('/', async (request, reply) => {
    const parseResult = CreateQueueSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid queue creation input',
          details: parseResult.error.flatten(),
          requestId: request.requestId
        }
      });
    }

    const { projectId, name, description, priority, maxConcurrency, retryPolicyId } = parseResult.data;

    const allowed = await verifyProjectAccess(request, reply, projectId, [Role.OWNER, Role.ADMIN]);
    if (!allowed) return;

    const existing = await prisma.queue.findFirst({
      where: { projectId, name, deletedAt: null }
    });
    if (existing) {
      return reply.status(409).send({
        error: {
          code: 'QUEUE_EXISTS',
          message: `A queue with name "${name}" already exists in this project`,
          requestId: request.requestId
        }
      });
    }

    const queue = await prisma.queue.create({
      data: {
        projectId,
        name,
        description,
        priority,
        maxConcurrency,
        retryPolicyId
      },
      include: { retryPolicy: true }
    });

    broadcastWsEvent('QUEUE_STATS_UPDATED', { queueId: queue.id, action: 'CREATED' });

    return reply.status(201).send({ queue });
  });

  // PATCH /api/v1/queues/:id
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const allowed = await verifyQueueAccess(request, reply, id, [Role.OWNER, Role.ADMIN]);
    if (!allowed) return;

    const parseResult = UpdateQueueSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid queue update payload',
          details: parseResult.error.flatten(),
          requestId: request.requestId
        }
      });
    }

    const queue = await prisma.queue.update({
      where: { id },
      data: parseResult.data,
      include: { retryPolicy: true }
    });

    broadcastWsEvent('QUEUE_STATS_UPDATED', { queueId: queue.id, isPaused: queue.isPaused });

    return reply.send({ queue });
  });

  // POST /api/v1/queues/:id/pause
  fastify.post('/:id/pause', async (request, reply) => {
    const { id } = request.params as { id: string };
    const allowed = await verifyQueueAccess(request, reply, id, [Role.OWNER, Role.ADMIN]);
    if (!allowed) return;

    const queue = await prisma.queue.update({
      where: { id },
      data: { isPaused: true }
    });

    broadcastWsEvent('QUEUE_STATS_UPDATED', { queueId: id, isPaused: true });

    return reply.send({ queue });
  });

  // POST /api/v1/queues/:id/resume
  fastify.post('/:id/resume', async (request, reply) => {
    const { id } = request.params as { id: string };
    const allowed = await verifyQueueAccess(request, reply, id, [Role.OWNER, Role.ADMIN]);
    if (!allowed) return;

    const queue = await prisma.queue.update({
      where: { id },
      data: { isPaused: false }
    });

    broadcastWsEvent('QUEUE_STATS_UPDATED', { queueId: id, isPaused: false });

    return reply.send({ queue });
  });

  // DELETE /api/v1/queues/:id (Soft deletion)
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const allowed = await verifyQueueAccess(request, reply, id, [Role.OWNER, Role.ADMIN]);
    if (!allowed) return;

    await prisma.queue.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    return reply.send({ message: 'Queue soft-deleted successfully' });
  });
}
