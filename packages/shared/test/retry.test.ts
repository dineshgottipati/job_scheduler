import assert from 'node:assert';
import { test, describe } from 'node:test';
import { calculateRetryDelaySeconds, calculateNextRetryTime, RetryPolicyType } from '../src/retry.js';

describe('Retry Policy Delay Calculations', () => {
  test('Fixed Backoff Policy', () => {
    const policy = { type: RetryPolicyType.FIXED, baseDelaySeconds: 10, maxDelaySeconds: 60 };
    assert.strictEqual(calculateRetryDelaySeconds(1, policy), 10);
    assert.strictEqual(calculateRetryDelaySeconds(2, policy), 10);
    assert.strictEqual(calculateRetryDelaySeconds(5, policy), 10);
  });

  test('Linear Backoff Policy', () => {
    const policy = { type: RetryPolicyType.LINEAR, baseDelaySeconds: 5, maxDelaySeconds: 20 };
    assert.strictEqual(calculateRetryDelaySeconds(1, policy), 5);  // 5 * 1
    assert.strictEqual(calculateRetryDelaySeconds(2, policy), 10); // 5 * 2
    assert.strictEqual(calculateRetryDelaySeconds(3, policy), 15); // 5 * 3
    assert.strictEqual(calculateRetryDelaySeconds(4, policy), 20); // 5 * 4
    assert.strictEqual(calculateRetryDelaySeconds(5, policy), 20); // capped at maxDelay (20)
  });

  test('Exponential Backoff Policy', () => {
    const policy = { type: RetryPolicyType.EXPONENTIAL, baseDelaySeconds: 2, maxDelaySeconds: 100 };
    assert.strictEqual(calculateRetryDelaySeconds(1, policy), 2);  // 2 * 2^0 = 2
    assert.strictEqual(calculateRetryDelaySeconds(2, policy), 4);  // 2 * 2^1 = 4
    assert.strictEqual(calculateRetryDelaySeconds(3, policy), 8);  // 2 * 2^2 = 8
    assert.strictEqual(calculateRetryDelaySeconds(4, policy), 16); // 2 * 2^3 = 16
    assert.strictEqual(calculateRetryDelaySeconds(5, policy), 32); // 2 * 2^4 = 32
  });

  test('Exponential Backoff Max Delay Cap', () => {
    const policy = { type: RetryPolicyType.EXPONENTIAL, baseDelaySeconds: 5, maxDelaySeconds: 30 };
    assert.strictEqual(calculateRetryDelaySeconds(10, policy), 30); // Capped at 30
  });

  test('calculateNextRetryTime returns future Date', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const policy = { type: RetryPolicyType.FIXED, baseDelaySeconds: 15, maxDelaySeconds: 60 };
    const nextTime = calculateNextRetryTime(1, policy, now);
    assert.strictEqual(nextTime.toISOString(), '2026-01-01T00:00:15.000Z');
  });
});
