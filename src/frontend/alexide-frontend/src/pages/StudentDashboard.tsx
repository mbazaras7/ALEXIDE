import React from 'react';
import {
  Container,
  Grid,
  Card,
  Text,
  Badge,
  Button,
  Group,
  Stack,
  Progress,
  ThemeIcon,
  Loader,
  Center,
  Alert,
  Paper,
} from '@mantine/core';
import {
  IconClock,
  IconTrophy,
  IconArrowRight,
  IconClipboardList,
  IconBook,
  IconAlertCircle,
  IconCircleCheck,
} from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useStudentDashboard } from '../hooks/useStudentDashboard';
import { useStudentAllAssignments } from '../hooks/useStudentAllAssignments';
import { LineChart } from '@mantine/charts';
import { Payload } from 'recharts/types/component/DefaultTooltipContent';
import classes from './StudentDashboard.module.css';

interface ChartTooltipProps {
  label: React.ReactNode;
  payload: Payload<number, string>[] | undefined;
}

function ChartTooltip({ label, payload }: ChartTooltipProps) {
  if (!payload || payload.length === 0) return null;
  return (
    <Paper
      px="xs"
      py="sm"
      radius="md"
      style={{
        backgroundColor: '#1a1b2e',
        border: '1px solid #7b5bf5',
        color: '#ffffff',
      }}
    >
      <Text fw={500} mb={5} c="white" size="xs">
        {label}
      </Text>
      {payload.map((item) => (
        <Text key={item.name} c="violet.4" size="xs" fz="xs">
          Average: {item.value}%
        </Text>
      ))}
    </Paper>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const { classes: enrolled, classSummaries, loading, error } = useStudentDashboard();
  const { assignments } = useStudentAllAssignments();

  if (loading)
    return (
      <Center h={400}>
        <Loader color="violet" data-testid="loading-spinner" />
      </Center>
    );
  if (error)
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red">
        {error}
      </Alert>
    );

  const pendingAssignments = assignments
    .filter(
      (a) => a.submissionStatus !== 'COMPLETED' && (!a.dueDate || new Date(a.dueDate) > new Date())
    )
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  const overallAvg = classSummaries.length
    ? (
        classSummaries.reduce((sum, s) => sum + s.averagePercentage, 0) / classSummaries.length
      ).toFixed(1)
    : null;

  return (
    <Container size="100%" className={classes.container}>
      <Stack gap="xl">
        <div className={classes.welcomeSection}>
          <Text size="xl" fw={700} className={classes.welcomeText}>
            Welcome back, {user?.name?.split(' ')[0]}!
          </Text>
          <Text size="sm" c="dimmed">
            {pendingAssignments.length > 0
              ? `You have ${pendingAssignments.length} pending assignment${pendingAssignments.length !== 1 ? 's' : ''}`
              : 'All caught up - no pending assignments'}
          </Text>
        </div>

        <Grid gutter="lg">
          <Grid.Col span={4}>
            <Card className={classes.statCard} padding="lg" radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Pending Assignments
                  </Text>
                  <Text size="xl" fw={700} mt="xs" data-testid="active-assignments-count">
                    {pendingAssignments.length}
                  </Text>
                </div>
                <ThemeIcon size={50} radius="md" variant="light" color="violet">
                  <IconClipboardList size={28} />
                </ThemeIcon>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={4}>
            <Card className={classes.statCard} padding="lg" radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Average Grade
                  </Text>
                  <Text size="xl" fw={700} mt="xs">
                    {overallAvg ? `${overallAvg}%` : '—'}
                  </Text>
                </div>
                <ThemeIcon size={50} radius="md" variant="light" color="blue">
                  <IconTrophy size={28} />
                </ThemeIcon>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={4}>
            <Card className={classes.statCard} padding="lg" radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Active Classes
                  </Text>
                  <Text size="xl" fw={700} mt="xs">
                    {enrolled.length}
                  </Text>
                </div>
                <ThemeIcon size={50} radius="md" variant="light" color="orange">
                  <IconBook size={28} />
                </ThemeIcon>
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

        <Card className={classes.contentCard} padding="lg" radius="md">
          <Group justify="space-between" mb="md">
            <Text size="lg" fw={700}>
              My Classes
            </Text>
            <Button
              component={Link}
              to="/student/classes"
              variant="subtle"
              rightSection={<IconArrowRight size={16} />}
            >
              View All
            </Button>
          </Group>

          {enrolled.length === 0 ? (
            <Text c="dimmed" size="sm">
              You are not enrolled in any classes yet.
            </Text>
          ) : (
            <Grid gutter="md">
              {enrolled.slice(0, 3).map((e) => {
                const summary = classSummaries.find((s) => s.classId === e.class.id);

                return (
                  <Grid.Col key={e.class.id} span={4}>
                    <Card className={classes.classCard} padding="md" radius="md">
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Badge variant="light" color="violet" w="fit-content">
                            {e.class.joinCode}
                          </Badge>
                          {summary?.averagePercentage != null && (
                            <Badge
                              variant="light"
                              color={
                                summary.averagePercentage >= 70
                                  ? 'green'
                                  : summary.averagePercentage >= 50
                                    ? 'yellow'
                                    : 'red'
                              }
                            >
                              Avg: {Math.round(summary.averagePercentage)}%
                            </Badge>
                          )}
                        </Group>

                        <Text fw={600} size="md">
                          {e.class.name}
                        </Text>
                        {e.class.description && (
                          <Text size="xs" c="dimmed" lineClamp={2}>
                            {e.class.description}
                          </Text>
                        )}

                        {summary?.averagePercentage != null && (
                          <Progress
                            value={summary.averagePercentage}
                            size="sm"
                            radius="xl"
                            color={
                              summary.averagePercentage >= 70
                                ? 'green'
                                : summary.averagePercentage >= 50
                                  ? 'yellow'
                                  : 'red'
                            }
                            mt="xs"
                          />
                        )}

                        <Button
                          component={Link}
                          to={`/student/classes/${e.class.id}`}
                          size="xs"
                          variant="light"
                          fullWidth
                          mt="xs"
                        >
                          View Class
                        </Button>
                      </Stack>
                    </Card>
                  </Grid.Col>
                );
              })}
            </Grid>
          )}
        </Card>

        <Grid gutter="lg">
          <Grid.Col span={8}>
            <Card className={classes.contentCard} padding="lg" radius="md">
              <Group justify="space-between" mb="md">
                <Text size="lg" fw={700}>
                  Pending Assignments
                </Text>
              </Group>

              {pendingAssignments.length === 0 ? (
                <Stack align="center" py="xl" gap="xs">
                  <ThemeIcon size={48} radius="md" variant="light" color="green">
                    <IconCircleCheck size={28} />
                  </ThemeIcon>
                  <Text c="dimmed" size="sm">
                    All caught up! No pending assignments.
                  </Text>
                </Stack>
              ) : (
                <Stack gap="sm">
                  {pendingAssignments.slice(0, 5).map((a) => (
                    <Card key={a.id} className={classes.assignmentCard} padding="md" radius="md">
                      <Group justify="space-between" align="flex-start">
                        <div style={{ flex: 1 }}>
                          <Text fw={600} size="sm">
                            {a.title}
                          </Text>
                          <Group gap="xs" mt={4}>
                            <Badge size="xs" variant="light" color="violet">
                              {a.language}
                            </Badge>
                            <Badge size="xs" variant="light" color="gray">
                              {a.className}
                            </Badge>
                            {a.dueDate && (
                              <Group gap={4}>
                                <IconClock size={12} />
                                <Text size="xs" c="dimmed">
                                  Due{' '}
                                  {new Date(a.dueDate).toLocaleDateString('en-IE', {
                                    day: 'numeric',
                                    month: 'short',
                                  })}
                                </Text>
                              </Group>
                            )}
                          </Group>
                        </div>
                        <Button
                          component={Link}
                          to={`/student/assignments/${a.id}`}
                          size="xs"
                          variant="light"
                        >
                          Start
                        </Button>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              )}
            </Card>
          </Grid.Col>

          <Grid.Col span={4}>
            <Card className={classes.contentCard} padding="lg" radius="md">
              <Text size="lg" fw={700} mb="md">
                Grades by Class
              </Text>

              {classSummaries.length === 0 ? (
                <Text c="dimmed" size="sm">
                  No grades released yet
                </Text>
              ) : (
                <>
                  <LineChart
                    h={200}
                    data={classSummaries.map((s) => ({
                      class: s.className,
                      average: Math.round(s.averagePercentage),
                    }))}
                    dataKey="class"
                    series={[{ name: 'average', color: 'violet.5', label: 'Average Grade' }]}
                    curveType="linear"
                    tickLine="xy"
                    tooltipProps={{
                      content: ({ label, payload }) => (
                        <ChartTooltip label={label} payload={payload} />
                      ),
                    }}
                    mb="md"
                  />
                  <Stack gap="xs">
                    {classSummaries.map((s) => (
                      <Group key={s.classId} justify="space-between">
                        <Text size="sm" fw={500}>
                          {s.className}
                        </Text>
                        <Badge
                          color={
                            s.averagePercentage >= 70
                              ? 'green'
                              : s.averagePercentage >= 50
                                ? 'yellow'
                                : 'red'
                          }
                          variant="light"
                        >
                          {Math.round(s.averagePercentage)}%
                        </Badge>
                      </Group>
                    ))}
                  </Stack>
                </>
              )}
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
