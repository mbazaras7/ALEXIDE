import React, { useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MonacoEditor from '@monaco-editor/react';
import ConfirmModal from '../components/ConfirmModal';
import {
  Box,
  Text,
  Group,
  Badge,
  Button,
  Stack,
  ScrollArea,
  Alert,
  Loader,
  Center,
  Divider,
  Tooltip,
} from '@mantine/core';
import {
  IconBook,
  IconBookOff,
  IconClock,
  IconCheck,
  IconPlayerPlay,
  IconDeviceFloppy,
  IconSend,
  IconAlertTriangle,
  IconCircleDotted,
  IconCircleCheck,
} from '@tabler/icons-react';

import { useExam, ExamQuestionData } from '../hooks/useExam';
import { useExamTimer } from '../hooks/useExamTimer';
import { useExamSubmission, QuestionState } from '../hooks/useExamSubmission';
import { useExamSocket } from '../hooks/useExamSocket';
import classes from './StudentExamPage.module.css';

function toMonacoLanguage(lang: string): string {
  const MAP: Record<string, string> = {
    python: 'python',
    javascript: 'javascript',
    typescript: 'typescript',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
  };
  return MAP[lang.toLowerCase()] ?? 'plaintext';
}

type QStatus = 'unanswered' | 'attempted' | 'saved';

function QuestionStatusDot({ status }: { status: QStatus }) {
  if (status === 'saved') return <IconCircleCheck size={14} className={classes.dotSaved} />;
  if (status === 'attempted')
    return <IconCircleDotted size={14} className={classes.dotAttempted} />;
  return <IconCircleDotted size={14} className={classes.dotUnanswered} />;
}

export default function StudentExamPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const {
    exam,
    session,
    submissions,
    loading,
    error,
    submitting,
    submitAll,
    recordTabSwitch,
    submitQuestion: persistQuestion,
  } = useExam({ examId: examId ?? null });

  const { getState, initCode, updateCode, runCode, saveAnswer } =
    useExamSubmission(persistQuestion);

  const [activeIdx, setActiveIdx] = React.useState(0);
  const autoSubmitFiredRef = useRef(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = React.useState(false);

  useEffect(() => {
    if (!exam || submissions === undefined) return;
    exam.questions.forEach((q) => {
      const saved = submissions.find((s) => s.questionId === q.id);
      initCode(q.id, saved?.code ?? '', !!saved);
    });
  }, [exam, submissions, initCode]);

  const {
    isConnected: socketConnected,
    emitTabSwitch,
    joinedPayload,
  } = useExamSocket({
    examId: examId!,
    enabled: !!session && !session.isSubmitted && !submitted,
    onEnded: () => {
      if (!submitted && !autoSubmitFiredRef.current) {
        autoSubmitFiredRef.current = true;
        setSubmitted(true);
      }
    },
  });

  const timer = useExamTimer(joinedPayload?.endTime ?? session?.expiresAt ?? null);

  const handleSubmitExam = useCallback(async () => {
    try {
      setSubmitError(null);
      await submitAll();
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    }
  }, [submitAll]);

  useEffect(() => {
    if (
      timer.isExpired &&
      !autoSubmitFiredRef.current &&
      session &&
      !session.isSubmitted &&
      !submitted
    ) {
      autoSubmitFiredRef.current = true;
      handleSubmitExam();
    }
  }, [timer.isExpired, session, submitted, handleSubmitExam]);

  useEffect(() => {
    if (!session || session.isSubmitted || submitted) return;
    if (exam?.isOpenBook) return;
    const handler = () => {
      if (document.visibilityState === 'hidden') {
        recordTabSwitch();
        emitTabSwitch();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [session, submitted, exam?.isOpenBook, recordTabSwitch, emitTabSwitch]);

  if (loading) {
    return (
      <Center h="100vh" className={classes.root}>
        <Stack align="center" gap="md">
          <Loader className={classes.loader} size="lg" />
          <Text c="dimmed" size="sm">
            Loading exam…
          </Text>
        </Stack>
      </Center>
    );
  }

  if (error || !exam || !session) {
    return (
      <Center h="100vh" className={classes.root}>
        <Alert
          color="red"
          title="Unable to load exam"
          maw={480}
          icon={<IconAlertTriangle size={18} />}
        >
          {error ?? 'No active session found for this exam.'}
        </Alert>
      </Center>
    );
  }

  if (submitted || session.isSubmitted) {
    return (
      <Center h="100vh" className={classes.root}>
        <Stack align="center" gap="lg" maw={480}>
          <span className={classes.successIcon}>
            <IconCheck size={56} />
          </span>
          <Text fw={700} size="xl" c="white">
            Exam Submitted
          </Text>
          <Text c="dimmed" ta="center">
            Your submissions have been saved. You may now close this tab.
          </Text>
          <Button
            variant="light"
            className={classes.btnPrimary}
            onClick={() => navigate('/student/dashboard')}
          >
            Back to Dashboard
          </Button>
        </Stack>
      </Center>
    );
  }

  const questions = [...exam.questions].sort((a, b) => a.orderIndex - b.orderIndex);
  const activeQuestion = questions[activeIdx] ?? questions[0];

  function questionStatus(q: ExamQuestionData): QStatus {
    const st = getState(q.id);
    if (st.isSaved) return 'saved';
    if (st.code.trim().length > 0) return 'attempted';
    return 'unanswered';
  }

  const timerClass = timer.isCritical
    ? classes.timerCritical
    : timer.isWarning
      ? classes.timerWarning
      : classes.timerNormal;

  return (
    <div className={classes.root}>
      <header className={classes.banner}>
        <Group justify="space-between" h="100%" px="md">
          <Group gap="sm">
            <Text fw={700} size="sm" c="white" className={classes.examTitle}>
              {exam.title}
            </Text>
            {exam.isOpenBook ? (
              <Badge color="green" variant="light" leftSection={<IconBook size={12} />} size="sm">
                Open Book
              </Badge>
            ) : (
              <Badge
                color="orange"
                variant="light"
                leftSection={<IconBookOff size={12} />}
                size="sm"
              >
                Closed Book
              </Badge>
            )}
            <Badge variant="light" size="sm" className={classes.badgeLanguage}>
              {exam.language}
            </Badge>
          </Group>
          <Group gap="xs">
            <IconClock size={16} className={timerClass} />
            <Text fw={700} size="md" className={timerClass} ff="monospace">
              {timer.display}
            </Text>
          </Group>
          <Tooltip label={socketConnected ? 'Connected to exam server' : 'Reconnecting…'}>
            <Box
              className={`${classes.connectionDot} ${socketConnected ? classes.connectionDotOnline : classes.connectionDotOffline}`}
            />
          </Tooltip>
          <Group gap="sm">
            {session.tabSwitchCounter > 0 && (
              <Tooltip label="Tab switches are logged and visible to your teacher">
                <Badge
                  color="red"
                  variant="light"
                  leftSection={<IconAlertTriangle size={12} />}
                  size="sm"
                  className={classes.tabSwitchBadge}
                >
                  {session.tabSwitchCounter} tab switch{session.tabSwitchCounter !== 1 ? 'es' : ''}
                </Badge>
              </Tooltip>
            )}
            <Button
              size="xs"
              className={classes.submitBtn}
              leftSection={<IconSend size={14} />}
              loading={submitting}
              onClick={() => setConfirmSubmitOpen(true)}
            >
              Submit Exam
            </Button>
          </Group>
        </Group>
      </header>

      {submitError && (
        <Alert
          color="red"
          className={classes.submitErrorBanner}
          withCloseButton
          onClose={() => setSubmitError(null)}
        >
          {submitError}
        </Alert>
      )}

      <div className={classes.body}>
        <aside className={classes.sidebar}>
          <Text
            size="xs"
            fw={700}
            tt="uppercase"
            c="dimmed"
            px="md"
            pt="sm"
            pb="xs"
            className={classes.sidebarLabel}
          >
            Questions
          </Text>
          <ScrollArea flex={1}>
            <Stack gap={0}>
              {questions.map((q, idx) => {
                const status = questionStatus(q);
                const isActive = idx === activeIdx;
                return (
                  <button
                    key={q.id}
                    className={`${classes.questionItem} ${isActive ? classes.questionItemActive : ''}`}
                    onClick={() => setActiveIdx(idx)}
                  >
                    <Group gap="xs" wrap="nowrap">
                      <QuestionStatusDot status={status} />
                      <div className={classes.questionItemText}>
                        <Text size="sm" fw={isActive ? 600 : 400} lineClamp={2}>
                          Q{idx + 1}. {q.title}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {q.maxScore} pt{q.maxScore !== 1 ? 's' : ''}
                        </Text>
                      </div>
                    </Group>
                  </button>
                );
              })}
            </Stack>
          </ScrollArea>
          <Divider />
          <Box px="md" py="sm">
            <Text size="xs" c="dimmed">
              {questions.filter((q) => questionStatus(q) !== 'unanswered').length} /{' '}
              {questions.length} answered
            </Text>
          </Box>
        </aside>

        <main className={classes.editorPanel}>
          {activeQuestion ? (
            <QuestionPanel
              question={activeQuestion}
              state={getState(activeQuestion.id)}
              onCodeChange={(code) => updateCode(activeQuestion.id, code)}
              onRun={() => runCode(activeQuestion)}
              onSave={() => saveAnswer(activeQuestion.id)}
            />
          ) : (
            <Center h="100%">
              <Text c="dimmed">Select a question.</Text>
            </Center>
          )}
        </main>
      </div>

      <ConfirmModal
        opened={confirmSubmitOpen}
        onClose={() => setConfirmSubmitOpen(false)}
        onConfirm={() => {
          setConfirmSubmitOpen(false);
          handleSubmitExam();
        }}
        title="Submit exam?"
        message="This cannot be undone. All saved answers will be graded."
        confirmLabel="Submit"
        confirmColor="violet"
        loading={submitting}
      />
    </div>
  );
}

interface QuestionPanelProps {
  question: ExamQuestionData;
  state: QuestionState;
  onCodeChange: (code: string) => void;
  onRun: () => void;
  onSave: () => void;
}

function QuestionPanel({ question, state, onCodeChange, onRun, onSave }: QuestionPanelProps) {
  return (
    <div className={classes.questionPanel}>
      <div className={classes.descriptionBar}>
        <Group justify="space-between" align="flex-start" px="md" pt="sm" pb="sm">
          <div className={classes.descriptionContent}>
            <Group gap="xs" mb={4}>
              <Text fw={700} size="sm" c="white">
                {question.title}
              </Text>
              <Badge variant="light" size="xs" className={classes.badgeLanguage}>
                {question.language}
              </Badge>
              <Badge color="gray" variant="light" size="xs">
                {question.maxScore} pts
              </Badge>
            </Group>
            {question.description && (
              <Text size="xs" c="dimmed" className={classes.questionDescription}>
                {question.description}
              </Text>
            )}
            {question.testCases.length > 0 && (
              <Group gap="xs" className={classes.descriptionActions}>
                {question.testCases.map((tc) => (
                  <Badge key={tc.id} color="gray" variant="outline" size="xs">
                    {tc.name}
                    {tc.inputData ? ` (stdin: ${tc.inputData.slice(0, 20)})` : ''}
                  </Badge>
                ))}
              </Group>
            )}
          </div>
          <Group gap="xs" className={classes.statusBadges}>
            {state.isSaved && !state.isDirty && (
              <Badge color="green" variant="light" size="xs" leftSection={<IconCheck size={10} />}>
                Saved
              </Badge>
            )}
            {state.isDirty && (
              <Badge color="yellow" variant="light" size="xs">
                Unsaved
              </Badge>
            )}
            {state.saveError && (
              <Text size="xs" c="red">
                {state.saveError}
              </Text>
            )}
          </Group>
        </Group>
      </div>

      <div className={classes.monacoWrapper}>
        <MonacoEditor
          language={toMonacoLanguage(question.language)}
          value={state.code}
          onChange={(val) => onCodeChange(val ?? '')}
          theme="vs-dark"
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 4,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>

      <div className={classes.actionBar}>
        <Group gap="sm" px="md" py="xs">
          <Button
            size="xs"
            variant="light"
            className={classes.btnRun}
            leftSection={<IconPlayerPlay size={14} />}
            loading={state.isRunning}
            disabled={!state.code.trim()}
            onClick={onRun}
          >
            Run
          </Button>
          <Button
            size="xs"
            variant="filled"
            className={classes.btnSave}
            leftSection={<IconDeviceFloppy size={14} />}
            loading={state.isSaving}
            disabled={!state.isDirty && state.isSaved}
            onClick={onSave}
          >
            Save Answer
          </Button>
        </Group>

        {(state.runResults.length > 0 || state.runError) && (
          <div className={classes.runResults}>
            {state.runError && (
              <Alert color="red" px="md" py="xs" radius={0}>
                <Text size="xs">{state.runError}</Text>
              </Alert>
            )}
            {state.runResults.map((r) => (
              <div key={r.testCaseId} className={classes.runResult}>
                <Group gap="xs" mb={4}>
                  <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                    {r.name}
                  </Text>
                  {r.input != null && (
                    <Badge size="xs" color="gray" variant="outline">
                      stdin: {r.input.slice(0, 30)}
                    </Badge>
                  )}
                  <Badge size="xs" color={r.exitCode === 0 ? 'green' : 'red'} variant="light">
                    exit {r.exitCode}
                  </Badge>
                </Group>
                <pre className={classes.output}>{r.actualOutput || '(no output)'}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
