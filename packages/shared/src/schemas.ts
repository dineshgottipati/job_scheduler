import { z } from 'zod';
import { Role, RetryPolicyType } from './types.js';

export const RegisterUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2)
});

export const LoginUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/)
});

export const AddOrganizationMemberSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(Role)
});

export const CreateProjectSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  description: z.string().optional()
});

export const CreateRetryPolicySchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(2),
  type: z.nativeEnum(RetryPolicyType),
  maxAttempts: z.number().int().min(1).max(50),
  baseDelaySeconds: z.number().int().min(1),
  maxDelaySeconds: z.number().int().min(1)
});

export const CreateQueueSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(2).regex(/^[a-zA-Z0-9_-]+$/),
  description: z.string().optional(),
  priority: z.number().int().default(5),
  maxConcurrency: z.number().int().min(1).default(5),
  retryPolicyId: z.string().uuid().optional()
});

export const UpdateQueueSchema = z.object({
  description: z.string().optional(),
  priority: z.number().int().optional(),
  maxConcurrency: z.number().int().min(1).optional(),
  isPaused: z.boolean().optional(),
  retryPolicyId: z.string().uuid().optional().nullable()
});

export const CreateJobSchema = z.object({
  queueId: z.string().uuid(),
  name: z.string().min(1),
  payload: z.record(z.any()).default({}),
  priority: z.number().int().optional(),
  maxAttempts: z.number().int().min(1).optional(),
  scheduledAt: z.string().datetime().optional(), // ISO timestamp
  timeoutSeconds: z.number().int().optional()
});

export const BatchCreateJobsSchema = z.object({
  queueId: z.string().uuid(),
  jobs: z.array(z.object({
    name: z.string().min(1),
    payload: z.record(z.any()).default({}),
    priority: z.number().int().optional(),
    scheduledAt: z.string().datetime().optional(),
    idempotencyKey: z.string().optional()
  })).min(1).max(100)
});

export const CreateScheduledJobSchema = z.object({
  queueId: z.string().uuid(),
  name: z.string().min(1),
  payload: z.record(z.any()).default({}),
  cronExpression: z.string().min(5),
  timezone: z.string().default('UTC'),
  priority: z.number().int().default(5),
  maxAttempts: z.number().int().min(1).default(3)
});

export const ListJobsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  projectId: z.string().uuid().optional(),
  queueId: z.string().uuid().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  workerId: z.string().uuid().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional()
});
