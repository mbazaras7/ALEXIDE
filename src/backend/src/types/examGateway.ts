export interface ExamJoinPayload {
  examId: string;
}

export interface ExamHeartbeatPayload {
  examId: string;
}

export interface ExamTabSwitchPayload {
  examId: string;
}

export interface ExamSubmitPayload {
  examId: string;
}

export interface ExamRequestSnapshotPayload {
  examId: string;
  studentId: string;
}

export interface ClientToServerEvents {
  'exam:join': (payload: ExamJoinPayload) => void;
  'exam:heartbeat': (payload: ExamHeartbeatPayload) => void;
  'exam:tab_switch': (payload: ExamTabSwitchPayload) => void;
  'exam:submit': (payload: ExamSubmitPayload) => void;
  'exam:request_snapshot': (payload: ExamRequestSnapshotPayload) => void;
}

export interface ExamStartedPayload {
  examId: string;
  endTime: string;
  durationMinutes: number;
}

export interface ExamStudentJoinedPayload {
  studentId: string;
  sessionId: string;
  joinedAt: string;
  name: string;
}

export interface ExamTabAlertPayload {
  studentId: string;
  count: number;
}

export interface ExamStudentDisconnectedPayload {
  studentId: string;
}

export interface ExamTimeWarningPayload {
  minutesLeft: number;
}

export interface ExamStudentSubmittedPayload {
  studentId: string;
}

export interface ExamSnapshotAnswer {
  questionId: string;
  questionTitle: string;
  code: string;
  status: string;
}

export interface ExamSnapshotResponsePayload {
  studentId: string;
  studentName: string;
  examType: 'open-book' | 'closed-book';
  answers: ExamSnapshotAnswer[];
}

export interface ServerToClientEvents {
  'exam:joined': (payload: ExamStartedPayload) => void;
  'exam:student_joined': (payload: ExamStudentJoinedPayload) => void;
  'exam:tab_alert': (payload: ExamTabAlertPayload) => void;
  'exam:student_disconnected': (payload: ExamStudentDisconnectedPayload) => void;
  'exam:time_warning': (payload: ExamTimeWarningPayload) => void;
  'exam:ended': () => void;
  'exam:student_submitted': (payload: ExamStudentSubmittedPayload) => void;
  'exam:snapshot_response': (payload: ExamSnapshotResponsePayload) => void;
  'exam:error': (message: string) => void;
}

export interface SocketData {
  userId: string;
  userName: string;
  role: 'TEACHER' | 'STUDENT';
  activeClosedBookExamId?: string | null;
}
