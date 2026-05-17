import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Text,
  Group,
  Badge,
  Button,
  Stack,
  Card,
  ScrollArea,
  Loader,
  Center,
  Alert,
  Modal,
  Code,
  Divider,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconWifi,
  IconWifiOff,
  IconEye,
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconUsers,
} from '@tabler/icons-react';
import { useTeacherExamSocket, MonitoredStudent } from '../hooks/useTeacherExamSocket';
import { ExamSessionMonitor, useTeacherExamDetails } from '../hooks/useTeacherExamDetails';
import classes from './TeacherExamMonitor.module.css';

interface StudentCardProps {
  student: MonitoredStudent;
  isAlert: boolean;
  onRequestSnapshot: () => void;
  snapshotLoading: boolean;
}

function mergeStudents(
  liveStudents: MonitoredStudent[],
  sessions: ExamSessionMonitor[]
): MonitoredStudent[] {
  if (liveStudents.length > 0) {
    const socketIds = new Set(liveStudents.map((s) => s.studentId));
    const dbOnly = sessions
      .filter((s) => !socketIds.has(s.studentId))
      .map(
        (s): MonitoredStudent => ({
          studentId: s.studentId,
          name: s.studentName ?? s.name ?? s.studentId,
          sessionId: s.id,
          status: s.isSubmitted ? 'submitted' : 'expired',
          tabSwitchCounter: s.tabSwitches ?? s.tabSwitchCount ?? 0,
          joinedAt: s.joinedAt ?? s.startedAt ?? new Date().toISOString(),
          submittedAt: s.submittedAt ?? null,
          isOnline: false,
        })
      );
    return [...liveStudents, ...dbOnly];
  }

  return sessions.map(
    (s): MonitoredStudent => ({
      studentId: s.studentId,
      name: s.studentName ?? s.name ?? s.studentId,
      sessionId: s.id,
      status: s.isSubmitted ? 'submitted' : s.isOnline ? 'active' : 'expired',
      tabSwitchCounter: s.tabSwitches ?? s.tabSwitchCount ?? 0,
      joinedAt: s.joinedAt ?? s.startedAt ?? new Date().toISOString(),
      submittedAt: s.submittedAt ?? null,
      isOnline: s.isOnline ?? false,
    })
  );
}

