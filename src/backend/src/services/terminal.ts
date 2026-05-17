/* eslint-disable @typescript-eslint/no-explicit-any */
import type Docker from 'dockerode';
import type { TerminalStartPayload } from '../types/terminal';
import type { Duplex } from 'stream';

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

export async function createPtySession(
  container: Docker.Container,
  payload: TerminalStartPayload
): Promise<Duplex> {
  const exec = await container.exec({
    Cmd: ['/bin/bash', '--login', '-i'],
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    User: 'sandbox',
    WorkingDir: '/sandbox',
    Env: [
      'HOME=/sandbox',
      'PATH=/usr/local/bin:/usr/bin:/bin',
      'PYTHONDONTWRITEBYTECODE=1',
      'PYTHONUNBUFFERED=1',
    ],
  });

  const stream = await exec.start({
    hijack: true,
    stdin: true,
    Tty: true,
  });

  if (payload.cols !== undefined || payload.rows !== undefined) {
    await resizePty(exec, {
      cols: payload.cols ?? DEFAULT_COLS,
      rows: payload.rows ?? DEFAULT_ROWS,
    });
  }

  return stream as Duplex;
}

export async function resizePty(
  exec: Docker.Exec,
  payload: { cols: number; rows: number }
): Promise<void> {
  try {
    await (exec as any).resize({ w: payload.cols, h: payload.rows });
  } catch (err: any) {
    console.warn(`Failed to resize terminal: ${err?.message}`);
  }
}
