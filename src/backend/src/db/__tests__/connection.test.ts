import { describe, it, expect } from '@jest/globals';
import { connectDatabase, disconnectDatabase, client } from '../index';

describe('Database Connection Tests', () => {
  describe('Connection Management', () => {
    it('should connect to database', async () => {
      await expect(connectDatabase()).resolves.not.toThrow();
    });

    it('should execute queries after connection', async () => {
      await connectDatabase();
      const result = await client`SELECT NOW() as current_time`;
      expect(result[0].current_time).toBeDefined();
    });

    it('should disconnect from database', async () => {
      await connectDatabase();
      await expect(disconnectDatabase()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid queries gracefully', async () => {
      await expect(client`SELECT * FROM nonexistent_table`).rejects.toThrow();
    });

    it('should handle syntax errors', async () => {
      await expect(client`INVALID SQL SYNTAX`).rejects.toThrow();
    });
  });
});
