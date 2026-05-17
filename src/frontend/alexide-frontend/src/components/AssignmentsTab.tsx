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
  Select,
  Alert,
  Loader,
  Center,
  Tooltip,
} from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconAlertCircle } from '@tabler/icons-react';
import {
  useTeacherAssignments,
  Assignment,
  CreateAssignmentData,
} from '../hooks/useTeacherAssignments';
import { ClassStudent } from '../hooks/useTeacherClasses';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from './ConfirmModal';
import classes from './AssignmentsTab.module.css';

const getErrorMessage = (e: unknown) =>
  e instanceof Error ? e.message : 'An unexpected error occurred';

const toISO = (dateStr: string) => (dateStr ? new Date(dateStr).toISOString() : undefined);

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
];

const STATUS_COLOURS: Record<string, string> = { DRAFT: 'gray', PUBLISHED: 'green' };

interface Props {
  classId: string;
  members: ClassStudent[];
}

export default function AssignmentsTab({ classId }: Props) {
  const { assignments, loading, error, createAssignment, updateAssignment, deleteAssignment } =
    useTeacherAssignments(classId);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formMaxScore, setFormMaxScore] = useState<number | string>(100);
  const [formLanguage, setFormLanguage] = useState<string | null>('python');
  const [formStatus, setFormStatus] = useState<string | null>('DRAFT');

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const navigate = useNavigate();

  const resetCreateForm = () => {
    setFormTitle('');
    setFormDesc('');
    setFormDueDate('');
    setFormMaxScore(100);
    setFormLanguage('python');
    setFormStatus('DRAFT');
    setFormError('');
  };

  const handleCreate = async () => {
    if (!formTitle.trim()) return setFormError('Title is required');
    try {
      setSubmitting(true);
      setFormError('');
      const payload: CreateAssignmentData = {
        title: formTitle.trim(),
        description: formDesc.trim() || undefined,
        dueDate: formDueDate ? toISO(formDueDate) : undefined,
        maxScore: Number(formMaxScore),
        language: 'python',
        status: (formStatus || 'DRAFT') as CreateAssignmentData['status'],
      };
      await createAssignment(payload);
      setCreateOpen(false);
      resetCreateForm();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedAssignment || !formTitle.trim()) return setFormError('Title is required');
    try {
      setSubmitting(true);
      setFormError('');
      await updateAssignment(selectedAssignment.id, {
        title: formTitle.trim(),
        description: formDesc.trim() || undefined,
        dueDate: formDueDate ? toISO(formDueDate) : undefined,
        maxScore: Number(formMaxScore),
        language: 'python',
        status: (formStatus || 'DRAFT') as CreateAssignmentData['status'],
      });
      setEditOpen(false);
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAssignment(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e) {
      alert(getErrorMessage(e));
    }
  };

  if (loading)
    return (
      <Center h={200} data-testid="loading-spinner">
        <Loader color="violet" size="sm" />
      </Center>
    );
  if (error)
    return (
      <Alert icon={<IconAlertCircle />} color="red">
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
            resetCreateForm();
            setCreateOpen(true);
          }}
        >
          New Assignment
        </Button>
      </Group>

      {assignments.length === 0 ? (
        <div className={classes.empty}>
          <Text c="dimmed">No assignments yet</Text>
          <Text size="sm" c="dimmed" mt={4}>
            Click "New Assignment" to create one
          </Text>
        </div>
      ) : (
        assignments.map((a) => (
          <Card
            key={a.id}
            className={classes.assignmentCard}
            onClick={() => navigate(`/teacher/assignments/${a.id}`)}
          >
            <Group justify="space-between" align="flex-start">
              <div style={{ flex: 1 }}>
                <Group gap="xs" mb={4}>
                  <Badge color={STATUS_COLOURS[a.status]} variant="light" size="sm">
                    {a.status}
                  </Badge>
                  <Badge color="violet" variant="light" size="sm">
                    {a.language}
                  </Badge>
                  <Text fw={600} c="white" size="sm">
                    {a.title}
                  </Text>
                </Group>
                {a.description && (
                  <Text size="xs" c="dimmed">
                    {a.description}
                  </Text>
                )}
                <Group gap="md" mt={6}>
                  <Text size="xs" c="dimmed">
                    Max score: {a.maxScore}
                  </Text>
                  {a.dueDate && (
                    <Text size="xs" c="dimmed">
                      Due: {new Date(a.dueDate).toLocaleDateString()}
                    </Text>
                  )}
                </Group>
              </div>
              <Group gap="xs">
                <Tooltip label="Edit assignment">
                  <ActionIcon
                    aria-label={`Edit assignment ${a.id}`}
                    size="sm"
                    variant="subtle"
                    className={classes.iconButton}
                    onClick={(e) => {
                      setSelectedAssignment(a);
                      setFormTitle(a.title);
                      setFormDesc(a.description || '');
                      setFormDueDate(a.dueDate ? a.dueDate.slice(0, 16) : '');
                      setFormMaxScore(a.maxScore);
                      setFormLanguage(a.language);
                      setFormStatus(a.status);
                      setFormError('');
                      setEditOpen(true);
                      e.stopPropagation();
                    }}
                  >
                    <IconEdit size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Delete assignment">
                  <ActionIcon
                    aria-label={`Delete assignment ${a.id}`}
                    size="sm"
                    variant="subtle"
                    color="red"
                    onClick={(e) => {
                      setDeleteTarget({ id: a.id, title: a.title });
                      e.stopPropagation();
                    }}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          </Card>
        ))
      )}

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Assignment"
        classNames={{
          content: classes.modalContent,
          header: classes.modalHeader,
          close: classes.modalClose,
        }}
      >
        <AssignmentForm
          title={formTitle}
          setTitle={setFormTitle}
          desc={formDesc}
          setDesc={setFormDesc}
          dueDate={formDueDate}
          setDueDate={setFormDueDate}
          maxScore={formMaxScore}
          setMaxScore={setFormMaxScore}
          language={formLanguage}
          setLanguage={setFormLanguage}
          status={formStatus}
          setStatus={setFormStatus}
          formError={formError}
          submitting={submitting}
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Create"
        />
      </Modal>

      <Modal
        opened={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Assignment"
        classNames={{
          content: classes.modalContent,
          header: classes.modalHeader,
          close: classes.modalClose,
        }}
      >
        <AssignmentForm
          title={formTitle}
          setTitle={setFormTitle}
          desc={formDesc}
          setDesc={setFormDesc}
          dueDate={formDueDate}
          setDueDate={setFormDueDate}
          maxScore={formMaxScore}
          setMaxScore={setFormMaxScore}
          language={formLanguage}
          setLanguage={setFormLanguage}
          status={formStatus}
          setStatus={setFormStatus}
          formError={formError}
          submitting={submitting}
          onSubmit={handleUpdate}
          onCancel={() => setEditOpen(false)}
          submitLabel="Save"
        />
      </Modal>

      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Assignment"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="red"
      />
    </Stack>
  );
}

