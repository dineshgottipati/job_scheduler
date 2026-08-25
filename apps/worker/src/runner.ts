import { getPrismaClient, JobStatus, ExecutionStatus, LogLevel, WorkerStatus } from '@job-scheduler/database';
import { calculateNextRetryTime, RetryPolicyType } from '@job-scheduler/shared';
import { ClaimedJob } from './claimer.js';
import { getHandler } from './handlers/index.js';
import os from 'os';

function stringifyJson(data: any): string | null {
  if (data === undefined || data === null) return null;
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

export class WorkerRunner {
  private workerId: string;
  private workerName: string;
  private concurrency: number;
  private leaseDurationSeconds: number;
  private activeJobsCount = 0;
  private isShuttingDown = false;
  private activeExecutions = new Set<Promise<void>>();

  constructor(workerName: string, concurrency = 5, leaseDurationSeconds = 30) {
    this.workerName = workerName;
    this.concurrency = concurrency;
    this.leaseDurationSeconds = leaseDurationSeconds;
    this.workerId = '';
  }

  async initialize(): Promise<string> {
    const prisma = getPrismaClient();

    const worker = await prisma.worker.create({
      data: {
        name: this.workerName,
        hostname: os.hostname(),
        concurrency: this.concurrency,
        status: WorkerStatus.ACTIVE,
        startedAt: new Date(),
        lastHeartbeatAt: new Date()
      }
    });

    this.workerId = worker.id;
    console.log(`🚀 Registered Worker node "${this.workerName}" (ID: ${this.workerId})`);
    return this.workerId;
  }

  getWorkerId(): string {
    return this.workerId;
  }

  getActiveJobsCount(): number {
    return this.activeJobsCount;
  }

  canAcceptWork(): boolean {
    return !this.isShuttingDown && this.activeJobsCount < this.concurrency;
  }

  async sendHeartbeat(): Promise<void> {
    if (!this.workerId) return;
    const prisma = getPrismaClient();
    const now = new Date();

    try {
      const memUsage = process.memoryUsage();
      const load = os.loadavg()[0];

      await prisma.$transaction([
        prisma.worker.update({
          where: { id: this.workerId },
          data: {
            status: WorkerStatus.ACTIVE,
            lastHeartbeatAt: now
          }
        }),
        prisma.workerHeartbeat.create({
          data: {
            workerId: this.workerId,
            recordedAt: now,
            activeJobsCount: this.activeJobsCount,
            memoryUsage: stringifyJson({ rssMb: Math.round(memUsage.rss / 1024 / 1024) }),
            cpuUsage: load
          }
        })
      ]);
    } catch (err) {
      console.error(`Failed to record heartbeat for worker ${this.workerId}:`, err);
    }
  }

  async recoverExpiredLeases(): Promise<void> {
    const prisma = getPrismaClient();
    const now = new Date();

    try {
      const expiredJobs = await prisma.job.findMany({
        where: {
          status: { in: [JobStatus.CLAIMED, JobStatus.RUNNING] },
          leaseExpiresAt: { lt: now }
        },
        take: 50
      });

      for (const job of expiredJobs) {
        console.warn(`⚠️ Recovering expired lease for job ${job.id} (Queue: ${job.queueId}). Requeuing.`);
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.QUEUED,
            workerId: null,
            leaseExpiresAt: null
          }
        });
      }
    } catch (err) {
      console.error('Error recovering expired worker leases:', err);
    }
  }

  executeJob(job: ClaimedJob): Promise<void> {
    this.activeJobsCount++;
    let executionPromise: Promise<void> = Promise.resolve();
    executionPromise = (async () => {
      const prisma = getPrismaClient();
      const startTime = Date.now();

      const execution = await prisma.jobExecution.create({
        data: {
          jobId: job.id,
          workerId: this.workerId,
          attemptNumber: job.attemptCount,
          status: ExecutionStatus.RUNNING,
          startedAt: new Date()
        }
      });

      const logHelper = async (level: string, message: string, metadata?: any) => {
        try {
          await prisma.jobLog.create({
            data: {
              executionId: execution.id,
              level,
              message,
              metadata: stringifyJson(metadata)
            }
          });
        } catch (err) {
          console.error(`Failed to write job log for execution ${execution.id}:`, err);
        }
      };

      try {
        console.log(`▶ Executing job "${job.name}" (ID: ${job.id}, Attempt: ${job.attemptCount}/${job.maxAttempts})`);
        const handler = getHandler(job.name);

        const result = await handler(job.payload, { log: logHelper });

        const endTime = Date.now();
        const durationMs = endTime - startTime;

        await prisma.jobExecution.update({
          where: { id: execution.id },
          data: {
            status: ExecutionStatus.COMPLETED,
            completedAt: new Date(),
            durationMs,
            output: stringifyJson(result || {})
          }
        });

        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.COMPLETED,
            completedAt: new Date(),
            result: stringifyJson(result || {}),
            leaseExpiresAt: null
          }
        });

        console.log(`✅ Job "${job.name}" (ID: ${job.id}) completed successfully in ${durationMs}ms`);
      } catch (err: any) {
        const endTime = Date.now();
        const durationMs = endTime - startTime;
        const errorMessage = err.message || String(err);
        const errorStack = err.stack || '';

        console.error(`❌ Job "${job.name}" (ID: ${job.id}) failed: ${errorMessage}`);

        await prisma.jobExecution.update({
          where: { id: execution.id },
          data: {
            status: ExecutionStatus.FAILED,
            completedAt: new Date(),
            durationMs,
            error: stringifyJson({ message: errorMessage, stack: errorStack })
          }
        });

        await logHelper(LogLevel.ERROR, `Execution attempt #${job.attemptCount} failed: ${errorMessage}`, { stack: errorStack });

        const retryPolicy = job.queue.retryPolicy || {
          type: RetryPolicyType.EXPONENTIAL,
          baseDelaySeconds: 5,
          maxDelaySeconds: 300,
          maxAttempts: job.maxAttempts
        };

        const maxAllowedAttempts = Math.max(job.maxAttempts, retryPolicy.maxAttempts);

        if (job.attemptCount < maxAllowedAttempts) {
          const nextRetryDate = calculateNextRetryTime(job.attemptCount, retryPolicy as any);

          await prisma.job.update({
            where: { id: job.id },
            data: {
              status: JobStatus.SCHEDULED,
              scheduledAt: nextRetryDate,
              error: stringifyJson({ message: errorMessage, failedAttempt: job.attemptCount }),
              leaseExpiresAt: null,
              workerId: null
            }
          });

          await logHelper(
            LogLevel.WARN,
            `Scheduled retry attempt #${job.attemptCount + 1} at ${nextRetryDate.toISOString()} using ${retryPolicy.type} policy.`
          );
          console.log(`🔄 Re-scheduled job "${job.name}" for attempt #${job.attemptCount + 1} at ${nextRetryDate.toISOString()}`);
        } else {
          await prisma.$transaction([
            prisma.job.update({
              where: { id: job.id },
              data: {
                status: JobStatus.DEAD_LETTER,
                completedAt: new Date(),
                error: stringifyJson({ message: errorMessage, attemptsExhausted: true }),
                leaseExpiresAt: null
              }
            }),
            prisma.deadLetterEntry.upsert({
              where: { jobId: job.id },
              update: {
                reason: `Max attempts (${maxAllowedAttempts}) exhausted. Final error: ${errorMessage}`,
                failedAt: new Date(),
                errorDetails: stringifyJson({ message: errorMessage, stack: errorStack }),
                isResolved: false
              },
              create: {
                jobId: job.id,
                queueId: job.queueId,
                reason: `Max attempts (${maxAllowedAttempts}) exhausted. Final error: ${errorMessage}`,
                failedAt: new Date(),
                errorDetails: stringifyJson({ message: errorMessage, stack: errorStack }),
                isResolved: false
              }
            })
          ]);

          await logHelper(
            LogLevel.ERROR,
            `Job failed permanently after ${job.attemptCount} attempts. Transferred to Dead Letter Queue.`
          );
          console.error(`💀 Job "${job.name}" (ID: ${job.id}) moved to Dead Letter Queue`);
        }
      } finally {
        this.activeJobsCount--;
        this.activeExecutions.delete(executionPromise);
      }
    })();

    this.activeExecutions.add(executionPromise);
    return executionPromise;
  }

  async shutdown(timeoutMs = 10000): Promise<void> {
    console.log(`🛑 Graceful shutdown initiated for worker ${this.workerName}...`);
    this.isShuttingDown = true;

    const prisma = getPrismaClient();

    const timeoutPromise = new Promise((res) => setTimeout(res, timeoutMs));
    await Promise.race([Promise.all(Array.from(this.activeExecutions)), timeoutPromise]);

    if (this.workerId) {
      try {
        await prisma.worker.update({
          where: { id: this.workerId },
          data: {
            status: WorkerStatus.STOPPED,
            stoppedAt: new Date()
          }
        });
        console.log(`⏹ Worker ${this.workerName} safely stopped.`);
      } catch (err) {
        console.error('Error marking worker stopped:', err);
      }
    }
  }
}
