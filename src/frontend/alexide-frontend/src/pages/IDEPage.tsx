import React, { useEffect, useRef, useState } from 'react';
import {
  Container,
  Text,
  Box,
  Alert,
  Button,
  Loader,
  Center,
  Tooltip,
  UnstyledButton,
  Group,
  Badge,
  Avatar,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconRefresh,
  IconTerminal2,
  IconChevronDown,
  IconChevronUp,
  IconCode,
  IconShare,
  IconDoorExit,
  IconUsers,
} from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import FileExplorer from '../components/FileExplorer';
import CodeEditor from '../components/CodeEditor';
import Terminal, { TerminalHandle } from '../components/Terminal';
import ShareModal from '../components/ShareModal';
import { useIDE } from '../hooks/useIDE';
import { useAuth } from '../contexts/AuthContext';
import { useCollaboration } from '../hooks/useCollaboration';
import { useDisclosure } from '@mantine/hooks';
import { useFileShare } from '../hooks/useFileShare';
import classes from './IDEPage.module.css';

export default function IDEPage() {
  const terminalRef = useRef<TerminalHandle>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [shareModalOpened, { open: openShareModal, close: closeShareModal }] = useDisclosure(false);
  const {
    shareData,
    createShare,
    error: shareError,
    loading: shareLoading,
    revokeShare,
  } = useFileShare();
  const locationState = location.state as {
    assignmentId?: string;
    assignmentTitle?: string;
    classId?: string;
    sharedFileId?: string;
  } | null;

  const [sharedFileId] = useState<string | null>(() => locationState?.sharedFileId ?? null);
  const collaborationFileId = sharedFileId ?? shareData?.fileId ?? null;
  const isSharedFile = !!sharedFileId;

  const [assignmentContext] = useState<{
    assignmentId?: string;
    assignmentTitle?: string;
    classId?: string;
  } | null>(() =>
    locationState?.assignmentId
      ? {
          assignmentId: locationState.assignmentId,
          assignmentTitle: locationState.assignmentTitle,
          classId: locationState.classId,
        }
      : null
  );

  useEffect(() => {
    navigate(location.pathname, { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const {
    fileTree,
    selectedFile,
    setSelectedFile,
    loading,
    error,
    isFullscreen,
    toggleFullscreen,
    terminalVisible,
    setTerminalVisible,
    terminalHeight,
    fetchFileTree,
    handleDragStart,
    handleFileCreate,
    handleFileDelete,
    handleFileRename,
    handleFileUpload,
    handleFileMove,
    explorerWidth,
    handleExplorerDragStart,
  } = useIDE();

  const handleRunFile = (fileId: string, filePath: string) => {
    if (!terminalVisible) setTerminalVisible(true);
    terminalRef.current?.runFile(fileId, filePath);
  };

  const handleSubmitAssignment = async () => {
    if (!selectedFile || !assignmentContext?.assignmentId) return;
    try {
      setSubmitting(true);
      setSubmitResult(null);

      const token = localStorage.getItem('authToken');
      const fileRes = await fetch(`/api/backend/files/${selectedFile.id}/content`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const fileData = await fileRes.json();
      const code = fileData.data?.content ?? fileData.content ?? '';

      const res = await fetch(
        `/api/backend/student/submit/assignments/${assignmentContext.assignmentId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ code }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setSubmitResult({ success: true, message: 'Submitted successfully!' });
      } else {
        setSubmitResult({ success: false, message: data.error || 'Submission failed' });
      }
    } catch {
      setSubmitResult({ success: false, message: 'Network error during submission' });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!sharedFileId || loading) return;

    const fetchSharedFileInfo = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/backend/files/${sharedFileId}/content`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setSelectedFile({
            id: sharedFileId,
            name: data.data.name,
            path: '/',
            isDirectory: false,
          });
        } else {
          setSelectedFile({ id: sharedFileId, name: 'shared.py', path: '/', isDirectory: false });
        }
      } catch {
        setSelectedFile({ id: sharedFileId, name: 'shared.py', path: '/', isDirectory: false });
      }
    };

    fetchSharedFileInfo();
  }, [sharedFileId, loading, setSelectedFile]);

  const { ydoc, awareness, collaborators, isConnected, collabError, isSynced, wasKicked, kickAll } =
    useCollaboration({
      fileId: collaborationFileId,
      userId: user?.id ?? '',
      userName: user?.email ?? 'Unknown',
      enabled: !!collaborationFileId,
    });

  useEffect(() => {
    if (!wasKicked) return;
    window.location.replace(user?.role === 'TEACHER' ? '/teacher/dashboard' : '/student/dashboard');
  }, [wasKicked, user?.role]);

  if (loading) {
    return (
      <Container fluid className={classes.container}>
        <Center style={{ height: '100%' }}>
          <Box style={{ textAlign: 'center' }}>
            <Loader size="lg" mb="md" />
            <Text c="dimmed">Loading your files...</Text>
          </Box>
        </Center>
      </Container>
    );
  }

  if (error) {
    return (
      <Container fluid className={classes.container}>
        <Box p="xl">
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error Loading Files"
            color="red"
            mb="md"
          >
            {error}
          </Alert>
          <Box>
            <Button leftSection={<IconRefresh size={16} />} onClick={fetchFileTree} mr="sm">
              Retry
            </Button>
            {error.includes('Authentication') && (
              <Button variant="light" onClick={() => navigate('/auth')}>
                Go to Login
              </Button>
            )}
          </Box>
        </Box>
      </Container>
    );
  }

  return (
    <Container fluid className={`${classes.container} ${isFullscreen ? classes.fullscreen : ''}`}>
      <div className={classes.statusBar} data-testid="status-bar">
        <Tooltip label={terminalVisible ? 'Hide Terminal (Ctrl+`)' : 'Show Terminal (Ctrl+`)'}>
          <UnstyledButton
            data-testid="terminal-toggle"
            className={`${classes.statusBarButton} ${terminalVisible ? classes.statusBarButtonActive : ''}`}
            onClick={() => setTerminalVisible((prev) => !prev)}
          >
            <IconTerminal2 size={14} />
            <span>Terminal</span>
            {terminalVisible ? <IconChevronDown size={12} /> : <IconChevronUp size={12} />}
          </UnstyledButton>
        </Tooltip>

        {selectedFile && !selectedFile.isDirectory && !sharedFileId && (
          <Tooltip label="Share file for pair programming">
            <UnstyledButton
              data-testid="share-button"
              className={classes.statusBarButton}
              onClick={openShareModal}
            >
              <IconShare size={14} />
              <span>Share</span>
            </UnstyledButton>
          </Tooltip>
        )}

        {sharedFileId && (
          <Tooltip label="Leave collaboration session">
            <UnstyledButton
              data-testid="leave-session-button"
              className={classes.statusBarButton}
              onClick={() => {
                setSelectedFile(null);
                navigate(user?.role === 'TEACHER' ? '/teacher/dashboard' : '/student/dashboard', {
                  replace: true,
                });
              }}
            >
              <IconDoorExit size={14} />
              <span>Leave Session</span>
            </UnstyledButton>
          </Tooltip>
        )}

        {!sharedFileId && shareData?.fileId && collaborators.length > 0 && (
          <Tooltip label="Save file and kick all collaborators">
            <UnstyledButton
              data-testid="stop-session-button"
              className={classes.statusBarButton}
              onClick={async () => {
                await kickAll(shareData.fileId);
                await revokeShare(shareData.fileId);
              }}
            >
              <IconDoorExit size={14} color="#F87171" />
              <span style={{ color: '#F87171' }}>Stop Session</span>
            </UnstyledButton>
          </Tooltip>
        )}
      </div>

      {(isSharedFile || collaborators.length > 0) && (
        <div style={{ background: '#3b1f6e', padding: '4px 16px' }}>
          <Text size="xs" c="violet.3">
            {isSharedFile
              ? 'Live collaboration session — you are editing a shared file'
              : `Live collaboration session — ${collaborators.length - 1} users are editing your file`}
          </Text>
        </div>
      )}
      <div
        className={classes.mainLayout}
        data-testid="ide-loaded"
        style={{
          gridTemplateColumns: sharedFileId ? '1fr' : `${explorerWidth}px 2px 1fr`,
        }}
      >
        {!sharedFileId && (
          <>
            <div className={classes.fileExplorerPanel}>
              <FileExplorer
                files={fileTree}
                selectedFileId={selectedFile?.id || null}
                onFileSelect={setSelectedFile}
                onFileCreate={handleFileCreate}
                onFileDelete={handleFileDelete}
                onFileRename={handleFileRename}
                onFileUpload={handleFileUpload}
                onFileMove={handleFileMove}
              />
            </div>
            <div className={classes.explorerResizeHandle} onMouseDown={handleExplorerDragStart} />
          </>
        )}

        <div className={classes.editorPanel}>
          <div className={classes.editorArea}>
            <div
              data-testid="collab-ready"
              data-connected={isConnected ? 'true' : 'false'}
              style={{ display: 'none' }}
            />
            {isConnected && collaborators.length > 1 && (
              <Group gap="xs" px="sm" py={4} className={classes.collabBar}>
                <IconUsers size={14} color="#9d7eff" />
                <Text size="xs" c="dimmed">
                  Live:
                </Text>
                <Avatar.Group spacing="xs">
                  {collaborators.map((c) => (
                    <Tooltip key={c.userId} label={c.name} withArrow>
                      <Avatar
                        size="sm"
                        radius="xl"
                        className={classes.collabAvatar}
                        style={{ backgroundColor: c.colour }}
                      >
                        {c.name.charAt(0).toUpperCase()}
                      </Avatar>
                    </Tooltip>
                  ))}
                </Avatar.Group>
              </Group>
            )}

            {collabError && (
              <Alert color="orange" title="Collaboration error" py={4} px="sm" radius={0}>
                {collabError}
              </Alert>
            )}

            {selectedFile && !selectedFile.isDirectory ? (
              <CodeEditor
                key={selectedFile.id}
                fileId={selectedFile.id}
                fileName={selectedFile.name}
                filePath={selectedFile.path}
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleFullscreen}
                onRunFile={handleRunFile}
                onFileSaved={(fileId) => terminalRef.current?.syncFile(fileId)}
                isSharedFile={isSharedFile && selectedFile.id === collaborationFileId}
                ydoc={selectedFile.id === collaborationFileId ? ydoc : null}
                awareness={selectedFile.id === collaborationFileId ? awareness : null}
                isSynced={selectedFile.id === collaborationFileId ? isSynced : false}
              />
            ) : (
              <div className={classes.emptyState}>
                <div className={classes.emptyStateContent}>
                  <Text size="lg" fw={500} c="dimmed" mb="xs">
                    No file selected
                  </Text>
                  <Text size="sm" c="dimmed">
                    {fileTree.length === 0
                      ? 'Create a new file to get started'
                      : 'Select a file from the explorer to start editing'}
                  </Text>
                </div>
              </div>
            )}
          </div>

          <div
            className={classes.resizeHandle}
            style={{ display: terminalVisible ? 'block' : 'none' }}
            onMouseDown={handleDragStart}
          />
          <div
            className={classes.terminalPanel}
            data-testid="terminal-panel"
            style={{
              height: terminalVisible ? terminalHeight : 0,
              display: terminalVisible ? 'block' : 'none',
            }}
          >
            <Terminal ref={terminalRef} isVisible={terminalVisible} />
          </div>
        </div>
      </div>

      {assignmentContext?.assignmentId && (
        <div className={classes.assignmentBanner}>
          <Group justify="space-between" px="md" py="xs">
            <Group gap="xs">
              <IconCode size={14} color="#9d7eff" />
              <Text size="xs" c="gray">
                Assignment:
              </Text>
              <Text size="xs" fw={600} c="white">
                {assignmentContext.assignmentTitle}
              </Text>
              {submitResult && (
                <Badge size="xs" color={submitResult.success ? 'green' : 'red'} variant="light">
                  {submitResult.message}
                </Badge>
              )}
            </Group>
            <Group gap="xs">
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                onClick={() => navigate(`/student/assignments/${assignmentContext.assignmentId}`)}
              >
                Back to Assignment
              </Button>
              <Button
                size="xs"
                className={classes.submitButton}
                loading={submitting}
                disabled={!selectedFile}
                onClick={handleSubmitAssignment}
              >
                Submit Assignment
              </Button>
            </Group>
          </Group>
        </div>
      )}

      {selectedFile && !selectedFile.isDirectory && (
        <ShareModal
          opened={shareModalOpened}
          onClose={closeShareModal}
          fileId={selectedFile?.id ?? ''}
          fileName={selectedFile?.name ?? ''}
          shareData={shareData}
          onCreateShare={createShare}
          onRevokeShare={revokeShare}
          loading={shareLoading}
          error={shareError}
        />
      )}
    </Container>
  );
}
