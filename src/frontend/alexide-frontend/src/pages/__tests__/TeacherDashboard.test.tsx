import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import TeacherDashboard from '../TeacherDashboard';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));
jest.mock('../../hooks/useTeacherDashboard', () => ({
  useTeacherDashboard: jest.fn(),
}));
jest.mock('@mantine/charts', () => ({
  BarChart: () => <div data-testid="bar-chart" />,
}));

const { useAuth } = require('../../contexts/AuthContext');
const { useTeacherDashboard } = require('../../hooks/useTeacherDashboard');

const mockUser = { name: 'Bob Teacher', email: 'bob@test.com', role: 'TEACHER' };

const mockClasses = [
  { id: 'class-1', name: 'Python Fundamentals', joinCode: 'PY101', memberCount: 10 },
  { id: 'class-2', name: 'Java Basics', joinCode: 'JV202', memberCount: 5 },
];

const mockOverviews = [
  {
    classId: 'class-1',
    className: 'Python Fundamentals',
    averagePercentage: 88,
    totalGrades: 10,
    memberCount: 10,
  },
  {
    classId: 'class-2',
    className: 'Java Basics',
    averagePercentage: 72,
    totalGrades: 5,
    memberCount: 5,
  },
];

const baseHookState = {
  classes: mockClasses,
  overviews: mockOverviews,
  loading: false,
  error: null,
};

const setHookState = (overrides = {}) => {
  useTeacherDashboard.mockReturnValue({ ...baseHookState, ...overrides });
};

const renderComponent = () =>
  render(
    <BrowserRouter>
      <MantineProvider>
        <TeacherDashboard />
      </MantineProvider>
    </BrowserRouter>
  );

describe('TeacherDashboard Component tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ user: mockUser });
    useTeacherDashboard.mockReturnValue(baseHookState);
  });

  test('should render welcome message with first name', () => {
    renderComponent();
    expect(screen.getByText('Welcome back, Bob!')).toBeInTheDocument();
  });

  test('should show loader when loading', () => {
    setHookState({ loading: true });
    renderComponent();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  test('should show error alert when error occurs', () => {
    setHookState({ error: 'Failed to load dashboard' });
    renderComponent();
    expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument();
  });

  test('should display correct total students count', () => {
    renderComponent();
    expect(screen.getByTestId('total-students-count')).toHaveTextContent('15');
  });

  test('should display correct active classes count', () => {
    renderComponent();
    expect(screen.getByText('Active Classes')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  test('should display correct total grades count', () => {
    renderComponent();
    expect(screen.getByTestId('total-grades-count')).toHaveTextContent('15');
  });

  test('should display overall average score', () => {
    renderComponent();
    expect(screen.getByText('Avg. Class Score')).toBeInTheDocument();
    expect(screen.getByText('80.0%')).toBeInTheDocument();
  });

  test('should display — for avg score when no grade data', () => {
    setHookState({ overviews: [] });
    renderComponent();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  test('should render class names in My Classes section', () => {
    renderComponent();
    expect(screen.getByText('Python Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('Java Basics')).toBeInTheDocument();
  });

  test('should show empty state when no classes', () => {
    setHookState({ classes: [], overviews: [] });
    renderComponent();
    expect(screen.getByText('No classes yet. Create one to get started.')).toBeInTheDocument();
  });

  test('should render bar chart in class performance section', () => {
    renderComponent();
    expect(screen.getByText('Class Performance')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  test('should show no grade data message when overviews empty', () => {
    setHookState({ overviews: [] });
    renderComponent();
    expect(screen.getByText('No grade data yet')).toBeInTheDocument();
  });

  test('should show subtitle with class and student counts', () => {
    renderComponent();
    expect(screen.getByText(/2 active classes with 15 students/i)).toBeInTheDocument();
  });
});
