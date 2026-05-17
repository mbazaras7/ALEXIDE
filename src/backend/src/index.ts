import app from './app';
import { connectDatabase, disconnectDatabase } from './db';
import { containerService } from './services/container';
import http from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Namespace, Socket } from 'socket.io';
import { registerTerminalGateway } from './gateways/terminal';
import { registerCollaborationGateway } from './gateways/collaboration';
import { registerExamGateway } from './gateways/examGateway';
import { JwtService } from './config/auth';
import { connectRedis, disconnectRedis, pubClient, subClient } from './config/redis';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from './types/terminal';
import type {
  ClientToServerEvents as ExamClientToServerEvents,
  ServerToClientEvents as ExamServerToClientEvents,
} from './types/examGateway';
import { createExamModeMiddleware } from './middleware/exam';
import { startExamScheduler, rehydrateActiveExams } from './services/examScheduler';

const PORT = process.env.PORT || 3000;

function createSocketAuthMiddleware() {
  return (socket: Socket, next: (err?: Error) => void) => {
    const raw =
      (socket.handshake.auth?.token as string) || (socket.handshake.query?.token as string);
    if (!raw) return next(new Error('No token provided'));

    const token = raw.startsWith('Bearer ') ? raw.substring(7) : raw;
    if (!token) return next(new Error('No token provided'));

    const payload = JwtService.verifyToken(token);
    if (!payload) return next(new Error('Invalid token'));

    socket.data.userId = payload.userId;
    socket.data.userName = payload.email;
    socket.data.role = payload.role;
    next();
  };
}

const startServer = async () => {
  try {
    await connectDatabase();

    try {
      await connectRedis();
    } catch (redisError) {
      console.warn('Redis not available, caching disabled:', redisError);
    }

    try {
      await containerService.ensureExecNetwork();
      await containerService.pruneOrphanedContainers();
    } catch (dockerError) {
      console.warn('Docker not available:', dockerError);
    }

    const httpServer = http.createServer(app);

    const io = new Server<
      ClientToServerEvents,
      ServerToClientEvents,
      Record<string, never>,
      SocketData
    >(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });

    io.adapter(createAdapter(pubClient, subClient));

    //Terminal — root namespace
    io.use(createSocketAuthMiddleware());
    registerTerminalGateway(io);

    //Collaboration — /collaboration namespace
    const collaborationNamespace = io.of('/collaboration');
    collaborationNamespace.use(createSocketAuthMiddleware());
    collaborationNamespace.use(createExamModeMiddleware());
    registerCollaborationGateway(collaborationNamespace);

    //Exam — /exam namespace
    const examNamespace = io.of('/exam') as Namespace<
      ExamClientToServerEvents,
      ExamServerToClientEvents,
      Record<string, never>,
      SocketData
    >;
    examNamespace.use(createSocketAuthMiddleware());
    registerExamGateway(examNamespace);
    const schedulerInterval = startExamScheduler(examNamespace);
    await rehydrateActiveExams(examNamespace);

    httpServer.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      console.log(`WebSocket: ws://localhost:${PORT}`);
      console.log(`Collaboration WS: ws://localhost:${PORT}/collaboration`);
      console.log(`Exam WS: ws://localhost:${PORT}/exam`);
    });

    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} signal received: closing HTTP server`);
      httpServer.close(async () => {
        console.log('HTTP server closed');
        await disconnectDatabase();
        await disconnectRedis();
        clearInterval(schedulerInterval);
        console.log('Graceful shutdown complete');
        process.exit(0);
      });

      const forceExit = setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10_000);
      forceExit.unref();
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
