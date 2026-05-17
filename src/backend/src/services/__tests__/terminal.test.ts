import { createPtySession, resizePty } from '../terminal';
import { EventEmitter } from 'events';
import { jest, beforeEach, expect, describe, it } from '@jest/globals';

// Mock dockerode container
const mockExecStart = jest.fn();
const mockExecResize = jest.fn();
const mockExec: jest.Mock = jest.fn();

function makeFakeStream() {
  const stream = new EventEmitter() as any;
  stream.write = jest.fn();
  stream.destroy = jest.fn();
  return stream;
}

beforeEach(() => {
  jest.clearAllMocks();

  const fakeStream = makeFakeStream();

  mockExecStart.mockImplementation(() => Promise.resolve(fakeStream));
  mockExecResize.mockImplementation(() => Promise.resolve(undefined));
  mockExec.mockImplementation(() =>
    Promise.resolve({
      start: mockExecStart,
      resize: mockExecResize,
    })
  );
});

// Cast using unknown first to bypass strict type checking
const mockContainer = {
  exec: mockExec,
} as unknown as any;

describe('createPtySession', () => {
  it('creates exec with correct PTY options', async () => {
    await createPtySession(mockContainer, {});

    expect(mockExec).toHaveBeenCalledWith({
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
  });

  it('starts exec with hijack and stdin enabled', async () => {
    await createPtySession(mockContainer, {});

    expect(mockExecStart).toHaveBeenCalledWith({
      hijack: true,
      stdin: true,
      Tty: true,
    });
  });

  it('returns the stream from exec.start', async () => {
    const stream = await createPtySession(mockContainer, {});
    expect(stream).toBeDefined();
  });

  it('calls resize when cols and rows are provided', async () => {
    await createPtySession(mockContainer, { cols: 120, rows: 40 });
    expect(mockExecResize).toHaveBeenCalledWith({ w: 120, h: 40 });
  });

  it('uses default dimensions when cols and rows are not provided', async () => {
    await createPtySession(mockContainer, {});
    expect(mockExecResize).not.toHaveBeenCalled();
  });

  it('uses default cols when only rows is provided', async () => {
    await createPtySession(mockContainer, { rows: 40 });
    expect(mockExecResize).toHaveBeenCalledWith({ w: 80, h: 40 });
  });

  it('uses default rows when only cols is provided', async () => {
    await createPtySession(mockContainer, { cols: 120 });
    expect(mockExecResize).toHaveBeenCalledWith({ w: 120, h: 24 });
  });
});

describe('resizePty', () => {
  it('calls exec resize with correct dimensions', async () => {
    const mockExecInstance = {
      resize: jest.fn().mockImplementation(() => Promise.resolve()),
    };
    await resizePty(mockExecInstance as any, { cols: 100, rows: 30 });
    expect(mockExecInstance.resize).toHaveBeenCalledWith({ w: 100, h: 30 });
  });
});
