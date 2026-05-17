import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import TeacherClassPage from '../TeacherClassPage';

jest.mock('../../hooks/useTeacherClasses', () => ({
  useTeacherClasses: jest.fn(),
}));

jest.mock('../../hooks/useTeacherAssignments', () => ({
  useTeacherAssignments: jest.fn(),
}));

jest.mock('../../components/GradesTab', () => () => <div>GradesTab</div>);
jest.mock('../../components/AssignmentsTab', () => () => <div>AssignmentsTab</div>);

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ classId: 'class-1' }),
  useNavigate: () => jest.fn(),
}));

const { useTeacherClasses } = require('../../hooks/useTeacherClasses');
const { useTeacherAssignments } = require('../../hooks/useTeacherAssignments');

const mockUpdateClass = jest.fn();
const mockDeleteClass = jest.fn();
const mockRegenerateCode = jest.fn();
const mockRemoveStudent = jest.fn();
const mockGetClassDetails = jest.fn();

const mockMember = {
  id: 'enroll-1',
  studentId: 'student-1',
  classId: 'class-1',
  joinedAt: '2026-01-01T00:00:00.000Z',
  student: { id: 'student-1', name: 'Alice', email: 'alice@test.com' },
};

const mockClassData = {
  id: 'class-1',
  name: 'Python Fundamentals',
  description: 'Intro to Python',
  joinCode: 'ABC12345',
  teacherId: 'teacher-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  members: [mockMember],
};

const baseHookState = {
  classes: [],
  loading: false,
  error: null,
  getClassDetails: mockGetClassDetails,
  updateClass: mockUpdateClass,
  deleteClass: mockDeleteClass,
  regenerateCode: mockRegenerateCode,
  removeStudent: mockRemoveStudent,
};

const renderComponent = () =>
  render(
    <MantineProvider>
      <BrowserRouter>
        <TeacherClassPage />
      </BrowserRouter>
    </MantineProvider>
  );

describe('TeacherClassPage Component tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetClassDetails.mockResolvedValue(mockClassData);
    useTeacherClasses.mockReturnValue(baseHookState);
    useTeacherAssignments.mockReturnValue({ assignments: [] });
  });

  test('should render class name and description', async () => {
    renderComponent();
    expect(await screen.findByText('Python Fundamentals')).toBeInTheDocument();
    expect(await screen.findByText('Intro to Python')).toBeInTheDocument();
  });

  test('should render member list', async () => {
    renderComponent();
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(await screen.findByText('alice@test.com')).toBeInTheDocument();
  });

  test('should show empty state when no members', async () => {
    mockGetClassDetails.mockResolvedValue({ ...mockClassData, members: [] });
    renderComponent();
    expect(await screen.findByText('No students enrolled yet')).toBeInTheDocument();
  });

  test('should show error alert when fetch fails', async () => {
    mockGetClassDetails.mockRejectedValue(new Error('Failed to load class'));
    renderComponent();
    expect(await screen.findByText('Failed to load class')).toBeInTheDocument();
  });

  test('should open edit popup when Edit button clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(await screen.findByRole('button', { name: /edit/i }));
    expect(await screen.findByText('Edit Class')).toBeInTheDocument();
  });

  test('should pre-fill edit form with current class values', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(await screen.findByRole('button', { name: /edit/i }));
    const input = await screen.findByDisplayValue('Python Fundamentals');
    expect(input).toBeInTheDocument();
  });

  test('should call updateClass with correct values', async () => {
    const user = userEvent.setup();
    mockUpdateClass.mockResolvedValue(undefined);
    renderComponent();
    await user.click(await screen.findByRole('button', { name: /edit/i }));
    const input = await screen.findByDisplayValue('Python Fundamentals');
    await user.clear(input);
    await user.type(input, 'Advanced Python');
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() =>
      expect(mockUpdateClass).toHaveBeenCalledWith('class-1', 'Advanced Python', 'Intro to Python')
    );
  });

  test('should call deleteClass when delete is confirmed', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockDeleteClass.mockResolvedValue(undefined);
    renderComponent();
    await user.click(await screen.findByRole('button', { name: /delete class/i }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(mockDeleteClass).toHaveBeenCalledWith('class-1'));
  });

  test('should not call deleteClass if confirm is cancelled', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    renderComponent();
    await user.click(await screen.findByRole('button', { name: /delete class/i }));
    expect(mockDeleteClass).not.toHaveBeenCalled();
  });

  test('should call removeStudent when remove is confirmed', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockRemoveStudent.mockResolvedValue(undefined);
    mockGetClassDetails.mockResolvedValue(mockClassData);
    renderComponent();
    await user.click(await screen.findByRole('button', { name: /remove alice/i }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /^remove$/i }));
    await waitFor(() => expect(mockRemoveStudent).toHaveBeenCalledWith('class-1', 'student-1'));
  });

  test('should render join code in overview tab', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(await screen.findByText('Overview'));
    expect(await screen.findByText('ABC12345')).toBeInTheDocument();
  });

  test('should render GradesTab when grades tab is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(await screen.findByText('Grades'));
    expect(await screen.findByText('GradesTab')).toBeInTheDocument();
  });

  test('should render AssignmentsTab when assignments tab is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(await screen.findByText('Assignments'));
    expect(await screen.findByText('AssignmentsTab')).toBeInTheDocument();
  });
});
