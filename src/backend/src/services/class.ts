import { randomBytes } from 'crypto';
import { classRepository } from '../repositories/class';
import {
  ClassData,
  ClassStudentList,
  ClassWithMemberCount,
  ClassWithMembers,
  CreateClassRequest,
  StudentClassData,
  UpdateClassRequest,
} from '../types/class';

export class ClassService {
  //Teacher Methods

  async createClass(teacherId: string, data: CreateClassRequest): Promise<ClassData> {
    const joinCode = await this.generateUniqueJoinCode();

    return classRepository.create({
      name: data.name,
      description: data.description,
      teacherId,
      joinCode,
    });
  }

  async getTeacherClasses(teacherId: string): Promise<ClassWithMemberCount[]> {
    return classRepository.findAllByTeacher(teacherId);
  }

  async getClassWithMembers(classId: string, teacherId: string): Promise<ClassWithMembers> {
    const classData = await classRepository.findByIdWithMembers(classId, teacherId);

    if (!classData) {
      throw new Error('Class not found');
    }

    return classData;
  }

  async getClassStudents(
    classId: string,
    requesterId: string,
    requesterRole: 'TEACHER' | 'STUDENT'
  ): Promise<ClassStudentList> {
    if (requesterRole === 'TEACHER') {
      const classData = await classRepository.findByIdAndTeacher(classId, requesterId);
      if (!classData) {
        throw new Error('Class not found');
      }
    } else {
      const membership = await classRepository.findMembership(classId, requesterId);
      if (!membership) {
        throw new Error('Class not found');
      }
    }

    return classRepository.findStudentsByClass(classId);
  }

  async updateClass(
    classId: string,
    teacherId: string,
    data: UpdateClassRequest
  ): Promise<ClassData> {
    if (!data.name && data.description === undefined) {
      throw new Error('At least one field (name or description) must be provided');
    }

    const updated = await classRepository.update(classId, teacherId, data);

    if (!updated) {
      throw new Error('Class not found');
    }

    return updated;
  }

  async regenerateJoinCode(classId: string, teacherId: string): Promise<ClassData> {
    const existing = await classRepository.findByIdAndTeacher(classId, teacherId);
    if (!existing) {
      throw new Error('Class not found');
    }

    const joinCode = await this.generateUniqueJoinCode();

    const updated = await classRepository.updateJoinCode(classId, teacherId, joinCode);
    if (!updated) {
      throw new Error('Failed to regenerate join code');
    }

    return updated;
  }

  async deleteClass(classId: string, teacherId: string): Promise<void> {
    const exists = await classRepository.findByIdAndTeacher(classId, teacherId);

    if (!exists) {
      throw new Error('Class not found');
    }

    const deleted = await classRepository.delete(classId, teacherId);

    if (!deleted) {
      throw new Error('Failed to delete class');
    }
  }

  async removeStudent(classId: string, studentId: string, teacherId: string): Promise<void> {
    const classData = await classRepository.findByIdAndTeacher(classId, teacherId);

    if (!classData) {
      throw new Error('Class not found');
    }

    const removed = await classRepository.removeMember(classId, studentId, teacherId);

    if (!removed) {
      throw new Error('Student not found in this class');
    }
  }

  //Student Methods

  async joinClass(studentId: string, joinCode: string): Promise<StudentClassData> {
    const classData = await classRepository.findByJoinCode(joinCode);

    if (!classData) {
      throw new Error('Invalid join code');
    }

    if (classData.teacherId === studentId) {
      throw new Error('Teachers cannot join their own class as a student');
    }

    const alreadyMember = await classRepository.findMembership(classData.id, studentId);

    if (alreadyMember) {
      throw new Error('You are already enrolled in this class');
    }

    await classRepository.joinClass(classData.id, studentId);

    const enrolled = await classRepository.findEnrolledClasses(studentId);
    const joined = enrolled.find((e) => e.classId === classData.id);

    if (!joined) {
      throw new Error('Failed to join class');
    }

    return joined;
  }

  async leaveClass(studentId: string, classId: string): Promise<void> {
    const isMember = await classRepository.findMembership(classId, studentId);

    if (!isMember) {
      throw new Error('You are not enrolled in this class');
    }

    const left = await classRepository.leaveClass(classId, studentId);

    if (!left) {
      throw new Error('Failed to leave class');
    }
  }

  async getEnrolledClasses(studentId: string): Promise<StudentClassData[]> {
    return classRepository.findEnrolledClasses(studentId);
  }

  async getEnrolledClass(studentId: string, classId: string): Promise<ClassData> {
    const membership = await classRepository.findMembership(classId, studentId);

    if (!membership) {
      throw new Error('Class not found');
    }

    const classData = await classRepository.findById(classId);

    if (!classData) {
      throw new Error('Class not found');
    }

    return classData;
  }

  //Private Helpers

  private generateJoinCode(): string {
    return randomBytes(4).toString('hex').toUpperCase();
  }

  private async generateUniqueJoinCode(): Promise<string> {
    for (let attempts = 0; attempts < 5; attempts++) {
      const joinCode = this.generateJoinCode();
      const taken = await classRepository.findByJoinCode(joinCode);
      if (!taken) {
        return joinCode;
      }
    }
    throw new Error('Failed to generate a unique join code, please try again');
  }
}

export const classService = new ClassService();
