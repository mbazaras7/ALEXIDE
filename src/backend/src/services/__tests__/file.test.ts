import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { fileService } from '../file';
import { fileRepository } from '../../repositories/file';
import { storageService } from '../storage';
import { FileMetadata } from '../../types/file';

jest.mock('../../repositories/file');
jest.mock('../storage');
jest.mock('../../config/redis', () => ({
  deleteDocState: jest.fn().mockResolvedValue(undefined as never),
  saveDocState: jest.fn().mockResolvedValue(undefined as never),
  loadDocState: jest.fn().mockResolvedValue(null as never),
  docStateExists: jest.fn().mockResolvedValue(false as never),
  connectRedis: jest.fn().mockResolvedValue(undefined as never),
  disconnectRedis: jest.fn().mockResolvedValue(undefined as never),
  pubClient: { connect: jest.fn(), quit: jest.fn() },
  subClient: { connect: jest.fn(), quit: jest.fn() },
  storeClient: { connect: jest.fn(), quit: jest.fn() },
}));

const mockFileRepository = fileRepository as jest.Mocked<typeof fileRepository>;
const mockStorageService = storageService as jest.Mocked<typeof storageService>;

describe('FileService', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createFile', () => {
    it('should create a file with content and upload to storage', async () => {
      const mockFile: FileMetadata = {
        id: 'file-123',
        userId: mockUserId,
        name: 'test.py',
        path: '/test.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/plain',
        size: 17,
        storageKey: 'users/user-123/test.py',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.pathExists.mockResolvedValue(false);
      mockStorageService.generateKey.mockReturnValue('users/user-123/test.py');
      mockStorageService.uploadFile.mockResolvedValue('http://minio/file');
      mockFileRepository.create.mockResolvedValue(mockFile);

      const result = await fileService.createFile(mockUserId, {
        name: 'test.py',
        path: '/test.py',
        content: 'print("hello")',
      });

      expect(mockFileRepository.pathExists).toHaveBeenCalledWith('/test.py', mockUserId);
      expect(mockStorageService.generateKey).toHaveBeenCalledWith(mockUserId, '/test.py');
      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        'users/user-123/test.py',
        'print("hello")',
        'text/plain'
      );
      expect(mockFileRepository.create).toHaveBeenCalledWith({
        userId: mockUserId,
        name: 'test.py',
        path: '/test.py',
        parentId: undefined,
        isDirectory: false,
        mimeType: 'text/plain',
        size: 14,
        storageKey: 'users/user-123/test.py',
      });
      expect(result).toEqual(mockFile);
    });

    it('should throw error if file path already exists', async () => {
      mockFileRepository.pathExists.mockResolvedValue(true);

      await expect(
        fileService.createFile(mockUserId, {
          name: 'test.py',
          path: '/test.py',
          content: 'print("hello")',
        })
      ).rejects.toThrow('File already exists at path: /test.py');

      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
      expect(mockFileRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error if parent directory not found', async () => {
      mockFileRepository.pathExists.mockResolvedValue(false);
      mockFileRepository.findById.mockResolvedValue(null);

      await expect(
        fileService.createFile(mockUserId, {
          name: 'test.py',
          path: '/src/test.py',
          parentId: 'dir-123',
          content: 'print("hello")',
        })
      ).rejects.toThrow('Parent directory not found');
    });

    it('should throw error if parent is not a directory', async () => {
      const mockFile: FileMetadata = {
        id: 'file-123',
        userId: mockUserId,
        name: 'main.py',
        path: '/main.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/x-python',
        size: 100,
        storageKey: 'users/user-123/main.py',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.pathExists.mockResolvedValue(false);
      mockFileRepository.findById.mockResolvedValue(mockFile);

      await expect(
        fileService.createFile(mockUserId, {
          name: 'test.py',
          path: '/main.py/test.py',
          parentId: 'file-123',
          content: 'print("hello")',
        })
      ).rejects.toThrow('Parent must be a directory');
    });
  });

  describe('getFile', () => {
    it('should return file by id', async () => {
      const mockFile: FileMetadata = {
        id: 'file-123',
        userId: mockUserId,
        name: 'test.py',
        path: '/test.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/x-python',
        size: 17,
        storageKey: 'users/user-123/test.py',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.findById.mockResolvedValue(mockFile);

      const result = await fileService.getFile('file-123', mockUserId);

      expect(mockFileRepository.findById).toHaveBeenCalledWith('file-123', mockUserId);
      expect(result).toEqual(mockFile);
    });

    it('should return null if file not found', async () => {
      mockFileRepository.findById.mockResolvedValue(null);

      const result = await fileService.getFile('file-999', mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('getFileContent', () => {
    it('should download file content from storage', async () => {
      const mockFile: FileMetadata = {
        id: 'file-123',
        userId: mockUserId,
        name: 'test.py',
        path: '/test.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/x-python',
        size: 17,
        storageKey: 'users/user-123/test.py',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContent = Buffer.from('print("hello")');

      mockFileRepository.findById.mockResolvedValue(mockFile);
      mockStorageService.downloadFile.mockResolvedValue(mockContent);

      const result = await fileService.getFileContent('file-123', mockUserId);

      expect(mockStorageService.downloadFile).toHaveBeenCalledWith('users/user-123/test.py');
      expect(result).toEqual(mockContent);
    });

    it('should throw error if file not found', async () => {
      mockFileRepository.findById.mockResolvedValue(null);

      await expect(fileService.getFileContent('file-999', mockUserId)).rejects.toThrow(
        'File not found'
      );
    });

    it('should throw error if trying to download directory', async () => {
      const mockDir: FileMetadata = {
        id: 'dir-123',
        userId: mockUserId,
        name: 'src',
        path: '/src',
        parentId: null,
        isDirectory: true,
        mimeType: null,
        size: 0,
        storageKey: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.findById.mockResolvedValue(mockDir);

      await expect(fileService.getFileContent('dir-123', mockUserId)).rejects.toThrow(
        'Cannot download directory content'
      );
    });

    it('should throw error if file has no storage key', async () => {
      const mockFile: FileMetadata = {
        id: 'file-123',
        userId: mockUserId,
        name: 'test.py',
        path: '/test.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/x-python',
        size: 0,
        storageKey: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.findById.mockResolvedValue(mockFile);

      await expect(fileService.getFileContent('file-123', mockUserId)).rejects.toThrow(
        'File has no storage key'
      );
    });
  });

  describe('updateFile', () => {
    it('should update file content and upload to storage', async () => {
      const existingFile: FileMetadata = {
        id: 'file-123',
        userId: mockUserId,
        name: 'test.py',
        path: '/test.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/x-python',
        size: 17,
        storageKey: 'users/user-123/test.py',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedFile: FileMetadata = {
        ...existingFile,
        size: 20,
        updatedAt: new Date(),
      };

      mockFileRepository.findById.mockResolvedValue(existingFile);
      mockStorageService.uploadFile.mockResolvedValue('http://minio/file');
      mockFileRepository.update.mockResolvedValue(updatedFile);

      const result = await fileService.updateFile('file-123', mockUserId, {
        content: 'print("updated")',
      });

      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        'users/user-123/test.py',
        'print("updated")',
        'text/x-python'
      );
      expect(result).toEqual(updatedFile);
    });

    it('should throw error if file not found', async () => {
      mockFileRepository.findById.mockResolvedValue(null);

      await expect(
        fileService.updateFile('file-999', mockUserId, { name: 'new.py' })
      ).rejects.toThrow('File not found');
    });
  });

  describe('deleteFile', () => {
    it('should soft delete a file', async () => {
      const mockFile: FileMetadata = {
        id: 'file-123',
        userId: mockUserId,
        name: 'test.py',
        path: '/test.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/x-python',
        size: 17,
        storageKey: 'users/user-123/test.py',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.findById.mockResolvedValue(mockFile);
      mockFileRepository.softDelete.mockResolvedValue(true);

      await fileService.deleteFile('file-123', mockUserId);

      expect(mockFileRepository.softDelete).toHaveBeenCalledWith('file-123', mockUserId);
    });

    it('should recursively delete directory and children', async () => {
      const mockDir: FileMetadata = {
        id: 'dir-123',
        userId: mockUserId,
        name: 'src',
        path: '/src',
        parentId: null,
        isDirectory: true,
        mimeType: null,
        size: 0,
        storageKey: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockChild: FileMetadata = {
        id: 'file-456',
        userId: mockUserId,
        name: 'main.py',
        path: '/src/main.py',
        parentId: 'dir-123',
        isDirectory: false,
        mimeType: 'text/x-python',
        size: 100,
        storageKey: 'users/user-123/src/main.py',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.findById.mockResolvedValue(mockDir);
      mockFileRepository.getChildren.mockResolvedValue([mockChild]);
      mockFileRepository.softDelete.mockResolvedValue(true);

      await fileService.deleteFile('dir-123', mockUserId);

      expect(mockFileRepository.getChildren).toHaveBeenCalledWith('dir-123', mockUserId);
      expect(mockFileRepository.softDelete).toHaveBeenCalledWith('file-456', mockUserId);
      expect(mockFileRepository.softDelete).toHaveBeenCalledWith('dir-123', mockUserId);
    });

    it('should throw error if file not found', async () => {
      mockFileRepository.findById.mockResolvedValue(null);

      await expect(fileService.deleteFile('file-999', mockUserId)).rejects.toThrow(
        'File not found'
      );
    });

    it('should throw error if deletion fails', async () => {
      const mockFile: FileMetadata = {
        id: 'file-123',
        userId: mockUserId,
        name: 'test.py',
        path: '/test.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/x-python',
        size: 17,
        storageKey: 'users/user-123/test.py',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.findById.mockResolvedValue(mockFile);
      mockFileRepository.softDelete.mockResolvedValue(false);

      await expect(fileService.deleteFile('file-123', mockUserId)).rejects.toThrow(
        'Failed to delete file'
      );
    });
  });

  describe('permanentlyDeleteFile', () => {
    it('should delete file from storage and database', async () => {
      const mockFile: FileMetadata = {
        id: 'file-123',
        userId: mockUserId,
        name: 'test.py',
        path: '/test.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/x-python',
        size: 17,
        storageKey: 'users/user-123/test.py',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.findById.mockResolvedValue(mockFile);
      mockStorageService.deleteFile.mockResolvedValue();
      mockFileRepository.hardDelete.mockResolvedValue(true);

      await fileService.permanentlyDeleteFile('file-123', mockUserId);

      expect(mockStorageService.deleteFile).toHaveBeenCalledWith('users/user-123/test.py');
      expect(mockFileRepository.hardDelete).toHaveBeenCalledWith('file-123', mockUserId);
    });

    it('should not delete from storage if directory', async () => {
      const mockDir: FileMetadata = {
        id: 'dir-123',
        userId: mockUserId,
        name: 'src',
        path: '/src',
        parentId: null,
        isDirectory: true,
        mimeType: null,
        size: 0,
        storageKey: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.findById.mockResolvedValue(mockDir);
      mockFileRepository.hardDelete.mockResolvedValue(true);

      await fileService.permanentlyDeleteFile('dir-123', mockUserId);

      expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
      expect(mockFileRepository.hardDelete).toHaveBeenCalledWith('dir-123', mockUserId);
    });

    it('should throw error if file not found', async () => {
      mockFileRepository.findById.mockResolvedValue(null);

      await expect(fileService.permanentlyDeleteFile('file-999', mockUserId)).rejects.toThrow(
        'File not found'
      );
    });
  });

  describe('getFileTree', () => {
    it('should return hierarchical file tree', async () => {
      const mockDir: FileMetadata = {
        id: 'dir-123',
        userId: mockUserId,
        name: 'src',
        path: '/src',
        parentId: null,
        isDirectory: true,
        mimeType: null,
        size: 0,
        storageKey: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockFile: FileMetadata = {
        id: 'file-456',
        userId: mockUserId,
        name: 'main.py',
        path: '/src/main.py',
        parentId: 'dir-123',
        isDirectory: false,
        mimeType: 'text/x-python',
        size: 100,
        storageKey: 'users/user-123/src/main.py',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.list
        .mockResolvedValueOnce([mockDir])
        .mockResolvedValueOnce([mockFile])
        .mockResolvedValueOnce([]);

      const result = await fileService.getFileTree(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('src');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0].name).toBe('main.py');
    });

    it('should return empty array if no files', async () => {
      mockFileRepository.list.mockResolvedValue([]);

      const result = await fileService.getFileTree(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('moveFile - Validation Logic', () => {
    it('should throw error when moving directory into itself', async () => {
      const dirId = 'dir-789';

      mockFileRepository.findById.mockResolvedValueOnce({
        id: dirId,
        userId: mockUserId,
        name: 'folder',
        path: '/folder',
        parentId: null,
        isDirectory: true,
        mimeType: null,
        size: 0,
        storageKey: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockFileRepository.findById.mockResolvedValueOnce({
        id: dirId,
        userId: mockUserId,
        name: 'folder',
        path: '/folder',
        parentId: null,
        isDirectory: true,
        mimeType: null,
        size: 0,
        storageKey: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        fileService.moveFile(dirId, mockUserId, {
          newParentId: dirId,
          newPath: '/folder/folder',
        })
      ).rejects.toThrow('Cannot move directory into itself or its subdirectories');
    });

    it('should throw error when moving directory into its descendant', async () => {
      mockFileRepository.findById
        .mockResolvedValueOnce({
          id: 'parent-id',
          userId: mockUserId,
          name: 'parent',
          path: '/parent',
          parentId: null,
          isDirectory: true,
          mimeType: null,
          size: 0,
          storageKey: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'child-id',
          userId: mockUserId,
          name: 'child',
          path: '/parent/child',
          parentId: 'parent-id',
          isDirectory: true,
          mimeType: null,
          size: 0,
          storageKey: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'child-id',
          userId: mockUserId,
          name: 'child',
          path: '/parent/child',
          parentId: 'parent-id',
          isDirectory: true,
          mimeType: null,
          size: 0,
          storageKey: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      await expect(
        fileService.moveFile('parent-id', mockUserId, {
          newParentId: 'child-id',
          newPath: '/parent/child/parent',
        })
      ).rejects.toThrow('Cannot move directory into itself or its subdirectories');
    });

    it('should throw error when target path already exists', async () => {
      const fileId = 'file-456';

      mockFileRepository.findById.mockResolvedValueOnce({
        id: fileId,
        userId: mockUserId,
        name: 'file1.py',
        path: '/file1.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/x-python',
        size: 100,
        storageKey: 'key1',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockFileRepository.pathExists.mockResolvedValue(true);

      await expect(
        fileService.moveFile(fileId, mockUserId, {
          newParentId: null,
          newPath: '/file2.py',
        })
      ).rejects.toThrow('File already exists at path: /file2.py');
    });

    it('should throw error when target is not a directory', async () => {
      const fileId = 'file-456';

      mockFileRepository.findById
        .mockResolvedValueOnce({
          id: fileId,
          userId: mockUserId,
          name: 'file.py',
          path: '/file.py',
          parentId: null,
          isDirectory: false,
          mimeType: 'text/x-python',
          size: 100,
          storageKey: 'key1',
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'not-dir',
          userId: mockUserId,
          name: 'notdir.txt',
          path: '/notdir.txt',
          parentId: null,
          isDirectory: false,
          mimeType: 'text/plain',
          size: 50,
          storageKey: 'key2',
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      await expect(
        fileService.moveFile(fileId, mockUserId, {
          newParentId: 'not-dir',
          newPath: '/notdir.txt/file.py',
        })
      ).rejects.toThrow('Target must be a directory');
    });
  });

  describe('moveFile - File Move Operations', () => {
    it('should move file and update storage key', async () => {
      const fileId = 'file-456';
      const dirId = 'dir-789';
      const fileContent = Buffer.from('print("hello")');

      mockFileRepository.findById.mockResolvedValueOnce({
        id: fileId,
        userId: mockUserId,
        name: 'test.py',
        path: '/test.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/x-python',
        size: 100,
        storageKey: 'old-key',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockFileRepository.findById.mockResolvedValueOnce({
        id: dirId,
        userId: mockUserId,
        name: 'folder',
        path: '/folder',
        parentId: null,
        isDirectory: true,
        mimeType: null,
        size: 0,
        storageKey: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockFileRepository.pathExists.mockResolvedValue(false);
      mockStorageService.downloadFile.mockResolvedValue(fileContent);
      mockStorageService.generateKey.mockReturnValue('new-key');
      mockStorageService.uploadFile.mockResolvedValue(undefined as any);
      mockStorageService.deleteFile.mockResolvedValue(undefined as any);

      const updatedFile = {
        id: fileId,
        userId: mockUserId,
        name: 'test.py',
        path: '/folder/test.py',
        parentId: dirId,
        isDirectory: false,
        mimeType: 'text/x-python',
        size: 100,
        storageKey: 'new-key',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.update.mockResolvedValue(updatedFile);

      const result = await fileService.moveFile(fileId, mockUserId, {
        newParentId: dirId,
        newPath: '/folder/test.py',
      });

      expect(result.path).toBe('/folder/test.py');
      expect(result.storageKey).toBe('new-key');
      expect(mockStorageService.downloadFile).toHaveBeenCalledWith('old-key');
      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        'new-key',
        fileContent,
        'text/x-python'
      );
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith('old-key');
    });

    it('should move directory and update all descendant paths', async () => {
      const dirId = 'dir-789';
      const dirData = {
        id: dirId,
        userId: mockUserId,
        name: 'folder',
        path: '/folder',
        parentId: null,
        isDirectory: true,
        mimeType: null,
        size: 0,
        storageKey: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.findById.mockResolvedValue(dirData);
      mockFileRepository.pathExists.mockResolvedValue(false);

      const movedDir = {
        ...dirData,
        path: '/moved/folder',
      };

      mockFileRepository.update.mockResolvedValueOnce(movedDir).mockResolvedValueOnce({
        id: 'file1',
        userId: mockUserId,
        name: 'file1.py',
        path: '/moved/folder/file1.py',
        parentId: dirId,
        isDirectory: false,
        mimeType: 'text/x-python',
        size: 100,
        storageKey: 'new-key1',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockFileRepository.getDescendants.mockResolvedValue([
        {
          id: 'file1',
          userId: mockUserId,
          name: 'file1.py',
          path: '/folder/file1.py',
          parentId: dirId,
          isDirectory: false,
          mimeType: 'text/x-python',
          size: 100,
          storageKey: 'key1',
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockStorageService.generateKey.mockReturnValue('new-key1');
      mockStorageService.downloadFile.mockResolvedValue(Buffer.from('content'));
      mockStorageService.uploadFile.mockResolvedValue(undefined as any);
      mockStorageService.deleteFile.mockResolvedValue(undefined as any);

      await fileService.moveFile(dirId, mockUserId, {
        newParentId: null,
        newPath: '/moved/folder',
      });

      expect(mockFileRepository.getDescendants).toHaveBeenCalledWith(dirId, mockUserId);
      expect(mockFileRepository.update).toHaveBeenCalledWith('file1', {
        path: '/moved/folder/file1.py',
        storageKey: 'new-key1',
      });
    });
  });

  describe('copyFile', () => {
    it('should copy a file', async () => {
      const fileId = 'file-456';
      const fileContent = Buffer.from('print("hello")');

      mockFileRepository.findById.mockResolvedValueOnce({
        id: fileId,
        userId: mockUserId,
        name: 'original.py',
        path: '/original.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/plain',
        size: 100,
        storageKey: 'old-key',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockFileRepository.pathExists.mockResolvedValue(false);
      mockStorageService.downloadFile.mockResolvedValue(fileContent);
      mockStorageService.generateKey.mockReturnValue('new-key');
      mockStorageService.uploadFile.mockResolvedValue(undefined as any);

      const copiedFile = {
        id: 'new-file-id',
        userId: mockUserId,
        name: 'copy.py',
        path: '/copy.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/plain',
        size: 100,
        storageKey: 'new-key',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.create.mockResolvedValue(copiedFile);

      const result = await fileService.copyFile(fileId, mockUserId, {
        newName: 'copy.py',
        newPath: '/copy.py',
      });

      expect(result.name).toBe('copy.py');
      expect(result.path).toBe('/copy.py');
      expect(mockStorageService.downloadFile).toHaveBeenCalledWith('old-key');
      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        'new-key',
        fileContent,
        'text/plain'
      );
    });

    it('should copy directory with children', async () => {
      const dirId = 'dir-789';

      mockFileRepository.findById.mockResolvedValue({
        id: dirId,
        userId: mockUserId,
        name: 'src',
        path: '/src',
        parentId: null,
        isDirectory: true,
        mimeType: null,
        size: 0,
        storageKey: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockFileRepository.pathExists.mockResolvedValue(false);

      const newDir = {
        id: 'new-dir-id',
        userId: mockUserId,
        name: 'src-copy',
        path: '/src-copy',
        parentId: null,
        isDirectory: true,
        mimeType: null,
        size: 0,
        storageKey: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.create.mockResolvedValue(newDir);

      mockFileRepository.getChildren.mockResolvedValue([
        {
          id: 'file1',
          userId: mockUserId,
          name: 'main.py',
          path: '/src/main.py',
          parentId: dirId,
          isDirectory: false,
          mimeType: 'text/plain',
          size: 100,
          storageKey: 'key1',
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockStorageService.downloadFile.mockResolvedValue(Buffer.from('content'));
      mockStorageService.generateKey.mockReturnValue('new-key');
      mockStorageService.uploadFile.mockResolvedValue(undefined as any);

      const result = await fileService.copyFile(dirId, mockUserId, {
        newName: 'src-copy',
        newPath: '/src-copy',
      });

      expect(result.name).toBe('src-copy');
      expect(result.isDirectory).toBe(true);
      expect(mockFileRepository.getChildren).toHaveBeenCalledWith(dirId, mockUserId);
    });

    it('should throw error when target path exists', async () => {
      mockFileRepository.findById.mockResolvedValue({
        id: 'file-id',
        userId: mockUserId,
        name: 'file.py',
        path: '/file.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/plain',
        size: 100,
        storageKey: 'key',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockFileRepository.pathExists.mockResolvedValue(true);

      await expect(
        fileService.copyFile('file-id', mockUserId, {
          newName: 'copy.py',
          newPath: '/existing.py',
        })
      ).rejects.toThrow('File already exists at path: /existing.py');
    });
  });

  describe('renameFile', () => {
    it('should rename a file in root directory', async () => {
      const fileId = 'file-456';

      mockFileRepository.findById.mockResolvedValueOnce({
        id: fileId,
        userId: mockUserId,
        name: 'old.py',
        path: '/old.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/plain',
        size: 100,
        storageKey: 'old-key',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockFileRepository.pathExists.mockResolvedValue(false);
      mockStorageService.downloadFile.mockResolvedValue(Buffer.from('content'));
      mockStorageService.generateKey.mockReturnValue('new-key');
      mockStorageService.uploadFile.mockResolvedValue(undefined as any);
      mockStorageService.deleteFile.mockResolvedValue(undefined as any);

      const renamedFile = {
        id: fileId,
        userId: mockUserId,
        name: 'new.py',
        path: '/new.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/plain',
        size: 100,
        storageKey: 'new-key',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.update.mockResolvedValue(renamedFile);

      const result = await fileService.renameFile(fileId, mockUserId, {
        newName: 'new.py',
      });

      expect(result.name).toBe('new.py');
      expect(result.path).toBe('/new.py');
      expect(mockStorageService.downloadFile).toHaveBeenCalledWith('old-key');
      expect(mockStorageService.uploadFile).toHaveBeenCalled();
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith('old-key');
    });

    it('should rename a file within a directory', async () => {
      const fileId = 'file-456';
      const parentId = 'parent-id';

      mockFileRepository.findById
        .mockResolvedValueOnce({
          id: fileId,
          userId: mockUserId,
          name: 'old.py',
          path: '/folder/old.py',
          parentId: parentId,
          isDirectory: false,
          mimeType: 'text/plain',
          size: 100,
          storageKey: 'old-key',
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: parentId,
          userId: mockUserId,
          name: 'folder',
          path: '/folder',
          parentId: null,
          isDirectory: true,
          mimeType: null,
          size: 0,
          storageKey: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      mockFileRepository.pathExists.mockResolvedValue(false);
      mockStorageService.downloadFile.mockResolvedValue(Buffer.from('content'));
      mockStorageService.generateKey.mockReturnValue('new-key');
      mockStorageService.uploadFile.mockResolvedValue(undefined as any);
      mockStorageService.deleteFile.mockResolvedValue(undefined as any);

      const renamedFile = {
        id: fileId,
        userId: mockUserId,
        name: 'new.py',
        path: '/folder/new.py',
        parentId: parentId,
        isDirectory: false,
        mimeType: 'text/plain',
        size: 100,
        storageKey: 'new-key',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.update.mockResolvedValue(renamedFile);

      const result = await fileService.renameFile(fileId, mockUserId, {
        newName: 'new.py',
      });

      expect(result.name).toBe('new.py');
      expect(result.path).toBe('/folder/new.py');
    });

    it('should rename a directory and update descendants', async () => {
      const dirId = 'dir-789';

      mockFileRepository.findById.mockResolvedValue({
        id: dirId,
        userId: mockUserId,
        name: 'old-folder',
        path: '/old-folder',
        parentId: null,
        isDirectory: true,
        mimeType: null,
        size: 0,
        storageKey: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockFileRepository.pathExists.mockResolvedValue(false);

      const renamedDir = {
        id: dirId,
        userId: mockUserId,
        name: 'new-folder',
        path: '/new-folder',
        parentId: null,
        isDirectory: true,
        mimeType: null,
        size: 0,
        storageKey: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.update.mockResolvedValue(renamedDir);
      mockFileRepository.getDescendants.mockResolvedValue([]);

      const result = await fileService.renameFile(dirId, mockUserId, {
        newName: 'new-folder',
      });

      expect(result.name).toBe('new-folder');
      expect(result.path).toBe('/new-folder');
      expect(mockFileRepository.getDescendants).toHaveBeenCalledWith(dirId, mockUserId);
    });

    it('should throw error when new name already exists', async () => {
      mockFileRepository.findById.mockResolvedValue({
        id: 'file-id',
        userId: mockUserId,
        name: 'old.py',
        path: '/old.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/plain',
        size: 100,
        storageKey: 'key',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockFileRepository.pathExists.mockResolvedValue(true);

      await expect(
        fileService.renameFile('file-id', mockUserId, {
          newName: 'existing.py',
        })
      ).rejects.toThrow('already exists');
    });

    it('should throw error when file not found', async () => {
      mockFileRepository.findById.mockResolvedValue(null);

      await expect(
        fileService.renameFile('non-existent', mockUserId, {
          newName: 'new.py',
        })
      ).rejects.toThrow('File not found');
    });
  });
  describe('searchFiles', () => {
    it('should search files by query string', async () => {
      const searchQuery = 'test';
      const mockFiles: FileMetadata[] = [
        {
          id: 'file-1',
          userId: mockUserId,
          name: 'test.py',
          path: '/test.py',
          parentId: null,
          isDirectory: false,
          mimeType: 'text/plain',
          size: 100,
          storageKey: 'users/user-123/test.py',
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'file-2',
          userId: mockUserId,
          name: 'testing.js',
          path: '/src/testing.js',
          parentId: 'dir-1',
          isDirectory: false,
          mimeType: 'text/javascript',
          size: 200,
          storageKey: 'users/user-123/src/testing.js',
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockFileRepository.search.mockResolvedValue(mockFiles);

      const result = await fileService.searchFiles(mockUserId, searchQuery);

      expect(mockFileRepository.search).toHaveBeenCalledWith(searchQuery, mockUserId);
      expect(result).toEqual(mockFiles);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no matches found', async () => {
      const searchQuery = 'nonexistent';

      mockFileRepository.search.mockResolvedValue([]);

      const result = await fileService.searchFiles(mockUserId, searchQuery);

      expect(mockFileRepository.search).toHaveBeenCalledWith(searchQuery, mockUserId);
      expect(result).toEqual([]);
    });

    it('should search with partial matches', async () => {
      const searchQuery = 'py';
      const mockFiles: FileMetadata[] = [
        {
          id: 'file-1',
          userId: mockUserId,
          name: 'main.py',
          path: '/main.py',
          parentId: null,
          isDirectory: false,
          mimeType: 'text/plain',
          size: 100,
          storageKey: 'users/user-123/main.py',
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'file-2',
          userId: mockUserId,
          name: 'utils.py',
          path: '/utils.py',
          parentId: null,
          isDirectory: false,
          mimeType: 'text/plain',
          size: 150,
          storageKey: 'users/user-123/utils.py',
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockFileRepository.search.mockResolvedValue(mockFiles);

      const result = await fileService.searchFiles(mockUserId, searchQuery);

      expect(result).toHaveLength(2);
      expect(result.every((file) => file.name.includes(searchQuery))).toBe(true);
    });

    it('should not return deleted files in search results', async () => {
      const searchQuery = 'test';
      const mockFiles: FileMetadata[] = [
        {
          id: 'file-1',
          userId: mockUserId,
          name: 'test.py',
          path: '/test.py',
          parentId: null,
          isDirectory: false,
          mimeType: 'text/plain',
          size: 100,
          storageKey: 'users/user-123/test.py',
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockFileRepository.search.mockResolvedValue(mockFiles);

      const result = await fileService.searchFiles(mockUserId, searchQuery);

      expect(result.every((file) => file.deletedAt === null)).toBe(true);
    });
  });

  describe('getTrash', () => {
    it('should return all soft-deleted files', async () => {
      const deletedDate = new Date();
      const mockDeletedFiles: FileMetadata[] = [
        {
          id: 'file-1',
          userId: mockUserId,
          name: 'deleted1.py',
          path: '/deleted1.py',
          parentId: null,
          isDirectory: false,
          mimeType: 'text/plain',
          size: 100,
          storageKey: 'users/user-123/deleted1.py',
          deletedAt: deletedDate,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'file-2',
          userId: mockUserId,
          name: 'deleted2.js',
          path: '/src/deleted2.js',
          parentId: 'dir-1',
          isDirectory: false,
          mimeType: 'text/javascript',
          size: 200,
          storageKey: 'users/user-123/src/deleted2.js',
          deletedAt: deletedDate,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockFileRepository.getDeleted.mockResolvedValue(mockDeletedFiles);

      const result = await fileService.getTrash(mockUserId);

      expect(mockFileRepository.getDeleted).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockDeletedFiles);
      expect(result).toHaveLength(2);
      expect(result.every((file) => file.deletedAt !== null)).toBe(true);
    });

    it('should return empty array when trash is empty', async () => {
      mockFileRepository.getDeleted.mockResolvedValue([]);

      const result = await fileService.getTrash(mockUserId);

      expect(mockFileRepository.getDeleted).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual([]);
    });

    it('should return deleted directories with files', async () => {
      const deletedDate = new Date();
      const mockDeletedFiles: FileMetadata[] = [
        {
          id: 'dir-1',
          userId: mockUserId,
          name: 'deleted-folder',
          path: '/deleted-folder',
          parentId: null,
          isDirectory: true,
          mimeType: null,
          size: 0,
          storageKey: null,
          deletedAt: deletedDate,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'file-1',
          userId: mockUserId,
          name: 'file-in-deleted-folder.py',
          path: '/deleted-folder/file-in-deleted-folder.py',
          parentId: 'dir-1',
          isDirectory: false,
          mimeType: 'text/plain',
          size: 100,
          storageKey: 'users/user-123/deleted-folder/file.py',
          deletedAt: deletedDate,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockFileRepository.getDeleted.mockResolvedValue(mockDeletedFiles);

      const result = await fileService.getTrash(mockUserId);

      expect(result).toHaveLength(2);
      expect(result.some((file) => file.isDirectory)).toBe(true);
    });

    it('should only return files for the specific user', async () => {
      const deletedDate = new Date();
      const mockDeletedFiles: FileMetadata[] = [
        {
          id: 'file-1',
          userId: mockUserId,
          name: 'user-file.py',
          path: '/user-file.py',
          parentId: null,
          isDirectory: false,
          mimeType: 'text/plain',
          size: 100,
          storageKey: 'users/user-123/user-file.py',
          deletedAt: deletedDate,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockFileRepository.getDeleted.mockResolvedValue(mockDeletedFiles);

      const result = await fileService.getTrash(mockUserId);

      expect(result.every((file) => file.userId === mockUserId)).toBe(true);
    });
  });

  describe('restoreFile', () => {
    it('should restore a soft-deleted file', async () => {
      const deletedFile: FileMetadata = {
        id: 'file-123',
        userId: mockUserId,
        name: 'deleted.py',
        path: '/deleted.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/plain',
        size: 100,
        storageKey: 'users/user-123/deleted.py',
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const restoredFile: FileMetadata = {
        ...deletedFile,
        deletedAt: null,
        updatedAt: new Date(),
      };

      mockFileRepository.findByIdIncludingDeleted.mockResolvedValue(deletedFile);
      mockFileRepository.restore.mockResolvedValue(restoredFile);

      const result = await fileService.restoreFile('file-123', mockUserId);

      expect(mockFileRepository.findByIdIncludingDeleted).toHaveBeenCalledWith(
        'file-123',
        mockUserId
      );
      expect(mockFileRepository.restore).toHaveBeenCalledWith('file-123', mockUserId);
      expect(result.deletedAt).toBeNull();
    });

    it('should throw error if file not found', async () => {
      mockFileRepository.findByIdIncludingDeleted.mockResolvedValue(null);

      await expect(fileService.restoreFile('file-999', mockUserId)).rejects.toThrow(
        'File not found'
      );
    });

    it('should throw error if file is not deleted', async () => {
      const activeFile: FileMetadata = {
        id: 'file-123',
        userId: mockUserId,
        name: 'active.py',
        path: '/active.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/plain',
        size: 100,
        storageKey: 'users/user-123/active.py',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.findByIdIncludingDeleted.mockResolvedValue(activeFile);

      await expect(fileService.restoreFile('file-123', mockUserId)).rejects.toThrow(
        'File is not deleted'
      );
    });

    it('should restore directory and all children recursively', async () => {
      const deletedDir: FileMetadata = {
        id: 'dir-123',
        userId: mockUserId,
        name: 'deleted-folder',
        path: '/deleted-folder',
        parentId: null,
        isDirectory: true,
        mimeType: null,
        size: 0,
        storageKey: null,
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const deletedChild: FileMetadata = {
        id: 'file-456',
        userId: mockUserId,
        name: 'child.py',
        path: '/deleted-folder/child.py',
        parentId: 'dir-123',
        isDirectory: false,
        mimeType: 'text/plain',
        size: 100,
        storageKey: 'users/user-123/deleted-folder/child.py',
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.findByIdIncludingDeleted.mockResolvedValue(deletedDir);
      mockFileRepository.getDescendants.mockResolvedValue([deletedChild]);
      mockFileRepository.restore.mockResolvedValue({ ...deletedDir, deletedAt: null });

      await fileService.restoreFile('dir-123', mockUserId);

      expect(mockFileRepository.getDescendants).toHaveBeenCalledWith('dir-123', mockUserId);
      expect(mockFileRepository.restore).toHaveBeenCalledWith('file-456', mockUserId);
      expect(mockFileRepository.restore).toHaveBeenCalledWith('dir-123', mockUserId);
    });
  });
  describe('uploadFile', () => {
    const mockUploadedFile = (name: string, content: string) => ({
      fieldname: 'file',
      originalname: name,
      encoding: '7bit',
      mimetype: 'text/plain',
      size: Buffer.byteLength(content),
      buffer: Buffer.from(content),
    });

    it('should upload file and store with correct metadata', async () => {
      const file = mockUploadedFile('test.py', 'print("hello")');
      const mockCreated: FileMetadata = {
        id: 'file-123',
        userId: mockUserId,
        name: 'test.py',
        path: '/test.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/plain',
        size: file.size,
        storageKey: 'users/user-123/test.py',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.pathExists.mockResolvedValue(false);
      mockStorageService.generateKey.mockReturnValue('users/user-123/test.py');
      mockStorageService.uploadFile.mockResolvedValue(undefined as any);
      mockFileRepository.create.mockResolvedValue(mockCreated);

      const result = await fileService.uploadFile(mockUserId, file, undefined, '/test.py');

      expect(mockFileRepository.pathExists).toHaveBeenCalledWith('/test.py', mockUserId);
      expect(mockStorageService.generateKey).toHaveBeenCalledWith(mockUserId, '/test.py');
      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        'users/user-123/test.py',
        expect.anything(),
        'text/plain'
      );
      expect(mockFileRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          name: 'test.py',
          path: '/test.py',
          isDirectory: false,
        })
      );
      expect(result).toEqual(mockCreated);
    });

    it('should default path to /filename when no targetPath provided', async () => {
      const file = mockUploadedFile('nopath.py', 'x = 1');
      const mockCreated: FileMetadata = {
        id: 'file-123',
        userId: mockUserId,
        name: 'nopath.py',
        path: '/nopath.py',
        parentId: null,
        isDirectory: false,
        mimeType: 'text/plain',
        size: file.size,
        storageKey: 'users/user-123/nopath.py',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.pathExists.mockResolvedValue(false);
      mockStorageService.generateKey.mockReturnValue('users/user-123/nopath.py');
      mockStorageService.uploadFile.mockResolvedValue(undefined as any);
      mockFileRepository.create.mockResolvedValue(mockCreated);

      const result = await fileService.uploadFile(mockUserId, file);

      expect(mockFileRepository.pathExists).toHaveBeenCalledWith('/nopath.py', mockUserId);
      expect(result.path).toBe('/nopath.py');
    });

    it('should throw error when file has no originalname', async () => {
      const file = { ...mockUploadedFile('', ''), originalname: '' };

      await expect(fileService.uploadFile(mockUserId, file)).rejects.toThrow('File has no name');

      expect(mockFileRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when path already exists', async () => {
      const file = mockUploadedFile('existing.py', 'x = 1');

      mockFileRepository.pathExists.mockResolvedValue(true);

      await expect(
        fileService.uploadFile(mockUserId, file, undefined, '/existing.py')
      ).rejects.toThrow('File already exists at path: /existing.py');

      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
      expect(mockFileRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when parentId does not exist', async () => {
      const file = mockUploadedFile('child.py', 'x = 1');

      mockFileRepository.pathExists.mockResolvedValue(false);
      mockFileRepository.findById.mockResolvedValue(null);

      await expect(
        fileService.uploadFile(mockUserId, file, 'nonexistent-dir', '/src/child.py')
      ).rejects.toThrow('Parent directory not found');

      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
    });

    it('should throw error when parent is not a directory', async () => {
      const file = mockUploadedFile('child.py', 'x = 1');
      const mockFile: FileMetadata = {
        id: 'file-parent',
        userId: mockUserId,
        name: 'notadir.py',
        path: '/notadir.py',
        parentId: null,
        isDirectory: false, // ← not a directory
        mimeType: 'text/plain',
        size: 100,
        storageKey: 'key',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.pathExists.mockResolvedValue(false);
      mockFileRepository.findById.mockResolvedValue(mockFile);

      await expect(
        fileService.uploadFile(mockUserId, file, 'file-parent', '/notadir.py/child.py')
      ).rejects.toThrow('Parent must be a directory');
    });

    it('should upload file into a valid parent directory', async () => {
      const file = mockUploadedFile('main.py', 'print("main")');
      const mockDir: FileMetadata = {
        id: 'dir-123',
        userId: mockUserId,
        name: 'src',
        path: '/src',
        parentId: null,
        isDirectory: true,
        mimeType: null,
        size: 0,
        storageKey: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockCreated: FileMetadata = {
        id: 'file-456',
        userId: mockUserId,
        name: 'main.py',
        path: '/src/main.py',
        parentId: 'dir-123',
        isDirectory: false,
        mimeType: 'text/plain',
        size: file.size,
        storageKey: 'users/user-123/src/main.py',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFileRepository.pathExists.mockResolvedValue(false);
      mockFileRepository.findById.mockResolvedValue(mockDir);
      mockStorageService.generateKey.mockReturnValue('users/user-123/src/main.py');
      mockStorageService.uploadFile.mockResolvedValue(undefined as any);
      mockFileRepository.create.mockResolvedValue(mockCreated);

      const result = await fileService.uploadFile(mockUserId, file, 'dir-123', '/src/main.py');

      expect(mockFileRepository.findById).toHaveBeenCalledWith('dir-123', mockUserId);
      expect(result.parentId).toBe('dir-123');
      expect(result.path).toBe('/src/main.py');
    });
  });
});
