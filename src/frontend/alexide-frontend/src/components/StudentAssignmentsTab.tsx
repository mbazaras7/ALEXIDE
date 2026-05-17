import React from 'react';
import { Stack, Group, Text, Card, Badge, Alert, Loader, Center } from '@mantine/core';
import { IconAlertCircle, IconClock, IconCode } from '@tabler/icons-react';
import { useStudentAssignments } from '../hooks/useStudentAssignments';
import { useNavigate } from 'react-router-dom';
import classes from './StudentAssignmentsTab.module.css';

const isOverdue = (dueDate: string | null) => (dueDate ? new Date(dueDate) < new Date() : false);

interface Props {
  classId: string;
}

export default function StudentAssignmentsTab({ classId }: Props) {
  const { assignments, loading, error } = useStudentAssignments(classId);
  const navigate = useNavigate();

  if (loading)
    return (
      <Center h={200} data-testid="loading-spinner">
        <Loader color="violet" size="sm" />
      </Center>
    );
  if (error)
    return (
      <Alert icon={<IconAlertCircle />} color="red">
        {error}
      </Alert>
    );

  if (assignments.length === 0) {
    return (
      <div className={classes.empty}>
        <IconCode size={32} color="var(--mantine-color-violet-4)" />
        <Text c="dimmed" mt="sm">
          No assignments yet
        </Text>
        <Text size="sm" c="dimmed" mt={4}>
          Your teacher hasn't posted any assignments
        </Text>
      </div>
    );
  }

  return (
    <Stack gap="md">
      {assignments.map((a) => {
        const overdue = isOverdue(a.dueDate);
        return (
          <Card
            key={a.id}
            className={classes.assignmentCard}
            onClick={() => navigate(`/student/assignments/${a.id}`)}
          >
            <Group justify="space-between" align="flex-start">
              <div style={{ flex: 1 }}>
                <Group gap="xs" mb={4}>
                  <Badge color="violet" variant="light" size="sm">
                    {a.language}
                  </Badge>
                  {overdue && (
                    <Badge color="red" variant="light" size="sm">
                      Overdue
                    </Badge>
                  )}
                  <Text fw={600} c="white" size="sm">
                    {a.title}
                  </Text>
                </Group>
                {a.description && (
                  <Text size="xs" c="dimmed">
                    {a.description}
                  </Text>
                )}
                <Group gap="md" mt={6}>
                  <Text size="xs" c="dimmed">
                    Max score: {a.maxScore}
                  </Text>
                  {a.dueDate && (
                    <Group gap={4}>
                      <IconClock
                        size={12}
                        color={overdue ? 'var(--mantine-color-red-4)' : 'rgba(255,255,255,0.4)'}
                      />
                      <Text size="xs" c={overdue ? 'red' : 'dimmed'}>
                        Due: {new Date(a.dueDate).toLocaleDateString()}
                      </Text>
                    </Group>
                  )}
                </Group>
              </div>
            </Group>
          </Card>
        );
      })}
    </Stack>
  );
}
