import { describe, it, expect, afterEach } from '@jest/globals';
import { storageService } from '../storage';

describe('Storage Service Tests', () => {
  const testKey = 'test-user/test-file.txt';
  const testContent = 'Hello from ALEXIDE storage!';

  afterEach(async () => {
    try {
      await storageService.deleteFile(testKey);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  it('should upload a file', async () => {
    const url = await storageService.uploadFile(testKey, testContent, 'text/plain');
    expect(url).toBeDefined();
    expect(url).toContain(testKey);
  });

  it('should download a file', async () => {
    await storageService.uploadFile(testKey, testContent, 'text/plain');

    const downloaded = await storageService.downloadFile(testKey);
    expect(downloaded.toString()).toBe(testContent);
  });

  it('should check if file exists', async () => {
    const existsBefore = await storageService.fileExists(testKey);
    expect(existsBefore).toBe(false);

    await storageService.uploadFile(testKey, testContent, 'text/plain');

    const existsAfter = await storageService.fileExists(testKey);
    expect(existsAfter).toBe(true);
  });

  it('should delete a file', async () => {
    await storageService.uploadFile(testKey, testContent, 'text/plain');
    await storageService.deleteFile(testKey);

    const exists = await storageService.fileExists(testKey);
    expect(exists).toBe(false);
  });

  it('should generate correct storage key', () => {
    const key = storageService.generateKey('user-123', '/projects/main.py');
    expect(key).toBe('users/user-123/projects/main.py');
  });

  it('should get file metadata', async () => {
    await storageService.uploadFile(testKey, testContent, 'text/plain');

    const metadata = await storageService.getFileMetadata(testKey);
    expect(metadata).not.toBeNull();
    expect(metadata?.size).toBeGreaterThan(0);
    expect(metadata?.contentType).toBe('text/plain');
  });
});
