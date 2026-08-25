import { PrismaClient } from '@prisma/client';

let globalPrisma: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (!globalPrisma) {
    globalPrisma = new PrismaClient();
  }
  return globalPrisma;
}

export const Role = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER'
} as const;

export const RetryPolicyType = {
  FIXED: 'FIXED',
  LINEAR: 'LINEAR',
  EXPONENTIAL: 'EXPONENTIAL'
} as const;

export const JobStatus = {
  QUEUED: 'QUEUED',
  SCHEDULED: 'SCHEDULED',
  CLAIMED: 'CLAIMED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  DEAD_LETTER: 'DEAD_LETTER'
} as const;

export const ExecutionStatus = {
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
} as const;

export const LogLevel = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
} as const;

export const WorkerStatus = {
  ACTIVE: 'ACTIVE',
  STOPPED: 'STOPPED',
  STALE: 'STALE'
} as const;

export * from '@prisma/client';
