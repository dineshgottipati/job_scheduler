import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { getPrismaClient, Role } from '@job-scheduler/database';
import { RegisterUserSchema, LoginUserSchema } from '@job-scheduler/shared';
import { authenticate } from '../middleware/auth.js';

export async function authRoutes(fastify: FastifyInstance) {
  const prisma = getPrismaClient();

  // POST /api/v1/auth/register
  fastify.post('/register', async (request, reply) => {
    const parseResult = RegisterUserSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid registration input',
          details: parseResult.error.flatten(),
          requestId: request.requestId
        }
      });
    }

    const { email, password, name } = parseResult.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({
        error: {
          code: 'USER_EXISTS',
          message: 'A user with this email address already exists',
          requestId: request.requestId
        }
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          name
        }
      });

      // Automatically create a default organization for the user
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-org-' + Math.floor(Math.random() * 1000);
      const org = await tx.organization.create({
        data: {
          name: `${name}'s Org`,
          slug,
          members: {
            create: {
              userId: newUser.id,
              role: Role.OWNER
            }
          }
        }
      });

      // Create a default project
      const proj = await tx.project.create({
        data: {
          organizationId: org.id,
          name: 'Default Project',
          slug: 'default-project',
          description: 'Default starter project'
        }
      });

      // Create a default queue
      await tx.queue.create({
        data: {
          projectId: proj.id,
          name: 'default-queue',
          description: 'Default job queue',
          priority: 5,
          maxConcurrency: 5
        }
      });

      return newUser;
    });

    const token = fastify.jwt.sign({ userId: user.id, email: user.email });

    return reply.status(201).send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString()
      },
      token
    });
  });

  // POST /api/v1/auth/login
  fastify.post('/login', async (request, reply) => {
    const parseResult = LoginUserSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid login input',
          details: parseResult.error.flatten(),
          requestId: request.requestId
        }
      });
    }

    const { email, password } = parseResult.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          requestId: request.requestId
        }
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return reply.status(401).send({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          requestId: request.requestId
        }
      });
    }

    const token = fastify.jwt.sign({ userId: user.id, email: user.email });

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString()
      },
      token
    });
  });

  // GET /api/v1/auth/me
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request as any).user?.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        memberships: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!user) {
      return reply.status(404).send({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found',
          requestId: request.requestId
        }
      });
    }

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
        organizations: user.memberships.map((m: any) => ({
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          role: m.role,
          createdAt: m.organization.createdAt.toISOString()
        }))
      }
    });
  });
}
