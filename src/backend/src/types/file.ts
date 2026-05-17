export interface FileMetadata {
  id: string;
  userId: string;
  name: string;
  path: string;
  parentId: string | null;
  isDirectory: boolean;
  mimeType: string | null;
  size: number;
  storageKey: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFileRequest {
  name: string;
  path: string;
  parentId?: string;
  isDirectory?: boolean;
  content?: string;
}

export interface UpdateFileRequest {
  name?: string;
  path?: string;
  parentId?: string;
  content?: string;
}

export interface ListFilesQuery {
  parentId?: string | null;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mimeType: string | null;
  createdAt: Date;
  updatedAt: Date;
  children?: FileTreeNode[];
}

export interface MoveFileData {
  newParentId: string | null;
  newPath: string;
}

export interface CopyFileData {
  newName: string;
  newPath: string;
  newParentId?: string | null;
}

export interface RenameFileData {
  newName: string;
}

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string | null;
  size: number;
  buffer: Buffer;
}
