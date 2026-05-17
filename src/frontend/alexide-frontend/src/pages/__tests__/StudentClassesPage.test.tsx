import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import StudentClassesPage from '../StudentClassesPage';

jest.mock('../../hooks/useStudentClasses', () => ({
  useStudentClasses: jest.fn(),
}));

const { useStudentClasses } = require('../../hooks/useStudentClasses');

const mockJoinClass = jest.fn();
const mockLeaveClass = jest.fn();
const mockFetchClasses = jest.fn();

const mockEnrollment = {
  id: 'enroll-1',
  classId: 'class-1',
  studentId: 'student-1',
  joinedAt: '2026-01-01T00:00:00.000Z',
  class: {
    id: 'class-1',
    name: 'Python Fundamentals',
    description: 'Intro to Python',
    teacherId: 'teacher-1',
    joinCode: 'ABC12345',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

const baseHookState = {
  classes: [mockEnrollment],
  loading: false,
  error: null,
  fetchClasses: mockFetchClasses,
  joinClass: mockJoinClass,
  leaveClass: mockLeaveClass,
};

const setHookState = (overrides = {}) => {
  useStudentClasses.mockReturnValue({ ...baseHookState, ...overrides });
};

const renderComponent = () =>
  render(
    <MantineProvider>
      <BrowserRouter>
        <StudentClassesPage />
      </BrowserRouter>
    </MantineProvider>
  );

describe('StudentClassesPage Component tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useStudentClasses.mockReturnValue(baseHookState);
  });

  test('should render enrolled class', () => {
    renderComponent();
    expect(screen.getByText('Python Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('Intro to Python')).toBeInTheDocument();
  });

  test('should show empty state when not enrolled in any class', () => {
    setHookState({ classes: [] });
    renderComponent();
    expect(screen.getByText('Not enrolled in any classes')).toBeInTheDocument();
  });

  test('should show error when fetch fails', () => {
    setHookState({ error: 'Network error' });
    renderComponent();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  test('should open join popup when Join Class is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByText('Join Class'));
    expect(await screen.findByText('Join a Class')).toBeInTheDocument();
  });

  test('should show error if join code is empty', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByText('Join Class'));
    await user.click(await screen.findByRole('button', { name: /^join$/i }));

    expect(await screen.findByText('Please enter a join code')).toBeInTheDocument();
  });

  test('should call joinClass with uppercased code', async () => {
    const user = userEvent.setup();
    mockJoinClass.mockResolvedValue(mockEnrollment);
    renderComponent();

    await user.click(screen.getByText('Join Class'));
    await user.type(await screen.findByPlaceholderText('e.g. DRUMN-C8'), 'abc123');
    await user.click(screen.getByRole('button', { name: /^join$/i }));

    await waitFor(() => {
      expect(mockJoinClass).toHaveBeenCalledWith('ABC123');
    });
  });

  test('should show form error if joinClass throws', async () => {
    const user = userEvent.setup();
    mockJoinClass.mockRejectedValue(new Error('Invalid join code'));
    renderComponent();

    await user.click(screen.getByText('Join Class'));
    await user.type(await screen.findByPlaceholderText('e.g. DRUMN-C8'), 'BADCODE');
    await user.click(screen.getByRole('button', { name: /^join$/i }));

    expect(await screen.findByText('Invalid join code')).toBeInTheDocument();
  });

  test('should call leaveClass with class id after confirmation', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockLeaveClass.mockResolvedValue(undefined);
    renderComponent();

    await user.click(screen.getByText('Leave'));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^leave$/i }));

    await waitFor(() => {
      expect(mockLeaveClass).toHaveBeenCalledWith('class-1');
    });
  });

  test('should not call leaveClass if confirm is cancelled', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    renderComponent();

    await user.click(screen.getByText('Leave'));
    expect(mockLeaveClass).not.toHaveBeenCalled();
  });

  test('should close join popup on cancel', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByText('Join Class'));
    expect(await screen.findByText('Join a Class')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText('Join a Class')).not.toBeInTheDocument();
    });
  });
});
