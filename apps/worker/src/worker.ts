import { JobClaimer } from './claimer.js';
import { WorkerRunner } from './runner.js';

export class WorkerEngine {
  private claimer: JobClaimer | null = null;
  private runner: WorkerRunner;
  private pollIntervalMs: number;
  private pollTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private leaseRecoveryTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    workerName = process.env.WORKER_NAME || `worker-${Math.floor(Math.random() * 1000)}`,
    concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    pollIntervalMs = parseInt(process.env.POLL_INTERVAL_MS || '1000', 10),
    leaseDurationSeconds = parseInt(process.env.LEASE_DURATION_SECONDS || '30', 10)
  ) {
    this.runner = new WorkerRunner(workerName, concurrency, leaseDurationSeconds);
    this.pollIntervalMs = pollIntervalMs;
  }

  async start(): Promise<void> {
    const workerId = await this.runner.initialize();
    this.claimer = new JobClaimer(workerId);
    this.isRunning = true;

    // Start polling loop
    this.pollTimer = setInterval(async () => {
      if (!this.isRunning || !this.runner.canAcceptWork()) return;

      try {
        const jobs = await this.claimer!.claimJobs(1);
        for (const job of jobs) {
          this.runner.executeJob(job);
        }
      } catch (err) {
        console.error('Polling error in worker loop:', err);
      }
    }, this.pollIntervalMs);

    // Start heartbeat loop (every 15s)
    this.heartbeatTimer = setInterval(() => {
      this.runner.sendHeartbeat();
    }, 15000);

    // Start lease recovery loop (every 30s)
    this.leaseRecoveryTimer = setInterval(() => {
      this.runner.recoverExpiredLeases();
    }, 30000);

    // Send initial heartbeat
    await this.runner.sendHeartbeat();

    console.log(`📡 Worker engine active (Polling every ${this.pollIntervalMs}ms)`);
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.leaseRecoveryTimer) clearInterval(this.leaseRecoveryTimer);

    await this.runner.shutdown();
  }
}
