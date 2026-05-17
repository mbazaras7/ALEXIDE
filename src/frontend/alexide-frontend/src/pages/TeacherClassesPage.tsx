import React, { useState } from 'react';
import {
  Box,
  Button,
  Text,
  Group,
  Stack,
  Modal,
  TextInput,
  Textarea,
  Badge,
  ActionIcon,
  Tooltip,
  Loader,
  Center,
  Alert,
  Card,
  CopyButton,
  ScrollArea,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconEdit,
  IconRefresh,
  IconUsers,
  IconCopy,
  IconCheck,
  IconAlertCircle,
  IconUserMinus,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTeacherClasses, Class } from '../hooks/useTeacherClasses';
import ConfirmModal from '../components/ConfirmModal';
import classes from './TeacherClassesPage.module.css';

const getErrorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : 'An unexpected error occurred';

export default function TeacherClassesPage() {
  const {
    classes: classList,
    loading,
    error,
    createClass,
    updateClass,
    deleteClass,
    regenerateCode,
    removeStudent,
    getClassDetails,
  } = useTeacherClasses();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [classDetails, setClassDetails] = useState<Class | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<string | null>(null);
  const [removeStudentTarget, setRemoveStudentTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!formName.trim()) return setFormError('Class name is required');
    try {
      setSubmitting(true);
      setFormError('');
      await createClass(formName.trim(), formDesc.trim());
      setCreateOpen(false);
      setFormName('');
      setFormDesc('');
    } catch (e: unknown) {
      setFormError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedClass || !formName.trim()) return setFormError('Class name is required');
    try {
      setSubmitting(true);
      setFormError('');
      await updateClass(selectedClass.id, formName.trim(), formDesc.trim());
      setEditOpen(false);
    } catch (e: unknown) {
      setFormError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteClass(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e: unknown) {
      alert(getErrorMessage(e));
    }
  };

  const handleRegenerate = async () => {
    if (!regenerateTarget) return;
    try {
      await regenerateCode(regenerateTarget);
      setRegenerateTarget(null);
    } catch (e: unknown) {
      alert(getErrorMessage(e));
    }
  };

  const handleViewMembers = async (cls: Class) => {
    try {
      const details = await getClassDetails(cls.id);
      setClassDetails(details);
      setMembersOpen(true);
    } catch (e: unknown) {
      alert(getErrorMessage(e));
    }
  };

  const handleRemoveStudent = async () => {
    if (!classDetails || !removeStudentTarget) return;
    try {
      await removeStudent(classDetails.id, removeStudentTarget.id);
      const updated = await getClassDetails(classDetails.id);
      setClassDetails(updated);
      setRemoveStudentTarget(null);
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
            {classList.length} class{classList.length !== 1 ? 'es' : ''}
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          className={classes.createButton}
          onClick={() => {
            setFormName('');
            setFormDesc('');
            setFormError('');
            setCreateOpen(true);
          }}
        >
          Create Class
        </Button>
      </Group>

      {classList.length === 0 ? (
        <Box className={classes.empty}>
          <Text size="lg" c="dimmed">
            No classes yet
          </Text>
          <Text size="sm" c="dimmed" mt={4}>
            Create your first class to get started
          </Text>
        </Box>
      ) : (
        <Stack gap="md">
          {classList.map((cls) => (
            <Card
              key={cls.id}
              className={classes.card}
              onClick={() => navigate(`/teacher/classes/${cls.id}`)}
            >
              <Group justify="space-between" align="flex-start">
                <div style={{ flex: 1 }}>
                  <Text className={classes.className}>{cls.name}</Text>
                  {cls.description && <Text className={classes.classDesc}>{cls.description}</Text>}
                  <Group gap="xs" mt="sm">
                    <Badge className={classes.codeBadge} variant="light">
                      {cls.joinCode}
                    </Badge>
                    <CopyButton value={cls.joinCode} timeout={2000}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'Copied!' : 'Copy join code'}>
                          <ActionIcon
                            aria-label="Copy Join Code"
                            size="sm"
                            variant="subtle"
                            className={classes.iconButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              copy();
                            }}
                          >
                            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                    <Tooltip label="Regenerate code">
                      <ActionIcon
                        aria-label="Regenerate code"
                        size="sm"
                        variant="subtle"
                        className={classes.iconButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRegenerateTarget(cls.id);
                        }}
                      >
                        <IconRefresh size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </div>
                <Group gap="xs">
                  <Tooltip label="View members">
                    <ActionIcon
                      aria-label="View members"
                      variant="subtle"
                      className={classes.iconButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewMembers(cls);
                      }}
                    >
                      <IconUsers size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Edit class">
                    <ActionIcon
                      aria-label="Edit class"
                      variant="subtle"
                      className={classes.iconButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClass(cls);
                        setFormName(cls.name);
                        setFormDesc(cls.description || '');
                        setFormError('');
                        setEditOpen(true);
                      }}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Delete class">
                    <ActionIcon
                      aria-label="Delete class"
                      variant="subtle"
                      color="red"
                      className={classes.iconButtonDanger}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ id: cls.id, name: cls.name });
                      }}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create New Class"
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
            label="Class Name"
            placeholder="e.g. Python Fundamentals"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            classNames={{ input: classes.input, label: classes.label }}
            required
          />
          <Textarea
            label="Description"
            placeholder="Optional description..."
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            classNames={{ input: classes.input, label: classes.label }}
            rows={3}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button className={classes.createButton} onClick={handleCreate} loading={submitting}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Class"
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
            label="Class Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            classNames={{ input: classes.input, label: classes.label }}
            required
          />
          <Textarea
            label="Description"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            classNames={{ input: classes.input, label: classes.label }}
            rows={3}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button className={classes.createButton} onClick={handleEdit} loading={submitting}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={membersOpen}
        onClose={() => setMembersOpen(false)}
        title={`${classDetails?.name} — Members`}
        size="md"
        classNames={{
          content: classes.modalContent,
          header: classes.modalHeader,
          close: classes.modalClose,
        }}
      >
        <ScrollArea h={300}>
          {!classDetails?.members || classDetails.members.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No students enrolled yet
            </Text>
          ) : (
            <Stack gap="xs">
              {classDetails.members.map((member) => (
                <Group key={member.id} justify="space-between" className={classes.memberRow}>
                  <div>
                    <Text size="sm" c="white">
                      {member.student.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {member.student.email}
                    </Text>
                  </div>
                  <Tooltip label="Remove student">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() =>
                        setRemoveStudentTarget({ id: member.studentId, name: member.student.name })
                      }
                    >
                      <IconUserMinus size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              ))}
            </Stack>
          )}
        </ScrollArea>
      </Modal>

      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Class"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="red"
      />

      <ConfirmModal
        opened={!!regenerateTarget}
        onClose={() => setRegenerateTarget(null)}
        onConfirm={handleRegenerate}
        title="Regenerate Join Code"
        message="The old join code will stop working immediately."
        confirmLabel="Regenerate"
        confirmColor="orange"
      />

      <ConfirmModal
        opened={!!removeStudentTarget}
        onClose={() => setRemoveStudentTarget(null)}
        onConfirm={handleRemoveStudent}
        title="Remove Student"
        message={`Remove ${removeStudentTarget?.name} from this class?`}
        confirmLabel="Remove"
        confirmColor="red"
      />
    </Box>
  );
}
