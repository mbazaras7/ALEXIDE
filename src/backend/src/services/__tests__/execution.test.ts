import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockExec = {
  start: jest.fn<(...args: any[]) => any>(),
  inspect: jest.fn<() => Promise<any>>().mockResolvedValue({ ExitCode: 0 }),
};

const mockContainer = {
  id: 'mock-container-abc123',
  start: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  stop: jest.fn<(options?: any) => Promise<void>>().mockResolvedValue(undefined),
  remove: jest.fn<(options?: any) => Promise<void>>().mockResolvedValue(undefined),
  inspect: jest
    .fn<() => Promise<{ State: { Running: boolean } }>>()
    .mockResolvedValue({ State: { Running: true } }),
  exec: jest.fn<(options: any) => Promise<any>>().mockResolvedValue(mockExec),
};

const mockDocker = {
  listNetworks: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  createNetwork: jest.fn<(options: any) => Promise<void>>().mockResolvedValue(undefined),
  createContainer: jest.fn<(options: any) => Promise<any>>(),
  listContainers: jest.fn<(options?: any) => Promise<any[]>>().mockResolvedValue([]),
  getContainer: jest.fn<(id: string) => any>(),
  modem: { demuxStream: jest.fn() },
};

jest.mock('../../config/docker', () => ({
  __esModule: true,
  get default() {
    return mockDocker;
  },
}));

jest.mock('../file', () => ({
  fileService: {
    getFileTree: jest.fn(),
    getFileContent: jest.fn(),
    getFile: jest.fn(),
  },
}));

import {
  ExecutionService,
  syncSingleFileToContainer,
  deleteFromContainer,
  moveInContainer,
  renameInContainer,
} from '../execution';
import { ContainerService } from '../container';
import { fileService } from '../file';

const mockFileService = fileService as jest.Mocked<typeof fileService>;

function makeService() {
  return new ExecutionService();
}

