import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import StudentAssignmentsTab from '../StudentAssignmentsTab';

jest.mock('../../hooks/useStudentAssignments', () => ({
  useStudentAssignments: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockNavigate = jest.fn();
const { useStudentAssignments } = require('../../hooks/useStudentAssignments');

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

const baseHookState = {
  assignments: [mockAssignment],
  loading: false,
  error: null,
};

const setHookState = (overrides = {}) => {
  useStudentAssignments.mockReturnValue({ ...baseHookState, ...overrides });
};

const renderComponent = () =>
  render(
    <MantineProvider>
      <BrowserRouter>
        <StudentAssignmentsTab classId="class-1" />
      </BrowserRouter>
    </MantineProvider>
  );

describe('StudentAssignmentsTab Component tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useStudentAssignments.mockReturnValue(baseHookState);
  });

  test('should render assignment title and language', () => {
    renderComponent();
    expect(screen.getByText('Hello World')).toBeInTheDocument();
    expect(screen.getByText('python')).toBeInTheDocument();
  });

  test('should render max score', () => {
    renderComponent();
    expect(screen.getByText(/Max score.*100/)).toBeInTheDocument();
  });

  test('should show loader when loading', () => {
    setHookState({ loading: true, assignment: [] });
    renderComponent();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  test('should show error alert when error occurs', () => {
    setHookState({ error: 'Failed to load assignments', assignments: [] });
    renderComponent();
    expect(screen.getByText('Failed to load assignments')).toBeInTheDocument();
  });

  test('should show empty state when no assignments', () => {
    setHookState({ assignments: [] });
    renderComponent();
    expect(screen.getByText('No assignments yet')).toBeInTheDocument();
  });

  test('should navigate to assignment page when card clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByText('Hello World'));
    expect(mockNavigate).toHaveBeenCalledWith('/student/assignments/asgn-1');
  });

  test('should show overdue badge when assignment is overdue', () => {
    const pastDate = new Date(Date.now() - 100000).toISOString();
    setHookState({
      assignments: [{ ...mockAssignment, dueDate: pastDate }],
    });
    renderComponent();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  test('should not show overdue badge when assignment is not overdue', () => {
    const futureDate = new Date(Date.now() + 9999999).toISOString();
    setHookState({
      assignments: [{ ...mockAssignment, dueDate: futureDate }],
    });
    renderComponent();
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
  });

  test('should render due date when assignment has one', () => {
    setHookState({
      assignments: [{ ...mockAssignment, dueDate: '2026-12-01T00:00:00.000Z' }],
    });
    renderComponent();
    expect(screen.getByText(/due/i)).toBeInTheDocument();
  });

  test('should render description when present', () => {
    renderComponent();
    expect(screen.getByText('Print hello world')).toBeInTheDocument();
  });
});
