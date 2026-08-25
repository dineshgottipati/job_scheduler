import { FastifyRequest, FastifyReply } from 'fastify';
import { getPrismaClient, Role } from '@job-scheduler/database';

export async function verifyOrganizationMember(
  request: FastifyRequest,
  reply: FastifyReply,
  organizationId: string,
  requiredRoles: any[] = [Role.OWNER, Role.ADMIN, Role.MEMBER]
): Promise<boolean> {
  const user = (request as any).user;
  if (!user || !user.userId) {
    reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        requestId: request.requestId
      }
    });
    return false;
  }

  const prisma = getPrismaClient();
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: user.userId
      }
    }
  });

  if (!membership || !requiredRoles.includes(membership.role)) {
    reply.status(403).send({
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to access resources in this organization',
        requestId: request.requestId
      }
    });
    return false;
  }

  return true;
}

export async function verifyProjectAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  projectId: string,
  requiredRoles: any[] = [Role.OWNER, Role.ADMIN, Role.MEMBER]
): Promise<boolean> {
  const prisma = getPrismaClient();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true }
  });

  if (!project) {
    reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Project not found',
        requestId: request.requestId
      }
    });
    return false;
  }

  return verifyOrganizationMember(request, reply, project.organizationId, requiredRoles);
}

export async function verifyQueueAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  queueId: string,
  requiredRoles: any[] = [Role.OWNER, Role.ADMIN, Role.MEMBER]
): Promise<boolean> {
  const prisma = getPrismaClient();
  const queue = await prisma.queue.findUnique({
    where: { id: queueId },
    select: { projectId: true }
  });

  if (!queue) {
    reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Queue not found',
        requestId: request.requestId
      }
    });
    return false;
  }

  return verifyProjectAccess(request, reply, queue.projectId, requiredRoles);
}
