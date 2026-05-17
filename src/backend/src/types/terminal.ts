import type { Duplex } from 'stream';

export interface TerminalSession {
  userId: string;
  socketId: string;
  execStream: Duplex | null;
  isActive: boolean;
}

export interface TerminalStartPayload {
  cols?: number;
  rows?: number;
}

export interface TerminalInputPayload {
  data: string;
}

export interface TerminalResizePayload {
  cols: number;
  rows: number;
}

export interface ClientToServerEvents {
  'terminal:start': (payload: TerminalStartPayload) => void;
  'terminal:input': (payload: TerminalInputPayload) => void;
  'terminal:resize': (payload: TerminalResizePayload) => void;
  'execution:sync': (payload: { fileId: string }) => void;
  'execution:stop': () => void;
  'execution:delete': (payload: { path: string }) => void;
  'execution:move': (payload: { oldPath: string; newPath: string }) => void;
  'execution:rename': (payload: { oldPath: string; newPath: string }) => void;
}

export interface ServerToClientEvents {
  'terminal:ready': () => void;
  'terminal:syncing': () => void;
  'terminal:output': (data: string) => void;
  'terminal:exit': (code: number) => void;
  'terminal:error': (message: string) => void;
}

export interface SocketData {
  userId: string;
  userName: string;
  role: 'TEACHER' | 'STUDENT';
}
