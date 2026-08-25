export interface HandlerContext {
  log: (level: 'INFO' | 'WARN' | 'ERROR', message: string, metadata?: any) => Promise<void>;
}

export type JobHandler = (payload: any, ctx: HandlerContext) => Promise<Record<string, any>>;

const sendEmailHandler: JobHandler = async (payload, ctx) => {
  const { to, subject, template, simulateFailure, executionMode, runtimeMs } = payload || {};
  const delay = runtimeMs || 1000;

  await ctx.log('INFO', `Starting send_email execution for recipient: ${to || 'user@example.com'}`);
  await new Promise((res) => setTimeout(res, delay));

  if (simulateFailure || executionMode === 'Simulate Failure') {
    await ctx.log('ERROR', 'Simulated failure requested in execution mode!');
    throw new Error('Simulated failure during email SMTP dispatch');
  }

  await ctx.log('INFO', `Email successfully dispatched to ${to || 'user@example.com'}`);
  return {
    delivered: true,
    recipient: to || 'user@example.com',
    subject: subject || 'No Subject',
    messageId: `msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`
  };
};

const generateReportHandler: JobHandler = async (payload, ctx) => {
  const { reportType, format, simulateFailure, executionMode, runtimeMs } = payload || {};
  const delay = runtimeMs || 3000;

  await ctx.log('INFO', `Starting generate_report execution (type: ${reportType || 'SUMMARY'})`);
  await new Promise((res) => setTimeout(res, delay));

  if (simulateFailure || executionMode === 'Simulate Failure') {
    await ctx.log('ERROR', 'Simulated failure during report rendering!');
    throw new Error('Report rendering engine crashed due to memory limit');
  }

  await ctx.log('INFO', 'Report successfully rendered.');
  return {
    reportType: reportType || 'SUMMARY',
    format: format || 'pdf',
    downloadUrl: `https://storage.acme.internal/reports/report-${Date.now()}.${format || 'pdf'}`
  };
};

const webhookHandler: JobHandler = async (payload, ctx) => {
  const { targetUrl, event, simulateFailure, executionMode, runtimeMs } = payload || {};
  const delay = runtimeMs || 1000;

  await ctx.log('INFO', `Initiating webhook HTTP POST request to ${targetUrl || 'https://api.partner.com/ping'}`);
  await new Promise((res) => setTimeout(res, delay));

  if (simulateFailure || executionMode === 'Simulate Failure' || targetUrl?.includes('fail')) {
    await ctx.log('ERROR', `Webhook HTTP POST failed with status 503`);
    throw new Error('HTTP 503 Service Unavailable from endpoint');
  }

  await ctx.log('INFO', `Webhook event "${event || 'ping'}" delivered successfully (200 OK)`);
  return {
    statusCode: 200,
    targetUrl: targetUrl || 'https://api.partner.com/ping',
    deliveredAt: new Date().toISOString()
  };
};

const failingJobHandler: JobHandler = async (payload, ctx) => {
  const delay = payload?.runtimeMs || 500;
  await new Promise((res) => setTimeout(res, delay));
  await ctx.log('ERROR', 'Simulated unhandled operational exception in job handler!');
  throw new Error(payload?.errorMessage || 'Simulated failure for testing retries and DLQ');
};

const defaultFallbackHandler: JobHandler = async (payload, ctx) => {
  const runtimeMs = payload?.runtimeMs || 1000;
  const { simulateFailure, executionMode, jobName } = payload || {};

  await ctx.log('INFO', `Executing job task "${jobName || 'generic'}" (Runtime: ${runtimeMs}ms)`);
  await new Promise((res) => setTimeout(res, runtimeMs));

  if (simulateFailure || executionMode === 'Simulate Failure') {
    await ctx.log('ERROR', 'Simulated failure requested in payload execution mode!');
    throw new Error('Simulated operational failure for testing retries and DLQ');
  }

  await ctx.log('INFO', `Task "${jobName || 'generic'}" completed successfully in ${runtimeMs}ms`);
  return { status: 'COMPLETED', jobName: jobName || 'generic', processedAt: new Date().toISOString() };
};

export const handlers: Record<string, JobHandler> = {
  send_email: sendEmailHandler,
  generate_report: generateReportHandler,
  webhook: webhookHandler,
  failing_job: failingJobHandler
};

export function getHandler(name: string): JobHandler {
  return handlers[name] || defaultFallbackHandler;
}
