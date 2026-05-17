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
  ThemeIcon,
  Loader,
  Center,
  Alert,
  Progress,
  Paper,
} from '@mantine/core';
import {
  IconUsers,
  IconClipboardList,
  IconSchool,
  IconChartBar,
  IconArrowRight,
  IconBook,
  IconAlertCircle,
} from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTeacherDashboard } from '../hooks/useTeacherDashboard';
import { BarChart } from '@mantine/charts';
import { Payload } from 'recharts/types/component/DefaultTooltipContent';
import classes from './TeacherDashboard.module.css';

interface ChartTooltipProps {
  label: React.ReactNode;
  payload: Payload<number, string>[] | undefined;
}

function ChartTooltip({ label, payload }: ChartTooltipProps) {
  if (!payload || payload.length === 0) return null;
  return (
    <Paper
      px="sm"
      py="xs"
      radius="md"
      style={{
        backgroundColor: '#1a1b2e',
        border: '1px solid #7b5bf5',
        color: '#ffffff',
      }}
    >
      <Text fw={500} mb={4} c="white" size="xs">
        {label}
      </Text>
      {payload.map((item) => (
        <Text key={item.name} c="violet.4" size="xs">
          {item.name === 'average' ? 'Avg Grade' : 'Students'}: {item.value}
          {item.name === 'average' ? '%' : ''}
        </Text>
      ))}
    </Paper>
  );
}

function getGradeColour(pct: number) {
  if (pct >= 70) return 'green';
  if (pct >= 50) return 'blue';
  return 'red';
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { classes: teacherClasses, overviews, loading, error } = useTeacherDashboard();

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

  const totalStudents = teacherClasses.reduce((sum, c) => sum + (c.memberCount ?? 0), 0);
  const classesWithGrades = overviews.filter((o) => o.averagePercentage !== null);
  const overallAvg = classesWithGrades.length
    ? (
        classesWithGrades.reduce((sum, o) => sum + (o.averagePercentage ?? 0), 0) /
        classesWithGrades.length
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
            You have {teacherClasses.length} active class{teacherClasses.length !== 1 ? 'es' : ''}{' '}
            with {totalStudents} students
          </Text>
        </div>

        <Grid gutter="lg">
          <Grid.Col span={3}>
            <Card className={classes.statCard} padding="lg" radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Total Students
                  </Text>
                  <Text size="xl" fw={700} mt="xs" data-testid="total-students-count">
                    {totalStudents}
                  </Text>
                </div>
                <ThemeIcon
                  className={classes.statIcon}
                  size={50}
                  radius="md"
                  variant="light"
                  color="violet"
                >
                  <IconUsers size={28} />
                </ThemeIcon>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={3}>
            <Card className={classes.statCard} padding="lg" radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Active Classes
                  </Text>
                  <Text size="xl" fw={700} mt="xs">
                    {teacherClasses.length}
                  </Text>
                </div>
                <ThemeIcon
                  className={classes.statIcon}
                  size={50}
                  radius="md"
                  variant="light"
                  color="blue"
                >
                  <IconBook size={28} />
                </ThemeIcon>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={3}>
            <Card className={classes.statCard} padding="lg" radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Total Grades
                  </Text>
                  <Text size="xl" fw={700} mt="xs" data-testid="total-grades-count">
                    {overviews.reduce((sum, o) => sum + o.totalGrades, 0)}
                  </Text>
                </div>
                <ThemeIcon
                  className={classes.statIcon}
                  size={50}
                  radius="md"
                  variant="light"
                  color="orange"
                >
                  <IconSchool size={28} />
                </ThemeIcon>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={3}>
            <Card className={classes.statCard} padding="lg" radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Avg. Class Score
                  </Text>
                  <Text size="xl" fw={700} mt="xs">
                    {overallAvg ? `${overallAvg}%` : '—'}
                  </Text>
                </div>
                <ThemeIcon
                  className={classes.statIcon}
                  size={50}
                  radius="md"
                  variant="light"
                  color="green"
                >
                  <IconChartBar size={28} />
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
              to="/teacher/classes"
              variant="subtle"
              rightSection={<IconArrowRight size={16} />}
            >
              View All
            </Button>
          </Group>

          {teacherClasses.length === 0 ? (
            <Text c="dimmed" size="sm">
              No classes yet. Create one to get started.
            </Text>
          ) : (
            <Grid gutter="md">
              {teacherClasses.slice(0, 3).map((c) => {
                const overview = overviews.find((o) => o.classId === c.id);
                return (
                  <Grid.Col key={c.id} span={4}>
                    <Card className={classes.classCard} padding="md" radius="md">
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Badge variant="light" color="violet">
                            {c.joinCode}
                          </Badge>
                          {overview?.averagePercentage != null && (
                            <Badge
                              variant="light"
                              color={getGradeColour(overview.averagePercentage)}
                            >
                              Avg: {Math.round(overview.averagePercentage)}%
                            </Badge>
                          )}
                        </Group>

                        <Text fw={600} size="md">
                          {c.name}
                        </Text>

                        <Group gap="lg">
                          <Group gap={4}>
                            <IconUsers size={14} />
                            <Text size="xs" c="dimmed">
                              {c.memberCount ?? 0} students
                            </Text>
                          </Group>
                          <Group gap={4}>
                            <IconClipboardList size={14} />
                            <Text size="xs" c="dimmed">
                              {overview?.totalGrades ?? 0} grades
                            </Text>
                          </Group>
                        </Group>

                        {overview?.averagePercentage != null && (
                          <Progress
                            value={overview.averagePercentage}
                            size="sm"
                            radius="xl"
                            color={getGradeColour(overview.averagePercentage)}
                            mt="xs"
                          />
                        )}

                        <Button
                          component={Link}
                          to={`/teacher/classes/${c.id}`}
                          size="xs"
                          variant="light"
                          fullWidth
                          mt="xs"
                        >
                          Manage Class
                        </Button>
                      </Stack>
                    </Card>
                  </Grid.Col>
                );
              })}
            </Grid>
          )}
        </Card>

        <Card className={classes.contentCard} padding="lg" radius="md">
          <Text size="lg" fw={700}>
            Class Performance
          </Text>

          {overviews.length === 0 ? (
            <Text c="dimmed" size="sm">
              No grade data yet
            </Text>
          ) : (
            <BarChart
              h={180}
              data={overviews.map((o) => ({
                class: o.className,
                average: o.averagePercentage !== null ? Math.round(o.averagePercentage) : 0,
                students: o.memberCount,
              }))}
              dataKey="class"
              series={[
                { name: 'average', color: 'violet.6', label: 'Avg %' },
                { name: 'students', color: 'blue.4', label: 'Students' },
              ]}
              tickLine="xy"
              gridAxis="xy"
              yAxisProps={{ domain: [0, 100] }}
              barProps={{ radius: 4 }}
              tooltipProps={{
                content: ({ label, payload }) => <ChartTooltip label={label} payload={payload} />,
              }}
            />
          )}
        </Card>
      </Stack>
    </Container>
  );
}
