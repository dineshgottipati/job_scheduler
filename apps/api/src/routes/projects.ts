import { FastifyInstance } from 'fastify';
import { getPrismaClient, Role } from '@job-scheduler/database';
import { CreateProjectSchema } from '@job-scheduler/shared';
import { authenticate } from '../middleware/auth.js';
import { verifyOrganizationMember, verifyProjectAccess } from '../middleware/rbac.js';

export async function projectRoutes(fastify: FastifyInstance) {
  const prisma = getPrismaClient();

  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/projects?organizationId=...
  fastify.get('/', async (request, reply) => {
    const { organizationId } = request.query as { organizationId?: string };

    if (!organizationId) {
      // Return projects for all organizations user is a member of
      const memberships = await prisma.organizationMember.findMany({
        where: { userId: (request as any).user!.userId },
        select: { organizationId: true }
      });
      const orgIds = memberships.map((m) => m.organizationId);

      const projects = await prisma.project.findMany({
        where: { organizationId: { in: orgIds } },
        orderBy: { createdAt: 'desc' }
      });
      return reply.send({ projects });
    }

    const allowed = await verifyOrganizationMember(request, reply, organizationId);
    if (!allowed) return;

    const projects = await prisma.project.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ projects });
  });

  // GET /api/v1/projects/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const allowed = await verifyProjectAccess(request, reply, id);
    if (!allowed) return;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        queues: {
          where: { deletedAt: null }
        },
        retryPolicies: true
      }
    });

    return reply.send({ project });
  });

  // POST /api/v1/projects
  fastify.post('/', async (request, reply) => {
    const parseResult = CreateProjectSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid project creation input',
          details: parseResult.error.flatten(),
          requestId: request.requestId
        }
      });
    }

    const { organizationId, name, slug, description } = parseResult.data;

    const allowed = await verifyOrganizationMember(request, reply, organizationId, [Role.OWNER, Role.ADMIN]);
    if (!allowed) return;

    const project = await prisma.project.create({
      data: {
        organizationId,
        name,
        slug,
        description
      }
    });

    return reply.status(201).send({ project });
  });
}
