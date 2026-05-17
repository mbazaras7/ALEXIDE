import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import AssignmentsTab from '../AssignmentsTab';

jest.mock('../../hooks/useTeacherAssignments', () => ({
  useTeacherAssignments: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockNavigate = jest.fn();
const mockCreateAssignment = jest.fn();
const mockUpdateAssignment = jest.fn();
const mockDeleteAssignment = jest.fn();

const { useTeacherAssignments } = require('../../hooks/useTeacherAssignments');

const mockAssignment = {
  id: 'asgn-1',
  classId: 'class-1',
  title: 'Hello World',
  description: 'Print hello world',
  language: 'python',
  maxScore: 100,
  dueDate: null,
  status: 'DRAFT',
};

const baseHookState = {
  assignments: [mockAssignment],
  loading: false,
  error: null,
  createAssignment: mockCreateAssignment,
  updateAssignment: mockUpdateAssignment,
  deleteAssignment: mockDeleteAssignment,
};

const setHookState = (overrides = {}) => {
  useTeacherAssignments.mockReturnValue({ ...baseHookState, ...overrides });
};

const defaultProps = {
  classId: 'class-1',
  members: [],
};

const renderComponent = (props = {}) =>
  render(
    <MantineProvider>
      <BrowserRouter>
        <AssignmentsTab {...defaultProps} {...props} />
      </BrowserRouter>
    </MantineProvider>
  );

describe('AssignmentsTab Component tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTeacherAssignments.mockReturnValue(baseHookState);
  });

  test('should render assignment title and language', () => {
    renderComponent();
    expect(screen.getByText('Hello World')).toBeInTheDocument();
    expect(screen.getByText('python')).toBeInTheDocument();
  });

  test('should render assignment status badge', () => {
    renderComponent();
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
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
    expect(mockNavigate).toHaveBeenCalledWith('/teacher/assignments/asgn-1');
  });

  test('should open create modal when New Assignment clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /new assignment/i }));
    const modal = await screen.findByRole('dialog');
    expect(modal).toBeInTheDocument();
  });

  test('should show form error if title is empty on create', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /new assignment/i }));
    await user.click(await screen.findByRole('button', { name: /^create$/i }));
    expect(await screen.findByText('Title is required')).toBeInTheDocument();
  });

  test('should call createAssignment with correct values', async () => {
    const user = userEvent.setup();
    mockCreateAssignment.mockResolvedValue({});
    renderComponent();
    await user.click(screen.getByRole('button', { name: /new assignment/i }));
    await user.type(await screen.findByPlaceholderText(/e.g. Week 1/i), 'New Assignment');
    await user.click(screen.getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(mockCreateAssignment).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Assignment' })
      )
    );
  });

  test('should open edit modal with pre-filled values', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /edit assignment asgn-1/i }));
    expect(await screen.findByDisplayValue('Hello World')).toBeInTheDocument();
  });

  test('should show form error if title is empty on edit', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /edit assignment asgn-1/i }));
    const input = await screen.findByDisplayValue('Hello World');
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByText('Title is required')).toBeInTheDocument();
  });

  test('should call updateAssignment with correct values', async () => {
    const user = userEvent.setup();
    mockUpdateAssignment.mockResolvedValue({});
    renderComponent();
    await user.click(screen.getByRole('button', { name: /edit assignment/i }));
    const input = await screen.findByDisplayValue('Hello World');
    await user.clear(input);
    await user.type(input, 'Updated Title');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() =>
      expect(mockUpdateAssignment).toHaveBeenCalledWith(
        'asgn-1',
        expect.objectContaining({ title: 'Updated Title' })
      )
    );
  });

  test('should call deleteAssignment when delete confirmed', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockDeleteAssignment.mockResolvedValue(undefined);
    renderComponent();
    await user.click(screen.getByRole('button', { name: /delete assignment asgn-1/i }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(mockDeleteAssignment).toHaveBeenCalledWith('asgn-1'));
  });

  test('should not call deleteAssignment when delete cancelled', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    renderComponent();
    await user.click(screen.getByRole('button', { name: /delete assignment asgn-1/i }));
    expect(mockDeleteAssignment).not.toHaveBeenCalled();
  });

  test('should render due date when assignment has one', () => {
    setHookState({
      assignments: [{ ...mockAssignment, dueDate: '2026-12-01T00:00:00.000Z' }],
    });
    renderComponent();
    expect(screen.getByText(/due/i)).toBeInTheDocument();
  });
});
