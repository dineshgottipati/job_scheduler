import { FastifyInstance } from 'fastify';
import { getPrismaClient, JobStatus, Role } from '@job-scheduler/database';
import { authenticate } from '../middleware/auth.js';
import { verifyQueueAccess } from '../middleware/rbac.js';
import { broadcastWsEvent } from '../services/websocket.js';

export async function dlqRoutes(fastify: FastifyInstance) {
  const prisma = getPrismaClient();

  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/dlq - List dead-lettered entries
  fastify.get('/', async (request, reply) => {
    const { queueId, isResolved } = request.query as { queueId?: string; isResolved?: string };

    const where: any = {};

    if (queueId) {
      const allowed = await verifyQueueAccess(request, reply, queueId);
      if (!allowed) return;
      where.queueId = queueId;
    } else {
      const memberships = await prisma.organizationMember.findMany({
        where: { userId: (request as any).user!.userId },
        select: { organizationId: true }
      });
      const orgIds = memberships.map((m) => m.organizationId);
      where.queue = { project: { organizationId: { in: orgIds } } };
    }

    if (isResolved !== undefined) {
      where.isResolved = isResolved === 'true';
    }

    const entries = await prisma.deadLetterEntry.findMany({
      where,
      include: {
        job: true,
        queue: { select: { id: true, name: true, project: { select: { id: true, name: true } } } }
      },
      orderBy: { failedAt: 'desc' }
    });

    return reply.send({ dlqEntries: entries });
  });

  // POST /api/v1/dlq/:id/retry - Requeue DLQ job for retry
  fastify.post('/:id/retry', async (request, reply) => {
    const { id } = request.params as { id: string };

    const entry = await prisma.deadLetterEntry.findUnique({
      where: { id },
      include: { job: true }
    });

    if (!entry) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Dead Letter Queue entry not found',
          requestId: request.requestId
        }
      });
    }

    const allowed = await verifyQueueAccess(request, reply, entry.queueId, [Role.OWNER, Role.ADMIN]);
    if (!allowed) return;

    await prisma.$transaction(async (tx) => {
      // Reset job status to QUEUED
      await tx.job.update({
        where: { id: entry.jobId },
        data: {
          status: JobStatus.QUEUED,
          scheduledAt: new Date(),
          maxAttempts: entry.job.maxAttempts + 1,
          error: null,
          workerId: null,
          leaseExpiresAt: null
        }
      });

      // Remove from DLQ
      await tx.deadLetterEntry.delete({ where: { id } });
    });

    broadcastWsEvent('JOB_UPDATED', { jobId: entry.jobId, status: JobStatus.QUEUED, action: 'DLQ_RETRY' });

    return reply.send({ message: 'DLQ job requeued successfully for execution' });
  });

  // POST /api/v1/dlq/:id/resolve - Mark DLQ entry as resolved
  fastify.post('/:id/resolve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { resolutionNotes } = (request.body as any) || {};

    const entry = await prisma.deadLetterEntry.findUnique({ where: { id } });
    if (!entry) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Dead Letter Queue entry not found',
          requestId: request.requestId
        }
      });
    }

    const allowed = await verifyQueueAccess(request, reply, entry.queueId, [Role.OWNER, Role.ADMIN]);
    if (!allowed) return;

    const updated = await prisma.deadLetterEntry.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolutionNotes: resolutionNotes || 'Resolved manually by admin'
      }
    });

    return reply.send({ dlqEntry: updated });
  });
}
