import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import * as awarenessProtocol from 'y-protocols/awareness';

export interface CollaboratorInfo {
  userId: string;
  name: string;
  colour: string;
}

interface UseCollaborationOptions {
  fileId: string | null;
  userId: string;
  userName: string;
  enabled: boolean;
}

export function useCollaboration({ fileId, userId, userName, enabled }: UseCollaborationOptions) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const isApplyingRemote = useRef(false);
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [collabError, setCollabError] = useState<string | null>(null);
  const [isSynced, setIsSynced] = useState(false);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const [wasKicked, setWasKicked] = useState(false);

  useEffect(() => {
    if (!enabled || !fileId || !userId) return;

    const token = localStorage.getItem('authToken');

    const ydocInstance = new Y.Doc();
    ydocRef.current = ydocInstance;

    const awarenessInstance = new Awareness(ydocInstance);
    awarenessRef.current = awarenessInstance;
    awarenessInstance.setLocalStateField('user', { userId, name: userName });

    setYdoc(ydocInstance);
    setAwareness(awarenessInstance);

    const socket = io('http://localhost:3000/collaboration', {
      auth: { token },
      transports: ['polling', 'websocket'],
    });

    socket.on('connect', () => {
      setIsConnected(true);
      setCollabError(null);
      socket.emit('collaboration:join', { fileId });
    });
    socketRef.current = socket;

    socket.on('disconnect', () => setIsConnected(false));

    socket.on('collaboration:error', (msg: string) => setCollabError(msg));

    socket.on('collaboration:synced', ({ update }: { update: number[] }) => {
      isApplyingRemote.current = true;
      Y.applyUpdate(ydocInstance, new Uint8Array(update));
      isApplyingRemote.current = false;
      setIsSynced(true);
    });

    socket.on('collaboration:update', ({ update }: { update: number[] }) => {
      isApplyingRemote.current = true;
      Y.applyUpdate(ydocInstance, new Uint8Array(update));
      isApplyingRemote.current = false;
    });

    socket.on('collaboration:awareness', ({ update }: { update: number[] }) => {
      awarenessProtocol.applyAwarenessUpdate(awarenessInstance, new Uint8Array(update), 'remote');
    });

    socket.on('collaboration:users', (users: CollaboratorInfo[]) => {
      setCollaborators(users);
    });

    socket.on('collaboration:kicked', () => {
      setWasKicked(true);
    });

    const onDocUpdate = (update: Uint8Array) => {
      if (isApplyingRemote.current) return;
      socket.emit('collaboration:update', { update: Array.from(update) });
    };
    ydocInstance.on('update', onDocUpdate);

    const onAwarenessUpdate = ({
      added,
      updated,
      removed,
    }: {
      added: number[];
      updated: number[];
      removed: number[];
    }) => {
      const changed = [...added, ...updated, ...removed];
      const update = awarenessProtocol.encodeAwarenessUpdate(awarenessInstance, changed);
      socket.emit('collaboration:awareness', { update: Array.from(update) });
    };
    awarenessInstance.on('update', onAwarenessUpdate);

    return () => {
      ydocInstance.off('update', onDocUpdate);
      awarenessInstance.off('update', onAwarenessUpdate);
      socket.off('collaboration:kicked');
      socket.emit('collaboration:leave');
      socket.disconnect();
      awarenessInstance.destroy();
      ydocInstance.destroy();
      ydocRef.current = null;
      awarenessRef.current = null;
      setYdoc(null);
      setAwareness(null);
      setIsConnected(false);
      setCollaborators([]);
      setIsSynced(false);
    };
  }, [fileId, enabled, userId, userName]);

  const kickAll = (fileId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('collaboration:kick', fileId);
    }
  };

  return { ydoc, awareness, collaborators, isConnected, collabError, isSynced, wasKicked, kickAll };
}
