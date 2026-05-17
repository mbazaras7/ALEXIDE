import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import StudentClassPage from '../StudentClassPage';

jest.mock('../../hooks/useStudentClass', () => ({
  useStudentClass: jest.fn(),
}));

jest.mock('../../hooks/useStudentClasses', () => ({
  useStudentClasses: jest.fn(),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../components/StudentGradesTab', () => () => <div>StudentGradesTab</div>);
jest.mock('../../components/StudentAssignmentsTab', () => () => <div>StudentAssignmentsTab</div>);

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ classId: 'class-1' }),
  useNavigate: () => mockNavigate,
}));

const mockNavigate = jest.fn();
const mockLeaveClass = jest.fn();

const { useStudentClass } = require('../../hooks/useStudentClass');
const { useStudentClasses } = require('../../hooks/useStudentClasses');
const { useAuth } = require('../../contexts/AuthContext');

const mockMember = {
  studentId: 'student-1',
  student: { id: 'student-1', name: 'Alice', email: 'alice@test.com' },
};

const mockClassData = {
  id: 'class-1',
  name: 'Python Fundamentals',
  description: 'Intro to Python',
  joinCode: 'ABC12345',
  createdAt: '2026-01-01T00:00:00.000Z',
  members: [mockMember],
};

const setHookState = (overrides = {}) => {
  useStudentClass.mockReturnValue({
    classData: mockClassData,
    loading: false,
    error: null,
    ...overrides,
  });
};

const renderComponent = () =>
  render(
    <MantineProvider>
      <BrowserRouter>
        <StudentClassPage />
      </BrowserRouter>
    </MantineProvider>
  );

describe('StudentClassPage Component tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useStudentClass.mockReturnValue({ classData: mockClassData, loading: false, error: null });
    useStudentClasses.mockReturnValue({ leaveClass: mockLeaveClass });
    useAuth.mockReturnValue({ user: { id: 'student-1' } });
  });

  test('should render class name', async () => {
    renderComponent();
    expect(await screen.findByTestId('class-name')).toHaveTextContent('Python Fundamentals');
  });

  test('should render class description', async () => {
    renderComponent();
    expect(await screen.findByTestId('class-description')).toHaveTextContent('Intro to Python');
  });

  test('should show loader when loading', () => {
    setHookState({ loading: true, assignment: null });
    renderComponent();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  test('should show error alert when error occurs', () => {
    setHookState({ error: 'Failed to load class', classData: null });
    renderComponent();
    expect(screen.getByText('Failed to load class')).toBeInTheDocument();
  });

  test('should render member list in overview tab', async () => {
    renderComponent();
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(await screen.findByText('alice@test.com')).toBeInTheDocument();
  });

  test('should show You badge for current user', async () => {
    renderComponent();
    expect(await screen.findByText('You')).toBeInTheDocument();
  });

  test('should show empty state when no other members', async () => {
    setHookState({ classData: { ...mockClassData, members: [] } });
    renderComponent();
    expect(await screen.findByText('No other students enrolled yet')).toBeInTheDocument();
  });

  test('should render class info in info tab', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(await screen.findByRole('tab', { name: /info/i }));
    expect(await screen.findByText('Class Details')).toBeInTheDocument();
    expect(await screen.findByTestId('info-name')).toHaveTextContent('Python Fundamentals');
  });

  test('should render StudentGradesTab in grades tab', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(await screen.findByRole('tab', { name: /grades/i }));
    expect(await screen.findByText('StudentGradesTab')).toBeInTheDocument();
  });

  test('should render StudentAssignmentsTab in assignments tab', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(await screen.findByRole('tab', { name: /assignments/i }));
    expect(await screen.findByText('StudentAssignmentsTab')).toBeInTheDocument();
  });

  test('should call leaveClass when Leave Class confirmed', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockLeaveClass.mockResolvedValue(undefined);
    renderComponent();
    await user.click(await screen.findByRole('button', { name: /leave class/i }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /^leave$/i }));
    await waitFor(() => expect(mockLeaveClass).toHaveBeenCalledWith('class-1'));
  });

  test('should not call leaveClass when Leave Class cancelled', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    renderComponent();
    await user.click(await screen.findByRole('button', { name: /leave class/i }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockLeaveClass).not.toHaveBeenCalled();
  });

  test('should navigate back to classes when Back button clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(await screen.findByRole('button', { name: /back to classes/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/student/classes');
  });
});
