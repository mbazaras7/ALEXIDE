import React, { useState } from 'react';
import {
  Stack,
  Group,
  Text,
  Card,
  Badge,
  ActionIcon,
  Tooltip,
  Modal,
  TextInput,
  NumberInput,
  Select,
  Button,
  Alert,
  Loader,
  Center,
} from '@mantine/core';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconSend,
  IconAlertCircle,
  IconCheck,
  IconExternalLink,
} from '@tabler/icons-react';
import { useTeacherGrades, Grade, SourceType } from '../hooks/useTeacherGrades';
import { ClassStudent } from '../hooks/useTeacherClasses';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from './ConfirmModal';
import classes from './GradesTab.module.css';

const getErrorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : 'An unexpected error occurred';

interface GradesTabProps {
  classId: string;
  members: ClassStudent[];
  assignments: { id: string; title: string }[];
}

const SOURCE_TYPE_OPTIONS = [
  { value: 'ASSIGNMENT', label: 'Assignment' },
  { value: 'EXAM', label: 'Exam' },
];

const SOURCE_TYPE_COLOURS: Record<SourceType, string> = {
  ASSIGNMENT: 'blue',
  EXAM: 'orange',
};

export default function GradesTab({ classId, members, assignments }: GradesTabProps) {
  const { grades, loading, error, recordGrade, updateGrade, deleteGrade, releaseGrades } =
    useTeacherGrades(classId);

  const [recordOpen, setRecordOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);

  const [formStudentId, setFormStudentId] = useState<string | null>(null);
  const [formSourceType, setFormSourceType] = useState<string | null>('ASSIGNMENT');
  const [formSourceId, setFormSourceId] = useState('');
  const [formScore, setFormScore] = useState<number | string>(0);
  const [formMaxScore, setFormMaxScore] = useState<number | string>(100);

  const [editScore, setEditScore] = useState<number | string>(0);
  const [editMaxScore, setEditMaxScore] = useState<number | string>(100);

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<{
    sourceType: SourceType;
    sourceId: string;
    title: string;
  } | null>(null);

  const navigate = useNavigate();

  const studentOptions = members.map((m) => ({
    value: m.studentId,
    label: `${m.student.name} (${m.student.email})`,
  }));

  const resetRecordForm = () => {
    setFormStudentId(null);
    setFormSourceType('ASSIGNMENT');
    setFormSourceId('');
    setFormScore(0);
    setFormMaxScore(100);
    setFormError('');
  };

  const resolveLabel = (sourceType: string, sourceId: string) => {
    if (sourceType === 'ASSIGNMENT') {
      return assignments.find((a) => a.id === sourceId)?.title ?? sourceId;
    }
    return sourceId;
  };

  const handleRecord = async () => {
    if (!formStudentId) return setFormError('Please select a student');
    if (!formSourceId.trim()) return setFormError('Please enter a source label');
    if (Number(formScore) < 0) return setFormError('Score cannot be negative');
    if (Number(formMaxScore) <= 0) return setFormError('Max score must be greater than 0');
    if (Number(formScore) > Number(formMaxScore))
      return setFormError('Score cannot exceed max score');

    try {
      setSubmitting(true);
      setFormError('');
      await recordGrade({
        studentId: formStudentId,
        sourceType: formSourceType as SourceType,
        sourceId: formSourceId.trim(),
        score: Number(formScore),
        maxScore: Number(formMaxScore),
      });
      setRecordOpen(false);
      resetRecordForm();
    } catch (e: unknown) {
      setFormError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedGrade) return;
    if (Number(editScore) > Number(editMaxScore))
      return setFormError('Score cannot exceed max score');
    try {
      setSubmitting(true);
      setFormError('');
      await updateGrade(selectedGrade.id, Number(editScore), Number(editMaxScore));
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
      await deleteGrade(deleteTarget);
      setDeleteTarget(null);
    } catch (e: unknown) {
      alert(getErrorMessage(e));
    }
  };

  const handleRelease = async () => {
    if (!releaseTarget) return;
    try {
      await releaseGrades(releaseTarget.sourceType, releaseTarget.sourceId);
      setReleaseTarget(null);
    } catch (e: unknown) {
      alert(getErrorMessage(e));
    }
  };

  const grouped = grades.reduce<Record<string, Grade[]>>((acc, grade) => {
    const key = `${grade.sourceType}__${grade.sourceId}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(grade);
    return acc;
  }, {});

  if (loading)
    return (
      <Center h={200}>
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
          className={classes.recordButton}
          onClick={() => {
            resetRecordForm();
            setRecordOpen(true);
          }}
        >
          Record Grade
        </Button>
      </Group>

      {grades.length === 0 ? (
        <div className={classes.empty}>
          <Text c="dimmed">No grades recorded yet</Text>
          <Text size="sm" c="dimmed" mt={4}>
            Click "Record Grade" to add one
          </Text>
        </div>
      ) : (
        Object.entries(grouped).map(([key, groupGrades]) => {
          const [sourceType, sourceId] = key.split('__');
          const allReleased = groupGrades.every((g) => g.releasedAt !== null);
          const linkedAssignment =
            sourceType === 'ASSIGNMENT' ? assignments.find((a) => a.id === sourceId) : null;

          return (
            <Card key={key} className={classes.groupCard}>
              <Group justify="space-between" mb="sm">
                <Group gap="xs">
                  <Badge
                    color={SOURCE_TYPE_COLOURS[sourceType as SourceType]}
                    variant="light"
                    size="sm"
                  >
                    {sourceType}
                  </Badge>
                  <Text fw={600} c="white" size="sm">
                    {resolveLabel(sourceType, sourceId)}
                  </Text>
                  <Text c="dimmed" size="xs">
                    ({groupGrades.length} student{groupGrades.length !== 1 ? 's' : ''})
                  </Text>
                </Group>
                <Group gap="xs">
                  {linkedAssignment && (
                    <Tooltip label="View submissions">
                      <Button
                        size="xs"
                        variant="subtle"
                        leftSection={<IconExternalLink size={12} />}
                        className={classes.releaseButton}
                        onClick={() =>
                          navigate(`/teacher/assignments/${sourceId}`, {
                            state: { tab: 'submissions' },
                          })
                        }
                      >
                        Submissions
                      </Button>
                    </Tooltip>
                  )}
                  {!allReleased && (
                    <Tooltip label="Release grades to students">
                      <Button
                        size="xs"
                        variant="subtle"
                        leftSection={<IconSend size={12} />}
                        className={classes.releaseButton}
                        onClick={() =>
                          setReleaseTarget({
                            sourceType: sourceType as SourceType,
                            sourceId,
                            title: resolveLabel(sourceType, sourceId),
                          })
                        }
                      >
                        Release
                      </Button>
                    </Tooltip>
                  )}
                  {allReleased && (
                    <Badge
                      color="green"
                      variant="light"
                      size="sm"
                      leftSection={<IconCheck size={10} />}
                    >
                      Released
                    </Badge>
                  )}
                </Group>
              </Group>

              <Stack gap="xs">
                {groupGrades.map((grade) => {
                  return (
                    <Group key={grade.id} justify="space-between" className={classes.gradeRow}>
                      <div>
                        <Text size="sm" c="white">
                          {grade.student?.name ?? 'Unknown'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {grade.student?.email}
                        </Text>
                      </div>
                      <Group gap="sm">
                        <Text className={classes.score}>
                          {grade.score} / {grade.maxScore}
                          <Text span size="xs" c="dimmed" ml={4}>
                            ({grade.percentage}%)
                          </Text>
                        </Text>
                        <Tooltip label="Edit grade">
                          <ActionIcon
                            aria-label={`Edit grade for ${grade.student?.name}`}
                            size="sm"
                            variant="subtle"
                            className={classes.iconButton}
                            onClick={() => {
                              setSelectedGrade(grade);
                              setEditScore(grade.score);
                              setEditMaxScore(grade.maxScore);
                              setFormError('');
                              setEditOpen(true);
                            }}
                          >
                            <IconEdit size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete grade">
                          <ActionIcon
                            aria-label={`Delete grade for ${grade.student?.name}`}
                            size="sm"
                            variant="subtle"
                            color="red"
                            onClick={() => setDeleteTarget(grade.id)}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                  );
                })}
              </Stack>
            </Card>
          );
        })
      )}

      <Modal
        opened={recordOpen}
        onClose={() => setRecordOpen(false)}
        title="Record Grade"
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
          <Select
            label="Student"
            placeholder="Select a student"
            data={studentOptions}
            value={formStudentId}
            onChange={setFormStudentId}
            classNames={{ input: classes.input, label: classes.label }}
            required
          />
          <Select
            label="Type"
            data={SOURCE_TYPE_OPTIONS}
            value={formSourceType}
            onChange={setFormSourceType}
            classNames={{ input: classes.input, label: classes.label }}
          />
          <TextInput
            label="Source Label"
            placeholder="e.g. Week 1 Assignment, Midterm Exam"
            value={formSourceId}
            onChange={(e) => setFormSourceId(e.target.value)}
            classNames={{ input: classes.input, label: classes.label }}
            required
          />
          <Group grow>
            <NumberInput
              label="Score"
              value={formScore}
              onChange={setFormScore}
              min={0}
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
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setRecordOpen(false)}>
              Cancel
            </Button>
            <Button className={classes.recordButton} onClick={handleRecord} loading={submitting}>
              Record
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Grade"
        classNames={{
          content: classes.modalContent,
          header: classes.modalHeader,
          close: classes.modalClose,
        }}
      >
        <Stack gap="md">
          {selectedGrade && (
            <Text size="sm" c="dimmed" mt="xs">
              Editing grade for{' '}
              <Text span c="white">
                {selectedGrade.student?.name}
              </Text>{' '}
              — {resolveLabel(selectedGrade.sourceType, selectedGrade.sourceId)}
            </Text>
          )}
          {formError && (
            <Alert
              color="red"
              icon={<IconAlertCircle size={16} />}
              classNames={{ root: classes.alert, message: classes.alertMessage }}
            >
              {formError}
            </Alert>
          )}
          <Group grow>
            <NumberInput
              label="Score"
              value={editScore}
              onChange={setEditScore}
              min={0}
              classNames={{ input: classes.input, label: classes.label }}
            />
            <NumberInput
              label="Max Score"
              value={editMaxScore}
              onChange={setEditMaxScore}
              min={1}
              classNames={{ input: classes.input, label: classes.label }}
            />
          </Group>
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button className={classes.recordButton} onClick={handleEdit} loading={submitting}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Grade"
        message="Are you sure you want to delete this grade?"
        confirmLabel="Delete"
        confirmColor="red"
      />

      <ConfirmModal
        opened={!!releaseTarget}
        onClose={() => setReleaseTarget(null)}
        onConfirm={handleRelease}
        title="Release Grades"
        message={`Release all grades for "${releaseTarget?.title}" to students? They will be able to see their scores.`}
        confirmLabel="Release"
        confirmColor="green"
      />
    </Stack>
  );
}
