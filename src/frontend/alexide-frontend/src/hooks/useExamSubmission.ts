import { useState, useCallback, useRef, useEffect } from 'react';
import { ExamQuestionData } from './useExam';

export interface RunResult {
  testCaseId: string;
  name: string;
  input: string | null;
  actualOutput: string;
  exitCode: number;
}

export interface QuestionState {
  code: string;
  isSaved: boolean;
  isDirty: boolean;
  isRunning: boolean;
  isSaving: boolean;
  runResults: RunResult[];
  runError: string | null;
  saveError: string | null;
}

type QuestionStateMap = Record<string, QuestionState>;

const DEFAULT_STATE: QuestionState = {
  code: '',
  isSaved: false,
  isDirty: false,
  isRunning: false,
  isSaving: false,
  runResults: [],
  runError: null,
  saveError: null,
};

export function useExamSubmission(
  saveAnswerFn: (questionId: string, code: string) => Promise<unknown>
) {
  const [states, setStates] = useState<QuestionStateMap>({});

  const statesRef = useRef(states);
  useEffect(() => {
    statesRef.current = states;
  }, [states]);

  const saveAnswerFnRef = useRef(saveAnswerFn);
  useEffect(() => {
    saveAnswerFnRef.current = saveAnswerFn;
  }, [saveAnswerFn]);

  const getState = useCallback(
    (questionId: string): QuestionState => states[questionId] ?? DEFAULT_STATE,
    [states]
  );

  const initCode = useCallback((questionId: string, code: string, fromServer = false) => {
    setStates((prev) => {
      const existing = prev[questionId];
      if (existing && (existing.isSaved || existing.code.trim().length > 0)) return prev;
      return {
        ...prev,
        [questionId]: {
          ...DEFAULT_STATE,
          code,
          isSaved: fromServer || code.length > 0,
        },
      };
    });
  }, []);

  const updateCode = useCallback((questionId: string, code: string) => {
    setStates((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] ?? DEFAULT_STATE),
        code,
        isDirty: true,
        isSaved: false,
      },
    }));
  }, []);

  const runCode = useCallback(async (question: ExamQuestionData) => {
    const code = statesRef.current[question.id]?.code ?? '';
    if (!code.trim()) return;

    const token = localStorage.getItem('authToken');
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
    };

    setStates((prev) => ({
      ...prev,
      [question.id]: {
        ...(prev[question.id] ?? DEFAULT_STATE),
        isRunning: true,
        runResults: [],
        runError: null,
      },
    }));

    try {
      const cases =
        question.testCases.length > 0
          ? question.testCases
          : [
              {
                id: '__default__',
                name: 'Run',
                inputData: null,
                sysArgs: null,
                orderIndex: 0,
                weight: 1,
              },
            ];

      const results: RunResult[] = await Promise.all(
        cases.map(async (tc) => {
          const res = await fetch('/api/backend/execute/code', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              code,
              language: question.language,
              stdin: tc.inputData ?? undefined,
              sysArgs: tc.sysArgs ?? undefined,
            }),
          });
          const json = await res.json();
          return {
            testCaseId: tc.id,
            name: tc.name,
            input: tc.inputData,
            actualOutput: json.data?.output ?? json.output ?? '',
            exitCode: json.data?.exitCode ?? json.exitCode ?? 0,
          };
        })
      );

      setStates((prev) => ({
        ...prev,
        [question.id]: {
          ...(prev[question.id] ?? DEFAULT_STATE),
          isRunning: false,
          runResults: results,
          runError: null,
        },
      }));
    } catch (err) {
      setStates((prev) => ({
        ...prev,
        [question.id]: {
          ...(prev[question.id] ?? DEFAULT_STATE),
          isRunning: false,
          runError: err instanceof Error ? err.message : 'Execution failed',
        },
      }));
    }
  }, []);

  const saveAnswer = useCallback(async (questionId: string) => {
    const code = statesRef.current[questionId]?.code ?? '';
    setStates((prev) => ({
      ...prev,
      [questionId]: { ...(prev[questionId] ?? DEFAULT_STATE), isSaving: true, saveError: null },
    }));
    try {
      await saveAnswerFnRef.current(questionId, code);
      setStates((prev) => ({
        ...prev,
        [questionId]: {
          ...(prev[questionId] ?? DEFAULT_STATE),
          isSaving: false,
          isSaved: true,
          isDirty: false,
        },
      }));
    } catch (err) {
      setStates((prev) => ({
        ...prev,
        [questionId]: {
          ...(prev[questionId] ?? DEFAULT_STATE),
          isSaving: false,
          saveError: err instanceof Error ? err.message : 'Failed to save',
        },
      }));
    }
  }, []);

  return { getState, initCode, updateCode, runCode, saveAnswer };
}
