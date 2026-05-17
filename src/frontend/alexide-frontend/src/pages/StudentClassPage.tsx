import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Text,
  Group,
  Stack,
  Tabs,
  Badge,
  Button,
  Loader,
  Center,
  Alert,
  Avatar,
  Card,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconUsers,
  IconChartBar,
  IconAlertCircle,
  IconSchool,
  IconDoorExit,
  IconInfoCircle,
  IconBook,
  IconFlask,
} from '@tabler/icons-react';
import { useStudentClass } from '../hooks/useStudentClass';
import { useStudentClasses } from '../hooks/useStudentClasses';
import { useStudentExams } from '../hooks/useStudentExams';
import { useAuth } from '../contexts/AuthContext';
import StudentGradesTab from '../components/StudentGradesTab';
import StudentAssignmentsTab from '../components/StudentAssignmentsTab';
import StudentExamTab from '../components/StudentExamTab';
import ConfirmModal from '../components/ConfirmModal';
import classes from './StudentClassPage.module.css';

const getErrorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : 'An unexpected error occurred';

export default function StudentClassPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { classData, loading, error } = useStudentClass(classId!);
  const { leaveClass } = useStudentClasses();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') ?? 'overview';
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  const { exams, loading: examsLoading, error: examsError } = useStudentExams(classId!);

  const handleLeave = async () => {
    if (!classId || !classData) return;
    try {
      await leaveClass(classId);
      navigate('/student/classes');
    } catch (e: unknown) {
      alert(getErrorMessage(e));
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
      <Alert
        color="red"
        icon={<IconAlertCircle size={16} />}
        classNames={{ root: classes.alert, message: classes.alertMessage }}
      >
        {error}
      </Alert>
    );

  if (!classData) return null;

  return (
    <Box className={classes.wrapper}>
      <div className={classes.header}>
        <Group justify="space-between" mb="md">
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={14} />}
            className={classes.backButton}
            onClick={() => navigate('/student/classes')}
          >
            Back to Classes
          </Button>
          <Button
            variant="subtle"
            color="red"
            leftSection={<IconDoorExit size={14} />}
            onClick={() => setLeaveConfirmOpen(true)}
          >
            Leave Class
          </Button>
        </Group>
        <Group justify="space-between" align="flex-start">
          <div>
            <Text data-testid="class-name" className={classes.className}>
              {classData.name}
            </Text>
            {classData.description && (
              <Text data-testid="class-description" c="dimmed" size="sm" mt={4}>
                {classData.description}
              </Text>
            )}
            {classData.teacher && (
              <Group gap="xs" mt={8}>
                <IconSchool size={14} color="var(--mantine-color-violet-4)" />
                <Text data-testid="class-teacher" size="sm" c="dimmed">
                  {classData.teacher.name}
                </Text>
              </Group>
            )}
          </div>
          <Badge className={classes.memberBadge} variant="light" color="violet">
            {classData.members?.length ?? 0} student{classData.members?.length !== 1 ? 's' : ''}
          </Badge>
        </Group>
      </div>

      <Tabs defaultValue={defaultTab} classNames={{ tab: classes.tab, list: classes.tabList }}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="overview" leftSection={<IconUsers size={14} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="info" leftSection={<IconInfoCircle size={14} />}>
            Info
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

        <Tabs.Panel value="overview">
          <Stack gap="md">
            <Text fw={600} c="white" size="sm">
              Classmates
            </Text>
            {!classData.members || classData.members.length === 0 ? (
              <div className={classes.empty}>
                <Text c="dimmed">No other students enrolled yet</Text>
              </div>
            ) : (
              classData.members.map((member) => (
                <Card key={member.studentId} className={classes.memberCard}>
                  <Group>
                    <Avatar color="violet" radius="xl" size="sm">
                      {member.student.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <div>
                      <Group gap="xs">
                        <Text size="sm" c="white">
                          {member.student.name}
                        </Text>
                        {member.studentId === user?.id && (
                          <Badge size="xs" variant="light" color="violet">
                            You
                          </Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed">
                        {member.student.email}
                      </Text>
                    </div>
                  </Group>
                </Card>
              ))
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="info">
          <Stack gap="md">
            <Text fw={600} c="white" size="sm" className={classes.sectionLabel}>
              Class Details
            </Text>
            <Card className={classes.infoCard}>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Class name
                  </Text>
                  <Text data-testid="info-name" size="sm" c="white">
                    {classData.name}
                  </Text>
                </Group>
                {classData.description && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Description
                    </Text>
                    <Text size="sm" c="white">
                      {classData.description}
                    </Text>
                  </Group>
                )}
                {classData.teacher && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Teacher
                    </Text>
                    <Text size="sm" c="white">
                      {classData.teacher.name}
                    </Text>
                  </Group>
                )}
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Created
                  </Text>
                  <Text size="sm" c="white">
                    {new Date(classData.createdAt).toLocaleDateString()}
                  </Text>
                </Group>
              </Stack>
            </Card>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="grades">
          <StudentGradesTab classId={classData.id} />
        </Tabs.Panel>

        <Tabs.Panel value="assignments">
          <StudentAssignmentsTab classId={classData.id} />
        </Tabs.Panel>

        <Tabs.Panel value="exams">
          <StudentExamTab
            classId={classData.id}
            exams={exams}
            loading={examsLoading}
            error={examsError}
          />
        </Tabs.Panel>
      </Tabs>

      <ConfirmModal
        opened={leaveConfirmOpen}
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={handleLeave}
        title="Leave Class"
        message={`Are you sure you want to leave "${classData?.name}"?`}
        confirmLabel="Leave"
        confirmColor="red"
      />
    </Box>
  );
}
