import { getPrismaClient, JobStatus } from '@job-scheduler/database';
import cronParser from 'cron-parser';

let cronInterval: NodeJS.Timeout | null = null;

export function startCronScheduler(pollIntervalMs = 5000) {
  if (cronInterval) return;

  const prisma = getPrismaClient();

  cronInterval = setInterval(async () => {
    try {
      const now = new Date();
      const dueScheduledJobs = await prisma.scheduledJob.findMany({
        where: {
          isPaused: false,
          OR: [
            { nextRunAt: { lte: now } },
            { nextRunAt: null }
          ]
        },
        include: {
          queue: true
        }
      });

      for (const scheduledJob of dueScheduledJobs) {
        if (scheduledJob.queue.deletedAt || scheduledJob.queue.isPaused) {
          continue;
        }

        // Create job instance
        await prisma.job.create({
          data: {
            queueId: scheduledJob.queueId,
            name: scheduledJob.name,
            payload: typeof scheduledJob.payload === 'string' ? scheduledJob.payload : JSON.stringify(scheduledJob.payload || {}),
            priority: scheduledJob.priority,
            maxAttempts: scheduledJob.maxAttempts,
            status: JobStatus.QUEUED,
            scheduledAt: now
          }
        });

        // Compute next run time using cron-parser
        let nextRunAt: Date | null = null;
        try {
          const interval = cronParser.parseExpression(scheduledJob.cronExpression, {
            currentDate: now,
            tz: scheduledJob.timezone || 'UTC'
          });
          nextRunAt = interval.next().toDate();
        } catch (err) {
          console.error(`Invalid cron expression for scheduled job ${scheduledJob.id}:`, err);
        }

        await prisma.scheduledJob.update({
          where: { id: scheduledJob.id },
          data: {
            lastRunAt: now,
            nextRunAt
          }
        });
      }
    } catch (err) {
      console.error('Error in cron scheduler loop:', err);
    }
  }, pollIntervalMs);

  console.log(`⏰ Cron scheduler service initialized (polling every ${pollIntervalMs}ms)`);
}

export function stopCronScheduler() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }
}
