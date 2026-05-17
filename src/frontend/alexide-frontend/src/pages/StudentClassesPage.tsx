import React, { useState } from 'react';
import {
  Box,
  Button,
  Text,
  Group,
  Stack,
  Modal,
  TextInput,
  Loader,
  Center,
  Alert,
  Card,
} from '@mantine/core';
import { IconPlus, IconDoorExit, IconAlertCircle, IconSchool } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useStudentClasses } from '../hooks/useStudentClasses';
import ConfirmModal from '../components/ConfirmModal';
import classes from './StudentClassesPage.module.css';

const getErrorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : 'An unexpected error occurred';

export default function StudentClassesPage() {
  const { classes: classList, loading, error, joinClass, leaveClass } = useStudentClasses();
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [leaveTarget, setLeaveTarget] = useState<{ id: string; name: string } | null>(null);

  const navigate = useNavigate();

  const handleJoin = async () => {
    if (!joinCode.trim()) return setFormError('Please enter a join code');
    try {
      setSubmitting(true);
      setFormError('');
      await joinClass(joinCode.trim().toUpperCase());
      setJoinOpen(false);
      setJoinCode('');
    } catch (e: unknown) {
      setFormError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeave = async () => {
    if (!leaveTarget) return;
    try {
      await leaveClass(leaveTarget.id);
      setLeaveTarget(null);
    } catch (e: unknown) {
      alert(getErrorMessage(e));
    }
  };

  if (loading)
    return (
      <Center h={400}>
        <Loader color="violet" />
      </Center>
    );
  if (error)
    return (
      <Alert
        color="red"
        icon={<IconAlertCircle size={16} />}
        classNames={{ root: classes.alert, message: classes.alertMessage }}
      >
        {error}
      </Alert>
    );

  return (
    <Box className={classes.container}>
      <Group justify="space-between" mb="xl">
        <div>
          <Text className={classes.title}>My Classes</Text>
          <Text className={classes.subtitle}>
            {classList.length} class{classList.length !== 1 ? 'es' : ''} enrolled
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          className={classes.joinButton}
          onClick={() => {
            setJoinCode('');
            setFormError('');
            setJoinOpen(true);
          }}
        >
          Join Class
        </Button>
      </Group>

      {classList.length === 0 ? (
        <Box className={classes.empty}>
          <IconSchool size={40} color="rgba(123, 91, 245, 0.4)" />
          <Text size="lg" c="dimmed" mt="sm">
            Not enrolled in any classes
          </Text>
          <Text size="sm" c="dimmed" mt={4}>
            Ask your teacher for a join code
          </Text>
        </Box>
      ) : (
        <Stack gap="md">
          {classList.map((enrollment) => (
            <Card
              key={enrollment.id}
              className={classes.card}
              onClick={() => navigate(`/student/classes/${enrollment.class.id}`)}
            >
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text className={classes.className}>{enrollment.class.name}</Text>
                  {enrollment.class.description && (
                    <Text className={classes.classDesc}>{enrollment.class.description}</Text>
                  )}
                </div>
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  leftSection={<IconDoorExit size={14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLeaveTarget({ id: enrollment.class.id, name: enrollment.class.name });
                  }}
                >
                  Leave
                </Button>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Modal
        opened={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="Join a Class"
        classNames={{
          content: classes.modalContent,
          header: classes.modalHeader,
          close: classes.modalClose,
        }}
      >
        <Stack gap="md">
          {formError && (
            <Alert
              color="red"
              icon={<IconAlertCircle size={16} />}
              classNames={{ root: classes.alert, message: classes.alertMessage }}
            >
              {formError}
            </Alert>
          )}
          <TextInput
            label="Join Code"
            placeholder="e.g. DRUMN-C8"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleJoin();
            }}
            classNames={{ input: classes.input, label: classes.label }}
            autoFocus
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setJoinOpen(false)}>
              Cancel
            </Button>
            <Button className={classes.joinButton} onClick={handleJoin} loading={submitting}>
              Join
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmModal
        opened={!!leaveTarget}
        onClose={() => setLeaveTarget(null)}
        onConfirm={handleLeave}
        title="Leave Class"
        message={`Are you sure you want to leave "${leaveTarget?.name}"?`}
        confirmLabel="Leave"
        confirmColor="red"
      />
    </Box>
  );
}
