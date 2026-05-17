import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import CodeEditor from '../CodeEditor';

jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ onChange }: { onChange?: (v: string) => void }) => (
    <textarea data-testid="monaco-editor" onChange={(e) => onChange?.(e.target.value)} />
  ),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const defaultProps = {
  fileId: 'file-123',
  fileName: 'main.py',
};

const renderComponent = (props = {}) =>
  render(
    <MantineProvider>
      <CodeEditor {...defaultProps} {...props} />
    </MantineProvider>
  );

describe('CodeEditor Component tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('authToken', 'test-token');

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          content: 'print("hello")',
          updatedAt: new Date().toISOString(),
          size: 14,
        },
      }),
    });
  });

  afterEach(() => localStorage.clear());

  test('should render the file name in the header', async () => {
    renderComponent();
    expect(await screen.findByText('main.py')).toBeInTheDocument();
  });

  test('should render Save button', async () => {
    renderComponent();
    expect(await screen.findByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  test('should have Save button disabled when no unsaved changes', async () => {
    renderComponent();
    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });
  });

  test('should show Unsaved text when changes made', async () => {
    renderComponent();
    const editor = await screen.findByTestId('monaco-editor');
    await userEvent.type(editor, 'new change');

    expect(await screen.findByText('Unsaved')).toBeInTheDocument();
  });

  test('should enable Save button when there are unsaved changes', async () => {
    renderComponent();
    await waitFor(() => screen.findByTestId('monaco-editor'));

    const editor = screen.getByTestId('monaco-editor');
    await userEvent.type(editor, 'some change');

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).not.toBeDisabled();
    });
  });

  test('should fetch file content on mount', async () => {
    renderComponent();
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/backend/files/file-123/content',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        })
      )
    );
  });

  test('should call save endpoint when Save button clicked', async () => {
    renderComponent();
    const editor = await screen.findByTestId('monaco-editor');
    await userEvent.type(editor, 'changed');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { updatedAt: new Date().toISOString() } }),
    });

    const saveButton = await screen.findByRole('button', { name: /save/i });
    await userEvent.click(saveButton);

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/backend/files/file-123/content',
        expect.objectContaining({ method: 'PUT' })
      )
    );
  });

  test('should call onContentChange when editor value changes', async () => {
    const onContentChange = jest.fn();
    renderComponent({ onContentChange });

    const editor = await screen.findByTestId('monaco-editor');
    await userEvent.type(editor, 'x');

    await waitFor(() => expect(onContentChange).toHaveBeenCalled());
  });
});
