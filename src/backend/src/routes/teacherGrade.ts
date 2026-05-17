import { Router } from 'express';
import { teacherGradeController } from '../controllers/teacherGrade';
import { authenticate, requireTeacher } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  recordGradeSchema,
  updateGradeSchema,
  deleteGradeSchema,
  getGradesByClassSchema,
  getGradesBySourceSchema,
  releaseGradesSchema,
  getStudentOverviewSchema,
} from '../validators/grade';

const router = Router();

router.use(authenticate, requireTeacher);

//POST /api/backend/teacher/grades/class/:classId
router.post(
  '/class/:classId',
  validate(recordGradeSchema),
  teacherGradeController.recordGrade.bind(teacherGradeController)
);

//GET /api/backend/teacher/grades/class/:classId
router.get(
  '/class/:classId',
  validate(getGradesByClassSchema),
  teacherGradeController.getGradesByClass.bind(teacherGradeController)
);

//GET /api/backend/teacher/grades/class/:classId/source?sourceId=x&sourceType=ASSIGNMENT
router.get(
  '/class/:classId/source',
  validate(getGradesBySourceSchema),
  teacherGradeController.getGradesBySource.bind(teacherGradeController)
);

//POST /api/backend/teacher/grades/class/:classId/release
router.post(
  '/class/:classId/release',
  validate(releaseGradesSchema),
  teacherGradeController.releaseGrades.bind(teacherGradeController)
);

//GET /api/backend/teacher/grades/class/:classId/overview
router.get(
  '/class/:classId/overview',
  validate(getGradesByClassSchema),
  teacherGradeController.getClassOverview.bind(teacherGradeController)
);

//GET /api/backend/teacher/grades/class/:classId/student/:studentId
router.get(
  '/class/:classId/student/:studentId',
  validate(getStudentOverviewSchema),
  teacherGradeController.getStudentOverview.bind(teacherGradeController)
);

//PATCH /api/backend/teacher/grades/:gradeId
router.patch(
  '/:gradeId',
  validate(updateGradeSchema),
  teacherGradeController.updateGrade.bind(teacherGradeController)
);

//DELETE /api/backend/teacher/grades/:gradeId
router.delete(
  '/:gradeId',
  validate(deleteGradeSchema),
  teacherGradeController.deleteGrade.bind(teacherGradeController)
);

export default router;
