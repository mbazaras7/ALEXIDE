import React, { useState } from 'react';
import {
  Stack,
  Group,
  Text,
  Card,
  Badge,
  Button,
  ActionIcon,
  Modal,
  TextInput,
  Textarea,
  NumberInput,
  Switch,
  Alert,
  Loader,
  Center,
  Tooltip,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconAlertCircle,
  IconClock,
  IconBook,
  IconBookOff,
  IconFlask,
  IconEye,
  IconPlayerPlay,
  IconCalendar,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTeacherExams } from '../hooks/useTeacherExams';
import type { CreateExamData } from '../hooks/useTeacherExams';
import ConfirmModal from './ConfirmModal';
import classes from './TeacherExamTab.module.css';

const getErrorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : 'An unexpected error occurred';

const STATUS_COLOUR: Record<string, string> = {
  ACTIVE: 'green',
  SCHEDULED: 'blue',
  COMPLETED: 'gray',
  CANCELLED: 'red',
  DRAFT: 'yellow',
};

interface Props {
  classId: string;
}

export default function TeacherExamTab({ classId }: Props) {
  const navigate = useNavigate();
  const { exams, loading, error, createExam, deleteExam } = useTeacherExams(classId);

  const [createOpen, setCreateOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formDuration, setFormDuration] = useState<number | string>(60);
  const [formMaxScore, setFormMaxScore] = useState<number | string>(100);
  const [formIsOpenBook, setFormIsOpenBook] = useState(false);
  const [formScheduledStart, setFormScheduledStart] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  function resetForm() {
    setFormTitle('');
    setFormInstructions('');
    setFormDuration(60);
    setFormMaxScore(100);
    setFormIsOpenBook(false);
    setFormScheduledStart('');
    setFormError('');
  }

  async function handleCreate() {
    if (!formTitle.trim()) return setFormError('Title is required');
    try {
      setSubmitting(true);
      setFormError('');
      const payload: CreateExamData = {
        title: formTitle.trim(),
        instructions: formInstructions.trim() || null,
        language: 'python',
        durationMinutes: Number(formDuration),
        maxScore: Number(formMaxScore),
        isOpenBook: formIsOpenBook,
        scheduledStart: formScheduledStart ? new Date(formScheduledStart).toISOString() : null,
      };
      const created = await createExam(payload);
      setCreateOpen(false);
      resetForm();
      navigate(`/teacher/exams/${created.id}`);
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteExam(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e) {
      alert(getErrorMessage(e));
    }
  }

  if (loading)
    return (
      <Center h={200} data-testid="loading-spinner">
        <Loader color="violet" size="sm" />
      </Center>
    );
  if (error)
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red">
        {error}
      </Alert>
    );

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button
          size="xs"
          leftSection={<IconPlus size={14} />}
          className={classes.createButton}
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
        >
          New Exam
        </Button>
      </Group>

      {exams.length === 0 ? (
        <div className={classes.empty}>
          <IconFlask size={28} opacity={0.3} />
          <Text c="dimmed" mt="sm">
            No exams yet
          </Text>
          <Text size="sm" c="dimmed" mt={4}>
            Create an exam to get started.
          </Text>
        </div>
      ) : (
        exams.map((exam) => (
          <Card
            key={exam.id}
            className={`${classes.examCard} ${exam.status === 'ACTIVE' ? classes.examCardActive : ''}`}
            onClick={() => navigate(`/teacher/exams/${exam.id}`)}
          >
            <Group justify="space-between" align="flex-start">
              <div style={{ flex: 1 }}>
                <Group gap="xs" mb={4}>
                  <Badge color={STATUS_COLOUR[exam.status]} variant="light" size="sm">
                    {exam.status}
                  </Badge>
                  <Badge color="violet" variant="light" size="sm">
                    {exam.language}
                  </Badge>
                  <Badge
                    color={exam.isOpenBook ? 'blue' : 'gray'}
                    variant="light"
                    size="sm"
                    leftSection={
                      exam.isOpenBook ? <IconBook size={10} /> : <IconBookOff size={10} />
                    }
                  >
                    {exam.isOpenBook ? 'Open-book' : 'Closed-book'}
                  </Badge>
                </Group>

                <Text fw={600} c="white" size="sm">
                  {exam.title}
                </Text>

                {exam.instructions && (
                  <Text size="xs" c="dimmed" mt={4} lineClamp={2}>
                    {exam.instructions}
                  </Text>
                )}

                <Group gap="md" mt={6}>
                  <Group gap={4}>
                    <IconClock size={12} opacity={0.5} />
                    <Text size="xs" c="dimmed">
                      {exam.durationMinutes} min
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Max score: {exam.maxScore}
                  </Text>
                  {exam.scheduledStart && (
                    <Group gap={4}>
                      <IconCalendar size={12} style={{ opacity: 0.5 }} />
                      <Text size="xs" c="dimmed">
                        {new Date(exam.scheduledStart).toLocaleString('en-IE', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </Group>
                  )}
                </Group>
              </div>
              <Group gap="xs">
                <Button
                  size="xs"
                  variant={exam.status === 'ACTIVE' ? 'gradient' : 'light'}
                  gradient={{ from: 'green', to: 'teal', deg: 45 }}
                  color={exam.status === 'ACTIVE' ? undefined : 'violet'}
                  leftSection={
                    exam.status === 'ACTIVE' ? <IconPlayerPlay size={13} /> : <IconEye size={13} />
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/teacher/exams/${exam.id}`);
                  }}
                >
                  {exam.status === 'ACTIVE' ? 'Monitor Live' : 'View'}
                </Button>

                {exam.status === 'DRAFT' && (
                  <Tooltip label="Delete exam">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      aria-label={`Delete ${exam.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ id: exam.id, title: exam.title });
                      }}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Group>
          </Card>
        ))
      )}

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Exam"
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
              classNames={{ root: classes.alert }}
            >
              {formError}
            </Alert>
          )}

          <TextInput
            label="Title"
            placeholder="e.g. Python Midterm"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            required
            classNames={{ input: classes.input, label: classes.label }}
          />

          <Textarea
            label="Instructions"
            placeholder="Instructions shown to students before they start (optional)"
            value={formInstructions}
            onChange={(e) => setFormInstructions(e.target.value)}
            rows={3}
            classNames={{ input: classes.input, label: classes.label }}
          />

          <Group grow>
            <NumberInput
              label="Duration (minutes)"
              value={formDuration}
              onChange={setFormDuration}
              min={5}
              classNames={{ input: classes.input, label: classes.label }}
            />
            <NumberInput
              label="Max Score"
              value={formMaxScore}
              onChange={setFormMaxScore}
              min={1}
              classNames={{ input: classes.input, label: classes.label }}
            />
          </Group>

          <TextInput
            label="Scheduled Start"
            type="datetime-local"
            value={formScheduledStart}
            onChange={(e) => setFormScheduledStart(e.target.value)}
            classNames={{ input: classes.input, label: classes.label }}
          />

          <Switch
            label="Open-book exam"
            description="Students can use the file explorer and IDE during the exam"
            checked={formIsOpenBook}
            onChange={(e) => setFormIsOpenBook(e.currentTarget.checked)}
            classNames={{ label: classes.switchLabel, description: classes.switchDesc }}
          />

          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              className={classes.createButton}
              onClick={handleCreate}
              loading={submitting}
              leftSection={<IconPlus size={14} />}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Exam"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="red"
      />
    </Stack>
  );
}
