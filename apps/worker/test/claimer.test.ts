import assert from 'node:assert';
import { test, describe } from 'node:test';
import { getHandler } from '../src/handlers/index.js';

describe('Worker Handler & Execution Logic', () => {
  test('send_email handler processes valid payload', async () => {
    const handler = getHandler('send_email');
    const logs: string[] = [];
    const mockCtx = {
      log: async (level: string, message: string) => {
        logs.push(`[${level}] ${message}`);
      }
    };

    const result = await handler({ to: 'alice@example.com', subject: 'Welcome' }, mockCtx as any);
    assert.strictEqual(result.delivered, true);
    assert.strictEqual(result.recipient, 'alice@example.com');
    assert.ok(logs.some((l) => l.includes('Starting send_email')));
  });

  test('send_email handler throws error on missing recipient', async () => {
    const handler = getHandler('send_email');
    const mockCtx = { log: async () => {} };

    await assert.rejects(
      async () => {
        await handler({}, mockCtx as any);
      },
      { message: 'Missing recipient email address in payload' }
    );
  });

  test('failing_job handler throws intentional operational error', async () => {
    const handler = getHandler('failing_job');
    const mockCtx = { log: async () => {} };

    await assert.rejects(
      async () => {
        await handler({ errorMessage: 'Test exception' }, mockCtx as any);
      },
      { message: 'Test exception' }
    );
  });
});
