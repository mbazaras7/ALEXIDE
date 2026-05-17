import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

const mockContainer = {
  id: 'mock-container-abc123',
  start: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  stop: jest.fn<(options?: any) => Promise<void>>().mockResolvedValue(undefined),
  remove: jest.fn<(options?: any) => Promise<void>>().mockResolvedValue(undefined),
  inspect: jest
    .fn<() => Promise<{ State: { Running: boolean } }>>()
    .mockResolvedValue({ State: { Running: true } }),
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

import { ContainerService } from '../container';

function makeService() {
  return new ContainerService();
}

describe('ContainerService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockContainer.inspect.mockResolvedValue({ State: { Running: true } });
    mockContainer.start.mockResolvedValue(undefined);
    mockContainer.stop.mockResolvedValue(undefined);
    mockContainer.remove.mockResolvedValue(undefined);
    mockDocker.listNetworks.mockResolvedValue([]);
    mockDocker.createNetwork.mockResolvedValue(undefined);
    mockDocker.createContainer.mockResolvedValue(mockContainer);
    mockDocker.listContainers.mockResolvedValue([]);
    mockDocker.getContainer.mockReturnValue(mockContainer);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('ensureExecNetwork', () => {
    it('should create the network if it does not exist', async () => {
      mockDocker.listNetworks.mockResolvedValueOnce([]);
      const service = makeService();
      await service.ensureExecNetwork();
      expect(mockDocker.createNetwork).toHaveBeenCalledTimes(1);
      expect(mockDocker.createNetwork).toHaveBeenCalledWith(
        expect.objectContaining({ Name: 'alexide-exec-network', Internal: true })
      );
    });

    it('should not create the network if it already exists', async () => {
      mockDocker.listNetworks.mockResolvedValueOnce([{ Name: 'alexide-exec-network' }]);
      const service = makeService();
      await service.ensureExecNetwork();
      expect(mockDocker.createNetwork).not.toHaveBeenCalled();
    });
  });

  describe('pruneOrphanedContainers', () => {
    it('should stop and remove containers prefixed with alexide-exec-', async () => {
      mockDocker.listContainers.mockResolvedValueOnce([
        { Id: 'orphan-1', Names: ['/alexide-exec-old-user'] },
        { Id: 'other-1', Names: ['/some-other-container'] },
      ]);
      const service = makeService();
      await service.pruneOrphanedContainers();
      expect(mockDocker.getContainer).toHaveBeenCalledWith('orphan-1');
      expect(mockDocker.getContainer).not.toHaveBeenCalledWith('other-1');
      expect(mockContainer.remove).toHaveBeenCalledTimes(1);
    });

    it('should do nothing when there are no orphaned containers', async () => {
      mockDocker.listContainers.mockResolvedValueOnce([]);
      const service = makeService();
      await service.pruneOrphanedContainers();
      expect(mockDocker.getContainer).not.toHaveBeenCalled();
    });
  });

  describe('getOrCreateContainer', () => {
    it('should create a new container for a new user', async () => {
      const service = makeService();
      const container = await service.getOrCreateContainer('user-001');
      expect(mockDocker.createContainer).toHaveBeenCalledTimes(1);
      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'alexide-exec-user-001',
          User: 'sandbox',
          WorkingDir: '/sandbox',
        })
      );
      expect(mockContainer.start).toHaveBeenCalledTimes(1);
      expect(container.id).toBe('mock-container-abc123');
    });

    it('should reuse an existing running container', async () => {
      const service = makeService();
      await service.getOrCreateContainer('user-002');
      await service.getOrCreateContainer('user-002');
      expect(mockDocker.createContainer).toHaveBeenCalledTimes(1);
    });

    it('should recreate container if existing one is stopped', async () => {
      const service = makeService();
      await service.getOrCreateContainer('user-003');
      mockContainer.inspect.mockResolvedValueOnce({ State: { Running: false } });
      await service.getOrCreateContainer('user-003');
      expect(mockDocker.createContainer).toHaveBeenCalledTimes(2);
    });

    it('should recreate container if inspect throws (container gone)', async () => {
      const service = makeService();
      await service.getOrCreateContainer('user-004');
      mockContainer.inspect.mockRejectedValueOnce(new Error('No such container'));
      await service.getOrCreateContainer('user-004');
      expect(mockDocker.createContainer).toHaveBeenCalledTimes(2);
    });
  });

  describe('destroyContainer', () => {
    it('should stop and remove the container', async () => {
      const service = makeService();
      await service.getOrCreateContainer('user-005');
      await service.destroyContainer('user-005');
      expect(mockContainer.stop).toHaveBeenCalledTimes(1);
      expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
    });

    it('should remove the user from the registry after destroy', async () => {
      const service = makeService();
      await service.getOrCreateContainer('user-006');
      await service.destroyContainer('user-006');
      const active = service.getActiveContainers();
      expect(active.find((c) => c.userId === 'user-006')).toBeUndefined();
    });

    it('should do nothing if no container exists for the user', async () => {
      const service = makeService();
      await expect(service.destroyContainer('ghost-user')).resolves.not.toThrow();
      expect(mockContainer.stop).not.toHaveBeenCalled();
    });

    it('should not throw if stop returns 304 (already stopped)', async () => {
      const service = makeService();
      await service.getOrCreateContainer('user-007');
      const err: any = new Error('already stopped');
      err.statusCode = 304;
      mockContainer.stop.mockRejectedValueOnce(err);
      await expect(service.destroyContainer('user-007')).resolves.not.toThrow();
    });

    it('should not throw if remove returns 404 (already gone)', async () => {
      const service = makeService();
      await service.getOrCreateContainer('user-008');
      const err: any = new Error('not found');
      err.statusCode = 404;
      mockContainer.remove.mockRejectedValueOnce(err);
      await expect(service.destroyContainer('user-008')).resolves.not.toThrow();
    });
  });

  describe('recordActivity', () => {
    it('should update lastActivity timestamp', async () => {
      const service = makeService();
      await service.getOrCreateContainer('user-009');
      const before = service.getActiveContainers().find((c) => c.userId === 'user-009')!.info
        .lastActivity;
      await new Promise((r) => setTimeout(r, 10));
      service.recordActivity('user-009');
      const after = service.getActiveContainers().find((c) => c.userId === 'user-009')!.info
        .lastActivity;
      expect(after.getTime()).toBeGreaterThan(before.getTime());
    });

    it('should do nothing if user has no container', () => {
      const service = makeService();
      expect(() => service.recordActivity('nobody')).not.toThrow();
    });
  });

  describe('inactivity timer', () => {
    it('should auto-destroy container after inactivity timeout', async () => {
      jest.useFakeTimers();
      const service = makeService();
      await service.getOrCreateContainer('user-010');
      jest.advanceTimersByTime(10 * 60 * 1000 + 1000);
      await Promise.resolve();
      expect(mockContainer.stop).toHaveBeenCalled();
      expect(mockContainer.remove).toHaveBeenCalled();
    });

    it('should reset the timer on recordActivity', async () => {
      jest.useFakeTimers();
      const service = makeService();
      await service.getOrCreateContainer('user-011');
      jest.advanceTimersByTime(9 * 60 * 1000);
      service.recordActivity('user-011');
      jest.advanceTimersByTime(2 * 60 * 1000);
      await Promise.resolve();
      const active = service.getActiveContainers();
      expect(active.find((c) => c.userId === 'user-011')).toBeDefined();
    });
  });

  describe('getActiveContainers', () => {
    it('should return all active containers', async () => {
      const service = makeService();
      await service.getOrCreateContainer('user-012');
      await service.getOrCreateContainer('user-013');
      const active = service.getActiveContainers();
      expect(active).toHaveLength(2);
      expect(active.map((c) => c.userId)).toContain('user-012');
      expect(active.map((c) => c.userId)).toContain('user-013');
    });

    it('should return empty array when no containers are active', () => {
      const service = makeService();
      expect(service.getActiveContainers()).toEqual([]);
    });
  });
});
