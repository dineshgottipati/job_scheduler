import { FastifyInstance } from 'fastify';
import { getPrismaClient, Role } from '@job-scheduler/database';
import { CreateOrganizationSchema, AddOrganizationMemberSchema } from '@job-scheduler/shared';
import { authenticate } from '../middleware/auth.js';
import { verifyOrganizationMember } from '../middleware/rbac.js';

export async function organizationRoutes(fastify: FastifyInstance) {
  const prisma = getPrismaClient();

  fastify.addHook('preHandler', authenticate);

  // GET /api/v1/organizations
  fastify.get('/', async (request, reply) => {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: (request as any).user!.userId },
      include: { organization: true }
    });

    return reply.send({
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
        createdAt: m.organization.createdAt.toISOString()
      }))
    });
  });

  // POST /api/v1/organizations
  fastify.post('/', async (request, reply) => {
    const parseResult = CreateOrganizationSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid organization input',
          details: parseResult.error.flatten(),
          requestId: request.requestId
        }
      });
    }

    const { name, slug } = parseResult.data;

    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      return reply.status(409).send({
        error: {
          code: 'SLUG_EXISTS',
          message: 'An organization with this slug already exists',
          requestId: request.requestId
        }
      });
    }

    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        members: {
          create: {
            userId: (request as any).user!.userId,
            role: Role.OWNER
          }
        }
      }
    });

    return reply.status(201).send({ organization: org });
  });

  // GET /api/v1/organizations/:id/members
  fastify.get('/:id/members', async (request, reply) => {
    const { id } = request.params as { id: string };
    const allowed = await verifyOrganizationMember(request, reply, id);
    if (!allowed) return;

    const members = await prisma.organizationMember.findMany({
      where: { organizationId: id },
      include: {
        user: {
          select: { id: true, email: true, name: true, createdAt: true }
        }
      }
    });

    return reply.send({ members });
  });

  // POST /api/v1/organizations/:id/members
  fastify.post('/:id/members', async (request, reply) => {
    const { id } = request.params as { id: string };
    const allowed = await verifyOrganizationMember(request, reply, id, [Role.OWNER, Role.ADMIN]);
    if (!allowed) return;

    const parseResult = AddOrganizationMemberSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid member invitation input',
          details: parseResult.error.flatten(),
          requestId: request.requestId
        }
      });
    }

    const { email, role } = parseResult.data;

    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) {
      return reply.status(4404).send({
        error: {
          code: 'USER_NOT_FOUND',
          message: `User with email ${email} not found. Target user must register first.`,
          requestId: request.requestId
        }
      });
    }

    const member = await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: id,
          userId: targetUser.id
        }
      },
      update: { role },
      create: {
        organizationId: id,
        userId: targetUser.id,
        role
      },
      include: {
        user: { select: { id: true, email: true, name: true } }
      }
    });

    return reply.status(201).send({ member });
  });
}
