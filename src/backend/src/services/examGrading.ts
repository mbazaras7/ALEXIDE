import { executionService } from './execution';
import { examRepository } from '../repositories/exam';
import { examSubmissionRepository } from '../repositories/examSubmission';
import { gradeRepository } from '../repositories/grade';

export class ExamGradingService {
  async gradeQuestionSubmission(submissionId: string): Promise<void> {
    const submission = await examSubmissionRepository.findById(submissionId);
    if (!submission) {
      console.error(`Submission not found: ${submissionId}`);
      return;
    }

    const examWithQuestions = await examRepository.findByIdWithQuestions(submission.examId);
    if (!examWithQuestions) {
      return;
    }

    const fullQuestion = examWithQuestions.questions.find((q) => q.id === submission.questionId);
    if (!fullQuestion) {
      return;
    }

    if (fullQuestion.testCases.length === 0) {
      await examSubmissionRepository.updateResult(submissionId, {
        status: 'COMPLETED',
        score: fullQuestion.maxScore,
        maxScore: fullQuestion.maxScore,
        testResults: [],
      });
      return;
    }

    const testResults = [];
    let totalWeight = 0;
    let passedWeight = 0;

    for (const testCase of fullQuestion.testCases) {
      const result = await executionService.executeCode(
        submission.studentId,
        submission.code,
        'python',
        testCase.inputData ?? undefined,
        testCase.sysArgs ?? undefined
      );

      const actualOutput = (result.output ?? '').trim();
      const expectedOutput = testCase.expectedOutput.trim();
      const passed = actualOutput === expectedOutput;
      const weight = testCase.weight ?? 1;

      testResults.push({
        name: testCase.name,
        passed,
        actualOutput,
        expectedOutput,
        weight,
      });

      totalWeight += weight;
      if (passed) {
        passedWeight += weight;
      }
    }

    const score =
      totalWeight > 0
        ? Math.round((passedWeight / totalWeight) * fullQuestion.maxScore * 100) / 100
        : 0;

    const status = passedWeight === totalWeight ? 'COMPLETED' : 'FAILED';

    await examSubmissionRepository.updateResult(submissionId, {
      status,
      score,
      maxScore: fullQuestion.maxScore,
      testResults,
    });

    console.log(`Question ${submission.questionId} graded: ${score}/${fullQuestion.maxScore}`);
  }

  async gradeExamSession(examId: string, studentId: string, examSessionId: string): Promise<void> {
    const exam = await examRepository.findById(examId);
    if (!exam) {
      console.error(`Exam not found: ${examId}`);
      return;
    }

    const submissions = await examSubmissionRepository.findBySession(examSessionId);

    for (const submission of submissions) {
      if (submission.status === 'PENDING' || submission.status === 'RUNNING') {
        await this.gradeQuestionSubmission(submission.id);
      }
    }

    const gradedSubmissions = await examSubmissionRepository.findBySession(examSessionId);

    const totalScore = gradedSubmissions.reduce((sum, s) => sum + (s.score ?? 0), 0);
    const totalMaxScore = gradedSubmissions.reduce((sum, s) => sum + (s.maxScore ?? 0), 0);

    const finalMaxScore = totalMaxScore > 0 ? totalMaxScore : exam.maxScore;
    const finalScore = Math.min(totalScore, finalMaxScore);

    const existing = await gradeRepository.findByStudentAndSource(studentId, examId, 'EXAM');

    if (existing) {
      await gradeRepository.update(existing.id, {
        score: finalScore,
        maxScore: finalMaxScore,
      });
    } else {
      await gradeRepository.create({
        studentId,
        classId: exam.classId,
        sourceType: 'EXAM',
        sourceId: exam.title,
        score: finalScore,
        maxScore: finalMaxScore,
      });
    }

    console.log(`Exam ${examId} graded for student ${studentId}: ${finalScore}/${finalMaxScore}`);
  }
}

export const examGradingService = new ExamGradingService();
