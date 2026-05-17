import { Router } from 'express';
import { studentSubmissionController } from '../controllers/studentSubmission';
import { authenticate, requireStudent } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  submitAssignmentSchema,
  assignmentIdSchema,
  submissionIdSchema,
  classIdSchema,
  classAndAssignmentSchema,
} from '../validators/submission';

const router = Router();
router.use(authenticate, requireStudent);

//POST /api/backend/student/submit/assignments/:assignmentId
router.post(
  '/assignments/:assignmentId',
  validate(submitAssignmentSchema),
  studentSubmissionController.submitAssignment.bind(studentSubmissionController)
);

//GET /api/backend/student/submit/assignments/:assignmentId
router.get(
  '/assignments/:assignmentId',
  validate(assignmentIdSchema),
  studentSubmissionController.getMySubmission.bind(studentSubmissionController)
);

//GET /api/backend/student/submit/classes/:classId/assignments/:assignmentId
router.get(
  '/classes/:classId/assignments/:assignmentId',
  validate(classAndAssignmentSchema),
  studentSubmissionController.getMySubmissionByClassAndAssignment.bind(studentSubmissionController)
);

//GET /api/backend/student/submit/classes/:classId
router.get(
  '/classes/:classId',
  validate(classIdSchema),
  studentSubmissionController.getMyClassSubmissions.bind(studentSubmissionController)
);

//GET /api/backend/student/submit/:submissionId/feedback
router.get(
  '/:submissionId/feedback',
  validate(submissionIdSchema),
  studentSubmissionController.getSubmissionFeedback.bind(studentSubmissionController)
);

//GET /api/backend/student/submit/:submissionId
router.get(
  '/:submissionId',
  validate(submissionIdSchema),
  studentSubmissionController.getSubmissionById.bind(studentSubmissionController)
);

export default router;
