import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import TeacherClassesPage from '../TeacherClassesPage';

jest.mock('../../hooks/useTeacherClasses', () => ({
  useTeacherClasses: jest.fn(),
}));

const { useTeacherClasses } = require('../../hooks/useTeacherClasses');

const mockCreateClass = jest.fn();
const mockUpdateClass = jest.fn();
const mockDeleteClass = jest.fn();
const mockRegenerateCode = jest.fn();
const mockRemoveStudent = jest.fn();
const mockGetClassDetails = jest.fn();
const mockFetchClasses = jest.fn();

const mockClass = {
  id: 'class-1',
  name: 'Python Fundamentals',
  description: 'Intro to Python',
  joinCode: 'ABC12345',
  teacherId: 'teacher-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const baseHookState = {
  classes: [mockClass],
  loading: false,
  error: null,
  fetchClasses: mockFetchClasses,
  createClass: mockCreateClass,
  updateClass: mockUpdateClass,
  deleteClass: mockDeleteClass,
  regenerateCode: mockRegenerateCode,
  removeStudent: mockRemoveStudent,
  getClassDetails: mockGetClassDetails,
};

const setHookState = (overrides = {}) => {
  useTeacherClasses.mockReturnValue({ ...baseHookState, ...overrides });
};

const renderComponent = () =>
  render(
    <MantineProvider>
      <BrowserRouter>
        <TeacherClassesPage />
      </BrowserRouter>
    </MantineProvider>
  );

describe('TeacherClassesPage Component tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTeacherClasses.mockReturnValue(baseHookState);
  });

  test('should render class list', () => {
    renderComponent();
    expect(screen.getByText('Python Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('Intro to Python')).toBeInTheDocument();
    expect(screen.getByText('ABC12345')).toBeInTheDocument();
  });

  test('should show empty state when no classes', () => {
    setHookState({ classes: [] });
    renderComponent();
    expect(screen.getByText('No classes yet')).toBeInTheDocument();
  });

  test('should show error alert when error occurs', () => {
    setHookState({ error: 'Failed to load classes' });
    renderComponent();
    expect(screen.getByText('Failed to load classes')).toBeInTheDocument();
  });

  test('should open create popup when Create Class is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByText('Create Class'));
    expect(await screen.findByText('Create New Class')).toBeInTheDocument();
  });

  test('should show form error if class name is empty on create', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByText('Create Class'));
    await user.click(await screen.findByRole('button', { name: /^create$/i }));
    expect(await screen.findByText('Class name is required')).toBeInTheDocument();
  });

  test('should call createClass with correct values', async () => {
    const user = userEvent.setup();
    mockCreateClass.mockResolvedValue(mockClass);
    renderComponent();

    await user.click(screen.getByText('Create Class'));
    await user.type(await screen.findByPlaceholderText('e.g. Python Fundamentals'), 'New Class');
    await user.type(await screen.findByPlaceholderText('Optional description...'), 'A description');
    await user.click(await screen.findByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(mockCreateClass).toHaveBeenCalledWith('New Class', 'A description');
    });
  });

  test('should not call deleteClass if confirm is cancelled', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    renderComponent();
    expect(mockDeleteClass).not.toHaveBeenCalled();
  });

  test('should show members popup with student list', async () => {
    const user = userEvent.setup();
    mockGetClassDetails.mockResolvedValue({
      ...mockClass,
      members: [
        {
          id: 'enroll-1',
          studentId: 'student-1',
          classId: 'class-1',
          joinedAt: '2026-01-01T00:00:00.000Z',
          student: { id: 'student-1', name: 'Alice', email: 'alice@test.com' },
        },
      ],
    });
    renderComponent();

    await user.click(screen.getByRole('button', { name: 'View members' }));

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(await screen.findByText('alice@test.com')).toBeInTheDocument();
  });

  test('should show empty members message when class has no students', async () => {
    const user = userEvent.setup();
    mockGetClassDetails.mockResolvedValue({ ...mockClass, members: [] });
    renderComponent();

    await user.click(screen.getByRole('button', { name: 'View members' }));

    expect(await screen.findByText('No students enrolled yet')).toBeInTheDocument();
  });
});
