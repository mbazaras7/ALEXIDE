/* eslint-disable @typescript-eslint/no-explicit-any */
import type Docker from 'dockerode';
import { containerService } from './container';
import { fileService } from './file';
import type { FileTreeNode } from '../types/file';
import { ExecutionResult } from '../types/execution';
import path from 'path';

const SANDBOX_DIR = '/sandbox';
const MAX_CODE_BYTES = 500 * 1024; // 500KB

export class ExecutionService {
  async executeCode(
    userId: string,
    code: string,
    language: 'python' = 'python',
    stdin?: string,
    sysArgs?: string[]
  ): Promise<ExecutionResult> {
    if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
      return {
        output: '',
        exitCode: 1,
        error: 'Code exceeds maximum allowed size of 500KB',
      };
    }
    const container = await containerService.getOrCreateContainer(userId);
    containerService.recordActivity(userId);

    try {
      const cmd = this.buildCommand(language, code, stdin, sysArgs);
      const exec = await container.exec({
        Cmd: ['bash', '-c', cmd],
        AttachStdout: true,
        AttachStderr: true,
        User: 'sandbox',
        WorkingDir: '/sandbox',
      });

      const stream = await exec.start({ hijack: true, stdin: false });

      let timeoutHandle: ReturnType<typeof setTimeout>;
      const timeout = new Promise<ExecutionResult>((resolve) => {
        timeoutHandle = setTimeout(() => {
          try {
            if (typeof stream.destroy === 'function') {
              stream.destroy();
            } else if (typeof stream.end === 'function') {
              stream.end();
            }
          } catch {
            //Ignore stream teardown errors
          }
          resolve({ output: 'Execution timed out', exitCode: 124 });
        }, 10_000);
      });

      const execution = (async () => {
        const output = await containerService.collectStream(stream);
        const inspected = await exec.inspect();
        return { output, exitCode: inspected.ExitCode ?? 0 };
      })();

      const result = await Promise.race([execution, timeout]);
      clearTimeout(timeoutHandle!);
      return result;
    } catch (error: any) {
      return {
        output: '',
        exitCode: 1,
        error: error?.message ?? 'Execution failed',
      };
    }
  }

  async executeFile(
    userId: string,
    storageKey: string,
    language: 'python' = 'python'
  ): Promise<ExecutionResult> {
    const { storageService } = await import('./storage');
    const contentBuffer = await storageService.downloadFile(storageKey);
    if (contentBuffer.byteLength > MAX_CODE_BYTES) {
      return { output: '', exitCode: 1, error: 'Code exceeds maximum allowed size of 500KB' };
    }
    const code = contentBuffer.toString('utf-8');
    return this.executeCode(userId, code, language);
  }

  private buildCommand(language: string, code: string, stdin?: string, sysArgs?: string[]): string {
    const escaped = code.replace(/'/g, `'\\''`);
    const args =
      sysArgs && sysArgs.length > 0
        ? ' ' + sysArgs.map((a) => `'${a.replace(/'/g, `'\\''`)}'`).join(' ')
        : '';

    switch (language) {
      case 'python': {
        const writeFile = `echo '${escaped}' > /sandbox/main.py`;

        if (stdin) {
          const escapedInput = stdin.replace(/'/g, `'\\''`);
          return `${writeFile} && echo '${escapedInput}' | timeout 10 python3 /sandbox/main.py${args} 2>&1`;
        }

        return `${writeFile} && timeout 10 python3 /sandbox/main.py${args} 2>&1`;
      }
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }
}

export const executionService = new ExecutionService();

//Workspace Sync

export async function syncWorkspaceToContainer(
  container: Docker.Container,
  userId: string
): Promise<void> {
  let tree: FileTreeNode[];
  try {
    tree = await fileService.getFileTree(userId);
  } catch (err: any) {
    console.warn(`[sync] getFileTree failed for userId=${userId}:`, err.message);
    return;
  }

  if (tree.length === 0) {
    return;
  }

  const allNodes = flattenTree(tree);
  const directories = allNodes.filter((n) => n.isDirectory);
  const files = allNodes.filter((n) => !n.isDirectory);

  for (const dir of directories) {
    try {
      await mkdirInContainer(container, `${SANDBOX_DIR}/${dir.path}`);
    } catch (err: any) {
      console.warn(`mkdir failed for ${dir.path}:`, err.message);
    }
  }

  for (const file of files) {
    try {
      const contentBuffer = await fileService.getFileContent(file.id, userId);
      await writeFileToContainer(
        container,
        `${SANDBOX_DIR}/${file.path}`,
        contentBuffer.toString('utf-8')
      );
    } catch (err: any) {
      console.warn(`[sync] Skipping file ${file.path}:`, err.message);
    }
  }
}

export async function syncSingleFileToContainer(
  container: Docker.Container,
  fileId: string,
  userId: string
): Promise<void> {
  const file = await fileService.getFile(fileId, userId);
  if (!file || file.isDirectory || !file.storageKey) {
    return;
  }

  const contentBuffer = await fileService.getFileContent(fileId, userId);
  await writeFileToContainer(
    container,
    `${SANDBOX_DIR}/${file.path}`,
    contentBuffer.toString('utf-8')
  );
}

//Container File Operations

async function mkdirInContainer(container: Docker.Container, dirPath: string): Promise<void> {
  const exec = await container.exec({
    Cmd: ['mkdir', '-p', dirPath],
    AttachStdin: false,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    User: 'sandbox',
  });

  await new Promise<void>((resolve, reject) => {
    exec.start({}, (err: Error, stream: any) => {
      if (err) {
        return reject(err);
      }
      stream.resume();
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  });
}

async function writeFileToContainer(
  container: Docker.Container,
  containerPath: string,
  content: string
): Promise<void> {
  const parentDir = containerPath.substring(0, containerPath.lastIndexOf('/'));
  if (parentDir) {
    await mkdirInContainer(container, parentDir);
  }

  const exec = await container.exec({
    Cmd: ['sh', '-c', `cat > "${containerPath}"`],
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    User: 'sandbox',
  });

  await new Promise<void>((resolve, reject) => {
    exec.start({ hijack: true, stdin: true }, (err: Error, stream: any) => {
      if (err) {
        return reject(err);
      }
      stream.write(content);
      stream.end();
      stream.resume();
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  });
}

//File Tree Helpers

function flattenTree(nodes: FileTreeNode[]): FileTreeNode[] {
  const result: FileTreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) {
      result.push(...flattenTree(node.children));
    }
  }
  return result;
}

//Container Path Operations

export async function deleteFromContainer(
  container: Docker.Container,
  containerPath: string
): Promise<void> {
  const safePath = path.posix.normalize(`${SANDBOX_DIR}/${containerPath}`);
  if (!safePath.startsWith(SANDBOX_DIR + '/')) {
    throw new Error(`Invalid container path: ${containerPath}`);
  }

  const exec = await container.exec({
    Cmd: ['rm', '-rf', safePath],
    AttachStdin: false,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    User: 'sandbox',
  });

  await new Promise<void>((resolve, reject) => {
    exec.start({}, (err: Error, stream: any) => {
      if (err) {
        return reject(err);
      }
      stream.resume();
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  });
}

export async function moveInContainer(
  container: Docker.Container,
  oldPath: string,
  newPath: string
): Promise<void> {
  const src = `${SANDBOX_DIR}/${oldPath}`;
  const dest = `${SANDBOX_DIR}/${newPath}`;
  const destDir = dest.substring(0, dest.lastIndexOf('/'));

  const exec = await container.exec({
    Cmd: ['sh', '-c', `mkdir -p "${destDir}" && mv "${src}" "${dest}"`],
    AttachStdin: false,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    User: 'sandbox',
  });

  await new Promise<void>((resolve, reject) => {
    exec.start({}, (err: Error, stream: any) => {
      if (err) {
        return reject(err);
      }
      stream.resume();
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  });
}

export async function renameInContainer(
  container: Docker.Container,
  oldPath: string,
  newPath: string
): Promise<void> {
  return moveInContainer(container, oldPath, newPath);
}
