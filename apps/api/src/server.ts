import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { authRoutes } from './routes/auth.js';
import { organizationRoutes } from './routes/organizations.js';
import { projectRoutes } from './routes/projects.js';
import { queueRoutes } from './routes/queues.js';
import { jobRoutes } from './routes/jobs.js';
import { scheduledJobRoutes } from './routes/scheduledJobs.js';
import { dlqRoutes } from './routes/dlq.js';
import { workerRoutes } from './routes/workers.js';
import { registerWsClient } from './services/websocket.js';
import { startCronScheduler } from './services/cronScheduler.js';
import { getPrismaClient } from '@job-scheduler/database';

export async function buildServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      formatters: {
        level: (label) => ({ level: label })
      }
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId'
  });

  // Attach request ID decorator
  fastify.addHook('onRequest', async (request) => {
    request.requestId = (request.headers['x-request-id'] as string) || request.id;
  });

  // CORS
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true
  });

  // JWT Auth plugin
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'super-secret-jwt-key-development-32-chars-minimum'
  });

  // Rate Limiting
  await fastify.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute'
  });

  // Swagger Documentation
  await fastify.register(swagger, {
    swagger: {
      info: {
        title: 'Distributed Job Scheduling Platform API',
        description: 'Production-inspired REST & WebSocket API specification',
        version: '1.0.0'
      },
      securityDefinitions: {
        bearerAuth: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header'
        }
      }
    }
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/documentation'
  });

  // WebSockets
  await fastify.register(websocket);

  fastify.register(async function (wsServer) {
    wsServer.get('/ws', { websocket: true }, (connection) => {
      const socket = (connection as any)?.socket || connection;
      registerWsClient(socket);
    });
  });

  // Custom Error Handler
  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    const code = (error as any).code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');

    fastify.log.error({ err: error, requestId: request.requestId }, 'API Error Handler');

    reply.status(statusCode).send({
      error: {
        code,
        message: error.message || 'An unexpected error occurred',
        requestId: request.requestId,
        details: (error as any).details
      }
    });
  });

  // Health and Readiness endpoints
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  fastify.get('/ready', async (request, reply) => {
    try {
      const prisma = getPrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', database: 'connected' };
    } catch (err) {
      reply.status(503).send({ status: 'unready', database: 'disconnected' });
    }
  });

  // Register API routes with prefix /api/v1
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(organizationRoutes, { prefix: '/api/v1/organizations' });
  await fastify.register(projectRoutes, { prefix: '/api/v1/projects' });
  await fastify.register(queueRoutes, { prefix: '/api/v1/queues' });
  await fastify.register(jobRoutes, { prefix: '/api/v1/jobs' });
  await fastify.register(scheduledJobRoutes, { prefix: '/api/v1/scheduled-jobs' });
  await fastify.register(dlqRoutes, { prefix: '/api/v1/dlq' });
  await fastify.register(workerRoutes, { prefix: '/api/v1/workers' });

  // Start background cron scheduler
  startCronScheduler();

  return fastify;
}
