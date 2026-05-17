import React from 'react';
import { Stack, Group, Text, Card, Badge, Button, Loader, Center, Alert } from '@mantine/core';
import {
  IconAlertCircle,
  IconClock,
  IconBook,
  IconBookOff,
  IconCalendar,
  IconPlayerPlay,
  IconFlask,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import classes from './StudentExamTab.module.css';

export interface StudentExamSummary {
  id: string;
  title: string;
  instructions: string | null;
  language: string;
  durationMinutes: number;
  scheduledStart: string | null;
  status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  maxScore: number;
  isOpenBook: boolean;
}

const STATUS_COLOUR: Record<string, string> = {
  ACTIVE: 'green',
  SCHEDULED: 'blue',
  COMPLETED: 'gray',
  CANCELLED: 'red',
  DRAFT: 'gray',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Live',
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DRAFT: 'Draft',
};

interface Props {
  classId: string;
  exams: StudentExamSummary[];
  loading: boolean;
  error: string | null;
}

export default function StudentExamTab({ classId: _classId, exams, loading, error }: Props) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Center h={200} data-testid="loading-spinner">
        <Loader color="violet" size="sm" />
      </Center>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red" classNames={{ root: classes.alert }}>
        {error}
      </Alert>
    );
  }

  const visible = exams.filter((e) => e.status === 'ACTIVE' || e.status === 'SCHEDULED');

  return (
    <Stack gap="md">
      {visible.length === 0 ? (
        <div className={classes.empty}>
          <IconFlask size={28} opacity={0.3} />
          <Text c="dimmed" mt="sm">
            No exams yet
          </Text>
          <Text size="sm" c="dimmed" mt={4}>
            Your teacher hasn't scheduled any exams for this class.
          </Text>
        </div>
      ) : (
        visible.map((exam) => (
          <Card
            key={exam.id}
            className={`${classes.examCard} ${exam.status === 'ACTIVE' ? classes.examCardActive : ''}`}
            onClick={() => {
              if (exam.status === 'ACTIVE') {
                navigate(`/student/exams/${exam.id}`);
              }
            }}
            data-testid={`exam-card-${exam.id}`}
          >
            <Group justify="space-between" align="flex-start">
              <div style={{ flex: 1 }}>
                <Group gap="xs" mb={4}>
                  <Badge color={STATUS_COLOUR[exam.status]} variant="light" size="sm">
                    {STATUS_LABEL[exam.status]}
                  </Badge>
                  <Badge color="violet" variant="light" size="sm">
                    {exam.language}
                  </Badge>
                  <Badge
                    color={exam.isOpenBook ? 'blue' : 'gray'}
                    variant="light"
                    size="sm"
                    leftSection={
                      exam.isOpenBook ? <IconBook size={10} /> : <IconBookOff size={10} />
                    }
                  >
                    {exam.isOpenBook ? 'Open-book' : 'Closed-book'}
                  </Badge>
                </Group>

                <Text fw={600} c="white" size="sm">
                  {exam.title}
                </Text>

                {exam.instructions && (
                  <Text size="xs" c="dimmed" mt={4} lineClamp={2}>
                    {exam.instructions}
                  </Text>
                )}

                <Group gap="md" mt={6}>
                  <Group gap={4}>
                    <IconClock size={12} color="white" />
                    <Text size="xs" c="dimmed">
                      {exam.durationMinutes} min
                    </Text>
                  </Group>
                  <Group gap={4}>
                    <Text size="xs" c="dimmed">
                      Max score: {exam.maxScore}
                    </Text>
                  </Group>
                  {exam.scheduledStart && (
                    <Group gap={4}>
                      <IconCalendar size={12} color="white" />
                      <Text size="xs" c="dimmed">
                        {new Date(exam.scheduledStart).toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </Text>
                    </Group>
                  )}
                </Group>
              </div>

              {exam.status === 'ACTIVE' && (
                <Button
                  size="xs"
                  variant="gradient"
                  gradient={{ from: 'green', to: 'teal', deg: 45 }}
                  leftSection={<IconPlayerPlay size={13} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/student/exams/${exam.id}`);
                  }}
                  data-testid={`exam-action-${exam.id}`}
                >
                  Join Exam
                </Button>
              )}
            </Group>
          </Card>
        ))
      )}
    </Stack>
  );
}
