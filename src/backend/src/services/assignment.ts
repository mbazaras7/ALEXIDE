import { and, eq, inArray } from 'drizzle-orm';
import db from '../db';
import { submissions } from '../db/schema';
import { assignmentRepository } from '../repositories/assignment';
import { classRepository } from '../repositories/class';
import {
  AssignmentData,
  AssignmentWithTestCases,
  AssignmentWithPublicTestCases,
  CreateAssignmentRequest,
  UpdateAssignmentRequest,
  TestCaseData,
  CreateTestCaseRequest,
  UpdateTestCaseRequest,
  AssignmentWithSubmissionStatus,
} from '../types/assignment';

export class AssignmentService {
  //Teacher Services
  async createAssignment(
    teacherId: string,
    classId: string,
    data: CreateAssignmentRequest
  ): Promise<AssignmentData> {
    const classData = await classRepository.findByIdAndTeacher(classId, teacherId);
    if (!classData) {
      throw new Error('Class not found');
    }

    let dueDate: Date | undefined;
    if (data.dueDate) {
      dueDate = new Date(data.dueDate);
      if (isNaN(dueDate.getTime())) {
        throw new Error('Invalid due date');
      }
      if (dueDate < new Date()) {
        throw new Error('Due date cannot be in the past');
      }
    }

    return assignmentRepository.create({
      classId,
      teacherId,
      title: data.title,
      description: data.description,
      dueDate,
      maxScore: data.maxScore ?? 100,
      language: data.language ?? 'python',
      status: data.status ?? 'DRAFT',
    });
  }

  async getAssignment(assignmentId: string, teacherId: string): Promise<AssignmentWithTestCases> {
    const assignment = await assignmentRepository.findByIdWithTestCasesAndTeacher(
      assignmentId,
      teacherId
    );

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    return assignment;
  }

  async getClassAssignments(classId: string, teacherId: string): Promise<AssignmentData[]> {
    const classData = await classRepository.findByIdAndTeacher(classId, teacherId);
    if (!classData) {
      throw new Error('Class not found');
    }

    return assignmentRepository.findAllByClassAndTeacher(classId, teacherId);
  }

  async updateAssignment(
    assignmentId: string,
    teacherId: string,
    data: UpdateAssignmentRequest
  ): Promise<AssignmentData> {
    const existing = await assignmentRepository.findByIdAndTeacher(assignmentId, teacherId);

    if (!existing) {
      throw new Error('Assignment not found');
    }

    if (Object.keys(data).length === 0) {
      throw new Error('At least one field must be provided');
    }

    let dueDate: Date | null | undefined;
    if (data.dueDate === '') {
      dueDate = null;
    } else if (data.dueDate) {
      dueDate = new Date(data.dueDate);
      if (isNaN(dueDate.getTime())) {
        throw new Error('Invalid due date');
      }
    }

    const updated = await assignmentRepository.update(assignmentId, teacherId, {
      title: data.title,
      description: data.description,
      dueDate,
      maxScore: data.maxScore,
      language: data.language,
      status: data.status,
    });

    if (!updated) {
      throw new Error('Assignment not found');
    }

    return updated;
  }

  async deleteAssignment(assignmentId: string, teacherId: string): Promise<void> {
    const assignment = await assignmentRepository.findByIdWithTestCasesAndTeacher(
      assignmentId,
      teacherId
    );

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    //Test cases are deleted automatically via cascade
    const deleted = await assignmentRepository.delete(assignmentId, teacherId);
    if (!deleted) {
      throw new Error('Failed to delete assignment');
    }
  }

  async addTestCase(
    assignmentId: string,
    teacherId: string,
    data: CreateTestCaseRequest
  ): Promise<TestCaseData> {
    const assignment = await assignmentRepository.findByIdAndTeacher(assignmentId, teacherId);

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    return assignmentRepository.addTestCase({
      assignmentId,
      name: data.name,
      inputData: data.inputData,
      expectedOutput: data.expectedOutput,
      sysArgs: data.sysArgs,
      weight: data.weight ?? 1,
      orderIndex: data.orderIndex ?? 0,
    });
  }

