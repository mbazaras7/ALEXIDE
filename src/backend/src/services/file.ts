import { fileRepository } from '../repositories/file';
import { storageService } from './storage';
import {
  CreateFileRequest,
  UpdateFileRequest,
  FileMetadata,
  ListFilesQuery,
  FileTreeNode,
  MoveFileData,
  CopyFileData,
  RenameFileData,
  UploadedFile,
} from '../types/file';
import * as mime from 'mime-types';
import { deleteDocState } from '../config/redis';

export class FileService {
  //New file or directory
  async createFile(userId: string, data: CreateFileRequest): Promise<FileMetadata> {
    const exists = await fileRepository.pathExists(data.path, userId);
    if (exists) {
      throw new Error(`File already exists at path: ${data.path}`);
    }

    if (data.parentId) {
      const parent = await fileRepository.findById(data.parentId, userId);
      if (!parent) {
        throw new Error('Parent directory not found');
      }
      if (!parent.isDirectory) {
        throw new Error('Parent must be a directory');
      }
    }

    const isDirectory = data.isDirectory ?? false;
    let storageKey: string | null = null;
    let fileSize = 0;
    let mimeType: string | null = null;

    if (!isDirectory && data.content) {
      storageKey = storageService.generateKey(userId, data.path);
      mimeType = mime.lookup(data.name) || 'text/plain';
      await storageService.uploadFile(storageKey, data.content, mimeType);
      fileSize = Buffer.byteLength(data.content, 'utf8');
    }

    return fileRepository.create({
      userId,
      name: data.name,
      path: data.path,
      parentId: data.parentId,
      isDirectory,
      mimeType: mimeType ?? undefined,
      size: fileSize,
      storageKey: storageKey ?? undefined,
    });
  }

  async getFile(fileId: string, userId: string): Promise<FileMetadata | null> {
    return fileRepository.findById(fileId, userId);
  }

  async getFileContent(fileId: string, userId: string): Promise<Buffer> {
    const file = await fileRepository.findById(fileId, userId);

    if (!file) {
      throw new Error('File not found');
    }

    if (file.isDirectory) {
      throw new Error('Cannot download directory content');
    }

    if (!file.storageKey) {
      throw new Error('File has no storage key');
    }

    return await storageService.downloadFile(file.storageKey);
  }

  async listFiles(userId: string, query: ListFilesQuery = {}): Promise<FileMetadata[]> {
    return fileRepository.list(userId, query);
  }

  async getFileTree(userId: string, rootId?: string): Promise<FileTreeNode[]> {
    const files = await fileRepository.list(userId, {
      parentId: rootId ?? null,
    });

    const tree: FileTreeNode[] = [];

    for (const file of files) {
      const node: FileTreeNode = {
        id: file.id,
        name: file.name,
        path: file.path,
        isDirectory: file.isDirectory,
        size: file.size,
        mimeType: file.mimeType,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      };

      //Recursively get children for directories
      if (file.isDirectory) {
        node.children = await this.getFileTree(userId, file.id);
      }

      tree.push(node);
    }

    return tree;
  }

  async updateFile(fileId: string, userId: string, data: UpdateFileRequest): Promise<FileMetadata> {
    const file = await fileRepository.findById(fileId, userId);

    if (!file) {
      throw new Error('File not found');
    }

    if (data.path && data.path !== file.path) {
      const exists = await fileRepository.pathExists(data.path, userId);
      if (exists) {
        throw new Error(`File already exists at path: ${data.path}`);
      }
    }

    let updatedSize = file.size;
    let updatedStorageKey = file.storageKey;

    if (data.content && !file.isDirectory) {
      const storageKey = file.storageKey ?? storageService.generateKey(userId, file.path);
      await storageService.uploadFile(storageKey, data.content, file.mimeType ?? 'text/plain');
      updatedSize = Buffer.byteLength(data.content, 'utf8');
      updatedStorageKey = storageKey;
    }

    const updated = await fileRepository.update(fileId, {
      name: data.name,
      path: data.path,
      parentId: data.parentId,
      size: updatedSize,
      storageKey: updatedStorageKey ?? undefined,
    });

    if (!updated) throw new Error('Failed to update file');

    return updated;
  }

  async deleteFile(fileId: string, userId: string): Promise<void> {
    const file = await fileRepository.findById(fileId, userId);
    if (!file) {
      throw new Error('File not found');
    }
    //Soft-delete all descendants first, then the file/directory itself
    if (file.isDirectory) {
      await this.deleteDirectoryRecursive(fileId, userId);
    }

    const deleted = await fileRepository.softDelete(fileId, userId);

    if (!deleted) {
      throw new Error('Failed to delete file');
    }
  }

