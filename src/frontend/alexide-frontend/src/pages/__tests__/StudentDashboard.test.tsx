import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import StudentDashboard from '../StudentDashboard';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));
jest.mock('../../hooks/useStudentDashboard', () => ({
  useStudentDashboard: jest.fn(),
}));
jest.mock('../../hooks/useStudentAllAssignments', () => ({
  useStudentAllAssignments: jest.fn(),
}));
jest.mock('@mantine/charts', () => ({
  LineChart: () => <div data-testid="line-chart" />,
}));

const { useAuth } = require('../../contexts/AuthContext');
const { useStudentDashboard } = require('../../hooks/useStudentDashboard');
const { useStudentAllAssignments } = require('../../hooks/useStudentAllAssignments');

const mockUser = { name: 'Alice Smith', email: 'alice@test.com', role: 'STUDENT' };

const mockEnrolled = [
  {
    class: {
      id: 'class-1',
      name: 'Python Fundamentals',
      joinCode: 'PY101',
      description: 'Intro to Python',
    },
  },
];

const mockClassSummaries = [
  { classId: 'class-1', className: 'Python Fundamentals', averagePercentage: 85, totalGrades: 3 },
];

const mockAssignments = [
  {
    id: 'asgn-1',
    title: 'Hello World',
    language: 'python',
    maxScore: 100,
    dueDate: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    id: 'asgn-2',
    title: 'Overdue Task',
    language: 'python',
    maxScore: 50,
    dueDate: new Date(Date.now() - 86400000).toISOString(),
  },
];

const baseHookState = {
  classes: mockEnrolled,
  classSummaries: mockClassSummaries,
  loading: false,
  error: null,
};

const setHookState = (overrides = {}) => {
  useStudentDashboard.mockReturnValue({ ...baseHookState, ...overrides });
};

const renderComponent = () =>
  render(
    <BrowserRouter>
      <MantineProvider>
        <StudentDashboard />
      </MantineProvider>
    </BrowserRouter>
  );

describe('StudentDashboard Component tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ user: mockUser });
    useStudentDashboard.mockReturnValue(baseHookState);
    useStudentAllAssignments.mockReturnValue({ assignments: mockAssignments });
  });

  test('should render welcome message with first name', () => {
    renderComponent();
    expect(screen.getByText('Welcome back, Alice!')).toBeInTheDocument();
  });

  test('should show loader when loading', () => {
    setHookState({ loading: true });
    useStudentAllAssignments.mockReturnValue({ assignments: [] });
    renderComponent();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  test('should show error alert when error occurs', () => {
    setHookState({ error: 'Failed to load dashboard' });
    useStudentAllAssignments.mockReturnValue({ assignments: [] });
    renderComponent();
    expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument();
  });

  test('should display correct active assignments count', () => {
    renderComponent();
    expect(screen.getByTestId('active-assignments-count')).toHaveTextContent('1');
  });

  test('should display correct active classes count', () => {
    renderComponent();
    expect(screen.getByText('Active Classes')).toBeInTheDocument();
  });

  test('should display average grade when grades exist', () => {
    renderComponent();
    expect(screen.getByText('85.0%')).toBeInTheDocument();
  });

  test('should display — for average grade when no summaries', () => {
    setHookState({ classSummaries: [] });
    renderComponent();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  test('should render enrolled class names', () => {
    renderComponent();
    const matches = screen.getAllByText('Python Fundamentals');
    expect(matches.length).toBeGreaterThan(0);
  });

  test('should show empty state when not enrolled in any classes', () => {
    setHookState({ classes: [] });
    renderComponent();
    expect(screen.getByText('You are not enrolled in any classes yet.')).toBeInTheDocument();
  });

  test('should render pending assignments section', () => {
    renderComponent();
    expect(screen.getAllByText('Pending Assignments').length).toBeGreaterThan(0);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  test('should show empty state when no pending assignments', () => {
    useStudentAllAssignments.mockReturnValue({ assignments: [] });
    renderComponent();
    expect(screen.getByText('All caught up! No pending assignments.')).toBeInTheDocument();
  });

  test('should render grades by class section with chart', () => {
    renderComponent();
    expect(screen.getByText('Grades by Class')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  test('should show no grades message when classSummaries is empty', () => {
    setHookState({ classSummaries: [] });
    renderComponent();
    expect(screen.getByText('No grades released yet')).toBeInTheDocument();
  });

  test('should render grade badge for each class summary', () => {
    renderComponent();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  test('should show pending subtitle when assignments exist', () => {
    renderComponent();
    expect(screen.getByText(/1 pending assignment/i)).toBeInTheDocument();
  });

  test('should show pending subtitle when no overdue assignments', () => {
    useStudentAllAssignments.mockReturnValue({
      assignments: [mockAssignments[0]],
    });
    renderComponent();
    expect(screen.getByText(/1 pending assignment/i)).toBeInTheDocument();
  });
});
