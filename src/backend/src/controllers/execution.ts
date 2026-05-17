/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { executionService } from '../services/execution';
import { ResponseHandler } from '../utils/response';

export class ExecutionController {
  //POST /api/backend/execute/code
  async executeCode(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { code, language = 'python', stdin, sysArgs } = req.body;

      if (!code || typeof code !== 'string') {
        ResponseHandler.badRequest(res, 'Code is required');
        return;
      }

      if (code.length > 50_000) {
        ResponseHandler.badRequest(res, 'Code exceeds maximum length of 50,000 characters');
        return;
      }

      if (sysArgs !== undefined && !Array.isArray(sysArgs)) {
        ResponseHandler.badRequest(res, 'sysArgs must be an array of strings');
        return;
      }

      if (sysArgs && sysArgs.some((a: any) => typeof a !== 'string')) {
        ResponseHandler.badRequest(res, 'sysArgs must be an array of strings');
        return;
      }

      const result = await executionService.executeCode(userId, code, language, stdin, sysArgs);
      ResponseHandler.success(res, result, 'Code executed successfully');
    } catch (error: any) {
      console.error('Execute code error:', error);
      ResponseHandler.serverError(res, error.message);
    }
  }

  //POST /api/backend/execute/file
  async executeFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { storageKey, language = 'python' } = req.body;

      if (!storageKey || typeof storageKey !== 'string') {
        ResponseHandler.badRequest(res, 'storageKey is required');
        return;
      }

      const result = await executionService.executeFile(userId, storageKey, language);
      ResponseHandler.success(res, result, 'File executed successfully');
    } catch (error: any) {
      console.error('Execute file error:', error);
      ResponseHandler.serverError(res, error.message);
    }
  }
}

export const executionController = new ExecutionController();