  async permanentlyDeleteFile(fileId: string, userId: string): Promise<void> {
    const file = await fileRepository.findById(fileId, userId);

    if (!file) {
      throw new Error('File not found');
    }

    if (file.storageKey && !file.isDirectory) {
      try {
        await storageService.deleteFile(file.storageKey);
      } catch (error) {
        console.error('Failed to delete file from storage:', error);
      }
    }

    await fileRepository.hardDelete(fileId, userId);
    await deleteDocState(fileId);
  }

  async moveFile(fileId: string, userId: string, data: MoveFileData): Promise<FileMetadata> {
    const file = await fileRepository.findById(fileId, userId);
    if (!file) {
      throw new Error('File not found');
    }

    if (data.newParentId) {
      const newParent = await fileRepository.findById(data.newParentId, userId);
      if (!newParent) {
        throw new Error('Target directory not found');
      }
      if (!newParent.isDirectory) {
        throw new Error('Target must be a directory');
      }

      if (file.isDirectory) {
        const isDescendant = await this.isDescendantOf(data.newParentId, fileId, userId);
        if (isDescendant || data.newParentId === fileId) {
          throw new Error('Cannot move directory into itself or its subdirectories');
        }
      }
    }

    if (data.newPath !== file.path) {
      const targetExists = await fileRepository.pathExists(data.newPath, userId);
      if (targetExists) throw new Error(`File already exists at path: ${data.newPath}`);
    }

    //Move file in storage, if not a directory
    if (!file.isDirectory && file.storageKey) {
      const newStorageKey = storageService.generateKey(userId, data.newPath);
      const content = await storageService.downloadFile(file.storageKey);
      await storageService.uploadFile(newStorageKey, content, file.mimeType ?? 'text/plain');
      await storageService.deleteFile(file.storageKey);

      const updated = await fileRepository.update(fileId, {
        path: data.newPath,
        parentId: data.newParentId ?? null,
        storageKey: newStorageKey,
      });
      if (!updated) throw new Error('Failed to move file');
      return updated;
    }

    const updatedDir = await fileRepository.update(fileId, {
      path: data.newPath,
      parentId: data.newParentId ?? null,
    });
    if (!updatedDir) throw new Error('Failed to move directory');

    if (file.isDirectory) {
      await this.updateDescendantPaths(fileId, userId, file.path, data.newPath);
    }

    return updatedDir;
  }

  async copyFile(fileId: string, userId: string, data: CopyFileData): Promise<FileMetadata> {
    const file = await fileRepository.findById(fileId, userId);
    if (!file) {
      throw new Error('File not found');
    }

    if (data.newParentId) {
      const newParent = await fileRepository.findById(data.newParentId, userId);
      if (!newParent) {
        throw new Error('Target directory not found');
      }
      if (!newParent.isDirectory) {
        throw new Error('Target must be a directory');
      }
    }

    const targetExists = await fileRepository.pathExists(data.newPath, userId);
    if (targetExists) throw new Error(`File already exists at path: ${data.newPath}`);

    return file.isDirectory
      ? this.copyDirectory(file, userId, data)
      : this.copySingleFile(file, userId, data);
  }

  async renameFile(fileId: string, userId: string, data: RenameFileData): Promise<FileMetadata> {
    const file = await fileRepository.findById(fileId, userId);
    if (!file) throw new Error('File not found');

    //Calculate new path
    const parentPath = file.parentId
      ? (await fileRepository.findById(file.parentId, userId))?.path || ''
      : '';

    const newPath = parentPath ? `${parentPath}/${data.newName}` : `/${data.newName}`;

    if (newPath !== file.path) {
      const pathExists = await fileRepository.pathExists(newPath, userId);
      if (pathExists) {
        throw new Error(`A file with the name "${data.newName}" already exists in this location`);
      }
    }

    if (!file.isDirectory && file.storageKey) {
      const newStorageKey = storageService.generateKey(userId, newPath);
      const content = await storageService.downloadFile(file.storageKey);
      await storageService.uploadFile(newStorageKey, content, file.mimeType ?? 'text/plain');
      await storageService.deleteFile(file.storageKey);

      const updated = await fileRepository.update(fileId, {
        name: data.newName,
        path: newPath,
        storageKey: newStorageKey,
      });

      if (!updated) {
        throw new Error('Failed to rename file');
      }

      return updated;
    }

    const updated = await fileRepository.update(fileId, {
      name: data.newName,
      path: newPath,
    });
    if (!updated) throw new Error('Failed to rename file');

    if (file.isDirectory) {
      await this.updateDescendantPaths(fileId, userId, file.path, newPath);
    }

    return updated;
  }

  async searchFiles(userId: string, searchTerm: string): Promise<FileMetadata[]> {
    return fileRepository.search(searchTerm, userId);
  }

  async getTrash(userId: string): Promise<FileMetadata[]> {
    return fileRepository.getDeleted(userId);
  }

