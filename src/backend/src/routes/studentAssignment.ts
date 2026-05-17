import { Router } from 'express';
import { studentAssignmentController } from '../controllers/studentAssignment';
import { authenticate, requireStudent } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getAssignmentSchema, getClassAssignmentsSchema } from '../validators/assignment';

const router = Router();

router.use(authenticate, requireStudent);

//GET /api/backend/student/assignments
router.get('/', studentAssignmentController.getMyAssignments.bind(studentAssignmentController));

//GET /api/backend/student/assignments/class/:classId
router.get(
  '/class/:classId',
  validate(getClassAssignmentsSchema),
  studentAssignmentController.getClassAssignments.bind(studentAssignmentController)
);

//GET /api/backend/student/assignments/:assignmentId
router.get(
  '/:assignmentId',
  validate(getAssignmentSchema),
  studentAssignmentController.getAssignment.bind(studentAssignmentController)
);

export default router;
