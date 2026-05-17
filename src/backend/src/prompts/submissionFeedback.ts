import { AiFeedbackInput } from '../types/aiFeedback';

export function buildSubmissionFeedbackPrompt(input: AiFeedbackInput): string {
  const failedTests = input.testResults.filter((t) => !t.passed);

  const testSummary =
    failedTests.length > 0
      ? `Failed tests:\n${failedTests
          .map((t) => `- ${t.name}: expected "${t.expectedOutput}", got "${t.actualOutput}"`)
          .join('\n')}`
      : 'All tests passed.';

  return `You are a helpful programming tutor reviewing a student's assignment submission.

    Assignment: ${input.assignmentTitle}
    Description: ${input.assignmentDescription}

    Student's Code:
    \`\`\`python
    ${input.studentCode}
    \`\`\`

    Test Results: ${input.totalPassed}/${input.totalTests} tests passed.
    ${testSummary}

    Please provide concise, constructive feedback (3-5 sentences) that:
    1. Acknowledges what the student did well
    2. Explains why any failing tests failed without giving away the solution
    3. Gives one specific, actionable improvement tip

    Be encouraging and educational. Do not write corrected code.`;
}
