import React from 'react';
import { Group, Text, Badge, Button, Tooltip } from '@mantine/core';
import { IconBook, IconBookOff, IconAlertTriangle, IconShield } from '@tabler/icons-react';
import classes from './ExamBanner.module.css';

interface ExamBannerProps {
  examTitle: string;
  timeRemaining: number;
  timeWarning: number | null;
  tabSwitchCount: number;
  isOpenBook: boolean;
  onSubmit: () => void;
  submitting: boolean;
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ExamBanner({
  examTitle,
  timeRemaining,
  timeWarning,
  tabSwitchCount,
  isOpenBook,
  onSubmit,
  submitting,
}: ExamBannerProps) {
  const isLow = timeRemaining > 0 && timeRemaining <= 300;
  const isCritical = timeRemaining > 0 && timeRemaining <= 60;

  return (
    <div className={classes.banner} data-testid="exam-banner">
      {timeWarning !== null && (
        <div className={classes.warningToast} data-testid="time-warning">
          <IconAlertTriangle size={14} />
          <Text size="xs" fw={600}>
            {timeWarning} minute{timeWarning !== 1 ? 's' : ''} remaining
          </Text>
        </div>
      )}

      <Group justify="space-between" h="100%" px="md">
        <Group gap="sm">
          <div className={classes.examModeBadge}>
            <IconShield size={13} />
            <span>EXAM MODE</span>
          </div>
          <Text size="sm" fw={600} c="white" lineClamp={1}>
            {examTitle}
          </Text>
          <Badge
            size="xs"
            variant="light"
            color={isOpenBook ? 'blue' : 'gray'}
            leftSection={isOpenBook ? <IconBook size={10} /> : <IconBookOff size={10} />}
          >
            {isOpenBook ? 'Open-book' : 'Closed-book'}
          </Badge>
        </Group>

        <Group gap="md">
          {tabSwitchCount > 0 && (
            <Tooltip label="Tab switches detected" withArrow>
              <div
                className={`${classes.tabCounter} ${tabSwitchCount >= 3 ? classes.tabCounterDanger : ''}`}
                data-testid="tab-switch-count"
              >
                <IconAlertTriangle size={12} />
                <span>
                  {tabSwitchCount} tab switch{tabSwitchCount !== 1 ? 'es' : ''}
                </span>
              </div>
            </Tooltip>
          )}

          <div
            className={`${classes.timer} ${isCritical ? classes.timerCritical : isLow ? classes.timerLow : ''}`}
            data-testid="exam-timer"
          >
            {formatTime(timeRemaining)}
          </div>

          <Button
            size="xs"
            color="red"
            variant="light"
            onClick={onSubmit}
            loading={submitting}
            data-testid="submit-exam-button"
          >
            Submit Exam
          </Button>
        </Group>
      </Group>
    </div>
  );
}
