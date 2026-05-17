/* eslint-disable @typescript-eslint/no-unused-vars */
import dotenv from 'dotenv';
import { beforeAll, afterAll, describe, it, expect, jest } from '@jest/globals';
import { connectDatabase, disconnectDatabase } from '../db';

dotenv.config({ path: '.env.test' });
describe('test setup', () => {
  it('runs successfully', () => {
    expect(true).toBe(true);
  });
});
//Connect to database before all tests
beforeAll(async () => {
  await connectDatabase();
});

//Disconnect after all tests
afterAll(async () => {
  await disconnectDatabase();
});
