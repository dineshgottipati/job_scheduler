import { PrismaClient } from '@prisma/client';
import { Role, RetryPolicyType, JobStatus, ExecutionStatus, LogLevel, WorkerStatus } from '../src/index.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Starting database seed...');

  // Clean existing data
  await prisma.deadLetterEntry.deleteMany();
  await prisma.jobLog.deleteMany();
  await prisma.jobExecution.deleteMany();
  await prisma.jobDependency.deleteMany();
  await prisma.job.deleteMany();
  await prisma.scheduledJob.deleteMany();
  await prisma.workerHeartbeat.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.queue.deleteMany();
  await prisma.retryPolicy.deleteMany();
  await prisma.project.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  const passwordHash = await bcrypt.hash('password123', 10);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@acme.com',
      name: 'Alice Admin',
      passwordHash
    }
  });

  const devUser = await prisma.user.create({
    data: {
      email: 'dev@acme.com',
      name: 'Bob Developer',
      passwordHash
    }
  });

  console.log('👤 Created users: admin@acme.com, dev@acme.com');

  // Create Organization
  const org = await prisma.organization.create({
    data: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      members: {
        create: [
          { userId: adminUser.id, role: Role.OWNER },
          { userId: devUser.id, role: Role.MEMBER }
        ]
      }
    }
  });

  console.log('🏢 Created organization: Acme Corp');

  // Create Projects
  const ecommerceProj = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'E-Commerce Platform',
      slug: 'ecommerce-platform',
      description: 'Core e-commerce backend background processing'
    }
  });

  const analyticsProj = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'Analytics Engine',
      slug: 'analytics-engine',
      description: 'Batch data aggregation and reporting'
    }
  });

  console.log('📁 Created projects: E-Commerce Platform, Analytics Engine');

  // Create Retry Policies
  const expPolicy = await prisma.retryPolicy.create({
    data: {
      projectId: ecommerceProj.id,
      name: 'Exponential Backoff (Default)',
      type: RetryPolicyType.EXPONENTIAL,
      maxAttempts: 3,
      baseDelaySeconds: 5,
      maxDelaySeconds: 300
    }
  });

  const fixedPolicy = await prisma.retryPolicy.create({
    data: {
      projectId: ecommerceProj.id,
      name: 'Fixed 10s Retry',
      type: RetryPolicyType.FIXED,
      maxAttempts: 5,
      baseDelaySeconds: 10,
      maxDelaySeconds: 10
    }
  });

  const linearPolicy = await prisma.retryPolicy.create({
    data: {
      projectId: analyticsProj.id,
      name: 'Linear 15s Backoff',
      type: RetryPolicyType.LINEAR,
      maxAttempts: 4,
      baseDelaySeconds: 15,
      maxDelaySeconds: 120
    }
  });

  console.log('🔄 Created retry policies');

  // Create Queues
  const emailQueue = await prisma.queue.create({
    data: {
      projectId: ecommerceProj.id,
      name: 'emails-high-priority',
      description: 'Transactional email delivery (welcome emails, password resets)',
      priority: 10,
      maxConcurrency: 10,
      retryPolicyId: expPolicy.id
    }
  });

  const webhookQueue = await prisma.queue.create({
    data: {
      projectId: ecommerceProj.id,
      name: 'webhooks',
      description: 'Outbound webhook notifications to third-party integrations',
      priority: 5,
      maxConcurrency: 5,
      retryPolicyId: fixedPolicy.id
    }
  });

  const reportQueue = await prisma.queue.create({
    data: {
      projectId: analyticsProj.id,
      name: 'reports-batch',
      description: 'Heavy SQL aggregations and PDF report generation',
      priority: 2,
      maxConcurrency: 2,
      retryPolicyId: linearPolicy.id
    }
  });

  console.log('⚡ Created queues: emails-high-priority, webhooks, reports-batch');

  // Create Scheduled Jobs
  await prisma.scheduledJob.create({
    data: {
      queueId: reportQueue.id,
      name: 'generate_report',
      payload: JSON.stringify({ reportType: 'DAILY_SALES_SUMMARY', format: 'pdf' }),
      cronExpression: '0 0 * * *',
      timezone: 'UTC',
      priority: 5,
      maxAttempts: 3,
      nextRunAt: new Date(Date.now() + 3600000)
    }
  });

  await prisma.scheduledJob.create({
    data: {
      queueId: webhookQueue.id,
      name: 'webhook',
      payload: JSON.stringify({ targetUrl: 'https://api.partner.com/ping', event: 'SYSTEM_HEALTH_CHECK' }),
      cronExpression: '*/15 * * * *',
      timezone: 'UTC',
      priority: 3,
      maxAttempts: 2,
      nextRunAt: new Date(Date.now() + 900000)
    }
  });

  console.log('⏰ Created scheduled cron jobs');

  // Create Workers
  const worker1 = await prisma.worker.create({
    data: {
      name: 'worker-us-east-1a',
      hostname: 'node-srv-01.acme.internal',
      concurrency: 5,
      status: WorkerStatus.ACTIVE,
      startedAt: new Date(Date.now() - 86400000),
      lastHeartbeatAt: new Date()
    }
  });

  const worker2 = await prisma.worker.create({
    data: {
      name: 'worker-us-east-1b',
      hostname: 'node-srv-02.acme.internal',
      concurrency: 5,
      status: WorkerStatus.ACTIVE,
      startedAt: new Date(Date.now() - 43200000),
      lastHeartbeatAt: new Date()
    }
  });

  // Worker Heartbeats
  await prisma.workerHeartbeat.createMany({
    data: [
      { workerId: worker1.id, recordedAt: new Date(Date.now() - 60000), activeJobsCount: 2, cpuUsage: 14.2, memoryUsage: JSON.stringify({ rssMb: 128 }) },
      { workerId: worker1.id, recordedAt: new Date(), activeJobsCount: 1, cpuUsage: 18.5, memoryUsage: JSON.stringify({ rssMb: 132 }) },
      { workerId: worker2.id, recordedAt: new Date(Date.now() - 30000), activeJobsCount: 3, cpuUsage: 25.1, memoryUsage: JSON.stringify({ rssMb: 145 }) }
    ]
  });

  console.log('🖥️ Created workers and heartbeats');

  // 1. Queued Jobs
  await prisma.job.create({
    data: {
      queueId: emailQueue.id,
      name: 'send_email',
      payload: JSON.stringify({ to: 'customer1@example.com', subject: 'Welcome to Acme!', template: 'welcome_v2' }),
      priority: 10,
      status: JobStatus.QUEUED,
      scheduledAt: new Date(),
      idempotencyKey: 'idempotent-email-key-001'
    }
  });

  await prisma.job.create({
    data: {
      queueId: webhookQueue.id,
      name: 'webhook',
      payload: JSON.stringify({ targetUrl: 'https://webhook.site/demo-endpoint', event: 'order.created', orderId: 'ord-9921' }),
      priority: 5,
      status: JobStatus.QUEUED,
      scheduledAt: new Date(),
      idempotencyKey: 'idempotent-webhook-key-002'
    }
  });

  // 2. Delayed Scheduled Job
  await prisma.job.create({
    data: {
      queueId: emailQueue.id,
      name: 'send_email',
      payload: JSON.stringify({ to: 'user2@example.com', subject: 'Your trial expires in 3 days', template: 'trial_reminder' }),
      priority: 5,
      status: JobStatus.SCHEDULED,
      scheduledAt: new Date(Date.now() + 1800000)
    }
  });

  // 3. Completed Job
  const completedJob = await prisma.job.create({
    data: {
      queueId: emailQueue.id,
      name: 'send_email',
      payload: JSON.stringify({ to: 'vip@acme.com', subject: 'Order Confirmation #5541', template: 'order_receipt' }),
      priority: 10,
      status: JobStatus.COMPLETED,
      attemptCount: 1,
      maxAttempts: 3,
      scheduledAt: new Date(Date.now() - 300000),
      claimedAt: new Date(Date.now() - 290000),
      startedAt: new Date(Date.now() - 280000),
      completedAt: new Date(Date.now() - 275000),
      workerId: worker1.id,
      result: JSON.stringify({ delivered: true, messageId: 'msg-abc-12345', latencyMs: 240 })
    }
  });

  const compExec = await prisma.jobExecution.create({
    data: {
      jobId: completedJob.id,
      workerId: worker1.id,
      attemptNumber: 1,
      status: ExecutionStatus.COMPLETED,
      startedAt: new Date(Date.now() - 280000),
      completedAt: new Date(Date.now() - 275000),
      durationMs: 5000,
      output: JSON.stringify({ status: 'DELIVERED', smtpCode: 250 })
    }
  });

  await prisma.jobLog.createMany({
    data: [
      { executionId: compExec.id, level: LogLevel.INFO, message: 'Initiating send_email handler execution' },
      { executionId: compExec.id, level: LogLevel.INFO, message: 'Connecting to SMTP gateway mail.acme.com:587' },
      { executionId: compExec.id, level: LogLevel.INFO, message: 'Email successfully accepted by relay host with ID msg-abc-12345' }
    ]
  });

  // 4. Failed & Retryable Scheduled Job
  const failedJob = await prisma.job.create({
    data: {
      queueId: webhookQueue.id,
      name: 'webhook',
      payload: JSON.stringify({ targetUrl: 'https://api.thirdparty.org/hook', payloadData: { paymentId: 'pay_9982' } }),
      priority: 5,
      status: JobStatus.SCHEDULED,
      attemptCount: 1,
      maxAttempts: 3,
      scheduledAt: new Date(Date.now() + 10000),
      error: JSON.stringify({ message: 'HTTP 503 Service Unavailable', statusCode: 503 })
    }
  });

  const failedExec = await prisma.jobExecution.create({
    data: {
      jobId: failedJob.id,
      workerId: worker2.id,
      attemptNumber: 1,
      status: ExecutionStatus.FAILED,
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(Date.now() - 58000),
      durationMs: 2000,
      error: JSON.stringify({ code: 'HTTP_503', message: 'Target server returned status 503' })
    }
  });

  await prisma.jobLog.createMany({
    data: [
      { executionId: failedExec.id, level: LogLevel.INFO, message: 'Posting HTTP payload to https://api.thirdparty.org/hook' },
      { executionId: failedExec.id, level: LogLevel.ERROR, message: 'HTTP request failed with status code 503' },
      { executionId: failedExec.id, level: LogLevel.WARN, message: 'Scheduling attempt #2 with fixed 10s retry policy' }
    ]
  });

  // 5. Dead-Lettered Job
  const dlqJob = await prisma.job.create({
    data: {
      queueId: reportQueue.id,
      name: 'generate_report',
      payload: JSON.stringify({ query: 'SELECT * FROM invalid_table_name', reportType: 'CUSTOM_SQL' }),
      priority: 2,
      status: JobStatus.DEAD_LETTER,
      attemptCount: 3,
      maxAttempts: 3,
      scheduledAt: new Date(Date.now() - 3600000),
      startedAt: new Date(Date.now() - 3500000),
      completedAt: new Date(Date.now() - 3400000),
      error: JSON.stringify({ message: 'Fatal syntax error: relation "invalid_table_name" does not exist' })
    }
  });

  const dlqExec = await prisma.jobExecution.create({
    data: {
      jobId: dlqJob.id,
      workerId: worker1.id,
      attemptNumber: 3,
      status: ExecutionStatus.FAILED,
      startedAt: new Date(Date.now() - 3500000),
      completedAt: new Date(Date.now() - 3400000),
      durationMs: 1000,
      error: JSON.stringify({ message: 'Database error: relation "invalid_table_name" does not exist' })
    }
  });

  await prisma.jobLog.create({
    data: {
      executionId: dlqExec.id,
      level: LogLevel.ERROR,
      message: 'Unrecoverable SQL error encountered. Exhaused max attempts (3/3). Moving to Dead Letter Queue.'
    }
  });

  await prisma.deadLetterEntry.create({
    data: {
      jobId: dlqJob.id,
      queueId: reportQueue.id,
      reason: 'Max retry attempts exhausted (3/3). Permanent failure.',
      errorDetails: JSON.stringify({
        message: 'Relation "invalid_table_name" does not exist',
        stack: 'DatabaseError: relation "invalid_table_name" does not exist at Client._query (pg/lib/client.js:521)'
      }),
      isResolved: false
    }
  });

  console.log('✅ Database seed completed successfully!');
}

seed()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
