import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import StudentAssignmentPage from '../StudentAssignmentPage';

jest.mock('../../hooks/useStudentAssignment', () => ({
  useStudentAssignment: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ assignmentId: 'asgn-1' }),
  useNavigate: () => mockNavigate,
}));

const mockNavigate = jest.fn();
const { useStudentAssignment } = require('../../hooks/useStudentAssignment');

const mockAssignment = {
  id: 'asgn-1',
  classId: 'class-1',
  title: 'Hello World',
  description: 'Print hello world',
  language: 'python',
  maxScore: 100,
  dueDate: null,
  status: 'PUBLISHED',
};

const mockSubmission = {
  id: 'sub-1',
  assignmentId: 'asgn-1',
  studentId: 'student-1',
  code: 'print("Hello World")',
  status: 'COMPLETED',
  score: 85,
  maxScore: 100,
  submittedAt: '2026-01-01T00:00:00.000Z',
  testResults: [
    {
      id: 'tr-1',
      testCaseId: 'tc-1',
      passed: true,
      output: 'Hello World',
      testCase: { name: 'Test 1', expectedOutput: 'Hello World' },
    },
  ],
};

const baseHookState = {
  assignment: mockAssignment,
  submission: null,
  feedback: null,
  gradeReleased: false,
  loading: false,
  error: null,
};

const setHookState = (overrides = {}) => {
  useStudentAssignment.mockReturnValue({ ...baseHookState, ...overrides });
};

const renderComponent = () =>
  render(
    <MantineProvider>
      <BrowserRouter>
        <StudentAssignmentPage />
      </BrowserRouter>
    </MantineProvider>
  );

describe('StudentAssignmentPage Component tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useStudentAssignment.mockReturnValue(baseHookState);
  });

  test('should render assignment title and description', () => {
    renderComponent();
    expect(screen.getByText('Hello World')).toBeInTheDocument();
    const descriptions = screen.getAllByText('Print hello world');
    expect(descriptions[0]).toBeInTheDocument();
  });

  test('should render language badge', () => {
    renderComponent();
    expect(screen.getByText('python')).toBeInTheDocument();
  });

  test('should render max score', () => {
    renderComponent();
    expect(screen.getByText(/Max score:.*100/)).toBeInTheDocument();
  });

  test('should show loader when loading', () => {
    setHookState({ loading: true, assignment: null });
    renderComponent();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  test('should show error alert when error occurs', () => {
    setHookState({ error: 'Failed to load assignment', assignment: null });
    renderComponent();
    expect(screen.getByText('Failed to load assignment')).toBeInTheDocument();
  });

  test('should show Start Assignment button when no submission', () => {
    renderComponent();
    expect(screen.getByRole('button', { name: /start assignment/i })).toBeInTheDocument();
  });

  test('should show Open in IDE button when submission exists', () => {
    setHookState({ submission: mockSubmission });
    renderComponent();
    expect(screen.getByRole('button', { name: /open in ide/i })).toBeInTheDocument();
  });

  test('should navigate to IDE when Start Assignment clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /start assignment/i }));
    expect(mockNavigate).toHaveBeenCalledWith(
      '/student/ide',
      expect.objectContaining({
        state: expect.objectContaining({ assignmentId: 'asgn-1' }),
      })
    );
  });

  test('should show graded submission card with score', () => {
    setHookState({ submission: mockSubmission, gradeReleased: true });
    renderComponent();
    expect(screen.getByText('Assignment Graded')).toBeInTheDocument();
    expect(screen.getByText(/85 \/ 100/)).toBeInTheDocument();
  });

  test('should show pending submission message', () => {
    setHookState({ submission: { ...mockSubmission, status: 'PENDING', score: null } });
    renderComponent();
    expect(screen.getByText('Submitted - awaiting grading')).toBeInTheDocument();
  });

  test('should show submission badge with correct status', () => {
    setHookState({ submission: mockSubmission, gradeReleased: true });
    renderComponent();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
  });

  test('should show test results when submission has test results', () => {
    setHookState({ submission: mockSubmission, gradeReleased: true });
    renderComponent();
    expect(screen.getByText('Test Results')).toBeInTheDocument();
    expect(screen.getByText('Test 1')).toBeInTheDocument();
    expect(screen.getByText('Pass')).toBeInTheDocument();
  });

  test('should show overdue badge when assignment is overdue and not submitted', () => {
    const pastDate = new Date(Date.now() - 100000).toISOString();
    setHookState({ assignment: { ...mockAssignment, dueDate: pastDate } });
    renderComponent();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  test('should show overdue alert and disable button when overdue with no submission', () => {
    const pastDate = new Date(Date.now() - 100000).toISOString();
    setHookState({ assignment: { ...mockAssignment, dueDate: pastDate } });
    renderComponent();
    expect(
      screen.getByText('This assignment is past its due date and can no longer be submitted.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start assignment/i })).toBeDisabled();
  });

  test('should show instructions card when description exists', () => {
    renderComponent();
    expect(screen.getByText('Instructions')).toBeInTheDocument();
  });

  test('should navigate back when back button clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: '' }));
    expect(mockNavigate).toHaveBeenCalledWith('/student/classes/class-1');
  });
});
