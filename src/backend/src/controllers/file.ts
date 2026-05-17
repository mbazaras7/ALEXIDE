/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { fileService } from '../services/file';
import { ResponseHandler } from '../utils/response';
import { storageService } from '../services/storage';
import { UploadedFile } from '../types/file';
import { fileRepository } from '../repositories/file';

export class FileController {
  private readonly LARGE_FILE_THRESHOLD = 5 * 1024 * 1024;

  // POST /api/files
  async createFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { name, path, parentId, isDirectory, content } = req.body;

      const file = await fileService.createFile(userId, {
        name,
        path,
        parentId,
        isDirectory,
        content,
      });

      ResponseHandler.created(res, file, 'File created successfully');
    } catch (error: any) {
      console.error('Create file error:', error);
      ResponseHandler.error(res, error.message);
    }
  }

  // GET /api/files/:id
  async getFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;

      const file = await fileService.getFile(id, userId);

      if (!file) {
        ResponseHandler.notFound(res, 'File not found');
        return;
      }

      ResponseHandler.success(res, file);
    } catch (error: any) {
      console.error('Get file error:', error);
      ResponseHandler.error(res, error.message);
    }
  }

  // GET /api/files/:id/download
  async downloadFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;

      const file = await fileService.getFile(id, userId);

      if (!file) {
        ResponseHandler.notFound(res, 'File not found');
        return;
      }

      if (file.isDirectory) {
        ResponseHandler.error(res, 'Cannot download directory', 400);
        return;
      }

      if (!file.storageKey) {
        ResponseHandler.error(res, 'File has no storage key', 500);
        return;
      }

      res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
      res.setHeader('Content-Length', file.size.toString());

      const stream = await storageService.downloadFileStream(file.storageKey);
      stream.pipe(res);

      stream.on('error', (error) => {
        console.error('Download stream error:', error);
        if (!res.headersSent) {
          ResponseHandler.error(res, 'Failed to download file');
        }
      });
    } catch (error: any) {
      console.error('Download file error:', error);
      if (!res.headersSent) {
        ResponseHandler.error(res, error.message);
      }
    }
  }

  // GET /api/files
  async listFiles(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { parentId, includeDeleted, limit, offset } = req.query;

      const files = await fileService.listFiles(userId, {
        parentId: parentId as string,
        includeDeleted: includeDeleted === 'true',
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      ResponseHandler.success(res, files);
    } catch (error: any) {
      console.error('List files error:', error);
      ResponseHandler.error(res, error.message);
    }
  }

  // GET /api/files/tree
  async getFileTree(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { rootId } = req.query;

      const tree = await fileService.getFileTree(userId, rootId as string);

      ResponseHandler.success(res, tree);
    } catch (error: any) {
      console.error('Get file tree error:', error);
      ResponseHandler.error(res, error.message);
    }
  }

  // PUT /api/files/:id
  async updateFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;
      const { name, path, parentId, content } = req.body;

      const file = await fileService.updateFile(id, userId, {
        name,
        path,
        parentId,
        content,
      });

      ResponseHandler.success(res, file, 'File updated successfully');
    } catch (error: any) {
      console.error('Update file error:', error);
      ResponseHandler.error(res, error.message);
    }
  }

  // DELETE /api/files/:id
  async deleteFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;

      await fileService.deleteFile(id, userId);

      ResponseHandler.success(res, null, 'File deleted successfully');
    } catch (error: any) {
      console.error('Delete file error:', error);
      ResponseHandler.error(res, error.message);
    }
  }

  // DELETE /api/files/:id/permanent
  async permanentlyDeleteFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;

      await fileService.permanentlyDeleteFile(id, userId);

      ResponseHandler.success(res, null, 'File permanently deleted');
    } catch (error: any) {
      console.error('Permanent delete error:', error);
      ResponseHandler.error(res, error.message);
    }
  }

  // GET /api/files/:id/content (optimized for large files)
  async getFileContent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;

      const hasAccess = await fileRepository.canUserAccessFile(id, userId);
      if (!hasAccess) {
        ResponseHandler.notFound(res, 'File not found');
        return;
      }

      const file = await fileRepository.findByIdWithoutOwnership(id);

      if (!file) {
        ResponseHandler.notFound(res, 'File not found');
        return;
      }

      if (file.isDirectory) {
        ResponseHandler.error(res, 'Cannot get content of a directory', 400);
        return;
      }

      if (!file.storageKey) {
        ResponseHandler.error(res, 'File has no storage key', 500);
        return;
      }

      if (file.size > this.LARGE_FILE_THRESHOLD) {
        console.log(`Streaming large file: ${file.name} (${file.size} bytes)`);

        const stream = await storageService.downloadFileStream(file.storageKey);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-File-Size', file.size.toString());
        res.setHeader('X-Updated-At', file.updatedAt.toISOString());

        //Collect chunks
        let content = '';
        stream.on('data', (chunk) => {
          content += chunk.toString('utf-8');
        });

        stream.on('end', () => {
          ResponseHandler.success(res, {
            name: file.name,
            content,
            updatedAt: file.updatedAt,
            size: file.size,
            mimeType: file.mimeType,
            isLargeFile: true,
          });
        });

        stream.on('error', (error) => {
          console.error('Stream error:', error);
          if (!res.headersSent) {
            ResponseHandler.error(res, 'Failed to stream file content');
          }
        });
      } else {
        const content = await storageService.downloadFile(file.storageKey);

        ResponseHandler.success(res, {
          name: file.name,
          content: content.toString('utf-8'),
          updatedAt: file.updatedAt,
          size: file.size,
          mimeType: file.mimeType,
          isLargeFile: false,
        });
      }
    } catch (error: any) {
      console.error('Get file content error:', error);
      if (!res.headersSent) {
        ResponseHandler.error(res, error.message);
      }
    }
  }

  // PUT /api/files/:id/content, with conflict detection
  async updateFileContent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;
      const { content, lastUpdatedAt } = req.body;

      if (content === undefined) {
        ResponseHandler.error(res, 'Content is required', 400);
        return;
      }

      //Conflict detection
      const existingFile = await fileService.getFile(id, userId);
      if (!existingFile) {
        ResponseHandler.notFound(res, 'File not found');
        return;
      }

      //Check for conflicts
      if (lastUpdatedAt) {
        const clientTimestamp = new Date(lastUpdatedAt);
        if (existingFile.updatedAt > clientTimestamp) {
          ResponseHandler.error(
            res,
            'Conflict detected: File has been modified by another user',
            409
          );
          return;
        }
      }

      const updatedFile = await fileService.updateFile(id, userId, { content });

      ResponseHandler.success(
        res,
        {
          id: updatedFile.id,
          updatedAt: updatedFile.updatedAt,
          size: updatedFile.size,
        },
        'File content updated successfully'
      );
    } catch (error: any) {
      console.error('Update file content error:', error);
      if (error.message === 'File not found') {
        ResponseHandler.notFound(res, 'File not found');
        return;
      }

      ResponseHandler.error(res, error.message);
    }
  }

  // PATCH /api/files/:id/auto-save
  async autoSaveFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;
      const { content, lastUpdatedAt } = req.body;

      if (content === undefined) {
        ResponseHandler.error(res, 'Content is required', 400);
        return;
      }

      const existingFile = await fileService.getFile(id, userId);
      if (!existingFile) {
        ResponseHandler.notFound(res, 'File not found');
        return;
      }

      let hasConflict = false;
      if (lastUpdatedAt) {
        const clientTimestamp = new Date(lastUpdatedAt);
        if (existingFile.updatedAt > clientTimestamp) {
          hasConflict = true;
          console.warn(`Auto-save conflict detected for file: ${id}`);
        }
      }

      const updatedFile = await fileService.updateFile(id, userId, { content });

      ResponseHandler.success(
        res,
        {
          id: updatedFile.id,
          updatedAt: updatedFile.updatedAt,
          size: updatedFile.size,
          hasConflict,
        },
        hasConflict ? 'Auto-saved with conflict warning' : 'Auto-saved successfully'
      );
    } catch (error: any) {
      console.error('Auto-save error:', error);
      if (error.message === 'File not found') {
        ResponseHandler.notFound(res, 'File not found');
        return;
      }

      ResponseHandler.error(res, error.message);
    }
  }

  //POST /api/files/:id/move
  //Move file to new location
  async moveFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;
      const { newParentId, newPath } = req.body;

      if (!newPath) {
        ResponseHandler.error(res, 'newPath is required', 400);
        return;
      }

      const movedFile = await fileService.moveFile(id, userId, {
        newParentId: newParentId || null,
        newPath,
      });

      ResponseHandler.success(res, movedFile, 'File moved successfully');
    } catch (error: any) {
      console.error('Move file error:', error);
      if (error.message.includes('not found')) {
        ResponseHandler.notFound(res, error.message);
        return;
      }
      if (
        error.message.includes('Cannot move directory') ||
        error.message.includes('already exists') ||
        error.message.includes('Target must be')
      ) {
        ResponseHandler.error(res, error.message, 400);
        return;
      }
      ResponseHandler.error(res, error.message);
    }
  }

  //POST /api/files/:id/copy File or directory
  async copyFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;
      const { newName, newPath, newParentId } = req.body;

      if (!newName || !newPath) {
        ResponseHandler.error(res, 'newName and newPath are required', 400);
        return;
      }

      const copiedFile = await fileService.copyFile(id, userId, {
        newName,
        newPath,
        newParentId: newParentId || null,
      });

      ResponseHandler.success(res, copiedFile, 'File copied successfully');
    } catch (error: any) {
      console.error('Copy file error:', error);

      if (error.message.includes('not found')) {
        ResponseHandler.notFound(res, error.message);
        return;
      }

      if (error.message.includes('already exists') || error.message.includes('Target must be')) {
        ResponseHandler.error(res, error.message, 400);
        return;
      }

      ResponseHandler.error(res, error.message, 500);
    }
  }

  //POST /api/files/:id/rename Files or Directories
  async renameFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;
      const { newName } = req.body;

      if (!newName) {
        ResponseHandler.error(res, 'newName is required', 400);
        return;
      }

      const renamedFile = await fileService.renameFile(id, userId, {
        newName,
      });

      ResponseHandler.success(res, renamedFile, 'File renamed successfully');
    } catch (error: any) {
      console.error('Rename file error:', error);

      if (error.message.includes('not found')) {
        ResponseHandler.notFound(res, error.message);
        return;
      }

      if (error.message.includes('already exists') || error.message.includes('invalid')) {
        ResponseHandler.error(res, error.message, 400);
        return;
      }

      ResponseHandler.error(res, error.message, 500);
    }
  }

  //GET /api/files/search?q=searchTerm
  async searchFiles(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const searchTerm = req.query.q as string;

      if (!searchTerm) {
        ResponseHandler.error(res, 'Search term is required', 400);
        return;
      }

      const files = await fileService.searchFiles(userId, searchTerm);
      ResponseHandler.success(res, files);
    } catch (error: any) {
      console.error('Search files error:', error);
      ResponseHandler.error(res, error.message, 500);
    }
  }

  //GET /api/files/trash only trash deleted
  async getTrash(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const files = await fileService.getTrash(userId);
      ResponseHandler.success(res, files);
    } catch (error: any) {
      console.error('Get trash error:', error);
      ResponseHandler.error(res, error.message, 500);
    }
  }

  //POST /api/files/:id/restore
  async restoreFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;

      const restoredFile = await fileService.restoreFile(id, userId);

      ResponseHandler.success(res, restoredFile, 'File restored successfully');
    } catch (error: any) {
      console.error('Restore file error:', error);

      if (error.message === 'File not found') {
        ResponseHandler.notFound(res, 'File not found');
        return;
      }

      if (error.message === 'File is not deleted') {
        ResponseHandler.error(res, 'File is not in trash', 400);
        return;
      }

      ResponseHandler.error(res, error.message, 500);
    }
  }
  // POST /api/files/upload
  async uploadFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const file = (req as any).file as UploadedFile | undefined;
      if (!file) {
        ResponseHandler.error(res, 'No file provided', 400);
        return;
      }

      const { parentId, path: targetPath } = req.body;
      const uploaded = await fileService.uploadFile(userId, file, parentId, targetPath);
      ResponseHandler.created(res, uploaded, 'File uploaded successfully');
    } catch (error: any) {
      console.error('Upload file error:', error);
      if (
        error.message.includes('already exists') ||
        error.message.includes('not allowed') ||
        error.message.includes('Parent')
      ) {
        ResponseHandler.error(res, error.message, 400);
        return;
      }
      ResponseHandler.error(res, error.message);
    }
  }
}

export const fileController = new FileController();
