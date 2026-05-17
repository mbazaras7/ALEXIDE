import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Tabs,
  Text,
  Group,
  Badge,
  Button,
  Stack,
  Card,
  Loader,
  Center,
  Alert,
  ActionIcon,
  Modal,
  TextInput,
  Textarea,
  NumberInput,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconUsers,
  IconTestPipe,
  IconCheck,
  IconPlus,
  IconEye,
  IconClock,
  IconCalendar,
  IconAlertCircle,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useTeacherExamDetails } from '../hooks/useTeacherExamDetails';
import { useTeacherExamSocket } from '../hooks/useTeacherExamSocket';
import type { MonitoredStudent } from '../hooks/useTeacherExamSocket';
import type { ExamQuestion, ExamSessionMonitor } from '../hooks/useTeacherExamDetails';
import { useTeacherExams } from '../hooks/useTeacherExams';
import ConfirmModal from '../components/ConfirmModal';
import classes from './TeacherExamPage.module.css';

const STATUS_COLOUR: Record<string, string> = {
  ACTIVE: 'green',
  SCHEDULED: 'blue',
  COMPLETED: 'gray',
  CANCELLED: 'red',
  DRAFT: 'yellow',
};

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
          status: s.isSubmitted ? 'submitted' : 'active',
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

export default function TeacherExamPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const [deleteExamConfirmOpen, setDeleteExamConfirmOpen] = useState(false);
  const [deleteQuestionTarget, setDeleteQuestionTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const {
    exam,
    questions,
    sessions,
    loading,
    error,
    fetchAll,
    updateStatus,
    addQuestion,
    deleteQuestion,
    addTestCase,
    deleteTestCase,
  } = useTeacherExamDetails(examId!);

  const { deleteExam } = useTeacherExams(exam?.classId ?? '');

  const { students: liveStudents } = useTeacherExamSocket({
    examId: examId!,
    enabled: !!exam && exam.status === 'ACTIVE',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam?.id, exam?.status, exam?.scheduledEnd, fetchAll]);

  const mergedStudents = useMemo(
    () => mergeStudents(liveStudents, sessions),
    [liveStudents, sessions]
  );

  const backPath = exam?.classId ? `/teacher/classes/${exam.classId}` : '/teacher/dashboard';
  const initialTab = 'questions';

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleStatusUpdate = useCallback(
    async (newStatus: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED') => {
      try {
        setStatusUpdating(true);
        setActionError(null);
        await updateStatus(newStatus);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Action failed');
      } finally {
        setStatusUpdating(false);
      }
    },
    [updateStatus]
  );

  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    try {
      setDeleting(true);
      await deleteExam(examId!);
      navigate(`/teacher/classes/${exam?.classId}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleting(false);
      setDeleteExamConfirmOpen(false);
    }
  }, [deleteExam, examId, exam?.classId, navigate]);

  const [questionOpen, setQuestionOpen] = useState(false);
  const [qTitle, setQTitle] = useState('');
  const [qDesc, setQDesc] = useState('');
  const [qMaxScore, setQMaxScore] = useState<number | string>(10);
  const [qSubmitting, setQSubmitting] = useState(false);
  const [qFormError, setQFormError] = useState<string | null>(null);

  const resetQuestionForm = () => {
    setQTitle('');
    setQDesc('');
    setQMaxScore(10);
    setQFormError(null);
  };

  const handleAddQuestion = useCallback(async () => {
    if (!qTitle.trim()) {
      setQFormError('Title is required');
      return;
    }
    try {
      setQSubmitting(true);
      setQFormError(null);
      await addQuestion({ title: qTitle, description: qDesc, maxScore: Number(qMaxScore) });
      setQuestionOpen(false);
      resetQuestionForm();
    } catch (e) {
      setQFormError(e instanceof Error ? e.message : 'Failed to add question');
    } finally {
      setQSubmitting(false);
    }
  }, [qTitle, qDesc, qMaxScore, addQuestion]);

  const handleDeleteQuestion = useCallback(async () => {
    if (!deleteQuestionTarget) return;
    await deleteQuestion(deleteQuestionTarget.id);
    setDeleteQuestionTarget(null);
  }, [deleteQuestion, deleteQuestionTarget]);

  const [testCaseOpen, setTestCaseOpen] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [tcName, setTcName] = useState('');
  const [tcInput, setTcInput] = useState('');
  const [tcExpected, setTcExpected] = useState('');
  const [tcSubmitting, setTcSubmitting] = useState(false);
  const [tcFormError, setTcFormError] = useState<string | null>(null);

  const resetTestCaseForm = () => {
    setTcName('');
    setTcInput('');
    setTcExpected('');
    setTcFormError(null);
  };

  const handleAddTestCase = useCallback(async () => {
    if (!tcName.trim()) {
      setTcFormError('Name is required');
      return;
    }
    if (!tcExpected.trim()) {
      setTcFormError('Expected output is required');
      return;
    }
    if (!activeQuestionId) return;
    try {
      setTcSubmitting(true);
      setTcFormError(null);
      await addTestCase(activeQuestionId, {
        name: tcName,
        inputData: tcInput,
        expectedOutput: tcExpected,
      });
      setTestCaseOpen(false);
      resetTestCaseForm();
    } catch (e) {
      setTcFormError(e instanceof Error ? e.message : 'Failed to add test case');
    } finally {
      setTcSubmitting(false);
    }
  }, [tcName, tcInput, tcExpected, activeQuestionId, addTestCase]);

  const handleDeleteTestCase = useCallback(
    async (qId: string, tcId: string) => {
      await deleteTestCase(qId, tcId);
    },
    [deleteTestCase]
  );

  if (loading)
    return (
      <Center h="100vh">
        <Loader color="violet" />
      </Center>
    );
  if (error || !exam)
    return (
      <Alert color="red" m="md">
        {error ?? 'Exam not found'}
      </Alert>
    );

  return (
    <Box className={classes.container}>
      <Group mb="xl" justify="space-between" align="flex-start">
        <Group gap="md">
          <ActionIcon
            variant="subtle"
            className={classes.backButton}
            onClick={() => navigate(backPath)}
            aria-label="Go back"
          >
            <IconArrowLeft size={18} />
          </ActionIcon>
          <div>
            <Group gap="xs" mb={4}>
              <Badge color={STATUS_COLOUR[exam.status]} variant="light" size="sm">
                {exam.status}
              </Badge>
              <Badge color="violet" variant="light" size="sm">
                {exam.language}
              </Badge>
              <Badge color={exam.isOpenBook ? 'blue' : 'gray'} variant="light" size="sm">
                {exam.isOpenBook ? 'Open-book' : 'Closed-book'}
              </Badge>
            </Group>
            <Text className={classes.title}>{exam.title}</Text>
            {exam.instructions && <Text className={classes.subtitle}>{exam.instructions}</Text>}
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
        </Group>

        <Group gap="xs">
          {exam.status === 'ACTIVE' && (
            <Button
              size="xs"
              variant="light"
              color="violet"
              leftSection={<IconEye size={13} />}
              onClick={() => navigate(`/teacher/exams/${exam.id}/monitor`)}
            >
              Monitor Live
            </Button>
          )}
          {exam.status === 'DRAFT' && (
            <Button
              size="xs"
              leftSection={<IconCheck size={14} />}
              className={classes.publishButton}
              onClick={() => handleStatusUpdate('SCHEDULED')}
              loading={statusUpdating}
            >
              Publish
            </Button>
          )}
          {exam.status === 'DRAFT' && (
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              className={classes.addButton}
              onClick={() => {
                resetQuestionForm();
                setQuestionOpen(true);
              }}
            >
              Add Question
            </Button>
          )}
          {exam.status === 'SCHEDULED' && (
            <Button
              size="xs"
              variant="light"
              color="orange"
              loading={statusUpdating}
              leftSection={<IconX size={14} />}
              onClick={() => handleStatusUpdate('CANCELLED')}
            >
              Cancel Exam
            </Button>
          )}

          {exam.status !== 'ACTIVE' && (
            <Button
              size="xs"
              variant="subtle"
              color="red"
              loading={deleting}
              leftSection={<IconTrash size={14} />}
              onClick={() => setDeleteExamConfirmOpen(true)}
            >
              Delete
            </Button>
          )}
        </Group>
      </Group>

      {actionError && (
        <Alert color="red" mb="md" withCloseButton onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <Tabs defaultValue={initialTab} classNames={{ tab: classes.tab, panel: classes.tabPanel }}>
        <Tabs.List mb="xl">
          <Tabs.Tab value="questions" leftSection={<IconTestPipe size={14} />}>
            Questions ({questions.length})
          </Tabs.Tab>
          <Tabs.Tab value="sessions" leftSection={<IconUsers size={14} />}>
            Sessions ({mergedStudents.length})
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="questions">
          {questions.length === 0 ? (
            <div className={classes.empty}>
              <IconTestPipe size={32} color="violet" />
              <Text c="dimmed" mt="sm">
                No questions yet
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                {exam.status === 'DRAFT'
                  ? 'Click "Add Question" to create the first question.'
                  : 'No questions were added to this exam.'}
              </Text>
            </div>
          ) : (
            <Stack gap="md">
              {questions.map((q, index) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={index}
                  isDraft={exam.status === 'DRAFT'}
                  onDeleteQuestion={() => setDeleteQuestionTarget({ id: q.id, title: q.title })}
                  onAddTestCase={() => {
                    resetTestCaseForm();
                    setActiveQuestionId(q.id);
                    setTestCaseOpen(true);
                  }}
                  onDeleteTestCase={(tcId) => handleDeleteTestCase(q.id, tcId)}
                />
              ))}
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="sessions">
          {mergedStudents.length === 0 ? (
            <div className={classes.empty}>
              <IconUsers size={32} color="violet" />
              <Text c="dimmed" mt="sm">
                No sessions yet
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                Students who join will appear here.
              </Text>
            </div>
          ) : (
            <Stack gap="sm">
              {mergedStudents.map((s) => (
                <Card key={s.studentId} className={classes.sessionCard}>
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Group gap="xs" mb={4}>
                        <Badge
                          color={s.status === 'submitted' ? 'green' : s.isOnline ? 'blue' : 'gray'}
                          variant={s.status === 'submitted' ? 'filled' : 'light'}
                          size="sm"
                          leftSection={
                            s.status === 'submitted' ? <IconCheck size={10} /> : undefined
                          }
                        >
                          {s.status === 'submitted'
                            ? 'Submitted'
                            : s.isOnline
                              ? 'In Progress'
                              : 'Offline'}
                        </Badge>
                        {s.tabSwitchCounter > 0 && (
                          <Badge
                            color={s.tabSwitchCounter >= 3 ? 'red' : 'yellow'}
                            variant="light"
                            size="sm"
                          >
                            {s.tabSwitchCounter} tab switch{s.tabSwitchCounter !== 1 ? 'es' : ''}
                          </Badge>
                        )}
                      </Group>
                      <Text size="sm" fw={500} c="white">
                        {s.name}
                      </Text>
                      <Group gap="md" mt={4}>
                        <Text size="xs" c="dimmed">
                          Joined {new Date(s.joinedAt).toLocaleString()}
                        </Text>
                        {s.submittedAt && (
                          <Text size="xs" c="dimmed">
                            Submitted {new Date(s.submittedAt).toLocaleString()}
                          </Text>
                        )}
                      </Group>
                    </div>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={questionOpen}
        onClose={() => setQuestionOpen(false)}
        title="Add Question"
        classNames={{
          content: classes.modalContent,
          header: classes.modalHeader,
          close: classes.modalClose,
        }}
      >
        <Stack gap="md">
          {qFormError && (
            <Alert
              color="red"
              icon={<IconAlertCircle size={16} />}
              classNames={{ root: classes.alert }}
            >
              {qFormError}
            </Alert>
          )}
          <TextInput
            label="Title"
            placeholder="e.g. FizzBuzz"
            value={qTitle}
            onChange={(e) => setQTitle(e.target.value)}
            required
            classNames={{ input: classes.input, label: classes.label }}
          />
          <Textarea
            label="Description"
            placeholder="Describe the problem..."
            value={qDesc}
            onChange={(e) => setQDesc(e.target.value)}
            rows={4}
            classNames={{ input: classes.input, label: classes.label }}
          />
          <NumberInput
            label="Max Score"
            value={qMaxScore}
            onChange={setQMaxScore}
            min={1}
            classNames={{ input: classes.input, label: classes.label }}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setQuestionOpen(false)}>
              Cancel
            </Button>
            <Button
              className={classes.addButton}
              onClick={handleAddQuestion}
              loading={qSubmitting}
              leftSection={<IconPlus size={14} />}
            >
              Add
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={testCaseOpen}
        onClose={() => setTestCaseOpen(false)}
        title="Add Test Case"
        classNames={{
          content: classes.modalContent,
          header: classes.modalHeader,
          close: classes.modalClose,
        }}
      >
        <Stack gap="md">
          {tcFormError && (
            <Alert
              color="red"
              icon={<IconAlertCircle size={16} />}
              classNames={{ root: classes.alert }}
            >
              {tcFormError}
            </Alert>
          )}
          <TextInput
            label="Name"
            placeholder="e.g. Basic input"
            value={tcName}
            onChange={(e) => setTcName(e.target.value)}
            required
            classNames={{ input: classes.input, label: classes.label }}
          />
          <Textarea
            label="Input Data"
            placeholder="stdin input (optional)"
            value={tcInput}
            onChange={(e) => setTcInput(e.target.value)}
            rows={3}
            classNames={{ input: classes.input, label: classes.label }}
          />
          <Textarea
            label="Expected Output"
            placeholder="exact expected stdout"
            value={tcExpected}
            onChange={(e) => setTcExpected(e.target.value)}
            rows={3}
            required
            classNames={{ input: classes.input, label: classes.label }}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setTestCaseOpen(false)}>
              Cancel
            </Button>
            <Button
              className={classes.addButton}
              onClick={handleAddTestCase}
              loading={tcSubmitting}
              leftSection={<IconPlus size={14} />}
            >
              Add
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmModal
        opened={deleteExamConfirmOpen}
        onClose={() => setDeleteExamConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Exam"
        message={`Delete "${exam?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="red"
        loading={deleting}
      />

      <ConfirmModal
        opened={!!deleteQuestionTarget}
        onClose={() => setDeleteQuestionTarget(null)}
        onConfirm={handleDeleteQuestion}
        title="Delete Question"
        message={`Delete question "${deleteQuestionTarget?.title}"?`}
        confirmLabel="Delete"
        confirmColor="red"
      />
    </Box>
  );
}

function QuestionCard({
  question,
  index,
  isDraft,
  onDeleteQuestion,
  onAddTestCase,
  onDeleteTestCase,
}: {
  question: ExamQuestion;
  index: number;
  isDraft: boolean;
  onDeleteQuestion: () => void;
  onAddTestCase: () => void;
  onDeleteTestCase: (tcId: string) => void;
}) {
  return (
    <Card className={classes.questionCard}>
      <Group justify="space-between" align="flex-start" mb="sm">
        <div style={{ flex: 1 }}>
          <Group gap="xs" mb={4}>
            <Badge variant="light" color="violet" size="xs">
              Q{index + 1}
            </Badge>
            <Badge variant="light" color="gray" size="xs">
              {question.maxScore} pts
            </Badge>
          </Group>
          <Text size="sm" fw={600} c="white">
            {question.title}
          </Text>
          {question.description && (
            <Text size="xs" c="dimmed" mt={4} style={{ whiteSpace: 'pre-wrap' }} lineClamp={3}>
              {question.description}
            </Text>
          )}
        </div>
        <Group gap="xs">
          {isDraft && (
            <>
              <Tooltip label="Add test case">
                <ActionIcon
                  variant="subtle"
                  className={classes.iconButton}
                  size="sm"
                  onClick={onAddTestCase}
                  aria-label={`Add test case to ${question.title}`}
                >
                  <IconPlus size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Delete question">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  onClick={onDeleteQuestion}
                  aria-label={`Delete ${question.title}`}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
        </Group>
      </Group>

      {question.testCases.length > 0 && (
        <Stack gap="xs" mt="sm">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">
            Test Cases ({question.testCases.length})
          </Text>
          {question.testCases.map((tc, i) => (
            <Card key={tc.id} className={classes.testCaseCard}>
              <Group justify="space-between" align="flex-start">
                <div style={{ flex: 1 }}>
                  <Group gap="xs" mb={4}>
                    <Badge variant="light" color="violet" size="xs">
                      {i + 1}
                    </Badge>
                    <Text size="xs" fw={600} c="white">
                      {tc.name}
                    </Text>
                  </Group>
                  {tc.inputData && (
                    <Text size="xs" c="dimmed">
                      Input: <code className={classes.code}>{tc.inputData}</code>
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    Expected: <code className={classes.code}>{tc.expectedOutput}</code>
                  </Text>
                </div>
                {isDraft && (
                  <Tooltip label="Delete test case">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() => onDeleteTestCase(tc.id)}
                      aria-label={`Delete test case ${tc.name}`}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Card>
  );
}
