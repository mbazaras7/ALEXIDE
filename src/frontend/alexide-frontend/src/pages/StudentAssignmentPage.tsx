import React from 'react';
import {
  Box,
  Text,
  Group,
  Stack,
  Badge,
  Button,
  ActionIcon,
  Loader,
  Center,
  Alert,
  Card,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconAlertCircle,
  IconCode,
  IconCheck,
  IconClock,
  IconAlertTriangle,
  IconMessage,
} from '@tabler/icons-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStudentAssignment } from '../hooks/useStudentAssignment';
import classes from './StudentAssignmentPage.module.css';

const STATUS_COLOURS: Record<string, string> = {
  PENDING: 'yellow',
  COMPLETED: 'green',
  FAILED: 'red',
};

const isOverdue = (dueDate: string | null) => (dueDate ? new Date(dueDate) < new Date() : false);

export default function StudentAssignmentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { assignment, submission, feedback, gradeReleased, loading, error } = useStudentAssignment(
    assignmentId!
  );

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

  const overdue = isOverdue(assignment.dueDate);
  const backPath = `/student/classes/${assignment.classId}`;

  const handleOpenIDE = () => {
    navigate('/student/ide', {
      state: {
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        classId: assignment.classId,
      },
    });
  };

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
              <Badge color="violet" variant="light" size="sm">
                {assignment.language}
              </Badge>
              {overdue && !submission && (
                <Badge color="red" variant="light" size="sm">
                  Overdue
                </Badge>
              )}
              {submission && gradeReleased && (
                <Badge color={STATUS_COLOURS[submission.status]} variant="light" size="sm">
                  {submission.status}
                </Badge>
              )}
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
                <Group gap={4}>
                  <IconClock
                    size={12}
                    color={overdue ? 'var(--mantine-color-red-4)' : 'rgba(255,255,255,0.4)'}
                  />
                  <Text size="xs" c={overdue ? 'red' : 'dimmed'}>
                    Due: {new Date(assignment.dueDate).toLocaleString()}
                  </Text>
                </Group>
              )}
            </Group>
          </div>
        </Group>

        <Button
          className={classes.ideButton}
          leftSection={<IconCode size={16} />}
          onClick={handleOpenIDE}
          disabled={overdue && !submission}
        >
          {submission ? 'Open in IDE' : 'Start Assignment'}
        </Button>
      </Group>

      <Stack gap="md">
        {submission && (
          <Card className={classes.submissionCard}>
            <Group justify="space-between" align="flex-start">
              <div>
                <Group gap="xs" mb={6}>
                  <IconCheck size={16} color="var(--mantine-color-green-4)" />
                  <Text size="sm" fw={600} c="white">
                    {gradeReleased ? 'Assignment Graded' : 'Submitted - awaiting grading'}
                  </Text>
                </Group>
                {gradeReleased && submission.score !== null && (
                  <Text size="xl" fw={700} c="white">
                    {submission.score} / {assignment.maxScore}
                  </Text>
                )}
                <Text size="xs" c="dimmed" mt={4}>
                  Submitted: {new Date(submission.submittedAt).toLocaleString()}
                </Text>
              </div>

              {gradeReleased && submission.testResults && submission.testResults.length > 0 && (
                <Stack gap="xs" align="flex-end">
                  <Text size="xs" c="dimmed">
                    Test Results
                  </Text>
                  {submission.testResults.map((tr) => (
                    <Group key={tr.id} gap="xs">
                      <Badge size="xs" color={tr.passed ? 'green' : 'red'} variant="light">
                        {tr.testCase?.name ?? 'Test'}
                      </Badge>
                      <Badge size="xs" color={tr.passed ? 'green' : 'red'} variant="dot">
                        {tr.passed ? 'Pass' : 'Fail'}
                      </Badge>
                    </Group>
                  ))}
                </Stack>
              )}
            </Group>
          </Card>
        )}

        {feedback?.feedback && (
          <Card className={classes.infoCard}>
            <Group gap="xs" mb="sm">
              <IconMessage size={14} color="var(--mantine-color-teal-4)" />
              <Text size="xs" className={classes.sectionLabel}>
                Feedback from your teacher
              </Text>
              {feedback.feedbackUpdatedAt && (
                <Text size="xs" c="dimmed">
                  {new Date(feedback.feedbackUpdatedAt).toLocaleDateString()}
                </Text>
              )}
            </Group>
            <Text
              size="sm"
              c="rgba(255,255,255,0.75)"
              style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
            >
              {feedback.feedback}
            </Text>
          </Card>
        )}

        {overdue && !submission && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="red"
            classNames={{ root: classes.alert, message: classes.alertMessage }}
          >
            This assignment is past its due date and can no longer be submitted.
          </Alert>
        )}

        {assignment.description && (
          <Card className={classes.infoCard}>
            <Text size="xs" className={classes.sectionLabel} mb="sm">
              Instructions
            </Text>
            <Text size="sm" c="rgba(255,255,255,0.7)" style={{ whiteSpace: 'pre-wrap' }}>
              {assignment.description}
            </Text>
          </Card>
        )}
      </Stack>
    </Box>
  );
}
