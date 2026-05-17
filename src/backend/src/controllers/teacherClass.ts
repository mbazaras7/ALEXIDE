/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { classService } from '../services/class';
import { ResponseHandler } from '../utils/response';

export class TeacherClassController {
  //POST /api/backend/teacher/classes
  async createClass(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const { name, description } = req.body;

      const newClass = await classService.createClass(teacherId, { name, description });

      ResponseHandler.created(res, newClass, 'Class created successfully');
    } catch (error: any) {
      console.error('Create class error:', error);
      ResponseHandler.error(res, error.message);
    }
  }

  //GET /api/backend/teacher/classes
  async getClasses(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;

      const teacherClasses = await classService.getTeacherClasses(teacherId);

      ResponseHandler.success(res, teacherClasses);
    } catch (error: any) {
      console.error('Get classes error:', error);
      ResponseHandler.error(res, error.message);
    }
  }

  //GET /api/backend/teacher/classes/:id
  async getClass(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const classId = req.params.id as string;

      const classData = await classService.getClassWithMembers(classId, teacherId);

      ResponseHandler.success(res, classData);
    } catch (error: any) {
      console.error('Get class error:', error);
      if (error.message === 'Class not found') {
        ResponseHandler.notFound(res, 'Class not found');
        return;
      }
      ResponseHandler.error(res, error.message);
    }
  }

  //GET /api/backend/teacher/classes/:id/students
  async getClassStudents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const classId = req.params.id as string;

      const students = await classService.getClassStudents(classId, teacherId, 'TEACHER');

      ResponseHandler.success(res, students);
    } catch (error: any) {
      console.error('Get class students error:', error);
      if (error.message === 'Class not found') {
        ResponseHandler.notFound(res, 'Class not found');
        return;
      }
      ResponseHandler.error(res, error.message);
    }
  }

  //PATCH /api/backend/teacher/classes/:id
  async updateClass(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const classId = req.params.id as string;
      const { name, description } = req.body;

      const updated = await classService.updateClass(classId, teacherId, { name, description });

      ResponseHandler.success(res, updated, 'Class updated successfully');
    } catch (error: any) {
      console.error('Update class error:', error);
      if (error.message === 'Class not found') {
        ResponseHandler.notFound(res, 'Class not found');
        return;
      }
      ResponseHandler.error(res, error.message);
    }
  }

  //POST /api/backend/teacher/classes/:id/regenerate-code
  async regenerateJoinCode(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const classId = req.params.id as string;

      const updated = await classService.regenerateJoinCode(classId, teacherId);

      ResponseHandler.success(
        res,
        { joinCode: updated.joinCode },
        'Join code regenerated successfully'
      );
    } catch (error: any) {
      console.error('Regenerate join code error:', error);
      if (error.message === 'Class not found') {
        ResponseHandler.notFound(res, 'Class not found');
        return;
      }
      ResponseHandler.error(res, error.message);
    }
  }

  //DELETE /api/backend/teacher/classes/:id
  async deleteClass(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const classId = req.params.id as string;

      await classService.deleteClass(classId, teacherId);

      ResponseHandler.success(res, null, 'Class deleted successfully');
    } catch (error: any) {
      console.error('Delete class error:', error);
      if (error.message === 'Class not found') {
        ResponseHandler.notFound(res, 'Class not found');
        return;
      }
      ResponseHandler.error(res, error.message);
    }
  }

  //DELETE /api/backend/teacher/classes/:id/students/:studentId
  async removeStudent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const teacherId = req.user!.userId;
      const classId = req.params.id as string;
      const studentId = req.params.studentId as string;

      await classService.removeStudent(classId, studentId, teacherId);

      ResponseHandler.success(res, null, 'Student removed from class successfully');
    } catch (error: any) {
      console.error('Remove student error:', error);
      if (error.message === 'Class not found') {
        ResponseHandler.notFound(res, 'Class not found');
        return;
      }
      if (error.message === 'Student not found in this class') {
        ResponseHandler.notFound(res, 'Student not found in this class');
        return;
      }
      ResponseHandler.error(res, error.message);
    }
  }
}

export const teacherClassController = new TeacherClassController();
