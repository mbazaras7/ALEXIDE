import React from 'react';
import { Modal, Text, Group, Button } from '@mantine/core';

interface ConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  confirmColor?: string;
  loading?: boolean;
}

export default function ConfirmModal({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmColor = 'violet',
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
      size="sm"
      styles={{
        content: {
          background: 'rgba(20, 20, 35, 0.98)',
          border: '1px solid rgba(123, 91, 245, 0.3)',
        },
        header: {
          background: 'rgba(123, 91, 245, 0.08)',
          borderBottom: '1px solid rgba(123, 91, 245, 0.2)',
          color: 'white',
        },
        body: { paddingTop: '16px' },
        title: { color: 'white', fontWeight: 600 },
        close: { color: 'rgba(255,255,255,0.6)' },
      }}
    >
      {message && (
        <Text size="sm" c="dimmed" mb="lg">
          {message}
        </Text>
      )}
      <Group justify="flex-end" gap="sm">
        <Button variant="subtle" color="gray" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button color={confirmColor} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}
