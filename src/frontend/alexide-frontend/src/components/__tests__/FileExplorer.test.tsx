import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import FileExplorer from '../FileExplorer';

const mockFiles = [
  {
    id: '1',
    name: 'src',
    path: '/src',
    isDirectory: true,
    children: [{ id: '2', name: 'main.py', path: '/src/main.py', isDirectory: false }],
  },
  { id: '3', name: 'readme.txt', path: '/readme.txt', isDirectory: false },
];

const defaultProps = {
  files: mockFiles,
  selectedFileId: null,
  onFileSelect: jest.fn(),
  onFileCreate: jest.fn(),
  onFileDelete: jest.fn(),
  onFileRename: jest.fn(),
};

const renderComponent = (props = {}) =>
  render(
    <MantineProvider>
      <FileExplorer {...defaultProps} {...props} />
    </MantineProvider>
  );

describe('FileExplorer Component tests', () => {
  beforeEach(() => jest.clearAllMocks());

  test('should render FILES header', () => {
    renderComponent();
    expect(screen.getByText('FILES')).toBeInTheDocument();
  });

  test('should render empty state when no files provided', () => {
    renderComponent({ files: [] });
    expect(
      screen.getByText('No files yet. Create a new file or folder to get started.')
    ).toBeInTheDocument();
  });

  test('should render file and folder names', () => {
    renderComponent();
    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.getByText('readme.txt')).toBeInTheDocument();
  });

  test('should render nested children when folder is expanded', () => {
    renderComponent();
    expect(screen.getByText('main.py')).toBeInTheDocument();
  });

  test('should call onFileSelect when a file is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByText('readme.txt'));
    expect(defaultProps.onFileSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: '3', name: 'readme.txt' })
    );
  });

  test('should not call onFileSelect when a folder is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByText('src'));
    expect(defaultProps.onFileSelect).not.toHaveBeenCalled();
  });

  test('should open Create File popup when New File header button clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByTitle('New File'));
    await waitFor(() => {
      expect(screen.getByText('Create New File')).toBeInTheDocument();
    });
  });

  test('should open Create Folder modal when New Folder header button clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByTitle('New Folder'));
    await waitFor(() => {
      expect(screen.getByText('Create New Folder')).toBeInTheDocument();
    });
  });

  test('should call onFileCreate with correct args when popup submitted', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByTitle('New File'));
    await waitFor(() => screen.findByText('Create New File'));
    await user.type(screen.getByRole('textbox'), 'newfile.py');
    await user.click(screen.getByRole('button', { name: /create/i }));
    expect(defaultProps.onFileCreate).toHaveBeenCalledWith('newfile.py', null, false);
  });

  test('should call onFileDelete when delete confirmed', async () => {
    const user = userEvent.setup();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    renderComponent();

    const dotsButtons = screen.getAllByRole('button', { name: '' });
    await user.click(dotsButtons[dotsButtons.length - 1]);

    await waitFor(() => screen.findByText('Delete'));
    await user.click(screen.getByText('Delete'));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(defaultProps.onFileDelete).toHaveBeenCalledWith('3');
  });

  test('should open rename popup with current name pre-filled', async () => {
    const user = userEvent.setup();
    renderComponent();

    const dotsButtons = screen.getAllByRole('button', { name: '' });
    await user.click(dotsButtons[dotsButtons.length - 1]);

    await waitFor(() => screen.findByText('Rename'));
    await user.click(screen.getByText('Rename'));

    await waitFor(() => {
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('readme.txt');
    });
  });

  test('should call onFileRename with new name', async () => {
    const user = userEvent.setup();
    renderComponent();

    const dotsButtons = screen.getAllByRole('button', { name: '' });
    await user.click(dotsButtons[dotsButtons.length - 1]);

    await waitFor(() => screen.findByText('Rename'));
    await user.click(screen.getByText('Rename'));

    await waitFor(() => screen.findByRole('textbox'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'renamed.txt');
    await user.click(screen.getByRole('button', { name: /rename/i }));

    expect(defaultProps.onFileRename).toHaveBeenCalledWith('3', 'renamed.txt');
  });
});