  async updateTestCase(
    testCaseId: string,
    teacherId: string,
    data: UpdateTestCaseRequest
  ): Promise<TestCaseData> {
    const testCase = await assignmentRepository.findTestCaseById(testCaseId);
    if (!testCase) {
      throw new Error('Test case not found');
    }

    const assignment = await assignmentRepository.findByIdAndTeacher(
      testCase.assignmentId,
      teacherId
    );

    if (!assignment) {
      throw new Error('Test case not found');
    }

    if (Object.keys(data).length === 0) {
      throw new Error('At least one field must be provided');
    }

    const updated = await assignmentRepository.updateTestCase(testCaseId, data);
    if (!updated) {
      throw new Error('Failed to update test case');
    }

    return updated;
  }

  async deleteTestCase(testCaseId: string, teacherId: string): Promise<void> {
    const testCase = await assignmentRepository.findTestCaseById(testCaseId);
    if (!testCase) {
      throw new Error('Test case not found');
    }

    const assignment = await assignmentRepository.findByIdAndTeacher(
      testCase.assignmentId,
      teacherId
    );

    if (!assignment) {
      throw new Error('Test case not found');
    }

    const deleted = await assignmentRepository.deleteTestCase(testCaseId);
    if (!deleted) {
      throw new Error('Failed to delete test case');
    }
  }

  async getTestCases(assignmentId: string, teacherId: string): Promise<TestCaseData[]> {
    const assignment = await assignmentRepository.findByIdAndTeacher(assignmentId, teacherId);

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    return assignmentRepository.findTestCasesByAssignment(assignmentId);
  }

  //Student services
  async getPublishedAssignment(
    assignmentId: string,
    studentId: string
  ): Promise<AssignmentWithPublicTestCases> {
    const assignment = await assignmentRepository.findByIdWithTestCases(assignmentId);

    if (!assignment || (assignment.status !== 'PUBLISHED' && assignment.status !== 'CLOSED')) {
      throw new Error('Assignment not found');
    }

    const isMember = await classRepository.findMembership(assignment.classId, studentId);

    if (!isMember) {
      throw new Error('Assignment not found');
    }

    return {
      ...assignment,
      testCases: assignment.testCases.map(({ id, name, inputData, orderIndex }) => ({
        id,
        name,
        inputData,
        orderIndex,
      })),
    };
  }

  async getPublishedAssignmentsForStudent(
    studentId: string
  ): Promise<AssignmentWithSubmissionStatus[]> {
    const enrolledClasses = await classRepository.findEnrolledClasses(studentId);
    if (enrolledClasses.length === 0) {
      return [];
    }

    const assignmentsByClass = await Promise.all(
      enrolledClasses.map((e) => assignmentRepository.findAllByClassWithClassName(e.classId))
    );

    const published = assignmentsByClass
      .flat()
      .filter((a) => a != null && (a.status === 'PUBLISHED' || a.status === 'CLOSED'))
      .sort((a, b) => {
        if (!a.dueDate) {
          return 1;
        }
        if (!b.dueDate) {
          return -1;
        }
        return a.dueDate.getTime() - b.dueDate.getTime();
      });

    if (published.length === 0) {
      return [];
    }

    const assignmentIds = published.map((a) => a.id);

    const studentSubmissions = await db
      .select()
      .from(submissions)
      .where(
        and(inArray(submissions.assignmentId, assignmentIds), eq(submissions.studentId, studentId))
      );

    const subMap = new Map(studentSubmissions.map((s) => [s.assignmentId, s]));

    return published.map((a) => {
      const sub = subMap.get(a.id);
      return {
        ...a,
        submissionStatus: (sub?.status ??
          null) as AssignmentWithSubmissionStatus['submissionStatus'],
        submissionScore: sub?.score ?? null,
        submissionMaxScore: sub?.maxScore ?? null,
        submittedAt: sub?.submittedAt ?? null,
      };
    });
  }

  async getPublishedAssignmentsByClass(
    classId: string,
    studentId: string
  ): Promise<AssignmentData[]> {
    const isMember = await classRepository.findMembership(classId, studentId);

    if (!isMember) {
      throw new Error('Class not found');
    }

    const all = await assignmentRepository.findAllByClass(classId);

    return all
      .filter((a) => a.status === 'PUBLISHED' || a.status === 'CLOSED')
      .sort((a, b) => {
        if (!a.dueDate) {
          return 1;
        }
        if (!b.dueDate) {
          return -1;
        }
        return a.dueDate.getTime() - b.dueDate.getTime();
      });
  }
}

export const assignmentService = new AssignmentService();
