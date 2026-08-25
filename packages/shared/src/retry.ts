import { RetryPolicyType } from './types.js';

export { RetryPolicyType };

export interface RetryPolicyConfig {
  type: RetryPolicyType;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
}

/**
 * Calculates the retry delay in seconds based on attempt number and policy type.
 * @param attempt 1-indexed attempt number that just failed
 * @param policy Retry policy configuration
 * @returns delay in seconds
 */
export function calculateRetryDelaySeconds(
  attempt: number,
  policy: RetryPolicyConfig
): number {
  const { type, baseDelaySeconds, maxDelaySeconds } = policy;
  const safeAttempt = Math.max(1, attempt);
  let delay = baseDelaySeconds;

  switch (type) {
    case RetryPolicyType.FIXED:
      delay = baseDelaySeconds;
      break;

    case RetryPolicyType.LINEAR:
      delay = baseDelaySeconds * safeAttempt;
      break;

    case RetryPolicyType.EXPONENTIAL:
      delay = baseDelaySeconds * Math.pow(2, safeAttempt - 1);
      break;

    default:
      delay = baseDelaySeconds;
  }

  return Math.min(maxDelaySeconds, Math.max(1, delay));
}

/**
 * Returns the exact future Date when the job should be scheduled for its next retry attempt.
 */
export function calculateNextRetryTime(
  attempt: number,
  policy: RetryPolicyConfig,
  fromTime: Date = new Date()
): Date {
  const delaySeconds = calculateRetryDelaySeconds(attempt, policy);
  return new Date(fromTime.getTime() + delaySeconds * 1000);
}
