import React from 'react';
import {
  Modal,
  Button,
  TextInput,
  Text,
  Group,
  Stack,
  CopyButton,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { IconCopy, IconCheck, IconTrash, IconShare } from '@tabler/icons-react';
import { ShareData } from '../hooks/useFileShare';

interface ShareModalProps {
  opened: boolean;
  onClose: () => void;
  fileId: string;
  fileName: string;
  shareData: ShareData | null;
  onCreateShare: (fileId: string, expiresInHours?: number) => Promise<ShareData | null>;
  onRevokeShare: (fileId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export default function ShareModal({
  opened,
  onClose,
  fileId,
  fileName,
  shareData,
  onCreateShare,
  onRevokeShare,
  loading,
  error,
}: ShareModalProps) {
  const shareUrl = shareData ? `${window.location.origin}/join/${shareData.shareCode}` : null;

  return (
    <Modal opened={opened} onClose={onClose} title={`Share "${fileName}"`} centered>
      <Stack gap="md">
        {!shareData ? (
          <>
            <Text size="sm" c="dimmed">
              Generate a share link to invite someone to collaborate on this file in real time.
            </Text>
            <Button
              leftSection={<IconShare size={16} />}
              onClick={() => onCreateShare(fileId)}
              loading={loading}
              variant="filled"
              color="violet"
              fullWidth
            >
              Generate Share Link
            </Button>
          </>
        ) : (
          <>
            <Text size="sm" c="dimmed">
              Send this link to your collaborator. They will join your live session.
            </Text>
            <TextInput
              value={shareUrl ?? ''}
              readOnly
              rightSection={
                <CopyButton value={shareUrl ?? ''} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied!' : 'Copy link'}>
                      <ActionIcon onClick={copy} color={copied ? 'teal' : 'gray'} variant="subtle">
                        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              }
            />
            {shareData.expiresAt && (
              <Text size="xs" c="dimmed">
                Expires: {new Date(shareData.expiresAt).toLocaleString()}
              </Text>
            )}
            <Group justify="flex-end">
              <Button
                leftSection={<IconTrash size={14} />}
                onClick={() => onRevokeShare(fileId)}
                loading={loading}
                variant="subtle"
                color="red"
                size="xs"
              >
                Revoke Link
              </Button>
            </Group>
          </>
        )}
        {error && (
          <Text size="xs" c="red">
            {error}
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
