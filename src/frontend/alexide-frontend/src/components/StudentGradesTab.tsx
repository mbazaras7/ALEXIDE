import React from 'react';
import {
  Stack,
  Group,
  Text,
  Card,
  Badge,
  Alert,
  Loader,
  Center,
  Progress,
  SimpleGrid,
} from '@mantine/core';
import { IconAlertCircle, IconTrophy, IconChartBar } from '@tabler/icons-react';
import { useStudentGrades, SourceType } from '../hooks/useStudentGrades';
import classes from './StudentGradesTab.module.css';

interface StudentGradesTabProps {
  classId: string;
}

const SOURCE_TYPE_COLOURS: Record<SourceType, string> = {
  ASSIGNMENT: 'blue',
  EXAM: 'orange',
};

const getScoreColour = (percentage: number) => {
  if (percentage >= 70) return 'green';
  if (percentage >= 50) return 'yellow';
  return 'red';
};

export default function StudentGradesTab({ classId }: StudentGradesTabProps) {
  const { grades, stats, loading, error } = useStudentGrades(classId);

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

  if (grades.length === 0) {
    return (
      <div className={classes.empty}>
        <IconChartBar size={32} color="var(--mantine-color-violet-4)" />
        <Text c="dimmed" mt="sm">
          No grades released yet
        </Text>
        <Text size="sm" c="dimmed" mt={4}>
          Your teacher hasn't released any grades for this class
        </Text>
      </div>
    );
  }

  const grouped = grades.reduce<Record<string, typeof grades>>((acc, grade) => {
    const key = `${grade.sourceType}__${grade.sourceId}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(grade);
    return acc;
  }, {});

  return (
    <Stack gap="md">
      {stats && (
        <SimpleGrid cols={3} spacing="sm">
          <Card className={classes.statCard}>
            <Text size="xs" c="dimmed" className={classes.statLabel}>
              Average
            </Text>
            <Text className={classes.statValue}>{stats.averagePercentage.toFixed(1)}%</Text>
          </Card>
          <Card className={classes.statCard}>
            <Text size="xs" c="dimmed" className={classes.statLabel}>
              Highest
            </Text>
            <Text className={classes.statValue} c="green">
              {stats.highestPercentage}%
            </Text>
          </Card>
          <Card className={classes.statCard}>
            <Text size="xs" c="dimmed" className={classes.statLabel}>
              Lowest
            </Text>
            <Text className={classes.statValue} c="red">
              {stats.lowestPercentage}%
            </Text>
          </Card>
        </SimpleGrid>
      )}

      {Object.entries(grouped).map(([key, groupGrades]) => {
        const [sourceType] = key.split('__');
        const grade = groupGrades[0];

        return (
          <Card key={key} className={classes.gradeCard}>
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
                  {grade.sourceName}
                </Text>
              </Group>
              <Group gap="xs">
                {grade.percentage >= 70 && (
                  <IconTrophy size={14} color="var(--mantine-color-yellow-4)" />
                )}
                <Text className={classes.score}>
                  {grade.score} / {grade.maxScore}
                  <Text span size="xs" c="dimmed" ml={4}>
                    ({grade.percentage}%)
                  </Text>
                </Text>
              </Group>
            </Group>
            <Progress
              value={grade.percentage}
              color={getScoreColour(grade.percentage)}
              size="sm"
              radius="xl"
              className={classes.progressBar}
            />
            <Text size="xs" c="dimmed" mt={6}>
              Released {new Date(grade.releasedAt!).toLocaleDateString()}
            </Text>
          </Card>
        );
      })}
    </Stack>
  );
}
