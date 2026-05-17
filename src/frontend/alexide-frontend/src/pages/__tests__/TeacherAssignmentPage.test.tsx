import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import TeacherAssignmentPage from '../TeacherAssignmentPage';

jest.mock('../../hooks/useTeacherAssignment', () => ({
  useTeacherAssignment: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ assignmentId: 'asgn-1' }),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ state: null }),
}));

const { useTeacherAssignment } = require('../../hooks/useTeacherAssignment');

const mockAddTestCase = jest.fn();
const mockDeleteTestCase = jest.fn();
const mockReGradeSubmission = jest.fn();
const mockPublishAssignment = jest.fn();

const mockAssignment = {
  id: 'asgn-1',
  classId: 'class-1',
  title: 'Hello World',
  description: 'Print hello world',
  status: 'DRAFT',
  language: 'python',
  maxScore: 100,
  dueDate: null,
  testCases: [
    {
      id: 'tc-1',
      name: 'Test 1',
      inputData: '',
      expectedOutput: 'Hello World',
      orderIndex: 1,
    },
  ],
};

const mockSubmission = {
  id: 'sub-1',
  assignmentId: 'asgn-1',
  studentId: 'student-1',
  code: 'print("Hello World")',
  status: 'GRADED',
  score: 100,
  maxScore: 100,
  submittedAt: '2026-01-01T00:00:00.000Z',
  student: { id: 'student-1', name: 'Alice', email: 'alice@test.com' },
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
  submissions: [mockSubmission],
  loading: false,
  error: null,
  addTestCase: mockAddTestCase,
  deleteTestCase: mockDeleteTestCase,
  reGradeSubmission: mockReGradeSubmission,
  publishAssignment: mockPublishAssignment,
};

const setHookState = (overrides = {}) => {
  useTeacherAssignment.mockReturnValue({ ...baseHookState, ...overrides });
};

const renderComponent = () =>
  render(
    <MantineProvider>
      <BrowserRouter>
        <TeacherAssignmentPage />
      </BrowserRouter>
    </MantineProvider>
  );

describe('TeacherAssignmentPage Component tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTeacherAssignment.mockReturnValue(baseHookState);
  });

  test('should render assignment title and description', () => {
    renderComponent();
    const headings = screen.getAllByText('Hello World');
    expect(headings[0]).toBeInTheDocument();
    expect(screen.getByText('Print hello world')).toBeInTheDocument();
  });

  test('should render assignment status and language badges', () => {
    renderComponent();
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
    expect(screen.getByText('python')).toBeInTheDocument();
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

  test('should render test cases tab with correct amount', () => {
    renderComponent();
    expect(screen.getByText(/Test Cases \(1\)/i)).toBeInTheDocument();
  });

  test('should render test case name and expected output', () => {
    renderComponent();
    const testNames = screen.getAllByText('Test 1');
    expect(testNames[0]).toBeInTheDocument();
    const outputs = screen.getAllByText('Hello World');
    expect(outputs[0]).toBeInTheDocument();
  });

  test('should show empty state when no test cases', () => {
    setHookState({ assignment: { ...mockAssignment, testCases: [] } });
    renderComponent();
    expect(screen.getByText('No test cases yet')).toBeInTheDocument();
  });

  test('should show Publish button when assignment is DRAFT', () => {
    renderComponent();
    expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument();
  });

  test('should not show Publish button when assignment is PUBLISHED', () => {
    setHookState({ assignment: { ...mockAssignment, status: 'PUBLISHED' } });
    renderComponent();
    expect(screen.queryByRole('button', { name: /publish/i })).not.toBeInTheDocument();
  });

  test('should call publishAssignment when Publish is confirmed', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockPublishAssignment.mockResolvedValue(undefined);
    renderComponent();
    await user.click(screen.getByRole('button', { name: /publish/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^publish$/i }));
    await waitFor(() => expect(mockPublishAssignment).toHaveBeenCalled());
  });

  test('should not call publishAssignment if confirm is cancelled', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    renderComponent();
    await user.click(screen.getByRole('button', { name: /publish/i }));
    expect(mockPublishAssignment).not.toHaveBeenCalled();
  });

  test('should open Add Test Case modal when button clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /add test case/i }));
    const modal = await screen.findByRole('dialog');
    expect(modal).toBeInTheDocument();
  });

  test('should show form error if name is empty on add test case', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /add test case/i }));
    await user.click(await screen.findByRole('button', { name: /^add$/i }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
  });

  test('should show form error if expected output is empty on add test case', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /add test case/i }));
    await user.type(await screen.findByPlaceholderText(/e.g. Test 1/i), 'My Test');
    await user.click(screen.getByRole('button', { name: /^add$/i }));
    expect(await screen.findByText('Expected output is required')).toBeInTheDocument();
  });

  test('should call addTestCase with correct values', async () => {
    const user = userEvent.setup();
    mockAddTestCase.mockResolvedValue({});
    renderComponent();
    await user.click(screen.getByRole('button', { name: /add test case/i }));
    await user.type(await screen.findByPlaceholderText(/e.g. Test 1/i), 'My Test');
    await user.type(screen.getByPlaceholderText(/expected stdout/i), 'Hello World');
    await user.click(screen.getByRole('button', { name: /^add$/i }));
    await waitFor(() =>
      expect(mockAddTestCase).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Test', expectedOutput: 'Hello World' })
      )
    );
  });

  test('should call deleteTestCase when delete confirmed', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockDeleteTestCase.mockResolvedValue(undefined);
    renderComponent();
    await user.click(screen.getByRole('button', { name: /delete test case tc-1/i }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(mockDeleteTestCase).toHaveBeenCalledWith('tc-1'));
  });

  test('should render submissions tab with correct count', async () => {
    renderComponent();
    expect(screen.getByText(/Submissions \(1\)/i)).toBeInTheDocument();
  });

  test('should render student name and score in submissions', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByText(/Submissions \(1\)/i));
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(await screen.findByText(/100 \/ 100/i)).toBeInTheDocument();
  });

  test('should show empty state when no submissions', async () => {
    const user = userEvent.setup();
    setHookState({ submissions: [] });
    renderComponent();
    await user.click(screen.getByText(/Submissions \(0\)/i));
    expect(await screen.findByText('No submissions yet')).toBeInTheDocument();
  });
});
