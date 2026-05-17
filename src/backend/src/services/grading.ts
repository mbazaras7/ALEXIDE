import { executionService } from './execution';
import type { TestResult } from '../types/submission';
import { assignmentRepository } from '../repositories/assignment';
import { aiFeedbackService } from './aiFeedback';
import { submissionRepository } from '../repositories/submission';
import { gradingRepository } from '../repositories/grading';

export class GradingService {
  async gradeSubmission(submissionId: string): Promise<void> {
    const submission = await gradingRepository.findSubmissionById(submissionId);
    if (!submission) {
      throw new Error('Submission not found');
    }

    const assignment = await gradingRepository.findAssignmentById(submission.assignmentId);
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    const cases = await assignmentRepository.findTestCasesByAssignment(assignment.id);

    await gradingRepository.setSubmissionRunning(submissionId);

    try {
      const testResults: TestResult[] = [];
      let totalWeight = 0;
      let earnedWeight = 0;

      for (const tc of cases) {
        const result = await executionService.executeCode(
          submission.studentId,
          submission.code,
          assignment.language as 'python',
          tc.inputData ?? undefined,
          tc.sysArgs ?? undefined
        );

        const actualOutput = result.output.trim();
        const expectedOutput = tc.expectedOutput.trim();
        const passed = actualOutput === expectedOutput;
        const weight = tc.weight ?? 1;

        testResults.push({ name: tc.name, passed, actualOutput, expectedOutput, weight });
        totalWeight += weight;
        if (passed) {
          earnedWeight += weight;
        }
      }

      const score =
        totalWeight > 0
          ? Math.round((earnedWeight / totalWeight) * assignment.maxScore * 100) / 100
          : 0;
      const status: 'COMPLETED' | 'FAILED' = earnedWeight === totalWeight ? 'COMPLETED' : 'FAILED';

      await gradingRepository.updateSubmissionResult(submissionId, {
        status,
        score,
        maxScore: assignment.maxScore,
        testResults: JSON.stringify(testResults),
      });

      await gradingRepository.upsertGrade({
        studentId: submission.studentId,
        classId: assignment.classId,
        sourceId: assignment.id,
        score,
        maxScore: assignment.maxScore,
      });

      // Fire-and-forget AI feedback — does not block grading result
      aiFeedbackService
        .generateSubmissionFeedback({
          assignmentTitle: assignment.title,
          assignmentDescription: assignment.description ?? '',
          studentCode: submission.code,
          testResults,
          totalPassed: testResults.filter((t) => t.passed).length,
          totalTests: testResults.length,
        })
        .then(({ feedback }) => submissionRepository.saveAiFeedback(submissionId, feedback))
        .catch((err: Error) =>
          console.error(`[aiFeedback] Failed for submission ${submissionId}`, err.message)
        );
    } catch (error) {
      await gradingRepository.setSubmissionFailed(submissionId);
      throw error;
    }
  }

  async reGradeSubmission(submissionId: string, teacherId: string): Promise<void> {
    const submission = await gradingRepository.findSubmissionWithAssignment(submissionId);
    if (!submission) {
      throw new Error('Submission not found');
    }

    const assignment = await gradingRepository.findAssignmentByIdAndTeacher(
      submission.assignmentId,
      teacherId
    );
    if (!assignment) {
      throw new Error('Submission not found');
    }

    if (submission.status === 'RUNNING') {
      throw new Error('Submission is already being graded');
    }

    await this.gradeSubmission(submissionId);
  }
}

export const gradingService = new GradingService();
