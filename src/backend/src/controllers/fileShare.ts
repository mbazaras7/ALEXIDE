/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { fileShareService } from '../services/fileShare';
import { ResponseHandler } from '../utils/response';

export class FileShareController {
  //POST /api/share/files/:id
  async createShare(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const fileId = req.params.id as string;
      const { expiresInHours } = req.body;

      const share = await fileShareService.createShare(fileId, userId, expiresInHours);
      ResponseHandler.created(res, share, 'Share link created');
    } catch (error: any) {
      if (error.message === 'File not found') {
        ResponseHandler.notFound(res, 'File not found');
        return;
      }

      ResponseHandler.error(res, error.message);
    }
  }

  //GET /api/share/:code
  async resolveShare(req: AuthRequest, res: Response): Promise<void> {
    try {
      const share = await fileShareService.resolveShare(req.params.code as string);
      ResponseHandler.success(res, share);
    } catch (error: any) {
      ResponseHandler.notFound(res, error.message);
    }
  }
  //DELETE /api/share/files/:id
  async revokeShare(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      await fileShareService.revokeShare(req.params.id as string, userId);
      ResponseHandler.success(res, null, 'Share revoked');
    } catch (error: any) {
      if (error.message === 'No active share found for this file') {
        ResponseHandler.notFound(res, error.message);
        return;
      }

      if (error.message === 'File not found') {
        ResponseHandler.notFound(res, 'File not found');
        return;
      }

      ResponseHandler.error(res, error.message);
    }
  }
}

export const fileShareController = new FileShareController();
