/* eslint-disable @typescript-eslint/no-explicit-any */
import { submissionRepository } from '../repositories/submission';
import { classRepository } from '../repositories/class';
import { assignmentRepository } from '../repositories/assignment';
import { gradingService } from './grading';
import { storageService } from './storage';
import { SubmissionData, StudentSubmissionData } from '../types/submission';

const PASS_THRESHOLD = 0.5;

export class SubmissionService {
  //Student Methods
  async submitAssignment(
    studentId: string,
    assignmentId: string,
    code?: string,
    storageKey?: string
  ): Promise<StudentSubmissionData> {
    if (!code && !storageKey) {
      throw new Error('Either code or storageKey must be provided');
    }

    const assignment = await assignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new Error('Assignment not found');
    }
    if (assignment.status !== 'PUBLISHED') {
      throw new Error('Assignment is not available for submission');
    }

    const membership = await classRepository.findMembership(assignment.classId, studentId);
    if (!membership) {
      throw new Error('You are not enrolled in this class');
    }

    if (assignment.dueDate && new Date() > assignment.dueDate) {
      throw new Error('Assignment due date has passed');
    }

    let finalCode: string;
    if (storageKey) {
      const contentBuffer = await storageService.downloadFile(storageKey);
      finalCode = contentBuffer.toString('utf-8');
    } else {
      finalCode = code!;
    }

    const submission = await submissionRepository.upsert(assignmentId, studentId, finalCode);

    try {
      await gradingService.gradeSubmission(submission.id);
    } catch (err: any) {
      console.error(`Grading failed for submission ${submission.id}:`, err.message);
    }

    const updated = await submissionRepository.findRawById(submission.id);
    return updated as StudentSubmissionData;
  }

  async getMySubmission(
    studentId: string,
    assignmentId: string
  ): Promise<StudentSubmissionData | null> {
    return submissionRepository.findByStudentAndAssignment(studentId, assignmentId);
  }

  async getSubmissionAsStudent(
    submissionId: string,
    studentId: string
  ): Promise<StudentSubmissionData> {
    const submission = await submissionRepository.findById(submissionId, studentId);
    if (!submission) {
      throw new Error('Submission not found');
    }
    return submission;
  }

  async getMySubmissionsByClass(
    studentId: string,
    classId: string
  ): Promise<StudentSubmissionData[]> {
    const membership = await classRepository.findMembership(classId, studentId);
    if (!membership) {
      throw new Error('You are not enrolled in this class');
    }

    const classAssignments = await assignmentRepository.findIdsByClass(classId);
    return submissionRepository.findByStudentAndAssignments(studentId, classAssignments);
  }

  async getMySubmissionByClassAndAssignment(
    studentId: string,
    classId: string,
    assignmentId: string
  ): Promise<StudentSubmissionData | null> {
    const membership = await classRepository.findMembership(classId, studentId);
    if (!membership) {
      throw new Error('You are not enrolled in this class');
    }

    const assignment = await assignmentRepository.findByIdAndClass(assignmentId, classId);
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    return submissionRepository.findByStudentAndAssignment(studentId, assignmentId);
  }

  //Teacher methods
  async getAssignmentSubmissions(
    assignmentId: string,
    teacherId: string
  ): Promise<SubmissionData[]> {
    const assignment = await assignmentRepository.findByIdAndTeacher(assignmentId, teacherId);
    if (!assignment) {
      throw new Error('Assignment not found');
    }
    return submissionRepository.findByAssignment(assignmentId);
  }

  async getSubmissionAsTeacher(submissionId: string, teacherId: string): Promise<SubmissionData> {
    const submission = await submissionRepository.findByIdAsTeacher(submissionId, teacherId);
    if (!submission) {
      throw new Error('Submission not found');
    }
    return submission;
  }

  async getClassSubmissions(classId: string, teacherId: string): Promise<SubmissionData[]> {
    const cls = await classRepository.findByIdAndTeacher(classId, teacherId);
    if (!cls) {
      throw new Error('Class not found');
    }

    const assignmentIds = await assignmentRepository.findIdsByClass(classId);
    return submissionRepository.findByAssignmentIds(assignmentIds);
  }

  async getSubmissionsByClassAndAssignment(
    teacherId: string,
    classId: string,
    assignmentId: string
  ): Promise<SubmissionData[]> {
    const cls = await classRepository.findByIdAndTeacher(classId, teacherId);
    if (!cls) {
      throw new Error('Class not found');
    }

    const assignment = await assignmentRepository.findByIdAndClass(assignmentId, classId);
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    return submissionRepository.findByAssignment(assignmentId);
  }

  async getAssignmentStats(
    assignmentId: string,
    teacherId: string
  ): Promise<{
    assignmentId: string;
    totalSubmissions: number;
    passRate: number;
    averageScore: number;
    averagePercentage: number;
    completedCount: number;
    failedCount: number;
    pendingCount: number;
  }> {
    const assignment = await assignmentRepository.findByIdAndTeacher(assignmentId, teacherId);
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    const rows = await submissionRepository.findRawByAssignment(assignmentId);
    const total = rows.length;
    if (total === 0) {
      return {
        assignmentId,
        totalSubmissions: 0,
        passRate: 0,
        averageScore: 0,
        averagePercentage: 0,
        completedCount: 0,
        failedCount: 0,
        pendingCount: 0,
      };
    }

    const completed = rows.filter((r) => r.status === 'COMPLETED');
    const failed = rows.filter((r) => r.status === 'FAILED');
    const pending = rows.filter((r) => r.status === 'PENDING' || r.status === 'RUNNING');
    const scored = completed.filter((r) => r.score !== null && r.maxScore !== null);

    const averageScore =
      scored.length > 0
        ? Math.round((scored.reduce((sum, r) => sum + r.score!, 0) / scored.length) * 100) / 100
        : 0;
    const averagePercentage =
      scored.length > 0
        ? Math.round(
            (scored.reduce((sum, r) => sum + (r.score! / r.maxScore!) * 100, 0) / scored.length) *
              100
          ) / 100
        : 0;
    const passed = scored.filter((r) => r.score! / r.maxScore! >= PASS_THRESHOLD);
    const passRate =
      scored.length > 0 ? Math.round((passed.length / scored.length) * 10000) / 100 : 0;

    return {
      assignmentId,
      totalSubmissions: total,
      passRate,
      averageScore,
      averagePercentage,
      completedCount: completed.length,
      failedCount: failed.length,
      pendingCount: pending.length,
    };
  }
}

export const submissionService = new SubmissionService();