interface FormProps {
  title: string;
  setTitle: (v: string) => void;
  desc: string;
  setDesc: (v: string) => void;
  dueDate: string;
  setDueDate: (v: string) => void;
  maxScore: number | string;
  setMaxScore: (v: number | string) => void;
  language: string | null;
  setLanguage: (v: string | null) => void;
  status: string | null;
  setStatus: (v: string | null) => void;
  formError: string;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}

function AssignmentForm({
  title,
  setTitle,
  desc,
  setDesc,
  dueDate,
  setDueDate,
  maxScore,
  setMaxScore,
  status,
  setStatus,
  formError,
  submitting,
  onSubmit,
  onCancel,
  submitLabel,
}: FormProps) {
  return (
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
        label="Title"
        placeholder="e.g. Week 1 — Hello World"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        classNames={{ input: classes.input, label: classes.label }}
      />
      <Textarea
        label="Description"
        placeholder="Assignment description (optional)"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        rows={3}
        classNames={{ input: classes.input, label: classes.label }}
      />
      <Group grow>
        <TextInput
          label="Language"
          value="Python"
          disabled
          classNames={{ input: classes.input, label: classes.label }}
        />
        <Select
          label="Status"
          data={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
          classNames={{ input: classes.input, label: classes.label }}
        />
      </Group>
      <Group grow>
        <NumberInput
          label="Max Score"
          value={maxScore}
          onChange={setMaxScore}
          min={1}
          classNames={{ input: classes.input, label: classes.label }}
        />
        <TextInput
          label="Due Date"
          type="datetime-local"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          classNames={{ input: classes.input, label: classes.label }}
        />
      </Group>
      <Group justify="flex-end" mt="xs">
        <Button variant="subtle" color="gray" onClick={onCancel}>
          Cancel
        </Button>
        <Button className={classes.createButton} onClick={onSubmit} loading={submitting}>
          {submitLabel}
        </Button>
      </Group>
    </Stack>
  );
}
