import * as Y from 'yjs';

export interface CollaborationJoinPayload {
  fileId: string;
}

export interface CollaborationUpdatePayload {
  update: number[];
}

export interface CollaborationAwarenessPayload {
  update: number[];
}

export interface ClientToServerEvents {
  'collaboration:join': (payload: CollaborationJoinPayload) => void;
  'collaboration:update': (payload: CollaborationUpdatePayload) => void;
  'collaboration:awareness': (payload: CollaborationAwarenessPayload) => void;
  'collaboration:kick': (fileId: string) => void;
  'collaboration:leave': () => void;
}

export interface ServerToClientEvents {
  'collaboration:synced': (payload: CollaborationUpdatePayload) => void;
  'collaboration:update': (payload: CollaborationUpdatePayload) => void;
  'collaboration:awareness': (payload: CollaborationAwarenessPayload) => void;
  'collaboration:users': (users: CollaboratorInfo[]) => void;
  'collaboration:error': (message: string) => void;
  'collaboration:kicked': (message: string) => void;
}

export interface SocketData {
  userId: string;
  userName: string;
  role: 'TEACHER' | 'STUDENT';
  activeClosedBookExamId?: string | null;
}

export interface CollaborationSession {
  userId: string;
  userName: string;
  colour: string;
  socketId: string;
  fileId: string | null;
}

export interface CollaboratorInfo {
  userId: string;
  name: string;
  colour: string;
}

export interface ManagedDoc {
  doc: Y.Doc;
  connectedUsers: Map<string, string>;
  persistTimer: ReturnType<typeof setTimeout> | null;
}

export interface CollaborationState {
  id: string;
  fileId: string;
  stateVector: string;
  updatedAt: Date;
}
