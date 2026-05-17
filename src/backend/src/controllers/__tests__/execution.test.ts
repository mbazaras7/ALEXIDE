import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth';

const mockExecutionService = {
  executeCode:
    jest.fn<
      (
        userId: string,
        code: string,
        language: string,
        stdin?: string,
        sysArgs?: string[]
      ) => Promise<any>
    >(),
  executeFile: jest.fn<(userId: string, storageKey: string, language: string) => Promise<any>>(),
};

jest.mock('../../services/execution', () => ({
  executionService: mockExecutionService,
}));

import { ExecutionController } from '../execution';

function makeReq(body: Record<string, any> = {}): AuthRequest {
  return {
    user: { userId: 'test-user-001', role: 'STUDENT' },
    body,
  } as unknown as AuthRequest;
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('ExecutionController', () => {
  let controller: ExecutionController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ExecutionController();
  });

  describe('executeCode', () => {
    it('should return 200 with output on success', async () => {
      mockExecutionService.executeCode.mockResolvedValueOnce({
        output: 'hello world',
        exitCode: 0,
      });

      const req = makeReq({ code: 'print("hello world")', language: 'python' });
      const res = makeRes();

      await controller.executeCode(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Code executed successfully',
          data: { output: 'hello world', exitCode: 0 },
        })
      );
    });

    it('should return 400 if code is missing', async () => {
      const req = makeReq({});
      const res = makeRes();

      await controller.executeCode(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Code is required' })
      );
      expect(mockExecutionService.executeCode).not.toHaveBeenCalled();
    });

    it('should return 400 if code exceeds 50,000 characters', async () => {
      const req = makeReq({ code: 'a'.repeat(50_001) });
      const res = makeRes();

      await controller.executeCode(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockExecutionService.executeCode).not.toHaveBeenCalled();
    });

    it('should return 400 if sysArgs is not an array', async () => {
      const req = makeReq({ code: 'print("hi")', sysArgs: 'not-an-array' });
      const res = makeRes();

      await controller.executeCode(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockExecutionService.executeCode).not.toHaveBeenCalled();
    });

    it('should return 400 if sysArgs contains non-string values', async () => {
      const req = makeReq({ code: 'print("hi")', sysArgs: [1, 2, 3] });
      const res = makeRes();

      await controller.executeCode(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockExecutionService.executeCode).not.toHaveBeenCalled();
    });

    it('should return 500 if service throws', async () => {
      mockExecutionService.executeCode.mockRejectedValueOnce(new Error('Docker down'));

      const req = makeReq({ code: 'print("hi")' });
      const res = makeRes();

      await controller.executeCode(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Docker down' })
      );
    });

    it('should default language to python if not provided', async () => {
      mockExecutionService.executeCode.mockResolvedValueOnce({ output: '', exitCode: 0 });

      const req = makeReq({ code: 'print("hi")' });
      const res = makeRes();

      await controller.executeCode(req, res);

      expect(mockExecutionService.executeCode).toHaveBeenCalledWith(
        'test-user-001',
        'print("hi")',
        'python',
        undefined,
        undefined
      );
    });

    it('should pass stdin to execution service', async () => {
      mockExecutionService.executeCode.mockResolvedValueOnce({ output: '5', exitCode: 0 });

      const req = makeReq({ code: 'print(input())', stdin: '5' });
      const res = makeRes();

      await controller.executeCode(req, res);

      expect(mockExecutionService.executeCode).toHaveBeenCalledWith(
        'test-user-001',
        'print(input())',
        'python',
        '5',
        undefined
      );
    });

    it('should pass sysArgs to execution service', async () => {
      mockExecutionService.executeCode.mockResolvedValueOnce({ output: 'hello', exitCode: 0 });

      const req = makeReq({ code: 'import sys\nprint(sys.argv[1])', sysArgs: ['hello'] });
      const res = makeRes();

      await controller.executeCode(req, res);

      expect(mockExecutionService.executeCode).toHaveBeenCalledWith(
        'test-user-001',
        'import sys\nprint(sys.argv[1])',
        'python',
        undefined,
        ['hello']
      );
    });

    it('should pass both stdin and sysArgs to execution service', async () => {
      mockExecutionService.executeCode.mockResolvedValueOnce({ output: 'foobar', exitCode: 0 });

      const req = makeReq({
        code: 'import sys\nprint(input() + sys.argv[1])',
        stdin: 'foo',
        sysArgs: ['bar'],
      });
      const res = makeRes();

      await controller.executeCode(req, res);

      expect(mockExecutionService.executeCode).toHaveBeenCalledWith(
        'test-user-001',
        'import sys\nprint(input() + sys.argv[1])',
        'python',
        'foo',
        ['bar']
      );
    });
  });

  describe('executeFile', () => {
    it('should return 200 with output on success', async () => {
      mockExecutionService.executeFile.mockResolvedValueOnce({
        output: 'from file',
        exitCode: 0,
      });

      const req = makeReq({ storageKey: 'users/user-001/main.py' });
      const res = makeRes();

      await controller.executeFile(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { output: 'from file', exitCode: 0 },
        })
      );
    });

    it('should return 400 if storageKey is missing', async () => {
      const req = makeReq({});
      const res = makeRes();

      await controller.executeFile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockExecutionService.executeFile).not.toHaveBeenCalled();
    });

    it('should return 500 if service throws', async () => {
      mockExecutionService.executeFile.mockRejectedValueOnce(new Error('Storage error'));

      const req = makeReq({ storageKey: 'users/user-001/main.py' });
      const res = makeRes();

      await controller.executeFile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
