export enum Role {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER'
}

export enum QueuePriority {
  LOW = 0,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 20
}

export enum RetryPolicyType {
  FIXED = 'FIXED',
  LINEAR = 'LINEAR',
  EXPONENTIAL = 'EXPONENTIAL'
}

export enum JobStatus {
  QUEUED = 'QUEUED',
  SCHEDULED = 'SCHEDULED',
  CLAIMED = 'CLAIMED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER'
}

export enum ExecutionStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export enum WorkerStatus {
  ACTIVE = 'ACTIVE',
  STOPPED = 'STOPPED',
  STALE = 'STALE'
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  role?: Role;
  createdAt: string;
}

export interface OrganizationMemberDto {
  id: string;
  organizationId: string;
  userId: string;
  role: Role;
  user?: UserDto;
  createdAt: string;
}

export interface ProjectDto {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt: string;
}

export interface RetryPolicyDto {
  id: string;
  projectId: string;
  name: string;
  type: RetryPolicyType;
  maxAttempts: number;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
  createdAt: string;
}

export interface QueueDto {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  priority: number;
  maxConcurrency: number;
  isPaused: boolean;
  retryPolicyId?: string | null;
  retryPolicy?: RetryPolicyDto | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  stats?: QueueStatsDto;
}

export interface QueueStatsDto {
  queued: number;
  scheduled: number;
  running: number;
  completed: number;
  failed: number;
  deadLettered: number;
  throughputPerMinute: number;
  successRatePercentage: number;
  avgDurationMs: number;
}

export interface JobDto {
  id: string;
  queueId: string;
  name: string;
  payload: Record<string, any>;
  result?: Record<string, any> | null;
  error?: Record<string, any> | null;
  priority: number;
  status: JobStatus;
  attemptCount: number;
  maxAttempts: number;
  scheduledAt: string;
  claimedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  leaseExpiresAt?: string | null;
  workerId?: string | null;
  idempotencyKey?: string | null;
  timeoutSeconds?: number | null;
  createdAt: string;
  updatedAt: string;
  queueName?: string;
  projectName?: string;
}

export interface JobExecutionDto {
  id: string;
  jobId: string;
  workerId: string;
  attemptNumber: number;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  error?: Record<string, any> | null;
  output?: Record<string, any> | null;
  createdAt: string;
}

export interface JobLogDto {
  id: string;
  executionId: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface ScheduledJobDto {
  id: string;
  queueId: string;
  name: string;
  payload: Record<string, any>;
  cronExpression: string;
  timezone: string;
  priority: number;
  maxAttempts: number;
  isPaused: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  createdAt: string;
}

export interface WorkerDto {
  id: string;
  name: string;
  hostname: string;
  concurrency: number;
  status: WorkerStatus;
  startedAt: string;
  stoppedAt?: string | null;
  lastHeartbeatAt: string;
  createdAt: string;
  activeJobsCount?: number;
}

export interface DeadLetterEntryDto {
  id: string;
  jobId: string;
  queueId: string;
  reason: string;
  failedAt: string;
  errorDetails?: Record<string, any> | null;
  isResolved: boolean;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
  job?: JobDto;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: any;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface WsEvent<T = any> {
  event: 'JOB_UPDATED' | 'QUEUE_STATS_UPDATED' | 'WORKER_HEARTBEAT' | 'DLQ_ENTRY_ADDED';
  data: T;
  timestamp: string;
}
