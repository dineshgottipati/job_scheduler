import { getPrismaClient, JobStatus } from '@job-scheduler/database';

export interface ClaimedJob {
  id: string;
  queueId: string;
  name: string;
  payload: any;
  priority: number;
  attemptCount: number;
  maxAttempts: number;
  timeoutSeconds: number | null;
  queue: {
    id: string;
    name: string;
    maxConcurrency: number;
    retryPolicy: {
      type: any;
      baseDelaySeconds: number;
      maxDelaySeconds: number;
      maxAttempts: number;
    } | null;
  };
}

export class JobClaimer {
  private workerId: string;
  private leaseDurationSeconds: number;

  constructor(workerId: string, leaseDurationSeconds = 30) {
    this.workerId = workerId;
    this.leaseDurationSeconds = leaseDurationSeconds;
  }

  /**
   * Atomically claims up to limit eligible jobs from active non-paused queues.
   */
  async claimJobs(limit = 1): Promise<ClaimedJob[]> {
    const prisma = getPrismaClient();

    try {
      return await prisma.$transaction(async (tx: any) => {
        const now = new Date();

        // 1. Fetch active queues that are not paused and not deleted
        const activeQueues = await tx.queue.findMany({
          where: {
            isPaused: false,
            deletedAt: null
          },
          include: {
            retryPolicy: true
          }
        });

        if (activeQueues.length === 0) {
          return [];
        }

        const eligibleQueueIds: string[] = [];

        // 2. Filter queues honoring queue-level maxConcurrency limits
        for (const queue of activeQueues) {
          const currentRunningCount = await tx.job.count({
            where: {
              queueId: queue.id,
              status: { in: [JobStatus.CLAIMED, JobStatus.RUNNING] }
            }
          });

          if (currentRunningCount < queue.maxConcurrency) {
            eligibleQueueIds.push(queue.id);
          }
        }

        if (eligibleQueueIds.length === 0) {
          return [];
        }

        // 3. Query due QUEUED jobs
        const eligibleJobs = await tx.job.findMany({
          where: {
            status: JobStatus.QUEUED,
            scheduledAt: { lte: now },
            queueId: { in: eligibleQueueIds }
          },
          orderBy: [
            { priority: 'desc' },
            { scheduledAt: 'asc' },
            { createdAt: 'asc' }
          ],
          take: limit
        });

        if (eligibleJobs.length === 0) {
          return [];
        }

        const jobIdsToClaim = eligibleJobs.map((j: any) => j.id);
        const leaseExpiresAt = new Date(now.getTime() + this.leaseDurationSeconds * 1000);

        // 4. Update selected jobs to RUNNING status
        await tx.job.updateMany({
          where: { id: { in: jobIdsToClaim } },
          data: {
            status: JobStatus.RUNNING,
            workerId: this.workerId,
            claimedAt: now,
            startedAt: now,
            leaseExpiresAt,
            attemptCount: { increment: 1 }
          }
        });

        // 5. Retrieve claimed jobs with relations
        const claimedJobs = await tx.job.findMany({
          where: { id: { in: jobIdsToClaim } },
          include: {
            queue: {
              include: {
                retryPolicy: true
              }
            }
          }
        });

        // Helper to parse JSON fields
        const parsedJobs = claimedJobs.map((j: any) => ({
          ...j,
          payload: typeof j.payload === 'string' ? JSON.parse(j.payload || '{}') : j.payload,
          result: typeof j.result === 'string' ? JSON.parse(j.result || '{}') : j.result,
          error: typeof j.error === 'string' ? JSON.parse(j.error || '{}') : j.error
        }));

        return parsedJobs as unknown as ClaimedJob[];
      });
    } catch (err) {
      console.error('Error claiming jobs in transaction:', err);
      return [];
    }
  }
}
