import { Router } from 'express';
import { studentGradeController } from '../controllers/studentGrade';
import { authenticate, requireStudent } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  getClassStatsSchema,
  getGradeByIdSchema,
  getStudentClassGradesSchema,
  getStudentGradesByTypeSchema,
} from '../validators/grade';

const router = Router();

router.use(authenticate, requireStudent);

//GET /api/backend/student/grades/summary
router.get('/summary', studentGradeController.getMyClassSummaries.bind(studentGradeController));

//GET /api/backend/student/grades
router.get('/', studentGradeController.getMyGrades.bind(studentGradeController));

router.get(
  '/class/:classId',
  validate(getStudentClassGradesSchema),
  studentGradeController.getMyGradesForClass.bind(studentGradeController)
);

// GET /api/backend/student/grades/class/:classId/stats
router.get(
  '/class/:classId/stats',
  validate(getClassStatsSchema),
  studentGradeController.getMyStatsForClass.bind(studentGradeController)
);

// GET /api/backend/student/grades/class/:classId/filter?sourceType=ASSIGNMENT
router.get(
  '/class/:classId/filter',
  validate(getStudentGradesByTypeSchema),
  studentGradeController.getMyGradesByType.bind(studentGradeController)
);

// GET /api/backend/student/grades/class/:classId
router.get(
  '/class/:classId',
  validate(getStudentClassGradesSchema),
  studentGradeController.getMyGradesForClass.bind(studentGradeController)
);

// GET /api/backend/student/grades/:gradeId
router.get(
  '/:gradeId',
  validate(getGradeByIdSchema),
  studentGradeController.getMyGradeById.bind(studentGradeController)
);

export default router;
