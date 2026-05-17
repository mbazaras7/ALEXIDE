export interface RedisExamState {
  examId: string;
  classId: string;
  teacherId: string;
  status: 'ACTIVE';
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface RedisStudentSession {
  studentId: string;
  examId: string;
  sessionId: string;
  joinedAt: string;
  tabSwitches: number;
  status: 'ACTIVE' | 'SUBMITTED' | 'EXPIRED';
  lastHeartbeat: string;
}

export interface MonitorStudentState {
  studentId: string;
  name: string;
  sessionId: string;
  status: 'ACTIVE' | 'SUBMITTED' | 'EXPIRED';
  tabSwitches: number;
  lastHeartbeat: string | null;
  joinedAt: string;
  submittedAt: string | null;
  isOnline: boolean;
}

export interface MonitorResponse {
  examId: string;
  totalStudents: number;
  submitted: number;
  active: number;
  students: MonitorStudentState[];
}