describe('ExecutionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContainer.inspect.mockResolvedValue({ State: { Running: true } });
    mockContainer.start.mockResolvedValue(undefined);
    mockContainer.stop.mockResolvedValue(undefined);
    mockContainer.remove.mockResolvedValue(undefined);
    mockContainer.exec.mockResolvedValue(mockExec);
    mockExec.start.mockResolvedValue({});
    mockExec.inspect.mockResolvedValue({ ExitCode: 0 });
    mockDocker.createContainer.mockResolvedValue(mockContainer);
    mockDocker.getContainer.mockReturnValue(mockContainer);
    mockDocker.listNetworks.mockResolvedValue([]);
    mockDocker.listContainers.mockResolvedValue([]);
  });

  describe('executeCode', () => {
    it('should execute code and return output with exitCode 0', async () => {
      jest.spyOn(ContainerService.prototype, 'collectStream').mockResolvedValue('hello world');

      const service = makeService();
      const result = await service.executeCode('user-001', 'print("hello world")');

      expect(result.output).toBe('hello world');
      expect(result.exitCode).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it('should pass the correct exec command to the container', async () => {
      jest.spyOn(ContainerService.prototype, 'collectStream').mockResolvedValue('');

      const service = makeService();
      await service.executeCode('user-001', 'print("hi")');

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          AttachStdout: true,
          AttachStderr: true,
          User: 'sandbox',
          WorkingDir: '/sandbox',
        })
      );
    });

    it('should return exitCode 1 on non-zero exit', async () => {
      jest
        .spyOn(ContainerService.prototype, 'collectStream')
        .mockResolvedValue('SyntaxError: invalid syntax');
      mockExec.inspect.mockResolvedValueOnce({ ExitCode: 1 });

      const service = makeService();
      const result = await service.executeCode('user-002', 'invalid !!');

      expect(result.exitCode).toBe(1);
      expect(result.output).toBe('SyntaxError: invalid syntax');
    });

    it('should return error and exitCode 1 if exec throws', async () => {
      mockContainer.exec.mockRejectedValueOnce(new Error('Container not running'));

      const service = makeService();
      const result = await service.executeCode('user-003', 'print("hi")');

      expect(result.exitCode).toBe(1);
      expect(result.error).toBe('Container not running');
      expect(result.output).toBe('');
    });

    it('should call recordActivity after execution', async () => {
      jest.spyOn(ContainerService.prototype, 'collectStream').mockResolvedValue('output');
      const recordSpy = jest.spyOn(ContainerService.prototype, 'recordActivity');

      const service = makeService();
      await service.executeCode('user-004', 'print("hi")');

      expect(recordSpy).toHaveBeenCalledWith('user-004');
    });

    it('should throw for unsupported language', async () => {
      const service = makeService();
      const result = await service.executeCode('user-005', 'code', 'javascript' as any);

      expect(result.exitCode).toBe(1);
      expect(result.error).toMatch(/Unsupported language/);
    });

    it('should reuse existing container on second call', async () => {
      jest.spyOn(ContainerService.prototype, 'collectStream').mockResolvedValue('');

      const service = makeService();
      await service.executeCode('user-006', 'print(1)');
      await service.executeCode('user-006', 'print(2)');

      expect(mockDocker.createContainer).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeFile', () => {
    it('should download file from storage and execute it', async () => {
      const mockDownload = jest
        .fn<() => Promise<Buffer>>()
        .mockResolvedValue(Buffer.from('print("from file")'));

      jest.spyOn(ContainerService.prototype, 'collectStream').mockResolvedValue('from file');

      const storageModule = await import('../../services/storage');
      jest.spyOn(storageModule.storageService, 'downloadFile').mockImplementation(mockDownload);

      const service = makeService();
      const result = await service.executeFile('user-007', 'users/user-007/main.py');

      expect(storageModule.storageService.downloadFile).toHaveBeenCalledWith(
        'users/user-007/main.py'
      );
      expect(result.output).toBe('from file');
      expect(result.exitCode).toBe(0);
    });
  });
});
describe('syncSingleFileToContainer', () => {
  //Might have to expand on these tests
  it('does nothing if the file is a directory', async () => {
    mockFileService.getFile.mockResolvedValue({
      id: 'dir-1',
      path: '/projects',
      isDirectory: true,
      storageKey: null,
    } as any);

    await syncSingleFileToContainer(mockContainer as any, 'dir-1', 'user-001');

    expect(mockFileService.getFileContent).not.toHaveBeenCalled();
    expect(mockContainer.exec).not.toHaveBeenCalled();
  });

  it('does nothing if file has no storageKey', async () => {
    mockFileService.getFile.mockResolvedValue({
      id: 'file-2',
      path: '/untitled.py',
      isDirectory: false,
      storageKey: null,
    } as any);

    await syncSingleFileToContainer(mockContainer as any, 'file-2', 'user-001');

    expect(mockFileService.getFileContent).not.toHaveBeenCalled();
  });

  it('does nothing if file is not found', async () => {
    mockFileService.getFile.mockResolvedValue(null);

    await syncSingleFileToContainer(mockContainer as any, 'missing-id', 'user-001');

    expect(mockFileService.getFileContent).not.toHaveBeenCalled();
  });

  describe('deleteFromContainer', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockExec.start.mockImplementation((_opts: any, cb: any) => {
        const stream = {
          resume: jest.fn(),
          on: jest.fn((event: string, handler: () => void) => {
            if (event === 'end') handler();
          }),
        };
        cb(null, stream);
      });
      mockContainer.exec.mockResolvedValue(mockExec);
    });

    it('should exec rm -rf with the correct sandbox path for a file', async () => {
      await deleteFromContainer(mockContainer as any, 'projects/main.py');

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ['rm', '-rf', '/sandbox/projects/main.py'],
          User: 'sandbox',
        })
      );
    });

    it('should exec rm -rf for a directory', async () => {
      await deleteFromContainer(mockContainer as any, 'projects');

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ['rm', '-rf', '/sandbox/projects'],
        })
      );
    });

    it('should reject if container exec throws', async () => {
      mockContainer.exec.mockRejectedValueOnce(new Error('exec failed'));

      await expect(deleteFromContainer(mockContainer as any, 'file.py')).rejects.toThrow(
        'exec failed'
      );
    });

    it('should reject if stream emits an error', async () => {
      mockExec.start.mockImplementation((_opts: any, cb: any) => {
        const stream = {
          resume: jest.fn(),
          on: jest.fn((event: string, handler: (err?: Error) => void) => {
            if (event === 'error') handler(new Error('stream error'));
          }),
        };
        cb(null, stream);
      });

      await expect(deleteFromContainer(mockContainer as any, 'file.py')).rejects.toThrow(
        'stream error'
      );
    });
  });

  describe('moveInContainer', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockExec.start.mockImplementation((_opts: any, cb: any) => {
        const stream = {
          resume: jest.fn(),
          on: jest.fn((event: string, handler: () => void) => {
            if (event === 'end') handler();
          }),
        };
        cb(null, stream);
      });
      mockContainer.exec.mockResolvedValue(mockExec);
    });

    it('should exec mkdir + mv when moving a file to a subdirectory', async () => {
      await moveInContainer(mockContainer as any, 'main.py', 'projects/main.py');

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: [
            'sh',
            '-c',
            'mkdir -p "/sandbox/projects" && mv "/sandbox/main.py" "/sandbox/projects/main.py"',
          ],
          User: 'sandbox',
        })
      );
    });

    it('should move a file from a subdirectory back to root', async () => {
      await moveInContainer(mockContainer as any, 'projects/main.py', 'main.py');

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: [
            'sh',
            '-c',
            'mkdir -p "/sandbox" && mv "/sandbox/projects/main.py" "/sandbox/main.py"',
          ],
        })
      );
    });

    it('should move a directory into another directory', async () => {
      await moveInContainer(mockContainer as any, 'utils', 'projects/utils');

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: [
            'sh',
            '-c',
            'mkdir -p "/sandbox/projects" && mv "/sandbox/utils" "/sandbox/projects/utils"',
          ],
        })
      );
    });

    it('should reject if container exec throws', async () => {
      mockContainer.exec.mockRejectedValueOnce(new Error('move failed'));

      await expect(moveInContainer(mockContainer as any, 'old.py', 'new.py')).rejects.toThrow(
        'move failed'
      );
    });

    it('should reject if stream emits an error', async () => {
      mockExec.start.mockImplementation((_opts: any, cb: any) => {
        const stream = {
          resume: jest.fn(),
          on: jest.fn((event: string, handler: (err?: Error) => void) => {
            if (event === 'error') handler(new Error('stream error'));
          }),
        };
        cb(null, stream);
      });

      await expect(moveInContainer(mockContainer as any, 'old.py', 'new.py')).rejects.toThrow(
        'stream error'
      );
    });
  });

  describe('renameInContainer', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockExec.start.mockImplementation((_opts: any, cb: any) => {
        const stream = {
          resume: jest.fn(),
          on: jest.fn((event: string, handler: () => void) => {
            if (event === 'end') handler();
          }),
        };
        cb(null, stream);
      });
      mockContainer.exec.mockResolvedValue(mockExec);
    });

    it('should rename a file at root level', async () => {
      await renameInContainer(mockContainer as any, 'main.py', 'solution.py');

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ['sh', '-c', 'mkdir -p "/sandbox" && mv "/sandbox/main.py" "/sandbox/solution.py"'],
          User: 'sandbox',
        })
      );
    });

    it('should rename a file inside a subdirectory', async () => {
      await renameInContainer(mockContainer as any, 'projects/old.py', 'projects/new.py');

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: [
            'sh',
            '-c',
            'mkdir -p "/sandbox/projects" && mv "/sandbox/projects/old.py" "/sandbox/projects/new.py"',
          ],
        })
      );
    });

    it('should rename a directory', async () => {
      await renameInContainer(mockContainer as any, 'utils', 'helpers');

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ['sh', '-c', 'mkdir -p "/sandbox" && mv "/sandbox/utils" "/sandbox/helpers"'],
        })
      );
    });

    it('should reject if the underlying exec throws', async () => {
      mockContainer.exec.mockRejectedValueOnce(new Error('rename failed'));

      await expect(renameInContainer(mockContainer as any, 'old.py', 'new.py')).rejects.toThrow(
        'rename failed'
      );
    });
  });
});
