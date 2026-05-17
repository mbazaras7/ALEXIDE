import React, { useState, useEffect, useRef } from 'react';
import {
  Stack,
  Group,
  Text,
  ActionIcon,
  Menu,
  Modal,
  TextInput,
  Button,
  ScrollArea,
  Box,
} from '@mantine/core';
import {
  IconFile,
  IconFolder,
  IconFolderOpen,
  IconChevronRight,
  IconChevronDown,
  IconDots,
  IconPlus,
  IconTrash,
  IconEdit,
  IconUpload,
  IconDownload,
} from '@tabler/icons-react';
import ConfirmModal from './ConfirmModal';
import classes from './FileExplorer.module.css';
import { isAncestor } from '../utils/fileTree';

interface FileNode {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
  parentId?: string | null;
}

interface FileExplorerProps {
  files: FileNode[];
  selectedFileId: string | null;
  onFileSelect: (file: FileNode) => void;
  onFileCreate: (name: string, parentId: string | null, isDirectory: boolean) => void;
  onFileDelete: (fileId: string) => void;
  onFileRename: (fileId: string, newName: string) => void;
  onFileUpload?: (file: File, parentId: string | null) => Promise<void>;
  onFileMove?: (fileId: string, newParentId: string | null) => void;
}

export default function FileExplorer({
  files,
  selectedFileId,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename,
  onFileUpload,
  onFileMove,
}: FileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [isCreatingDirectory, setIsCreatingDirectory] = useState(false);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [uploadParentId, setUploadParentId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const collectAllFolderIds = (nodes: FileNode[]): string[] => {
      const ids: string[] = [];
      nodes.forEach((node) => {
        if (node.isDirectory) {
          ids.push(node.id);
          if (node.children) {
            ids.push(...collectAllFolderIds(node.children));
          }
        }
      });
      return ids;
    };

    const allFolderIds = collectAllFolderIds(files);
    setExpandedFolders(new Set(allFolderIds));
  }, [files]);

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleCreateClick = (parentId: string | null, isDirectory: boolean) => {
    setCurrentParentId(parentId);
    setIsCreatingDirectory(isDirectory);
    setNewItemName('');
    setCreateModalOpen(true);
  };

  const handleCreate = () => {
    if (newItemName.trim()) {
      onFileCreate(newItemName.trim(), currentParentId, isCreatingDirectory);
      setCreateModalOpen(false);
      setNewItemName('');
    }
  };

  const handleRenameClick = (fileId: string, currentName: string) => {
    setRenamingFileId(fileId);
    setNewItemName(currentName);
    setRenameModalOpen(true);
  };

  const handleRename = () => {
    if (renamingFileId && newItemName.trim()) {
      onFileRename(renamingFileId, newItemName.trim());
      setRenameModalOpen(false);
      setNewItemName('');
      setRenamingFileId(null);
    }
  };

  const handleUploadClick = (parentId: string | null) => {
    setUploadParentId(parentId);
    uploadInputRef.current?.click();
  };

  const handleUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onFileUpload) return;
    try {
      setUploading(true);
      await onFileUpload(file, uploadParentId);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggingNodeId) return;
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.getData('nodeId')) return;
    const file = e.dataTransfer.files?.[0];
    if (!file || !onFileUpload) return;
    try {
      setUploading(true);
      await onFileUpload(file, null);
    } finally {
      setUploading(false);
    }
  };

  const handleNodeDragStart = (e: React.DragEvent, nodeId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('nodeId', nodeId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingNodeId(nodeId);
  };

  const handleNodeDragEnd = () => {
    setDraggingNodeId(null);
    setDragOverFolderId(null);
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggingNodeId) return;
    if (draggingNodeId === folderId || isAncestor(files, draggingNodeId, folderId)) return;
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolderId(folderId);
  };

  const handleFolderDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverFolderId(null);
    }
  };

  const handleFolderDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const nodeId = e.dataTransfer.getData('nodeId');
    if (!nodeId || !onFileMove) return;
    if (nodeId === targetFolderId) return;
    if (targetFolderId && isAncestor(files, nodeId, targetFolderId)) return;
    onFileMove(nodeId, targetFolderId);
    setDraggingNodeId(null);
    setDragOverFolderId(null);
  };

  const handleDownload = async (node: FileNode) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`/api/backend/files/${node.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = node.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFileIcon = (fileName: string) => {
    return fileName.endsWith('.py') ? '#3B82F6' : '#868E96';
  };

  const renderFileNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.id);
    const isSelected = node.id === selectedFileId;
    const isDragging = node.id === draggingNodeId;
    const isDragTarget = node.isDirectory && node.id === dragOverFolderId;
    const indentSize = 24;

    return (
      <Box key={node.id}>
        <Group
          data-testid={node.isDirectory ? 'folder-item' : 'file-item'}
          gap="xs"
          py={6}
          className={`${classes.fileNode} ${isSelected ? classes.selected : ''} ${isDragging ? classes.dragging : ''} ${isDragTarget ? classes.dragTarget : ''}`}
          style={{
            paddingLeft: `${depth * indentSize + 12}px`,
            paddingRight: '1rem',
          }}
          draggable
          onDragStart={(e) => handleNodeDragStart(e, node.id)}
          onDragEnd={handleNodeDragEnd}
          onDragOver={node.isDirectory ? (e) => handleFolderDragOver(e, node.id) : undefined}
          onDragLeave={node.isDirectory ? handleFolderDragLeave : undefined}
          onDrop={node.isDirectory ? (e) => handleFolderDrop(e, node.id) : undefined}
          onClick={() => {
            if (node.isDirectory) {
              toggleFolder(node.id);
            } else {
              onFileSelect(node);
            }
          }}
        >
          {node.isDirectory ? (
            isExpanded ? (
              <IconChevronDown size={14} className={classes.icon} />
            ) : (
              <IconChevronRight size={14} className={classes.icon} />
            )
          ) : (
            <Box style={{ width: 14 }} />
          )}

          {node.isDirectory ? (
            isExpanded ? (
              <IconFolderOpen size={18} color="#FCC419" className={classes.icon} />
            ) : (
              <IconFolder size={18} color="#FCC419" className={classes.icon} />
            )
          ) : (
            <IconFile size={16} color={getFileIcon(node.name)} className={classes.icon} />
          )}

          <Text size="sm" style={{ flex: 1 }}>
            {node.name}
          </Text>

          <Menu position="right-start" withArrow>
            <Menu.Target>
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={(e) => e.stopPropagation()}
                className={classes.actionButton}
              >
                <IconDots size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown className={classes.menuDropdown}>
              {node.isDirectory && (
                <>
                  <Menu.Item
                    leftSection={<IconPlus size={14} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateClick(node.id, false);
                    }}
                  >
                    New File
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconPlus size={14} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateClick(node.id, true);
                    }}
                  >
                    New Folder
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconUpload size={14} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUploadClick(node.id);
                    }}
                  >
                    Upload File
                  </Menu.Item>
                  <Menu.Divider />
                </>
              )}
              <Menu.Item
                leftSection={<IconEdit size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRenameClick(node.id, node.name);
                }}
              >
                Rename
              </Menu.Item>
              {!node.isDirectory && (
                <Menu.Item
                  leftSection={<IconDownload size={14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(node);
                  }}
                >
                  Download
                </Menu.Item>
              )}
              <Menu.Item
                leftSection={<IconTrash size={14} />}
                color="red"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget({ id: node.id, name: node.name });
                }}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        {node.isDirectory && isExpanded && node.children && node.children.length > 0 && (
          <Box>{node.children.map((child) => renderFileNode(child, depth + 1))}</Box>
        )}
      </Box>
    );
  };

  return (
    <>
      <Stack
        gap={0}
        className={`${classes.container} ${isDraggingOver ? classes.dragOver : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Group justify="space-between" className={classes.header}>
          <Text fw={600} size="sm">
            FILES
          </Text>
          <Group gap={4}>
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={() => handleCreateClick(null, false)}
              title="New File"
              className={classes.headerButton}
            >
              <IconFile size={16} />
            </ActionIcon>
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={() => handleCreateClick(null, true)}
              title="New Folder"
              className={classes.headerButton}
            >
              <IconFolder size={16} />
            </ActionIcon>
            <ActionIcon
              size="sm"
              variant="subtle"
              loading={uploading}
              onClick={() => handleUploadClick(null)}
              className={classes.headerButton}
            >
              <IconUpload size={16} />
            </ActionIcon>
          </Group>
        </Group>

        <ScrollArea style={{ flex: 1 }}>
          <Stack gap={0} p="xs">
            {files.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                No files yet. Create a new file or folder to get started.
              </Text>
            ) : (
              files.map((file) => renderFileNode(file, 0))
            )}
            {draggingNodeId && (
              <Box
                className={`${classes.rootDropZone} ${dragOverFolderId === 'root' ? classes.dragTarget : ''}`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOverFolderId('root');
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverFolderId(null);
                  }
                }}
                onDrop={(e) => handleFolderDrop(e, null)}
              >
                <Text size="xs" c="dimmed" ta="center" style={{ pointerEvents: 'none' }}>
                  Move to root
                </Text>
              </Box>
            )}
          </Stack>
        </ScrollArea>
        {isDraggingOver && (
          <div className={classes.dragOverlay}>
            <Text size="sm" c="violet.4" fw={600}>
              Drop to upload
            </Text>
          </div>
        )}
      </Stack>

      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={`Create New ${isCreatingDirectory ? 'Folder' : 'File'}`}
        classNames={{ content: classes.modalContent, header: classes.modalHeader }}
      >
        <TextInput
          label="Name"
          placeholder={isCreatingDirectory ? 'folder-name' : 'filename.py'}
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCreate();
            }
          }}
          autoFocus
          classNames={{ input: classes.input, label: classes.label }}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => setCreateModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Create</Button>
        </Group>
      </Modal>

      <Modal
        opened={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        title="Rename"
        classNames={{ content: classes.modalContent, header: classes.modalHeader }}
      >
        <TextInput
          label="New Name"
          placeholder="new-name"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleRename();
            }
          }}
          autoFocus
          classNames={{ input: classes.input, label: classes.label }}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => setRenameModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleRename}>Rename</Button>
        </Group>
      </Modal>
      <input
        ref={uploadInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleUploadChange}
      />
      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            onFileDelete(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        title="Delete File"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete"
        confirmColor="red"
      />
    </>
  );
}
