/* eslint-disable @typescript-eslint/no-explicit-any */
import Docker from 'dockerode';
import { Writable, Readable } from 'stream';
import docker from '../config/docker';
import type { ContainerState } from '../types/container';

const EXEC_NETWORK_NAME = process.env.EXEC_NETWORK_NAME || 'alexide-exec-network';
const EXEC_IMAGE_NAME = process.env.EXEC_IMAGE_NAME || 'alexide-python-executor';
const INACTIVITY_MS = 10 * 60 * 1000; //10 minutes
const MEMORY_BYTES = 128 * 1024 * 1024; //128MB
const CPU_NANOCPUS = 500_000_000; //0.5 cores

export class ContainerService {
  //In-memory registry
  private registry = new Map<string, ContainerState>();

  //Network and Startup

  async ensureExecNetwork(): Promise<void> {
    const networks = await docker.listNetworks();
    const exists = networks.some((n) => n.Name === EXEC_NETWORK_NAME);

    if (!exists) {
      console.log(`Creating exec network "${EXEC_NETWORK_NAME}"...`);
      await docker.createNetwork({
        Name: EXEC_NETWORK_NAME,
        Driver: 'bridge',
        Internal: true,
        CheckDuplicate: true,
      });
      console.log(`Exec network created.`);
    } else {
      console.log(`Exec network already exists.`);
    }
  }

  async pruneOrphanedContainers(): Promise<void> {
    console.log('Pruning orphaned execution containers');
    const containers = await docker.listContainers({ all: true });
    const orphans = containers.filter((c) =>
      c.Names.some((name) => name.startsWith('/alexide-exec-'))
    );

    for (const orphan of orphans) {
      try {
        const c = docker.getContainer(orphan.Id);
        await c.stop({ t: 2 }).catch(() => {});
        await c.remove({ force: true });
        console.log(`Pruned: ${orphan.Names[0]}`);
      } catch (err: any) {
        console.warn(`Failed to prune ${orphan.Names[0]}:`, err?.message);
      }
    }

    console.log(`Pruned ${orphans.length} orphaned container(s).`);
  }

  //Container Lifecycle

  async getOrCreateContainer(userId: string): Promise<Docker.Container> {
    const existing = this.registry.get(userId);

    if (existing) {
      try {
        const inspected = await existing.container.inspect();
        if (inspected.State.Running) {
          this.resetTimer(userId);
          console.log(`Reusing container for user ${userId}.`);
          return existing.container;
        }
        console.log(`Container stopped for user ${userId}. Recreating...`);
        await this.destroyContainer(userId);
      } catch {
        console.log(`Container gone for user ${userId}. Recreating...`);
        this.registry.delete(userId);
      }
    }

    return this.createContainer(userId);
  }

  async destroyContainer(userId: string): Promise<void> {
    const state = this.registry.get(userId);
    if (!state) {
      return;
    }

    clearTimeout(state.inactivityTimer);
    this.registry.delete(userId);

    try {
      await state.container.stop({ t: 2 });
    } catch (err: any) {
      if (err?.statusCode !== 304 && err?.statusCode !== 404) {
        console.warn(`Stop error for ${userId}:`, err?.message);
      }
    }

    try {
      await state.container.remove({ force: true });
      console.log(`Container destroyed for user ${userId}.`);
    } catch (err: any) {
      if (err?.statusCode !== 404) {
        console.warn(`Remove error for ${userId}:`, err?.message);
      }
    }
  }

  recordActivity(userId: string): void {
    this.resetTimer(userId);
  }

  getActiveContainers() {
    return Array.from(this.registry.entries()).map(([userId, state]) => ({
      userId,
      info: state.info,
    }));
  }

  //Stream Utilities

  collectStream(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';

      const stdout = new Writable({
        write(chunk, _encoding, callback) {
          output += chunk.toString();
          callback();
        },
      });

      const stderr = new Writable({
        write(chunk, _encoding, callback) {
          output += chunk.toString();
          callback();
        },
      });

      docker.modem.demuxStream(stream, stdout, stderr);
      stream.on('end', () => resolve(output.trim()));
      stream.on('error', reject);
    });
  }

  //Private Helpers

  private scheduleDestroy(userId: string): ReturnType<typeof setTimeout> {
    return setTimeout(async () => {
      console.log(`Inactivity timeout for user ${userId}.`);
      await this.destroyContainer(userId);
    }, INACTIVITY_MS);
  }

  private resetTimer(userId: string): void {
    const state = this.registry.get(userId);
    if (!state) {
      return;
    }
    clearTimeout(state.inactivityTimer);
    state.inactivityTimer = this.scheduleDestroy(userId);
    state.info.lastActivity = new Date();
  }

  private async createContainer(userId: string): Promise<Docker.Container> {
    const containerName = `alexide-exec-${userId}`;
    console.log(`Creating container for user ${userId}...`);

    const container = await docker.createContainer({
      Image: EXEC_IMAGE_NAME,
      name: containerName,
      Cmd: ['tail', '-f', '/dev/null'],
      AttachStdin: false,
      AttachStdout: false,
      AttachStderr: false,
      Tty: false,
      User: 'sandbox',
      WorkingDir: '/sandbox',
      HostConfig: {
        NetworkMode: EXEC_NETWORK_NAME, //No route to the internet or host
        Memory: MEMORY_BYTES,
        MemorySwap: MEMORY_BYTES,
        NanoCpus: CPU_NANOCPUS,
        PidsLimit: 64,
        Ulimits: [
          { Name: 'nproc', Soft: 50, Hard: 50 },
          { Name: 'nofile', Soft: 64, Hard: 64 },
        ],
        // Drop every Linux capability
        CapDrop: ['ALL'],
        CapAdd: [],
        SecurityOpt: ['no-new-privileges:true'],
        // System paths are read-only; /sandbox stays writable via WorkingDir
        ReadonlyPaths: ['/usr', '/bin', '/sbin', '/lib', '/lib64', '/etc', '/proc/sys'],
        Tmpfs: { '/tmp': 'rw,noexec,nosuid,size=32m' },
        Binds: [],
      },
    });

    await container.start();

    for (let i = 0; i < 10; i++) {
      const info = await container.inspect();
      if (info.State.Running) {
        break;
      }
      if (i === 9) {
        console.error('Container state:', JSON.stringify(info.State));
        throw new Error(
          `Container ${containerName} failed to start: ${info.State.Error || info.State.ExitCode}`
        );
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    console.log(`Container ${containerName} started.`);

    const now = new Date();
    this.registry.set(userId, {
      container,
      info: { containerId: container.id, userId, createdAt: now, lastActivity: now },
      inactivityTimer: this.scheduleDestroy(userId),
    });

    return container;
  }
}

export const containerService = new ContainerService();
