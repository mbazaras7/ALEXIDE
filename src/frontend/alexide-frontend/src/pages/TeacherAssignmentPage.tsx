import React, { useState } from 'react';
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
  Modal,
  TextInput,
  Textarea,
  Collapse,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconTestPipe,
  IconUsers,
  IconAlertCircle,
  IconTrash,
  IconPlus,
  IconRefresh,
  IconCheck,
  IconX,
  IconChevronUp,
  IconCode,
  IconChevronDown,
} from '@tabler/icons-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTeacherAssignment } from '../hooks/useTeacherAssignment';
import { CreateTestCaseData } from '../hooks/useTeacherAssignments';
import ConfirmModal from '../components/ConfirmModal';
import classes from './TeacherAssignmentPage.module.css';
import { SubmissionFeedbackPanel } from '../components/SubmissionFeedbackPanel';

const getErrorMessage = (e: unknown) =>
  e instanceof Error ? e.message : 'An unexpected error occurred';

const STATUS_COLOURS: Record<string, string> = { DRAFT: 'gray', PUBLISHED: 'green' };
const SUBMISSION_COLOURS: Record<string, string> = {
  PENDING: 'yellow',
  GRADED: 'green',
  FAILED: 'red',
};

export default function TeacherAssignmentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const initialTab = (location.state as { tab?: string })?.tab ?? 'testcases';
  const {
    assignment,
    submissions,
    loading,
    error,
    addTestCase,
    deleteTestCase,
    reGradeSubmission,
    publishAssignment,
  } = useTeacherAssignment(assignmentId!);

  const [testCaseOpen, setTestCaseOpen] = useState(false);
  const [tcName, setTcName] = useState('');
  const [tcInput, setTcInput] = useState('');
  const [tcExpected, setTcExpected] = useState('');
  const [formError, setFormError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTestCaseTarget, setDeleteTestCaseTarget] = useState<string | null>(null);
  const [regradeTarget, setRegradeTarget] = useState<string | null>(null);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);

  const resetTcForm = () => {
    setTcName('');
    setTcInput('');
    setTcExpected('');
    setFormError('');
  };

  const handleAddTestCase = async () => {
    if (!tcName.trim()) return setFormError('Name is required');
    if (!tcExpected.trim()) return setFormError('Expected output is required');
    try {
      setSubmitting(true);
      setFormError('');
      const payload: CreateTestCaseData = {
        name: tcName.trim(),
        inputData: tcInput,
        expectedOutput: tcExpected.trim(),
        orderIndex: (assignment?.testCases?.length ?? 0) + 1,
      };
      await addTestCase(payload);
      resetTcForm();
      setTestCaseOpen(false);
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTestCase = async () => {
    if (!deleteTestCaseTarget) return;
    try {
      await deleteTestCase(deleteTestCaseTarget);
      setDeleteTestCaseTarget(null);
    } catch (e) {
      alert(getErrorMessage(e));
    }
  };

  const handleRegrade = async () => {
    if (!regradeTarget) return;
    try {
      await reGradeSubmission(regradeTarget);
      setRegradeTarget(null);
    } catch (e) {
      alert(getErrorMessage(e));
    }
  };

  const handlePublish = async () => {
    try {
      setPublishing(true);
      await publishAssignment();
      setPublishConfirmOpen(false);
    } catch (e) {
      alert(getErrorMessage(e));
    } finally {
      setPublishing(false);
    }
  };

  if (loading)
    return (
      <Center h={400} data-testid="loading-spinner">
        <Loader color="violet" />
      </Center>
    );
  if (error)
    return (
      <Alert color="red" icon={<IconAlertCircle size={16} />} m="xl">
        {error}
      </Alert>
    );
  if (!assignment) return null;

  const backPath = `/teacher/classes/${assignment.classId}`;

  return (
    <Box className={classes.container}>
      <Group mb="xl" justify="space-between" align="flex-start">
        <Group gap="md">
          <ActionIcon
            variant="subtle"
            className={classes.backButton}
            onClick={() => navigate(backPath)}
          >
            <IconArrowLeft size={18} />
          </ActionIcon>
          <div>
            <Group gap="xs" mb={4}>
              <Badge color={STATUS_COLOURS[assignment.status]} variant="light" size="sm">
                {assignment.status}
              </Badge>
              <Badge color="violet" variant="light" size="sm">
                {assignment.language}
              </Badge>
            </Group>
            <Text className={classes.title}>{assignment.title}</Text>
            {assignment.description && (
              <Text className={classes.subtitle}>{assignment.description}</Text>
            )}
            <Group gap="md" mt={6}>
              <Text size="xs" c="dimmed">
                Max score: {assignment.maxScore}
              </Text>
              {assignment.dueDate && (
                <Text size="xs" c="dimmed">
                  Due: {new Date(assignment.dueDate).toLocaleString()}
                </Text>
              )}
            </Group>
          </div>
        </Group>
        <Group gap="xs">
          {assignment.status === 'DRAFT' && (
            <Button
              size="xs"
              leftSection={<IconCheck size={14} />}
              className={classes.publishButton}
              onClick={() => setPublishConfirmOpen(true)}
            >
              Publish
            </Button>
          )}
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            className={classes.addButton}
            onClick={() => {
              resetTcForm();
              setTestCaseOpen(true);
            }}
          >
            Add Test Case
          </Button>
        </Group>
      </Group>

      <Tabs defaultValue={initialTab} classNames={{ tab: classes.tab, panel: classes.tabPanel }}>
        <Tabs.List mb="xl">
          <Tabs.Tab value="testcases" leftSection={<IconTestPipe size={14} />}>
            Test Cases ({assignment.testCases?.length ?? 0})
          </Tabs.Tab>
          <Tabs.Tab value="submissions" leftSection={<IconUsers size={14} />}>
            Submissions ({submissions.length})
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="testcases">
          {!assignment.testCases || assignment.testCases.length === 0 ? (
            <div className={classes.empty}>
              <IconTestPipe size={32} color="var(--mantine-color-violet-4)" />
              <Text c="dimmed" mt="sm">
                No test cases yet
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                Click "Add Test Case" to create one
              </Text>
            </div>
          ) : (
            <Stack gap="sm">
              {assignment.testCases.map((tc, index) => (
                <Card key={tc.id} className={classes.testCaseCard}>
                  <Group justify="space-between" align="flex-start">
                    <div style={{ flex: 1 }}>
                      <Group gap="xs" mb={4}>
                        <Badge variant="light" color="violet" size="xs">
                          #{index + 1}
                        </Badge>
                        <Text size="sm" fw={600} c="white">
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
                    <Tooltip label="Delete test case">
                      <ActionIcon
                        aria-label={`Delete test case ${tc.id}`}
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={() => setDeleteTestCaseTarget(tc.id)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="submissions">
          {submissions.length === 0 ? (
            <div className={classes.empty}>
              <IconUsers size={32} color="var(--mantine-color-violet-4)" />
              <Text c="dimmed" mt="sm">
                No submissions yet
              </Text>
            </div>
          ) : (
            <Stack gap="sm">
              {submissions.map((sub) => (
                <Card key={sub.id} className={classes.submissionCard}>
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Group gap="xs" mb={4}>
                        <Badge color={SUBMISSION_COLOURS[sub.status]} variant="light" size="sm">
                          {sub.status}
                        </Badge>
                        {sub.status === 'PENDING' && (
                          <Text size="xs" c="yellow">
                            Grading in progress...
                          </Text>
                        )}
                        <Text size="sm" fw={600} c="white">
                          {sub.student?.name ?? 'Unknown'}
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {sub.student?.email}
                      </Text>
                      <Group gap="md" mt={4}>
                        {sub.status === 'GRADED' && (
                          <Text size="xs" c="white">
                            Score: {sub.score} / {sub.maxScore}
                          </Text>
                        )}
                        <Text size="xs" c="dimmed">
                          Submitted: {new Date(sub.submittedAt).toLocaleString()}
                        </Text>
                      </Group>
                      {sub.testResults && sub.testResults.length > 0 && (
                        <Group gap="xs" mt={6}>
                          {sub.testResults.map((tr) => (
                            <Tooltip
                              key={tr.id}
                              label={`${tr.testCase?.name ?? 'Test'}: ${tr.passed ? 'Passed' : 'Failed'}`}
                            >
                              <Badge
                                size="xs"
                                color={tr.passed ? 'green' : 'red'}
                                variant="light"
                                leftSection={
                                  tr.passed ? <IconCheck size={8} /> : <IconX size={8} />
                                }
                              >
                                {tr.testCase?.name ?? 'Test'}
                              </Badge>
                            </Tooltip>
                          ))}
                        </Group>
                      )}
                    </div>
                    <Tooltip
                      label={
                        sub.status === 'PENDING' ? 'Grading in progress...' : 'Regrade submission'
                      }
                    >
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        className={classes.iconButton}
                        disabled={sub.status === 'PENDING'}
                        loading={sub.status === 'PENDING'}
                        onClick={() => setRegradeTarget(sub.id)}
                      >
                        <IconRefresh size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                  <CodeBlock code={sub.code} />
                  <SubmissionFeedbackPanel sub={sub} />
                </Card>
              ))}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>

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
            label="Name"
            placeholder="e.g. Test 1 - basic input"
            value={tcName}
            onChange={(e) => setTcName(e.target.value)}
            classNames={{ input: classes.input, label: classes.label }}
            required
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
            placeholder="expected stdout"
            value={tcExpected}
            onChange={(e) => setTcExpected(e.target.value)}
            rows={3}
            classNames={{ input: classes.input, label: classes.label }}
            required
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setTestCaseOpen(false)}>
              Cancel
            </Button>
            <Button
              className={classes.addButton}
              onClick={handleAddTestCase}
              loading={submitting}
              leftSection={<IconPlus size={14} />}
            >
              Add
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmModal
        opened={!!deleteTestCaseTarget}
        onClose={() => setDeleteTestCaseTarget(null)}
        onConfirm={handleDeleteTestCase}
        title="Delete Test Case"
        message="Are you sure you want to delete this test case?"
        confirmLabel="Delete"
        confirmColor="red"
      />

      <ConfirmModal
        opened={!!regradeTarget}
        onClose={() => setRegradeTarget(null)}
        onConfirm={handleRegrade}
        title="Regrade Submission"
        message="This will re-run all test cases against the submitted code."
        confirmLabel="Regrade"
        confirmColor="violet"
      />

      <ConfirmModal
        opened={publishConfirmOpen}
        onClose={() => setPublishConfirmOpen(false)}
        onConfirm={handlePublish}
        title="Publish Assignment"
        message="Students will be able to see and submit this assignment immediately."
        confirmLabel="Publish"
        confirmColor="green"
        loading={publishing}
      />
    </Box>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: '8px' }}>
      <Button
        size="xs"
        variant="subtle"
        color="gray"
        leftSection={<IconCode size={13} />}
        rightSection={open ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Hide Code' : 'View Submitted Code'}
      </Button>

      <Collapse in={open}>
        <div
          style={{
            marginTop: '8px',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(123,91,245,0.2)',
            borderRadius: '6px',
            padding: '12px',
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          <pre
            style={{
              margin: 0,
              fontSize: '0.8rem',
              color: 'rgba(255,255,255,0.85)',
              fontFamily: 'Fira Code, Consolas, monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.6,
            }}
          >
            {code}
          </pre>
        </div>
      </Collapse>
    </div>
  );
}
