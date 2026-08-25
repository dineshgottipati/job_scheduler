import { FastifyRequest, FastifyReply } from 'fastify';

export interface AuthUser {
  userId: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser;
    requestId?: string;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid Authorization header',
          requestId: request.requestId
        }
      });
    }

    const payload = await request.jwtVerify<AuthUser>();
    (request as any).user = payload;
    request.authUser = payload;
  } catch (err) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired authentication token',
        requestId: request.requestId
      }
    });
  }
}
