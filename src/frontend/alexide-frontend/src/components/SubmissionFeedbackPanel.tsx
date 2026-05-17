import React, { useEffect, useState } from 'react';
import { Button, Collapse, Divider, Group, Stack, Text, Textarea } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconMessageCircle, IconRobot } from '@tabler/icons-react';
import { useTeacherSubmissionFeedback } from '../hooks/useTeacherSubmission';
import type { Submission } from '../hooks/useTeacherAssignment';
import styles from './SubmissionFeedbackPanel.module.css';

export function SubmissionFeedbackPanel({ sub }: { sub: Submission }) {
  const {
    aiFeedback,
    aiFeedbackGeneratedAt,
    teacherFeedback,
    feedbackUpdatedAt,
    generatingAI,
    savingFeedback,
    aiError,
    feedbackError,
    initFeedback,
    generateAiFeedback,
    saveTeacherFeedback,
  } = useTeacherSubmissionFeedback(sub.id);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [draftFeedback, setDraftFeedback] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleToggle = () => {
    if (!feedbackOpen) {
      initFeedback({
        aiFeedback: sub.aiFeedback,
        aiFeedbackGeneratedAt: sub.aiFeedbackGeneratedAt,
        feedback: sub.feedback,
        feedbackUpdatedAt: sub.feedbackUpdatedAt,
      });
      setDraftFeedback(sub.feedback ?? '');
    }
    setFeedbackOpen((o) => !o);
  };

  const handleSave = async () => {
    const ok = await saveTeacherFeedback(draftFeedback);
    if (ok) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  useEffect(() => {
    if (teacherFeedback !== null) {
      setDraftFeedback(teacherFeedback);
    }
  }, [teacherFeedback]);

  return (
    <>
      <Button
        size="xs"
        variant="subtle"
        color="violet"
        leftSection={<IconMessageCircle size={13} />}
        rightSection={feedbackOpen ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
        onClick={handleToggle}
        className={styles.toggleButton}
      >
        Feedback
      </Button>

      <Collapse in={feedbackOpen}>
        <Stack gap="sm" className={styles.panel}>
          <div>
            <div className={styles.sectionHeader}>
              <IconRobot size={14} color="var(--mantine-color-violet-4)" />
              <Text className={styles.sectionLabel} c="violet.4">
                AI Feedback
              </Text>
              {aiFeedbackGeneratedAt && (
                <Text size="xs" c="dimmed">
                  {new Date(aiFeedbackGeneratedAt).toLocaleString()}
                </Text>
              )}
            </div>

            {aiFeedback ? (
              <Text className={styles.aiFeedbackText}>{aiFeedback}</Text>
            ) : (
              <Text className={styles.emptyState} c="dimmed">
                No AI feedback generated yet.
              </Text>
            )}

            {aiError && (
              <Text className={styles.errorText} c="red">
                {aiError}
              </Text>
            )}

            <Button
              size="xs"
              variant="light"
              color="violet"
              leftSection={<IconRobot size={13} />}
              onClick={generateAiFeedback}
              loading={generatingAI}
              mt="xs"
              disabled={!aiFeedback}
            >
              Adopt AI Feedback
            </Button>
            <Text size="xs" c="dimmed" mt={8}>
              Copies AI feedback into your feedback box for editing
            </Text>
          </div>

          <Divider className={styles.divider} />

          <div>
            <div className={styles.sectionHeader}>
              <IconMessageCircle size={14} color="var(--mantine-color-teal-4)" />
              <Text className={styles.sectionLabel} c="teal.4">
                Your Feedback
              </Text>
              {feedbackUpdatedAt && (
                <Text size="xs" c="dimmed">
                  Last saved {new Date(feedbackUpdatedAt).toLocaleString()}
                </Text>
              )}
            </div>

            <Textarea
              placeholder="Write personalised feedback for this student..."
              value={draftFeedback}
              onChange={(e) => setDraftFeedback(e.currentTarget.value)}
              minRows={3}
              autosize
              resize="vertical"
              classNames={{ input: styles.feedbackInput }}
            />

            {feedbackError && (
              <Text className={styles.errorText} c="red">
                {feedbackError}
              </Text>
            )}

            <Group gap="xs" mt="xs">
              <Button
                size="xs"
                variant="light"
                color="teal"
                onClick={handleSave}
                loading={savingFeedback}
                disabled={draftFeedback === (teacherFeedback ?? '')}
              >
                Save Feedback
              </Button>
              {savedSuccess && (
                <Text className={styles.savedText} c="teal">
                  Saved
                </Text>
              )}
            </Group>
          </div>
        </Stack>
      </Collapse>
    </>
  );
}
