import { useState, useEffect, useCallback, useRef } from 'react';
import { FileNode, cleanFileTree, findNodeInTree } from '../utils/fileTree';

const MIN_TERMINAL_HEIGHT = 100;
const MAX_TERMINAL_HEIGHT = 600;
const DEFAULT_TERMINAL_HEIGHT = 280;
const DEFAULT_EXPLORER_WIDTH = 280;
const MIN_EXPLORER_WIDTH = 280;
const MAX_EXPLORER_WIDTH = 450;

const getToken = () => localStorage.getItem('authToken');

export function useIDE() {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(DEFAULT_TERMINAL_HEIGHT);
  const [explorerWidth, setExplorerWidth] = useState(DEFAULT_EXPLORER_WIDTH);

  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);
  const isExplorerDraggingRef = useRef(false);
  const explorerDragStartXRef = useRef(0);
  const explorerDragStartWidthRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        setTerminalVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleDragStart = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = terminalHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const handleExplorerDragStart = (e: React.MouseEvent) => {
    isExplorerDraggingRef.current = true;
    explorerDragStartXRef.current = e.clientX;
    explorerDragStartWidthRef.current = explorerWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const delta = dragStartYRef.current - e.clientY;
        const newHeight = Math.min(
          MAX_TERMINAL_HEIGHT,
          Math.max(MIN_TERMINAL_HEIGHT, dragStartHeightRef.current + delta)
        );
        setTerminalHeight(newHeight);
      }

      if (isExplorerDraggingRef.current) {
        const delta = e.clientX - explorerDragStartXRef.current;
        const newWidth = Math.min(
          MAX_EXPLORER_WIDTH,
          Math.max(MIN_EXPLORER_WIDTH, explorerDragStartWidthRef.current + delta)
        );
        setExplorerWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      isExplorerDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const fetchFileTree = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getToken();
      if (!token) {
        setError('No authentication token found. Please log in again.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/backend/files/tree', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        setError('Authentication failed. Your session may have expired.');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        setError(`Failed to load files: ${response.status} ${response.statusText}`);
        setLoading(false);
        return;
      }

      const data = await response.json();
      const cleanedTree = cleanFileTree(data.data || []);
      setFileTree(cleanedTree);
      setLoading(false);
    } catch (error) {
      setError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFileTree();
  }, [fetchFileTree]);

  const handleFileCreate = async (name: string, parentId: string | null, isDirectory: boolean) => {
    try {
      const token = getToken();
      let path = `/${name}`;
      if (parentId) {
        const parent = findNodeInTree(fileTree, parentId);
        if (parent) {
          path = `${parent.path}/${name}`;
        }
      }
      const response = await fetch('/api/backend/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name,
          path,
          isDirectory,
          ...(parentId && { parentId }),
          ...(!isDirectory && { content: ' ' }),
        }),
      });
      if (response.ok) {
        await fetchFileTree();
      } else {
        const error = await response.json();
        alert(
          `Failed to create ${isDirectory ? 'folder' : 'file'}: ${error.message || error.error}`
        );
      }
    } catch {
      alert('Failed to create file/folder');
    }
  };

  const handleFileDelete = async (fileId: string) => {
    try {
      const token = getToken();
      const response = await fetch(`/api/backend/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        if (selectedFile?.id === fileId) {
          setSelectedFile(null);
        }
        await fetchFileTree();
      } else {
        const error = await response.json();
        alert(`Failed to delete: ${error.message}`);
      }
    } catch {
      alert('Failed to delete file/folder');
    }
  };

  const handleFileRename = async (fileId: string, newName: string) => {
    try {
      const token = getToken();
      const file = findNodeInTree(fileTree, fileId);
      if (!file) return;
      const pathParts = file.path.split('/');
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join('/');
      const response = await fetch(`/api/backend/files/${fileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName, path: newPath }),
      });
      if (response.ok) {
        await fetchFileTree();
        if (selectedFile?.id === fileId) {
          setSelectedFile({ ...selectedFile, name: newName, path: newPath });
        }
      } else {
        const error = await response.json();
        alert(`Failed to rename: ${error.message}`);
      }
    } catch {
      alert('Failed to rename file/folder');
    }
  };

  const handleFileUpload = async (file: File, parentId: string | null) => {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    if (parentId) formData.append('parentId', parentId);

    const response = await fetch('/api/backend/files/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (response.ok) {
      await fetchFileTree();
    }
  };

  const handleFileMove = async (fileId: string, newParentId: string | null) => {
    try {
      const token = getToken();
      const file = findNodeInTree(fileTree, fileId);
      if (!file) return;

      const newParent = newParentId ? findNodeInTree(fileTree, newParentId) : null;
      const newPath = newParent ? `${newParent.path}/${file.name}` : `/${file.name}`;

      const response = await fetch(`/api/backend/files/${fileId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          newParentId: newParentId ?? null,
          newPath,
        }),
      });

      if (response.ok) {
        await fetchFileTree();
      } else {
        const error = await response.json();
        alert(`Failed to move file: ${error.message || error.error}`);
      }
    } catch {
      alert('Failed to move file');
    }
  };

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  return {
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
    explorerWidth,
    handleExplorerDragStart,
    handleFileMove,
  };
}
