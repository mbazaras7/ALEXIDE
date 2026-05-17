import { Router } from 'express';
import { teacherSubmissionController } from '../controllers/teacherSubmission';
import { authenticate, requireTeacher } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  assignmentIdSchema,
  submissionIdSchema,
  classIdSchema,
  classAndAssignmentSchema,
  reGradeSubmissionSchema,
  saveFeedbackSchema,
  adoptAiFeedbackSchema,
} from '../validators/submission';

const router = Router();
router.use(authenticate, requireTeacher);

//GET /api/backend/teacher/submit/assignments/:assignmentId
router.get(
  '/assignments/:assignmentId',
  validate(assignmentIdSchema),
  teacherSubmissionController.getAssignmentSubmissions.bind(teacherSubmissionController)
);

//GET /api/backend/teacher/submit/classes/:classId/assignments/:assignmentId
router.get(
  '/classes/:classId/assignments/:assignmentId',
  validate(classAndAssignmentSchema),
  teacherSubmissionController.getSubmissionsByClassAndAssignment.bind(teacherSubmissionController)
);

//GET /api/backend/teacher/submit/classes/:classId
router.get(
  '/classes/:classId',
  validate(classIdSchema),
  teacherSubmissionController.getClassSubmissions.bind(teacherSubmissionController)
);

//POST /api/backend/teacher/submit/:submissionId/regrade
router.post(
  '/:submissionId/regrade',
  validate(reGradeSubmissionSchema),
  teacherSubmissionController.reGradeSubmission.bind(teacherSubmissionController)
);

//GET /api/backend/teacher/submit/assignments/:assignmentId/stats
router.get(
  '/assignments/:assignmentId/stats',
  validate(assignmentIdSchema),
  teacherSubmissionController.getAssignmentStats.bind(teacherSubmissionController)
);

//PATCH /api/backend/teacher/submit/:submissionId/feedback
router.patch(
  '/:submissionId/feedback',
  validate(saveFeedbackSchema),
  teacherSubmissionController.saveFeedback.bind(teacherSubmissionController)
);

//POST /api/backend/teacher/submit/:submissionId/feedback/adopt-ai
router.post(
  '/:submissionId/feedback/adopt-ai',
  validate(adoptAiFeedbackSchema),
  teacherSubmissionController.adoptAiFeedback.bind(teacherSubmissionController)
);

//GET /api/backend/teacher/submit/:submissionId
router.get(
  '/:submissionId',
  validate(submissionIdSchema),
  teacherSubmissionController.getSubmissionById.bind(teacherSubmissionController)
);

export default router;
