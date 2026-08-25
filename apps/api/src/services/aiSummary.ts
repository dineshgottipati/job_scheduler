export interface AiSummaryProvider {
  generateFailureSummary(input: {
    jobName: string;
    queueName: string;
    attempts: number;
    errorDetails: any;
    logs: string[];
  }): Promise<{
    summary: string;
    rootCause: string;
    recommendedFix: string;
    confidenceScore: number;
  }>;
}

export class MockAiSummaryProvider implements AiSummaryProvider {
  async generateFailureSummary(input: {
    jobName: string;
    queueName: string;
    attempts: number;
    errorDetails: any;
    logs: string[];
  }) {
    const errorStr = JSON.stringify(input.errorDetails || {}).toLowerCase();
    const logStr = input.logs.join(' ').toLowerCase();

    let rootCause = 'Unknown error during job execution.';
    let recommendedFix = 'Inspect worker logs and check service health.';

    if (errorStr.includes('503') || errorStr.includes('service unavailable')) {
      rootCause = 'Target HTTP endpoint returned 503 Service Unavailable (temporary server overload or outage).';
      recommendedFix = 'Verify upstream endpoint health or increase retry backoff interval.';
    } else if (errorStr.includes('relation') || errorStr.includes('does not exist') || errorStr.includes('sql')) {
      rootCause = 'Database query failed due to invalid schema reference or missing database table.';
      recommendedFix = 'Run database migrations or check table query syntax in handler.';
    } else if (errorStr.includes('timeout') || errorStr.includes('econnrefused')) {
      rootCause = 'Network connection failed or connection timed out.';
      recommendedFix = 'Ensure target host is reachable and firewall/security groups allow egress traffic.';
    } else if (errorStr.includes('invalid') || errorStr.includes('email')) {
      rootCause = 'Input payload contains malformed parameters or email format error.';
      recommendedFix = 'Validate job payload schema before submitting job to queue.';
    }

    return {
      summary: `Job "${input.jobName}" failed after ${input.attempts} attempts on queue "${input.queueName}".`,
      rootCause,
      recommendedFix,
      confidenceScore: 0.92
    };
  }
}

export const defaultAiSummaryProvider: AiSummaryProvider = new MockAiSummaryProvider();
