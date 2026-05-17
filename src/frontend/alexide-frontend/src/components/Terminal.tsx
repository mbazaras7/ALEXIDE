import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { Group, Text, ActionIcon, Tooltip } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { io, Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';
import classes from './Terminal.module.css';

interface TerminalProps {
  isVisible: boolean;
}

export interface TerminalHandle {
  runFile: (fileId: string, filePath: string) => void;
  stopExecution: () => void;
  syncFile: (fileId: string) => void;
}

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';

const Terminal = forwardRef<TerminalHandle, TerminalProps>(({ isVisible }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useImperativeHandle(ref, () => ({
    runFile: (fileId: string, filePath: string) => {
      if (!socketRef.current?.connected) return;
      setIsSyncing(true);
      socketRef.current.emit('execution:sync', { fileId });
      setTimeout(() => {
        setIsSyncing(false);
        socketRef.current?.emit('terminal:input', {
          data: `python3 /sandbox${filePath}\r`,
        });
      }, 1500);
    },
    stopExecution: () => {
      socketRef.current?.emit('execution:stop');
    },
    syncFile: (fileId: string) => {
      if (!socketRef.current?.connected) return;
      socketRef.current.emit('execution:sync', { fileId });
    },
  }));

  const connectSocket = useCallback(() => {
    const token = localStorage.getItem('authToken');
    if (!token || isConnectedRef.current) return;

    const socket = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket'],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      isConnectedRef.current = true;
      const { cols, rows } = fitAddonRef.current
        ? { cols: xtermRef.current?.cols ?? 80, rows: xtermRef.current?.rows ?? 24 }
        : { cols: 80, rows: 24 };

      socket.emit('terminal:start', { cols, rows });
    });

    socket.on('terminal:ready', () => {
      xtermRef.current?.writeln('\r\n\x1b[32m✓ Terminal ready\x1b[0m\r\n');
    });

    socket.on('terminal:syncing', () => {
      setIsSyncing(true);
    });

    socket.on('terminal:output', (data: string) => {
      xtermRef.current?.write(data);
    });

    socket.on('terminal:exit', (code: number) => {
      xtermRef.current?.writeln(`\r\n\x1b[33mProcess exited with code ${code}\x1b[0m`);
      isConnectedRef.current = false;
    });

    socket.on('terminal:error', (message: string) => {
      xtermRef.current?.writeln(`\r\n\x1b[31mError: ${message}\x1b[0m`);
    });

    socket.on('disconnect', () => {
      isConnectedRef.current = false;
      xtermRef.current?.writeln('\r\n\x1b[31mDisconnected from terminal\x1b[0m');
    });
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;

    const xterm = new XTerm({
      theme: {
        background: '#0f0f1e',
        foreground: '#e0e0e0',
        cursor: '#7b5bf5',
        selectionBackground: 'rgba(123, 91, 245, 0.3)',
        black: '#0f0f1e',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#7b5bf5',
        red: '#ff5555',
        cyan: '#8be9fd',
        white: '#e0e0e0',
      },
      fontFamily: '"Fira Code", "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.5,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    xterm.onData((data) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('terminal:input', { data });
      }
    });

    xterm.onResize(({ cols, rows }) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('terminal:resize', { cols, rows });
      }
    });

    connectSocket();

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      xterm.dispose();
      socketRef.current?.disconnect();
      socketRef.current = null;
      isConnectedRef.current = false;
    };
  }, [connectSocket]);

  useEffect(() => {
    if (isVisible && fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 100);
    }
  }, [isVisible]);

  return (
    <div className={classes.terminalWrapper}>
      <Group className={classes.terminalHeader} justify="space-between" px="sm" py={4}>
        <Text size="xs" fw={600} c="violet.4" tt="uppercase" style={{ letterSpacing: '0.5px' }}>
          Terminal
        </Text>
        {isSyncing && (
          <Text size="xs" c="yellow.4">
            syncing...
          </Text>
        )}
        <Tooltip label="Clear terminal">
          <ActionIcon
            variant="subtle"
            size="sm"
            color="gray"
            onClick={() => xtermRef.current?.clear()}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <div ref={terminalRef} className={classes.terminalContainer} />
    </div>
  );
});

export default Terminal;
