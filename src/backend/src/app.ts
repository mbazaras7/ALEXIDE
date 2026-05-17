import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/user';
import healthRoutes from './routes/health';
import fileRoutes from './routes/file';
import executionRoutes from './routes/execution';
import teacherClassRoutes from './routes/teacherClass';
import teacherGradeRoutes from './routes/teacherGrade';
import teacherAssignmentRoutes from './routes/teacherAssignment';
import teacherSubmissionRouter from './routes/teacherSubmission';
import studentClassRoutes from './routes/studentClass';
import studentGradeRoutes from './routes/studentGrade';
import studentAssignmentRoutes from './routes/studentAssignment';
import studentSubmissionRouter from './routes/studentSubmission';
import fileShareRoutes from './routes/fileShare';
import teacherExamRoutes from './routes/teacherExam';
import studentExamRoutes from './routes/studentExam';

dotenv.config();

// Create Express app
const app: Application = express();

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json()); // Parse JSON bodies

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// API base route
app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'backend',
    version: process.env.API_VERSION || 'v1',
  });
});

// API base route
app.get('/api/backend', (req: Request, res: Response) => {
  res.json({
    message: 'Base route',
    endpoints: {
      auth: '/api/backend/auth',
      health: '/api/backend/health',
      file: '/api/backend/files',
      execute: '/api/backend/execute',
      teacherClasses: '/api/backend/teacher/classes',
      teacherGrades: '/api/backend/teacher/grades',
      teacherAssignments: '/api/backend/teacher/assignments',
      teacherSubmissions: '/api/backend/teacher/submit',
      studentClasses: '/api/backend/student/classes',
      studentGrades: '/api/backend/student/grades',
      studentAssignments: '/api/backend/student/assignments',
      studentSubmissions: '/api/backend/student/submit',
      fileShare: '/api/backend/share',
      teacherExams: '/api/backend/teacher/exams',
      studentExams: '/api/backend/student/exams',
    },
  });
});

app.use('/api/backend/health', healthRoutes);
app.use('/api/backend/auth', userRoutes);
app.use('/api/backend/files', fileRoutes);
app.use('/api/backend/execute', executionRoutes);
app.use('/api/backend/teacher/classes', teacherClassRoutes);
app.use('/api/backend/teacher/grades', teacherGradeRoutes);
app.use('/api/backend/teacher/assignments', teacherAssignmentRoutes);
app.use('/api/backend/teacher/submit', teacherSubmissionRouter);
app.use('/api/backend/student/classes', studentClassRoutes);
app.use('/api/backend/student/grades', studentGradeRoutes);
app.use('/api/backend/student/assignments', studentAssignmentRoutes);
app.use('/api/backend/student/submit', studentSubmissionRouter);
app.use('/api/backend/share', fileShareRoutes);
app.use('/api/backend/teacher/exams', teacherExamRoutes);
app.use('/api/backend/student/exams', studentExamRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

export default app;
