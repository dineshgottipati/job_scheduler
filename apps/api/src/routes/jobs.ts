import { FastifyInstance } from 'fastify';
import { getPrismaClient, JobStatus, Role } from '@job-scheduler/database';
import { CreateJobSchema, BatchCreateJobsSchema, ListJobsQuerySchema } from '@job-scheduler/shared';
import { authenticate } from '../middleware/auth.js';
import { verifyQueueAccess, verifyProjectAccess } from '../middleware/rbac.js';
import { broadcastWsEvent } from '../services/websocket.js';
import { defaultAiSummaryProvider } from '../services/aiSummary.js';

function parseJsonField(val: any) {
  if (!val) return null;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

function formatJob(j: any) {
  return {
    ...j,
    payload: parseJsonField(j.payload) || {},
    result: parseJsonField(j.result),
    error: parseJsonField(j.error),
    queueName: j.queue?.name,
    projectName: j.queue?.project?.name
  };
}

export async function jobRoutes(fastify: FastifyInstance) {
  const prisma = getPrismaClient();

  fastify.addHook('preHandler', authenticate);

  // POST /api/v1/jobs - Submit single job with optional Idempotency-Key
  fastify.post('/', async (request, reply) => {
    const idempotencyKey = (request.headers['idempotency-key'] as string) || (request.body as any)?.idempotencyKey;

    if (idempotencyKey) {
      const existingJob = await prisma.job.findUnique({
        where: { idempotencyKey },
        include: { queue: true }
      });
      if (existingJob) {
        return reply.status(200).send({
          job: formatJob(existingJob),
          idempotentDuplicate: true
        });
      }
    }

    const parseResult = CreateJobSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid job creation payload',
          details: parseResult.error.flatten(),
          requestId: request.requestId
        }
      });
    }

    const { queueId, name, payload, priority, maxAttempts, scheduledAt, timeoutSeconds } = parseResult.data;

    const allowed = await verifyQueueAccess(request, reply, queueId);
    if (!allowed) return;

    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
      include: { retryPolicy: true }
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

    if (queue.isPaused) {
      return reply.status(400).send({
        error: {
          code: 'QUEUE_PAUSED',
          message: `Jobs cannot be added while queue "${queue.name}" is paused.`,
          requestId: request.requestId
        }
      });
    }

    const targetScheduledAt = scheduledAt ? new Date(scheduledAt) : new Date();
    const initialStatus = targetScheduledAt.getTime() > Date.now() + 1000 ? JobStatus.SCHEDULED : JobStatus.QUEUED;
    const finalMaxAttempts = maxAttempts || queue.retryPolicy?.maxAttempts || 3;
    const finalPriority = priority ?? queue.priority;

    const job = await prisma.job.create({
      data: {
        queueId,
        name,
        payload: typeof payload === 'string' ? payload : JSON.stringify(payload || {}),
        priority: finalPriority,
        maxAttempts: finalMaxAttempts,
        status: initialStatus,
        scheduledAt: targetScheduledAt,
        idempotencyKey: idempotencyKey || null,
        timeoutSeconds: timeoutSeconds || null
      },
      include: {
        queue: { select: { id: true, name: true } }
      }
    });

    broadcastWsEvent('JOB_UPDATED', { jobId: job.id, status: job.status, queueId });

    return reply.status(201).send({ job: formatJob(job) });
  });

  // POST /api/v1/jobs/batch
  fastify.post('/batch', async (request, reply) => {
    const parseResult = BatchCreateJobsSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid batch job payload',
          details: parseResult.error.flatten(),
          requestId: request.requestId
        }
      });
    }

    const { queueId, jobs } = parseResult.data;

    const allowed = await verifyQueueAccess(request, reply, queueId);
    if (!allowed) return;

    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
      include: { retryPolicy: true }
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

    if (queue.isPaused) {
      return reply.status(400).send({
        error: {
          code: 'QUEUE_PAUSED',
          message: `Jobs cannot be added while queue "${queue.name}" is paused.`,
          requestId: request.requestId
        }
      });
    }

    const createdJobs = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of jobs) {
        if (item.idempotencyKey) {
          const existing = await tx.job.findUnique({ where: { idempotencyKey: item.idempotencyKey } });
          if (existing) {
            results.push(formatJob(existing));
            continue;
          }
        }

        const targetScheduledAt = item.scheduledAt ? new Date(item.scheduledAt) : new Date();
        const initialStatus = targetScheduledAt.getTime() > Date.now() + 1000 ? JobStatus.SCHEDULED : JobStatus.QUEUED;

        const job = await tx.job.create({
          data: {
            queueId,
            name: item.name,
            payload: JSON.stringify(item.payload || {}),
            priority: item.priority ?? queue.priority,
            maxAttempts: queue.retryPolicy?.maxAttempts || 3,
            status: initialStatus,
            scheduledAt: targetScheduledAt,
            idempotencyKey: item.idempotencyKey || null
          }
        });
        results.push(formatJob(job));
      }
      return results;
    });

    broadcastWsEvent('JOB_UPDATED', { count: createdJobs.length, queueId });

    return reply.status(201).send({ jobs: createdJobs });
  });

  // GET /api/v1/jobs - Filterable, paginated search
  fastify.get('/', async (request, reply) => {
    const parseResult = ListJobsQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: parseResult.error.flatten(),
          requestId: request.requestId
        }
      });
    }

    const { page, pageSize, projectId, queueId, status, search, workerId, fromDate, toDate } = parseResult.data;

    const where: any = {};

    if (queueId) {
      const allowed = await verifyQueueAccess(request, reply, queueId);
      if (!allowed) return;
      where.queueId = queueId;
    } else if (projectId) {
      const allowed = await verifyProjectAccess(request, reply, projectId);
      if (!allowed) return;
      where.queue = { projectId };
    } else {
      const memberships = await prisma.organizationMember.findMany({
        where: { userId: (request as any).user!.userId },
        select: { organizationId: true }
      });
      const orgIds = memberships.map((m) => m.organizationId);
      where.queue = { project: { organizationId: { in: orgIds } } };
    }

    if (status) {
      where.status = status as any;
    }

    if (workerId) {
      where.workerId = workerId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { id: { contains: search } }
      ];
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    const skip = (page - 1) * pageSize;

    const [total, jobs] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          queue: {
            select: { id: true, name: true, project: { select: { id: true, name: true } } }
          },
          worker: {
            select: { id: true, name: true }
          }
        }
      })
    ]);

    const formatted = jobs.map(formatJob);

    return reply.send({
      data: formatted,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  });

  // GET /api/v1/jobs/:id - Details with executions and logs
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        queue: {
          select: { id: true, name: true, projectId: true, project: { select: { organizationId: true, name: true } } }
        },
        worker: { select: { id: true, name: true } },
        executions: {
          orderBy: { attemptNumber: 'desc' },
          include: {
            worker: { select: { id: true, name: true } },
            logs: { orderBy: { createdAt: 'asc' } }
          }
        },
        deadLetter: true
      }
    });

    if (!job) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found',
          requestId: request.requestId
        }
      });
    }

    const allowed = await verifyQueueAccess(request, reply, job.queueId);
    if (!allowed) return;

    const formattedJob = {
      ...formatJob(job),
      executions: job.executions.map((e) => ({
        ...e,
        output: parseJsonField(e.output),
        error: parseJsonField(e.error)
      }))
    };

    return reply.send({ job: formattedJob });
  });

  // POST /api/v1/jobs/:id/retry
  fastify.post('/:id/retry', async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await prisma.job.findUnique({
      where: { id },
      include: { queue: true }
    });

    if (!job) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found',
          requestId: request.requestId
        }
      });
    }

    const allowed = await verifyQueueAccess(request, reply, job.queueId, [Role.OWNER, Role.ADMIN]);
    if (!allowed) return;

    if (job.status !== JobStatus.FAILED && job.status !== JobStatus.DEAD_LETTER) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_JOB_STATE',
          message: `Only FAILED or DEAD_LETTER jobs can be retried manually. Current status: ${job.status}`,
          requestId: request.requestId
        }
      });
    }

    const updatedJob = await prisma.$transaction(async (tx) => {
      const updated = await tx.job.update({
        where: { id },
        data: {
          status: JobStatus.QUEUED,
          scheduledAt: new Date(),
          maxAttempts: job.maxAttempts + 1,
          error: null,
          workerId: null,
          leaseExpiresAt: null
        }
      });

      await tx.deadLetterEntry.deleteMany({
        where: { jobId: id }
      });

      return updated;
    });

    broadcastWsEvent('JOB_UPDATED', { jobId: id, status: JobStatus.QUEUED, action: 'MANUAL_RETRY' });

    return reply.send({
      message: 'Job requeued successfully for manual retry',
      job: formatJob(updatedJob)
    });
  });

  // GET /api/v1/jobs/:id/ai-summary
  fastify.get('/:id/ai-summary', async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        queue: true,
        executions: {
          include: { logs: true },
          orderBy: { attemptNumber: 'desc' }
        }
      }
    });

    if (!job) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found',
          requestId: request.requestId
        }
      });
    }

    const allowed = await verifyQueueAccess(request, reply, job.queueId);
    if (!allowed) return;

    const allLogs = job.executions.flatMap((e) => e.logs.map((l) => `[${l.level}] ${l.message}`));

    const summaryResult = await defaultAiSummaryProvider.generateFailureSummary({
      jobName: job.name,
      queueName: job.queue.name,
      attempts: job.attemptCount,
      errorDetails: parseJsonField(job.error),
      logs: allLogs
    });

    return reply.send({ aiSummary: summaryResult });
  });
}
