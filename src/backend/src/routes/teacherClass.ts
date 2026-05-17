import { Router } from 'express';
import { teacherClassController } from '../controllers/teacherClass';
import { authenticate, requireTeacher } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createClassSchema,
  deleteClassSchema,
  getClassSchema,
  getClassStudentsSchema,
  removeStudentSchema,
  updateClassSchema,
} from '../validators/class';

const router = Router();

router.use(authenticate, requireTeacher);

//POST /api/backend/teacher/classes
/*
Body
{
  "name": "Python class",
  "description": "Intro"
}
Response
    "message": "Class created successfully",
    "data": {
        "id": "f5f914aa-7f5b-4d65-8c2f-ccd5e5e8fd70",
        "name": "Python class",
        "description": "Intro",
        "teacherId": "b9ed1e1b-8dc0-444e-aa84-77d2c4a8660c",
        "joinCode": "DRUMN-C8",
        "createdAt": "2026-03-06T21:53:53.792Z",
        "updatedAt": "2026-03-06T21:53:53.792Z"
    },
*/
router.post(
  '/',
  validate(createClassSchema),
  teacherClassController.createClass.bind(teacherClassController)
);

//GET /api/backend/teacher/classes
router.get('/', teacherClassController.getClasses.bind(teacherClassController));

//GET /api/backend/teacher/classes/:id
router.get(
  '/:id',
  validate(getClassSchema),
  teacherClassController.getClass.bind(teacherClassController)
);

//GET /api/backend/teacher/classes/:id/students
router.get(
  '/:id/students',
  validate(getClassStudentsSchema),
  teacherClassController.getClassStudents.bind(teacherClassController)
);

//PATCH /api/backend/teacher/classes/:id
router.patch(
  '/:id',
  validate(updateClassSchema),
  teacherClassController.updateClass.bind(teacherClassController)
);

//POST /api/backend/teacher/classes/:id/regenerate-code
router.post(
  '/:id/regenerate-code',
  validate(getClassSchema),
  teacherClassController.regenerateJoinCode.bind(teacherClassController)
);

//DELETE /api/backend/teacher/classes/:id
router.delete(
  '/:id',
  validate(deleteClassSchema),
  teacherClassController.deleteClass.bind(teacherClassController)
);

//DELETE /api/backend/teacher/classes/:id/students/:studentId
router.delete(
  '/:id/students/:studentId',
  validate(removeStudentSchema),
  teacherClassController.removeStudent.bind(teacherClassController)
);

export default router;
