import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Text,
  Group,
  Stack,
  Tabs,
  Badge,
  Button,
  ActionIcon,
  Loader,
  Center,
  Alert,
  Card,
  Tooltip,
  CopyButton,
  Modal,
  TextInput,
  Textarea,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconUsers,
  IconSettings,
  IconCopy,
  IconCheck,
  IconRefresh,
  IconUserMinus,
  IconAlertCircle,
  IconTrash,
  IconChartBar,
  IconBook,
  IconFlask,
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTeacherClasses, Class, ClassStudent } from '../hooks/useTeacherClasses';
import { useTeacherAssignments } from '../hooks/useTeacherAssignments';
import ConfirmModal from '../components/ConfirmModal';
import classes from './TeacherClassPage.module.css';
import GradesTab from '../components/GradesTab';
import AssignmentsTab from '../components/AssignmentsTab';
import TeacherExamTab from '../components/TeacherExamTab';

const getErrorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : 'An unexpected error occurred';

export default function TeacherClassPage() {
  const { classId } = useParams<{ classId: string }>();
  const { assignments } = useTeacherAssignments(classId!);
  const navigate = useNavigate();
  const { getClassDetails, updateClass, regenerateCode, removeStudent, deleteClass } =
    useTeacherClasses();

  const [classData, setClassData] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false);
  const [removeStudentTarget, setRemoveStudentTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const fetchClass = useCallback(async () => {
    if (!classId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getClassDetails(classId);
      setClassData(data);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [classId, getClassDetails]);

  useEffect(() => {
    fetchClass();
  }, [fetchClass]);

  const handleEdit = async () => {
    if (!classId || !formName.trim()) return setFormError('Class name is required');
    try {
      setSubmitting(true);
      setFormError('');
      await updateClass(classId, formName.trim(), formDesc.trim());
      await fetchClass();
      setEditOpen(false);
    } catch (e: unknown) {
      setFormError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerate = async () => {
    if (!classId) return;
    try {
      await regenerateCode(classId);
      await fetchClass();
      setRegenerateConfirmOpen(false);
    } catch (e: unknown) {
      alert(getErrorMessage(e));
    }
  };

  const handleRemoveStudent = async () => {
    if (!classId || !removeStudentTarget) return;
    try {
      await removeStudent(classId, removeStudentTarget.id);
      await fetchClass();
      setRemoveStudentTarget(null);
    } catch (e: unknown) {
      alert(getErrorMessage(e));
    }
  };

  const handleDelete = async () => {
    if (!classId) return;
    try {
      await deleteClass(classId);
      navigate('/teacher/classes');
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
      <Alert icon={<IconAlertCircle />} color="red" m="xl">
        {error}
      </Alert>
    );
  if (!classData) return null;

  const memberList = (classData.members ?? []) as ClassStudent[];

  return (
    <Box className={classes.container}>
      <Group mb="xl" justify="space-between" align="flex-start">
        <Group gap="md">
          <ActionIcon
            aria-label="Go back"
            variant="subtle"
            className={classes.backButton}
            onClick={() => navigate('/teacher/classes')}
          >
            <IconArrowLeft size={18} />
          </ActionIcon>
          <div>
            <Text className={classes.title}>{classData.name}</Text>
            {classData.description && (
              <Text className={classes.subtitle}>{classData.description}</Text>
            )}
          </div>
        </Group>
        <Group gap="xs">
          <Button
            size="xs"
            variant="subtle"
            className={classes.editButton}
            leftSection={<IconSettings size={14} />}
            onClick={() => {
              setFormName(classData.name);
              setFormDesc(classData.description || '');
              setFormError('');
              setEditOpen(true);
            }}
          >
            Edit
          </Button>
          <Button
            size="xs"
            variant="subtle"
            color="red"
            leftSection={<IconTrash size={14} />}
            onClick={() => setDeleteConfirmOpen(true)}
          >
            Delete Class
          </Button>
        </Group>
      </Group>

      <Tabs
        defaultValue="members"
        classNames={{
          root: classes.tabs,
          tab: classes.tab,
          panel: classes.tabPanel,
        }}
      >
        <Tabs.List mb="xl">
          <Tabs.Tab value="members" leftSection={<IconUsers size={14} />}>
            Members ({memberList.length})
          </Tabs.Tab>
          <Tabs.Tab value="overview" leftSection={<IconSettings size={14} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="grades" leftSection={<IconChartBar size={14} />}>
            Grades
          </Tabs.Tab>
          <Tabs.Tab value="assignments" leftSection={<IconBook size={14} />}>
            Assignments
          </Tabs.Tab>
          <Tabs.Tab value="exams" leftSection={<IconFlask size={14} />}>
            Exams
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="members">
          {memberList.length === 0 ? (
            <Box className={classes.empty}>
              <Text c="dimmed">No students enrolled yet</Text>
              <Text size="sm" c="dimmed" mt={4}>
                Share the join code below to invite students
              </Text>
            </Box>
          ) : (
            <Stack gap="sm">
              {memberList.map((member) => (
                <Card key={member.id} className={classes.memberCard}>
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" c="white" fw={500}>
                        {member.student.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {member.student.email}
                      </Text>
                    </div>
                    <Tooltip label="Remove student">
                      <ActionIcon
                        aria-label={`Remove ${member.student.name}`}
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={() =>
                          setRemoveStudentTarget({
                            id: member.studentId,
                            name: member.student.name,
                          })
                        }
                      >
                        <IconUserMinus size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="overview">
          <Stack gap="md" maw={500}>
            <Card className={classes.overviewCard}>
              <Text className={classes.sectionLabel}>Join Code</Text>
              <Group gap="sm">
                <Text className={classes.joinCode}>{classData.joinCode}</Text>
                <CopyButton value={classData.joinCode} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied!' : 'Copy join code'}>
                      <ActionIcon
                        aria-label="Copy join code"
                        size="sm"
                        variant="subtle"
                        className={classes.iconButton}
                        onClick={copy}
                      >
                        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
                <Tooltip label="Regenerate code">
                  <ActionIcon
                    aria-label="Regenerate join code"
                    size="sm"
                    variant="subtle"
                    className={classes.iconButton}
                    onClick={() => setRegenerateConfirmOpen(true)}
                  >
                    <IconRefresh size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Card>

            <Card className={classes.overviewCard}>
              <Text className={classes.sectionLabel}>Class Info</Text>
              <Stack gap={4}>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Students enrolled
                  </Text>
                  <Badge variant="light" color="violet">
                    {memberList.length}
                  </Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Created
                  </Text>
                  <Text size="sm" c="white">
                    {new Date(classData.createdAt).toLocaleDateString()}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Last updated
                  </Text>
                  <Text size="sm" c="white">
                    {new Date(classData.updatedAt).toLocaleDateString()}
                  </Text>
                </Group>
              </Stack>
            </Card>
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="grades">
          <GradesTab classId={classData.id} members={memberList} assignments={assignments} />
        </Tabs.Panel>
        <Tabs.Panel value="assignments">
          <AssignmentsTab classId={classData.id} members={memberList} />
        </Tabs.Panel>
        <Tabs.Panel value="exams">
          <TeacherExamTab classId={classData.id} />
        </Tabs.Panel>
      </Tabs>

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
            radius="sm"
            label="Class Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            classNames={{ input: classes.input, label: classes.label }}
            required
          />
          <Textarea
            radius="sm"
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
            <Button className={classes.saveButton} onClick={handleEdit} loading={submitting}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmModal
        opened={regenerateConfirmOpen}
        onClose={() => setRegenerateConfirmOpen(false)}
        onConfirm={handleRegenerate}
        title="Regenerate Join Code"
        message="The old join code will stop working immediately. Students will need the new code to join."
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

      <ConfirmModal
        opened={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Class"
        message={`Delete "${classData?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="red"
      />
    </Box>
  );
}