  async restoreFile(id: string, userId: string): Promise<FileMetadata> {
    const file = await fileRepository.findByIdIncludingDeleted(id, userId);

    if (!file) {
      throw new Error('File not found');
    }

    if (!file.deletedAt) {
      throw new Error('File is not deleted');
    }

    if (file.isDirectory) {
      const descendants = await fileRepository.getDescendants(id, userId);
      for (const descendant of descendants) {
        await fileRepository.restore(descendant.id, userId);
      }
    }

    return fileRepository.restore(id, userId);
  }

  async uploadFile(
    userId: string,
    file: UploadedFile,
    parentId?: string,
    targetPath?: string
  ): Promise<FileMetadata> {
    if (!file.originalname) {
      throw new Error('File has no name');
    }
    const fileName = file.originalname;
    const filePath = targetPath?.trim() ? targetPath : `/${fileName}`;
    const mimeType = file.mimetype || mime.lookup(fileName) || 'application/octet-stream';

    const exists = await fileRepository.pathExists(filePath, userId);
    if (exists) throw new Error(`File already exists at path: ${filePath}`);

    if (parentId) {
      const parent = await fileRepository.findById(parentId, userId);
      if (!parent) throw new Error('Parent directory not found');
      if (!parent.isDirectory) throw new Error('Parent must be a directory');
    }

    const storageKey = storageService.generateKey(userId, filePath);
    //Pass raw Buffer to preserve binary files (images, PDFs, etc.)
    await storageService.uploadFile(storageKey, file.buffer, mimeType);

    return fileRepository.create({
      userId,
      name: fileName,
      path: filePath,
      parentId: parentId ?? null,
      isDirectory: false,
      mimeType,
      size: file.size,
      storageKey,
    });
  }

  //Private Helpers

  private async deleteDirectoryRecursive(directoryId: string, userId: string): Promise<void> {
    const children = await fileRepository.getChildren(directoryId, userId);
    for (const child of children) {
      if (child.isDirectory) {
        await this.deleteDirectoryRecursive(child.id, userId);
      }
      await fileRepository.softDelete(child.id, userId);
    }
  }

  private async copySingleFile(
    file: FileMetadata,
    userId: string,
    data: CopyFileData
  ): Promise<FileMetadata> {
    let newStorageKey: string | null = null;

    if (file.storageKey) {
      newStorageKey = storageService.generateKey(userId, data.newPath);
      const content = await storageService.downloadFile(file.storageKey);
      await storageService.uploadFile(newStorageKey, content, file.mimeType ?? 'text/plain');
    }

    return fileRepository.create({
      userId,
      name: data.newName,
      path: data.newPath,
      parentId: data.newParentId ?? null,
      isDirectory: false,
      mimeType: file.mimeType ?? undefined,
      size: file.size,
      storageKey: newStorageKey ?? undefined,
    });
  }

  private async copyDirectory(
    directory: FileMetadata,
    userId: string,
    data: CopyFileData
  ): Promise<FileMetadata> {
    const newDirectory = await fileRepository.create({
      userId,
      name: data.newName,
      path: data.newPath,
      parentId: data.newParentId ?? null,
      isDirectory: true,
    });

    const children = await fileRepository.getChildren(directory.id, userId);

    for (const child of children) {
      const childNewPath = data.newPath + child.path.substring(directory.path.length);

      if (child.isDirectory) {
        await this.copyDirectory(child, userId, {
          newName: child.name,
          newPath: childNewPath,
          newParentId: newDirectory.id,
        });
      } else {
        await this.copySingleFile(child, userId, {
          newName: child.name,
          newPath: childNewPath,
          newParentId: newDirectory.id,
        });
      }
    }

    return newDirectory;
  }

  private async isDescendantOf(
    targetId: string,
    ancestorId: string,
    userId: string
  ): Promise<boolean> {
    const target = await fileRepository.findById(targetId, userId);
    if (!target?.parentId) return false;
    if (target.parentId === ancestorId) return true;
    return this.isDescendantOf(target.parentId, ancestorId, userId);
  }

  private async updateDescendantPaths(
    directoryId: string,
    userId: string,
    oldBasePath: string,
    newBasePath: string
  ): Promise<void> {
    const descendants = await fileRepository.getDescendants(directoryId, userId);

    for (const descendant of descendants) {
      const newPath = descendant.path.replace(oldBasePath, newBasePath);

      if (!descendant.isDirectory && descendant.storageKey) {
        const newStorageKey = storageService.generateKey(userId, newPath);
        const content = await storageService.downloadFile(descendant.storageKey);
        await storageService.uploadFile(
          newStorageKey,
          content,
          descendant.mimeType ?? 'text/plain'
        );
        await storageService.deleteFile(descendant.storageKey);
        await fileRepository.update(descendant.id, { path: newPath, storageKey: newStorageKey });
      } else {
        await fileRepository.update(descendant.id, { path: newPath });
      }
    }
  }
}

export const fileService = new FileService();
