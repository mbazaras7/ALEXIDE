import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Center, Loader, Text, Stack, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';

export default function JoinPage() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolveShare = async () => {
      try {
        const token = localStorage.getItem('authToken');

        if (loading) return;

        if (!isAuthenticated || !token) {
          navigate('/auth', { state: { redirectTo: `/join/${shareCode}` } });
          return;
        }

        const res = await fetch(`/api/backend/share/${shareCode}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('Share link is invalid or has expired');

        const data = await res.json();
        const fileId: string = data.data.fileId;

        const idePath = user?.role === 'TEACHER' ? '/teacher/ide' : '/student/ide';
        navigate(idePath, { state: { sharedFileId: fileId } });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Share link is invalid or has expired');
      }
    };

    if (shareCode) resolveShare();
  }, [shareCode, isAuthenticated, user, navigate, loading]);

  if (error) {
    return (
      <Center h="100vh">
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          title="Invalid Share Link"
          maw={400}
        >
          {error}
        </Alert>
      </Center>
    );
  }

  return (
    <Center h="100vh">
      <Stack align="center" gap="md">
        <Loader color="violet" size="lg" />
        <Text c="dimmed">Joining collaboration session...</Text>
      </Stack>
    </Center>
  );
}
