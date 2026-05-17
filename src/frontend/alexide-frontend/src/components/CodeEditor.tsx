import React, { useRef, useState, useEffect, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Button, Text, Badge, LoadingOverlay, ActionIcon, Tooltip } from '@mantine/core';
import { IconDeviceFloppy, IconMaximize, IconMinimize, IconPlayerPlay } from '@tabler/icons-react';
import * as monaco from 'monaco-editor';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { Awareness } from 'y-protocols/awareness';
import classes from './CodeEditor.module.css';

interface CodeEditorProps {
  fileId: string;
  fileName: string;
  onContentChange?: (content: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onRunFile?: (fileId: string, filePath: string) => void;
  onFileSaved?: (fileId: string) => void;
  filePath?: string;
  ydoc?: Y.Doc | null;
  awareness?: Awareness | null;
  isSharedFile?: boolean;
  isSynced?: boolean;
}

export default function CodeEditor({
  fileId,
  fileName,
  onContentChange,
  isFullscreen = false,
  onToggleFullscreen,
  onRunFile,
  onFileSaved,
  filePath,
  ydoc,
  awareness,
  isSharedFile = false,
  isSynced = false,
}: CodeEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editorMounted, setEditorMounted] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const editorDisposedRef = useRef(false);

  const getLanguage = (filename: string): string => {
    return filename.endsWith('.py') ? 'python' : 'plaintext';
  };

  const handleManualSave = useCallback(async () => {
    const currentContent = editorRef.current?.getValue() || content;

    try {
      setSaving(true);
      const token = localStorage.getItem('authToken');

      const response = await fetch(`/api/backend/files/${fileId}/content`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: currentContent,
          lastUpdatedAt: lastSavedAt?.toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          alert(
            'Conflict: File has been modified by another user. Please refresh to see the latest version.'
          );
        } else {
          throw new Error(errorData.message || 'Failed to save file');
        }
        return;
      }

      const data = await response.json();
      setLastSavedAt(new Date(data.data.updatedAt));
      setHasUnsavedChanges(false);
      onFileSaved?.(fileId);
    } catch (error) {
      alert('Failed to save file. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [fileId, content, lastSavedAt, onFileSaved]);

  useEffect(() => {
    const fetchFileContent = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/backend/files/${fileId}/content`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 500) {
            const errorData = await response.json();
            if (errorData.error === 'File has no storage key') {
              setContent('');
              setLastSavedAt(new Date());
              setHasUnsavedChanges(false);
              setLoading(false);
              return;
            }
          }
          throw new Error('Failed to fetch file content');
        }

        const data = await response.json();
        const fileContent = data.data.content || '';
        setContent(fileContent);
        setLastSavedAt(new Date(data.data.updatedAt));
        setHasUnsavedChanges(false);
      } catch (error) {
        setContent('');
        setLastSavedAt(new Date());
      } finally {
        setLoading(false);
      }
    };

    if (fileId) {
      fetchFileContent();
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [fileId]);

  useEffect(() => {
    if (!editorMounted || !editorRef.current || loading || ydoc) return;
    editorRef.current.setValue(content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, editorMounted]);

  useEffect(() => {
    if (!isSynced || !ydoc || !awareness || !editorMounted || !editorRef.current) return;

    const yText = ydoc.getText('content');
    const model = editorRef.current.getModel();
    if (!model) return;

    bindingRef.current?.destroy();
    bindingRef.current = null;

    const timer = setTimeout(() => {
      if (!editorRef.current) return;
      const currentModel = editorRef.current.getModel();
      if (!currentModel) return;

      bindingRef.current = new MonacoBinding(
        yText,
        currentModel,
        new Set([editorRef.current]),
        awareness
      );
    }, 50);

    return () => {
      clearTimeout(timer);
      if (!editorDisposedRef.current) {
        try {
          bindingRef.current?.destroy();
        } catch {}
      }
      bindingRef.current = null;
    };
  }, [isSynced, ydoc, awareness, editorMounted]);

  useEffect(() => {
    if (!hasUnsavedChanges || !content || isSharedFile) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/backend/files/${fileId}/auto-save`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content: editorRef.current?.getValue() ?? content,
            lastUpdatedAt: lastSavedAt?.toISOString(),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setLastSavedAt(new Date(data.data.updatedAt));
          setHasUnsavedChanges(false);
          onFileSaved?.(fileId);

          if (data.data.hasConflict) {
            // console.warn('Auto-save conflict detected');
          }
        }
      } catch (error) {
        // console.error('Auto-save error:', error);
      }
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [content, hasUnsavedChanges, fileId, lastSavedAt, onFileSaved, isSharedFile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasUnsavedChanges && !isSharedFile) {
          handleManualSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, handleManualSave, isSharedFile]);

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    setEditorMounted(true);

    editor.onDidDispose(() => {
      editorDisposedRef.current = true;
      bindingRef.current = null;
    });

    editor.updateOptions({
      fontSize: 14,
      tabSize: 4,
      insertSpaces: true,
      wordWrap: 'on',
    });

    editor.addAction({
      id: 'save-file',
      label: 'Save File',
      keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS],
      contextMenuGroupId: 'file',
      contextMenuOrder: 1.5,
      run: () => {
        handleManualSave();
      },
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setContent(value);
      setHasUnsavedChanges(true);
      onContentChange?.(value);
    }
  };

  return (
    <div className={classes.container}>
      <LoadingOverlay visible={loading} />

      <div className={classes.toolbar}>
        <div className={classes.toolbarLeft}>
          <span className={classes.fileName}>{fileName}</span>
          {hasUnsavedChanges ? (
            <Badge size="sm" color="yellow" variant="dot">
              Unsaved
            </Badge>
          ) : lastSavedAt ? (
            <span className={classes.statusText}>Saved {lastSavedAt.toLocaleTimeString()}</span>
          ) : null}
        </div>

        <div className={classes.toolbarRight}>
          {hasUnsavedChanges && (
            <Text size="xs" c="dimmed" style={{ marginRight: '0.5rem', opacity: 0.8 }}>
              Press Cmd/Ctrl+S to save
            </Text>
          )}
          <Button
            leftSection={<IconDeviceFloppy size={18} />}
            onClick={handleManualSave}
            loading={saving}
            disabled={!hasUnsavedChanges || isSharedFile}
            variant="light"
            size="sm"
          >
            Save
          </Button>

          {onRunFile && fileName.endsWith('.py') && (
            <Tooltip label="Run file">
              <Button
                variant="filled"
                color="violet"
                size="sm"
                leftSection={<IconPlayerPlay size={14} />}
                onClick={() => onRunFile(fileId, filePath ?? `/${fileName}`)}
                disabled={saving}
              >
                Run
              </Button>
            </Tooltip>
          )}

          {onToggleFullscreen && (
            <Tooltip label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
              <ActionIcon
                size="lg"
                variant="subtle"
                onClick={onToggleFullscreen}
                className={classes.fullscreenButton}
                ml="xs"
              >
                {isFullscreen ? <IconMinimize size={20} /> : <IconMaximize size={20} />}
              </ActionIcon>
            </Tooltip>
          )}
        </div>
      </div>

      <div className={classes.editorWrapper}>
        <Editor
          height="100%"
          language={getLanguage(fileName)}
          theme="vs-dark"
          defaultValue=""
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 14,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            wordWrap: 'on',
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            formatOnPaste: true,
            formatOnType: true,
          }}
        />
      </div>
    </div>
  );
}
