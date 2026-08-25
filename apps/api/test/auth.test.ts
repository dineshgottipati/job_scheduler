import assert from 'node:assert';
import { test, describe } from 'node:test';
import { RegisterUserSchema, LoginUserSchema, CreateQueueSchema } from '@job-scheduler/shared';

describe('API Schema & Auth Validation Unit Tests', () => {
  test('RegisterUserSchema validates valid payload', () => {
    const valid = RegisterUserSchema.safeParse({
      email: 'test@acme.com',
      password: 'password123',
      name: 'Test User'
    });
    assert.strictEqual(valid.success, true);
  });

  test('RegisterUserSchema rejects invalid email or short password', () => {
    const invalidEmail = RegisterUserSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
      name: 'Test User'
    });
    assert.strictEqual(invalidEmail.success, false);

    const shortPassword = RegisterUserSchema.safeParse({
      email: 'test@acme.com',
      password: '123',
      name: 'Test User'
    });
    assert.strictEqual(shortPassword.success, false);
  });

  test('CreateQueueSchema validates queue creation constraints', () => {
    const validQueue = CreateQueueSchema.safeParse({
      projectId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      name: 'high-priority-emails',
      priority: 10,
      maxConcurrency: 5
    });
    assert.strictEqual(validQueue.success, true);

    const invalidName = CreateQueueSchema.safeParse({
      projectId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      name: 'invalid name with spaces!'
    });
    assert.strictEqual(invalidName.success, false);
  });
});
