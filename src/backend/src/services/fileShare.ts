import { fileShareRepository } from '../repositories/fileShare';
import { fileRepository } from '../repositories/file';

export class FileShareService {
  async createShare(fileId: string, ownerId: string, expiresInHours?: number) {
    const file = await fileRepository.findById(fileId, ownerId);
    if (!file) {
      throw new Error('File not found');
    }

    const existing = await fileShareRepository.findByFileAndOwner(fileId, ownerId);
    if (existing) {
      return existing;
    }

    return fileShareRepository.create(fileId, ownerId, expiresInHours);
  }

  async resolveShare(shareCode: string) {
    const share = await fileShareRepository.findByCode(shareCode);
    if (!share) {
      throw new Error('Share link is invalid or has expired');
    }
    return share;
  }

  async revokeShare(fileId: string, ownerId: string) {
    const existing = await fileShareRepository.findByFileAndOwner(fileId, ownerId);
    if (!existing) {
      throw new Error('No active share found for this file');
    }
    await fileShareRepository.deleteByFileAndOwner(fileId, ownerId);
  }
}

export const fileShareService = new FileShareService();
