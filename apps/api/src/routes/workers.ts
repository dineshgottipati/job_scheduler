import { FastifyInstance } from 'fastify';
import { getPrismaClient, WorkerStatus } from '@job-scheduler/database';
import { authenticate } from '../middleware/auth.js';

export async function workerRoutes(fastify: FastifyInstance) {
  const prisma = getPrismaClient();

  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/workers - List active and stale worker nodes
  fastify.get('/', async (request, reply) => {
    const sixtySecondsAgo = new Date(Date.now() - 60000);

    // Auto-update status of workers with outdated heartbeats to STALE
    await prisma.worker.updateMany({
      where: {
        status: WorkerStatus.ACTIVE,
        lastHeartbeatAt: { lt: sixtySecondsAgo }
      },
      data: { status: WorkerStatus.STALE }
    });

    const workers = await prisma.worker.findMany({
      orderBy: { lastHeartbeatAt: 'desc' },
      include: {
        _count: {
          select: {
            jobs: { where: { status: 'RUNNING' } }
          }
        },
        executions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            job: { select: { id: true, name: true, status: true } }
          }
        }
      }
    });

    const formatted = workers.map((w) => {
      const latestExec = w.executions[0];
      let lastExecutedJob = 'Idle (-)';
      if (latestExec && latestExec.job) {
        const jobStatus = latestExec.status.toLowerCase();
        lastExecutedJob = `${latestExec.job.name} (${jobStatus})`;
      }

      return {
        id: w.id,
        name: w.name,
        hostname: w.hostname,
        concurrency: w.concurrency,
        status: w.status,
        startedAt: w.startedAt.toISOString(),
        stoppedAt: w.stoppedAt?.toISOString() || null,
        lastHeartbeatAt: w.lastHeartbeatAt.toISOString(),
        createdAt: w.createdAt.toISOString(),
        activeJobsCount: w._count.jobs,
        lastExecutedJob
      };
    });

    return reply.send({ workers: formatted });
  });

  // POST /api/v1/workers - Manually register / add a worker node
  fastify.post('/', async (request, reply) => {
    const body = (request.body as any) || {};
    const name = body.name ? String(body.name).trim() : `worker-${Math.floor(Math.random() * 1000)}`;
    const hostname = body.hostname ? String(body.hostname).trim() : 'local';
    const concurrency = body.concurrency ? parseInt(body.concurrency, 10) : 5;

    const worker = await prisma.worker.create({
      data: {
        name,
        hostname,
        concurrency,
        status: WorkerStatus.ACTIVE,
        startedAt: new Date(),
        lastHeartbeatAt: new Date()
      }
    });

    return reply.status(201).send({ worker });
  });

  // POST /api/v1/workers/:id/stop - Stop a worker node
  fastify.post('/:id/stop', async (request, reply) => {
    const { id } = request.params as { id: string };

    const worker = await prisma.worker.update({
      where: { id },
      data: {
        status: WorkerStatus.STOPPED,
        stoppedAt: new Date()
      }
    });

    return reply.send({ message: 'Worker node stopped', worker });
  });

  // DELETE /api/v1/workers/:id - Remove / delete a worker node
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    await prisma.worker.delete({
      where: { id }
    });

    return reply.send({ message: 'Worker node removed successfully' });
  });

  // GET /api/v1/workers/:id/heartbeats - Heartbeat metrics history
  fastify.get('/:id/heartbeats', async (request, reply) => {
    const { id } = request.params as { id: string };

    const heartbeats = await prisma.workerHeartbeat.findMany({
      where: { workerId: id },
      take: 100,
      orderBy: { recordedAt: 'desc' }
    });

    return reply.send({ heartbeats });
  });
}
