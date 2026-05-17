import { Router } from 'express';
import { studentClassController } from '../controllers/studentClass';
import { authenticate, requireStudent } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  getEnrolledClassStudentsSchema,
  joinClassSchema,
  leaveClassSchema,
} from '../validators/class';

const router = Router();

router.use(authenticate, requireStudent);

//POST /api/backend/student/classes/join
/*
Body
{
  "joinCode": "0A55B635"
}
*/
router.post(
  '/join',
  validate(joinClassSchema),
  studentClassController.joinClass.bind(studentClassController)
);

//GET /api/backend/student/classes/:classId
router.get(
  '/:classId',
  validate(leaveClassSchema),
  studentClassController.getEnrolledClass.bind(studentClassController)
);

//GET /api/backend/student/classes/:classId/students
router.get(
  '/:classId/students',
  validate(getEnrolledClassStudentsSchema),
  studentClassController.getClassStudents.bind(studentClassController)
);

//DELETE /api/backend/student/classes/:classId/leave
router.delete(
  '/:classId/leave',
  validate(leaveClassSchema),
  studentClassController.leaveClass.bind(studentClassController)
);

//GET /api/backend/student/classes
router.get('/', studentClassController.getEnrolledClasses.bind(studentClassController));

export default router;
