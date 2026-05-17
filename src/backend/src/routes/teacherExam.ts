import { Router } from 'express';
import { teacherExamController } from '../controllers/teacherExam';
import { authenticate, requireTeacher } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createExamSchema,
  updateExamSchema,
  getExamSchema,
  getClassExamsSchema,
  deleteExamSchema,
  publishExamSchema,
  addQuestionSchema,
  updateQuestionSchema,
  deleteQuestionSchema,
  addExamTestCaseSchema,
  updateExamTestCaseSchema,
  deleteExamTestCaseSchema,
  getExamMonitorStateSchema,
  getStudentSnapshotSchema,
} from '../validators/exam';

const router = Router();

router.use(authenticate, requireTeacher);

//Exam
//POST /api/backend/teacher/exams/:classId
router.post(
  '/:classId',
  validate(createExamSchema),
  teacherExamController.createExam.bind(teacherExamController)
);

//GET /api/backend/teacher/exams/class/:classId
router.get(
  '/class/:classId',
  validate(getClassExamsSchema),
  teacherExamController.getClassExams.bind(teacherExamController)
);

//GET /api/backend/teacher/exams/:examId
router.get(
  '/:examId',
  validate(getExamSchema),
  teacherExamController.getExam.bind(teacherExamController)
);

//PATCH /api/backend/teacher/exams/:examId
router.patch(
  '/:examId',
  validate(updateExamSchema),
  teacherExamController.updateExam.bind(teacherExamController)
);

//POST /api/backend/teacher/exams/:examId/publish
router.post(
  '/:examId/publish',
  validate(publishExamSchema),
  teacherExamController.publishExam.bind(teacherExamController)
);

//DELETE /api/backend/teacher/exams/:examId
router.delete(
  '/:examId',
  validate(deleteExamSchema),
  teacherExamController.deleteExam.bind(teacherExamController)
);

//Questions
//POST /api/backend/teacher/exams/:examId/questions
router.post(
  '/:examId/questions',
  validate(addQuestionSchema),
  teacherExamController.addQuestion.bind(teacherExamController)
);

//PATCH /api/backend/teacher/exams/:examId/questions/:questionId
router.patch(
  '/:examId/questions/:questionId',
  validate(updateQuestionSchema),
  teacherExamController.updateQuestion.bind(teacherExamController)
);

//DELETE /api/backend/teacher/exams/:examId/questions/:questionId
router.delete(
  '/:examId/questions/:questionId',
  validate(deleteQuestionSchema),
  teacherExamController.deleteQuestion.bind(teacherExamController)
);

//Test Cases
//POST /api/backend/teacher/exams/:examId/questions/:questionId/testcases
router.post(
  '/:examId/questions/:questionId/test-cases',
  validate(addExamTestCaseSchema),
  teacherExamController.addTestCase.bind(teacherExamController)
);

//PATCH /api/backend/teacher/exams/:examId/questions/:questionId/testcases/:testCaseId
router.patch(
  '/:examId/questions/:questionId/test-cases/:testCaseId',
  validate(updateExamTestCaseSchema),
  teacherExamController.updateTestCase.bind(teacherExamController)
);

//DELETE /api/backend/teacher/exams/:examId/questions/:questionId/testcases/:testCaseId
router.delete(
  '/:examId/questions/:questionId/test-cases/:testCaseId',
  validate(deleteExamTestCaseSchema),
  teacherExamController.deleteTestCase.bind(teacherExamController)
);

//GET /api/backend/teacher/exams/:examId/monitor
router.get(
  '/:examId/monitor',
  validate(getExamMonitorStateSchema),
  teacherExamController.getMonitor.bind(teacherExamController)
);

//GET /api/backend/teacher/exams/:examId/students/:studentId/files
router.get(
  '/:examId/students/:studentId/files',
  validate(getStudentSnapshotSchema),
  teacherExamController.getStudentFiles.bind(teacherExamController)
);

export default router;
