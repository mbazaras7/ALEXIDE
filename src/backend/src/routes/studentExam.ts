import { Router } from 'express';
import { studentExamController } from '../controllers/studentExam';
import { authenticate, requireStudent } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  addExamAnswerSchema,
  getClassExamsSchema,
  getExamAnswersSchema,
  getExamSchema,
  startExamSchema,
  submitExamSchema,
  tabSwitchSchema,
} from '../validators/exam';

const router = Router();

router.use(authenticate, requireStudent);

//GET /api/backend/student/exams/class/:classId
router.get(
  '/class/:classId',
  validate(getClassExamsSchema),
  studentExamController.getClassExams.bind(studentExamController)
);

//GET /api/backend/student/exams/:examId
router.get(
  '/:examId',
  validate(getExamSchema),
  studentExamController.getExam.bind(studentExamController)
);

//POST /api/backend/student/exams/:examId/start
router.post(
  '/:examId/start',
  validate(startExamSchema),
  studentExamController.startExam.bind(studentExamController)
);

//GET /api/backend/student/exams/:examId/session
router.get(
  '/:examId/session',
  validate(getExamSchema),
  studentExamController.getSession.bind(studentExamController)
);

//POST /api/backend/student/exams/:examId/submit
router.post(
  '/:examId/submit',
  validate(submitExamSchema),
  studentExamController.submitExam.bind(studentExamController)
);

//POST /api/backend/student/exams/:examId/tab-switch
router.post(
  '/:examId/tab-switch',
  validate(tabSwitchSchema),
  studentExamController.recordTabSwitch.bind(studentExamController)
);

//POST /api/backend/student/exams/:examId/questions/:questionId/answer
router.post(
  '/:examId/questions/:questionId/answer',
  validate(addExamAnswerSchema),
  studentExamController.saveAnswer.bind(studentExamController)
);

//GET /api/backend/student/exams/:examId/answers
router.get(
  '/:examId/answers',
  validate(getExamAnswersSchema),
  studentExamController.getAnswers.bind(studentExamController)
);

export default router;
