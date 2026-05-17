import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import IDEPage from '../IDEPage';

jest.mock('../../components/FileExplorer', () => ({
  __esModule: true,
  default: ({ files }: { files: unknown[] }) => (
    <div data-testid="file-explorer">FileExplorer ({files.length} files)</div>
  ),
}));

jest.mock('../../components/CodeEditor', () => ({
  __esModule: true,
  default: ({ fileName }: { fileName: string }) => <div data-testid="code-editor">{fileName}</div>,
}));

jest.mock('../../components/Terminal', () => ({
  __esModule: true,
  default: ({ isVisible }: { isVisible: boolean }) => (
    <div data-testid="terminal" data-visible={String(isVisible)} />
  ),
}));

jest.mock('../../hooks/useIDE', () => ({
  useIDE: jest.fn(),
}));

jest.mock('../../hooks/useCollaboration', () => ({
  useCollaboration: jest.fn(),
}));

jest.mock('../../hooks/useFileShare', () => ({
  useFileShare: jest.fn(),
}));

jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuth: () => ({
    user: { id: 'u1', email: 'test@test.com', role: 'STUDENT' },
    isAuthenticated: true,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const { useIDE } = require('../../hooks/useIDE');
const { useCollaboration } = require('../../hooks/useCollaboration');
const { useFileShare } = require('../../hooks/useFileShare');

const mockFetchFileTree = jest.fn();
const mockSetSelectedFile = jest.fn();
const mockSetTerminalVisible = jest.fn();
const mockToggleFullscreen = jest.fn();
const mockKickAll = jest.fn();
const mockRevokeShare = jest.fn();

const baseCollabState = {
  ydoc: null,
  awareness: null,
  collaborators: [],
  isConnected: false,
  collabError: null,
  isSynced: false,
  wasKicked: false,
  kickAll: mockKickAll,
};

const baseShareState = {
  shareData: null,
  createShare: jest.fn(),
  error: null,
  loading: false,
  revokeShare: mockRevokeShare,
};

const baseHookState: {
  fileTree: { id: string; name: string; path: string; isDirectory: boolean }[];
  selectedFile: { id: string; name: string; path: string; isDirectory: boolean } | null;
  setSelectedFile: jest.Mock;
  loading: boolean;
  error: string | null;
  isFullscreen: boolean;
  toggleFullscreen: jest.Mock;
  terminalVisible: boolean;
  setTerminalVisible: jest.Mock;
  terminalHeight: number;
  explorerWidth: number;
  fetchFileTree: jest.Mock;
  handleDragStart: jest.Mock;
  handleExplorerDragStart: jest.Mock;
  handleFileCreate: jest.Mock;
  handleFileDelete: jest.Mock;
  handleFileRename: jest.Mock;
  handleFileUpload: jest.Mock;
} = {
  fileTree: [],
  selectedFile: null,
  setSelectedFile: mockSetSelectedFile,
  loading: false,
  error: null,
  isFullscreen: false,
  toggleFullscreen: mockToggleFullscreen,
  terminalVisible: false,
  setTerminalVisible: mockSetTerminalVisible,
  terminalHeight: 280,
  explorerWidth: 280,
  fetchFileTree: mockFetchFileTree,
  handleDragStart: jest.fn(),
  handleExplorerDragStart: jest.fn(),
  handleFileCreate: jest.fn(),
  handleFileDelete: jest.fn(),
  handleFileRename: jest.fn(),
  handleFileUpload: jest.fn(),
};

const setHookState = (overrides: Partial<typeof baseHookState> = {}) => {
  useIDE.mockReturnValue({ ...baseHookState, ...overrides });
};

const renderComponent = () =>
  render(
    <MantineProvider>
      <BrowserRouter>
        <AuthProvider>
          <IDEPage />
        </AuthProvider>
      </BrowserRouter>
    </MantineProvider>
  );

describe('IDEPage Component tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useIDE.mockReturnValue(baseHookState);
    useCollaboration.mockReturnValue(baseCollabState);
    useFileShare.mockReturnValue(baseShareState);
    localStorage.setItem('authToken', 'test-token');
  });

  afterEach(() => localStorage.clear());

  test('should render loading state', () => {
    setHookState({ loading: true });
    renderComponent();
    expect(screen.getByText('Loading your files...')).toBeInTheDocument();
  });

  test('should not render file explorer while loading', () => {
    setHookState({ loading: true });
    renderComponent();
    expect(screen.queryByTestId('file-explorer')).not.toBeInTheDocument();
  });

  test('should render error message when error occurs', () => {
    setHookState({ error: 'Failed to load files: 500' });
    renderComponent();
    expect(screen.getByText('Error Loading Files')).toBeInTheDocument();
    expect(screen.getByText('Failed to load files: 500')).toBeInTheDocument();
  });

  test('should render Retry button on error', () => {
    setHookState({ error: 'Network error' });
    renderComponent();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  test('should show Go to Login button on authentication error', () => {
    setHookState({ error: 'Authentication failed. Your session may have expired.' });
    renderComponent();
    expect(screen.getByRole('button', { name: /go to login/i })).toBeInTheDocument();
  });

  test('should navigate to /auth when Go to Login is clicked', async () => {
    const user = userEvent.setup();
    setHookState({ error: 'Authentication failed. Your session may have expired.' });
    renderComponent();
    await user.click(screen.getByRole('button', { name: /go to login/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/auth');
  });

  test('should render file explorer when loaded', () => {
    renderComponent();
    expect(screen.getByTestId('file-explorer')).toBeInTheDocument();
  });

  test('should not render CodeEditor when a directory is selected', () => {
    setHookState({
      selectedFile: { id: '1', name: 'src', path: '/src', isDirectory: true },
    });
    renderComponent();
    expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument();
  });

  test('should show "Create a new file" when file tree is empty and no file selected', () => {
    setHookState({ fileTree: [], selectedFile: null });
    renderComponent();
    expect(screen.getByText('Create a new file to get started')).toBeInTheDocument();
  });

  test('should show "Select a file" message when no file selected', () => {
    setHookState({
      fileTree: [{ id: '1', name: 'main.py', path: '/main.py', isDirectory: false }],
      selectedFile: null,
    });
    renderComponent();
    expect(screen.getByText('No file selected')).toBeInTheDocument();
    expect(
      screen.getByText('Select a file from the explorer to start editing')
    ).toBeInTheDocument();
  });

  test('should render CodeEditor when a file is selected', () => {
    setHookState({
      selectedFile: { id: '1', name: 'main.py', path: '/main.py', isDirectory: false },
    });
    renderComponent();
    expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    expect(screen.getByText('main.py')).toBeInTheDocument();
  });

  test('should render terminal toggle button', () => {
    renderComponent();
    expect(screen.getByRole('button', { name: /terminal/i })).toBeInTheDocument();
  });

  describe('Collaboration features', () => {
    const twoCollaborators = [
      { userId: 'u1', name: 'alice@test.com', colour: '#F87171' },
      { userId: 'u2', name: 'bob@test.com', colour: '#34D399' },
    ];

    test('should not show live bar when not connected', () => {
      useCollaboration.mockReturnValue({
        ...baseCollabState,
        isConnected: false,
        collaborators: twoCollaborators,
      });
      renderComponent();
      expect(screen.queryByText('Live:')).not.toBeInTheDocument();
    });

    test('should not show live bar when only one collaborator', () => {
      useCollaboration.mockReturnValue({
        ...baseCollabState,
        isConnected: true,
        collaborators: [twoCollaborators[0]],
      });
      renderComponent();
      expect(screen.queryByText('Live:')).not.toBeInTheDocument();
    });

    test('should show live bar when connected with multiple collaborators', () => {
      useCollaboration.mockReturnValue({
        ...baseCollabState,
        isConnected: true,
        collaborators: twoCollaborators,
      });
      renderComponent();
      expect(screen.getByText('Live:')).toBeInTheDocument();
    });

    test('should render avatar initials for each collaborator', () => {
      useCollaboration.mockReturnValue({
        ...baseCollabState,
        isConnected: true,
        collaborators: twoCollaborators,
      });
      renderComponent();
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    test('should show collaboration error alert when collabError is set', () => {
      useCollaboration.mockReturnValue({
        ...baseCollabState,
        collabError: 'Access denied: you do not have permission to access this file',
      });
      renderComponent();
      expect(screen.getByText('Collaboration error')).toBeInTheDocument();
      expect(
        screen.getByText('Access denied: you do not have permission to access this file')
      ).toBeInTheDocument();
    });

    test('should show Stop Session button when a live session is started', () => {
      useCollaboration.mockReturnValue({
        ...baseCollabState,
        isConnected: true,
        collaborators: twoCollaborators,
      });
      useFileShare.mockReturnValue({
        ...baseShareState,
        shareData: { fileId: 'file-123', shareCode: 'abc123' },
      });
      renderComponent();
      expect(screen.getByText('Stop Session')).toBeInTheDocument();
    });

    test('should call kickAll and revokeShare when Stop Session is clicked', async () => {
      const user = userEvent.setup();
      mockKickAll.mockResolvedValue(undefined);
      mockRevokeShare.mockResolvedValue(undefined);

      useCollaboration.mockReturnValue({
        ...baseCollabState,
        isConnected: true,
        collaborators: twoCollaborators,
      });
      useFileShare.mockReturnValue({
        ...baseShareState,
        shareData: { fileId: 'file-123', shareCode: 'abc123' },
      });
      renderComponent();

      await user.click(screen.getByText('Stop Session'));
      expect(mockKickAll).toHaveBeenCalledWith('file-123');
      expect(mockRevokeShare).toHaveBeenCalledWith('file-123');
    });

    test('should show shared file collaboration banner', () => {
      jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue({
        pathname: '/ide',
        state: { sharedFileId: 'shared-file-99' },
        search: '',
        hash: '',
      });
      renderComponent();

      expect(
        screen.getByText('Live collaboration session — you are editing a shared file')
      ).toBeInTheDocument();

      expect(screen.queryByText('Share')).not.toBeInTheDocument();
      expect(screen.getByText('Leave Session')).toBeInTheDocument();
    });
  });
});
