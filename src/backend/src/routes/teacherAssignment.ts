import { Router } from 'express';
import { teacherAssignmentController } from '../controllers/teacherAssignment';
import { authenticate, requireTeacher } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  getAssignmentSchema,
  getClassAssignmentsSchema,
  deleteAssignmentSchema,
  createTestCaseSchema,
  updateTestCaseSchema,
  testCaseParamSchema,
} from '../validators/assignment';

const router = Router();

router.use(authenticate, requireTeacher);

//POST /api/backend/teacher/assignments/class/:classId
router.post(
  '/class/:classId',
  validate(createAssignmentSchema),
  teacherAssignmentController.createAssignment.bind(teacherAssignmentController)
);

//GET /api/backend/teacher/assignments/class/:classId
router.get(
  '/class/:classId',
  validate(getClassAssignmentsSchema),
  teacherAssignmentController.getClassAssignments.bind(teacherAssignmentController)
);

//GET /api/backend/teacher/assignments/:assignmentId
router.get(
  '/:assignmentId',
  validate(getAssignmentSchema),
  teacherAssignmentController.getAssignment.bind(teacherAssignmentController)
);

//PATCH /api/backend/teacher/assignments/:assignmentId
router.patch(
  '/:assignmentId',
  validate(updateAssignmentSchema),
  teacherAssignmentController.updateAssignment.bind(teacherAssignmentController)
);

//DELETE /api/backend/teacher/assignments/:assignmentId
router.delete(
  '/:assignmentId',
  validate(deleteAssignmentSchema),
  teacherAssignmentController.deleteAssignment.bind(teacherAssignmentController)
);

//POST /api/backend/teacher/assignments/:assignmentId/test-cases
router.post(
  '/:assignmentId/test-cases',
  validate(createTestCaseSchema),
  teacherAssignmentController.addTestCase.bind(teacherAssignmentController)
);

//GET /api/backend/teacher/assignments/:assignmentId/test-cases
router.get(
  '/:assignmentId/test-cases',
  validate(getAssignmentSchema),
  teacherAssignmentController.getTestCases.bind(teacherAssignmentController)
);

//PATCH /api/backend/teacher/assignments/test-cases/:testCaseId
router.patch(
  '/test-cases/:testCaseId',
  validate(updateTestCaseSchema),
  teacherAssignmentController.updateTestCase.bind(teacherAssignmentController)
);

//DELETE /api/backend/teacher/assignments/test-cases/:testCaseId
router.delete(
  '/test-cases/:testCaseId',
  validate(testCaseParamSchema),
  teacherAssignmentController.deleteTestCase.bind(teacherAssignmentController)
);

export default router;