function StudentCard({
  student: s,
  isAlert,
  onRequestSnapshot,
  snapshotLoading,
}: StudentCardProps) {
  const statusColor = s.status === 'submitted' ? 'green' : s.isOnline ? 'blue' : 'gray';

  const cardClass = [
    classes.studentCard,
    isAlert ? classes.studentCardAlert : '',
    s.status === 'submitted' ? classes.studentCardSubmitted : '',
  ]
    .filter(Boolean)
    .join(' ');

  const dotClass = [
    classes.statusDot,
    s.isOnline ? classes.statusDotOnline : classes.statusDotOffline,
  ].join(' ');

  return (
    <Card className={cardClass} padding="sm">
      <Group justify="space-between" mb={6}>
        <Group gap="xs">
          <div className={dotClass} />
          <Text size="xs" ff="monospace" c="white">
            {s.name}
          </Text>
        </Group>
        <Badge color={statusColor} variant="light" size="xs">
          {s.status}
        </Badge>
      </Group>

      <Group gap="md" mb={6}>
        {s.tabSwitchCounter > 0 && (
          <Group gap={4}>
            <IconAlertTriangle size={12} color={s.tabSwitchCounter >= 3 ? 'red' : 'orange'} />
            <Text size="xs" c={s.tabSwitchCounter >= 3 ? 'red.4' : 'orange.4'}>
              {s.tabSwitchCounter} switch{s.tabSwitchCounter !== 1 ? 'es' : ''}
            </Text>
          </Group>
        )}
        <Group gap={4}>
          <IconClock size={11} opacity={0.4} />
          <Text size="xs" c="dimmed">
            Joined {s.joinedAt ? new Date(s.joinedAt).toLocaleString() : 'Unknown'}
          </Text>
        </Group>
      </Group>

      {s.status !== 'submitted' && (
        <Tooltip label="View student's current code">
          <Button
            size="xs"
            variant="subtle"
            color="violet"
            fullWidth
            leftSection={<IconEye size={12} />}
            onClick={onRequestSnapshot}
            loading={snapshotLoading}
            style={{ marginTop: 'auto' }}
          >
            Snapshot
          </Button>
        </Tooltip>
      )}

      {s.submittedAt && (
        <Text size="xs" c="dimmed" ta="center" mt="auto">
          Submitted{' '}
          {new Date(s.submittedAt).toLocaleTimeString('en-IE', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      )}
    </Card>
  );
}

export default function TeacherExamMonitor() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const { exam, sessions, loading, error, fetchAll } = useTeacherExamDetails(examId!);

  const {
    isConnected,
    students: liveStudents,
    alertStudentId,
    snapshot,
    snapshotLoading,
    requestSnapshot,
    dismissSnapshot,
  } = useTeacherExamSocket({
    examId: examId!,
    enabled: !!exam,
    onExamEnded: fetchAll,
    onStudentSubmitted: fetchAll,
  });

  useEffect(() => {
    if (!exam || exam.status !== 'ACTIVE') return;
    const endTime = exam.scheduledEnd ? new Date(exam.scheduledEnd).getTime() : null;
    if (!endTime) return;
    const remaining = endTime - Date.now();
    if (remaining <= 0) {
      fetchAll();
      return;
    }
    const timer = setTimeout(fetchAll, remaining);
    return () => clearTimeout(timer);
  }, [exam, fetchAll]);

  const mergedStudents = useMemo(
    () => mergeStudents(liveStudents, sessions),
    [liveStudents, sessions]
  );

  const submitted = mergedStudents.filter((s) => s.status === 'submitted').length;
  const active = mergedStudents.filter((s) => s.isOnline).length;

  if (loading) {
    return (
      <Center h="100vh" bg="#0d0d1a">
        <Loader color="violet" />
      </Center>
    );
  }

  if (error || !exam) {
    return (
      <Center h="100vh" bg="#0d0d1a">
        <Alert color="red">{error ?? 'Exam not found'}</Alert>
      </Center>
    );
  }

  return (
    <div className={classes.root}>
      <header className={classes.header}>
        <Group justify="space-between" w="100%">
          <Group gap="sm">
            <ActionIcon
              variant="subtle"
              onClick={() => navigate(`/teacher/exams/${examId}`)}
              aria-label="Back"
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Text fw={700} c="white" size="sm">
              {exam.title} - Monitor
            </Text>
            <Badge color={exam.status === 'ACTIVE' ? 'green' : 'gray'} variant="light" size="sm">
              {exam.status}
            </Badge>
          </Group>

          <Group gap="sm">
            <Tooltip label={isConnected ? 'Live connection active' : 'Connecting…'}>
              <Group gap={6}>
                {isConnected ? (
                  <IconWifi size={14} color="green" />
                ) : (
                  <IconWifiOff size={14} color="red" />
                )}
                <Text size="xs" c={isConnected ? 'green.4' : 'red.4'}>
                  {isConnected ? 'Live' : 'Offline'}
                </Text>
              </Group>
            </Tooltip>

            {exam.status === 'SCHEDULED' && exam.scheduledStart && (
              <Badge color="blue" leftSection={<IconClock size={12} />}>
                Auto-starts{' '}
                {new Date(exam.scheduledStart).toLocaleString('en-IE', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Badge>
            )}
            {exam.status === 'ACTIVE' && (
              <Badge color="green" variant="filled">
                Live - ends automatically
              </Badge>
            )}
          </Group>
        </Group>
      </header>

      <div className={classes.statsBar}>
        <Group gap="xl">
          <Group gap="xs">
            <IconUsers size={14} color="rgba(255,255,255,0.5)" />
            <Text size="xs" c="dimmed">
              {mergedStudents.length} total
            </Text>
          </Group>
          <Group gap="xs">
            <div className={`${classes.statusDot} ${classes.statusDotOnline}`} />
            <Text size="xs" c="dimmed">
              {active} online
            </Text>
          </Group>
          <Group gap="xs">
            <IconCheck size={14} color="green" />
            <Text size="xs" c="dimmed">
              {submitted} submitted
            </Text>
          </Group>
          <Group gap="xs">
            <Text size="xs" c="dimmed">
              {mergedStudents.length - submitted} remaining
            </Text>
          </Group>
        </Group>
      </div>

      <ScrollArea className={classes.scrollArea}>
        <div className={classes.grid}>
          {mergedStudents.length === 0 ? (
            <Center py="xl" style={{ gridColumn: '1 / -1' }}>
              <Stack align="center" gap="sm">
                <IconUsers size={40} opacity={0.3} />
                <Text c="dimmed" size="sm">
                  No students have joined yet.
                </Text>
              </Stack>
            </Center>
          ) : (
            mergedStudents.map((s) => (
              <StudentCard
                key={s.studentId}
                student={s}
                isAlert={s.studentId === alertStudentId}
                onRequestSnapshot={() => requestSnapshot(s.studentId)}
                snapshotLoading={snapshotLoading}
              />
            ))
          )}
        </div>
      </ScrollArea>

      <Modal
        opened={!!snapshot}
        onClose={dismissSnapshot}
        title={`Snapshot: ${snapshot?.studentName?.slice(0, 20)} — ${new Date().toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}`}
        size="xl"
        classNames={{
          content: classes.snapshotContent,
          header: classes.snapshotHeader,
          body: classes.snapshotBody,
        }}
      >
        {!snapshot?.answers.length ? (
          <Text c="dimmed" size="sm">
            No answers saved yet.
          </Text>
        ) : (
          <Stack gap="md">
            {snapshot.answers.map((a) => (
              <div key={a.questionId}>
                <Group gap="xs" mb={6}>
                  <Text size="sm" fw={600} c="white">
                    {a.questionTitle}
                  </Text>
                  <Badge
                    size="xs"
                    color={a.status === 'COMPLETED' ? 'green' : 'gray'}
                    variant="light"
                  >
                    {a.status}
                  </Badge>
                </Group>
                <Code block className={classes.snapshotCode}>
                  {a.code || '(empty)'}
                </Code>
                <Divider mt="sm" color="rgba(255,255,255,0.06)" />
              </div>
            ))}
          </Stack>
        )}
      </Modal>
    </div>
  );
}
