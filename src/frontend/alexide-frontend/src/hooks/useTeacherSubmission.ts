import { useState, useCallback } from 'react';

const getToken = () => localStorage.getItem('authToken');

export interface SubmissionFeedback {
  aiFeedback: string | null;
  aiFeedbackGeneratedAt: string | null;
  feedback: string | null;
  feedbackUpdatedAt: string | null;
}

export function useTeacherSubmissionFeedback(submissionId: string) {
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiFeedbackGeneratedAt, setAiFeedbackGeneratedAt] = useState<string | null>(null);
  const [teacherFeedback, setTeacherFeedback] = useState<string | null>(null);
  const [feedbackUpdatedAt, setFeedbackUpdatedAt] = useState<string | null>(null);

  const [generatingAI, setGeneratingAI] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const initFeedback = useCallback((initial: SubmissionFeedback) => {
    setAiFeedback(initial.aiFeedback);
    setAiFeedbackGeneratedAt(initial.aiFeedbackGeneratedAt);
    setTeacherFeedback(initial.feedback);
    setFeedbackUpdatedAt(initial.feedbackUpdatedAt);
  }, []);

  const generateAiFeedback = useCallback(async () => {
    setGeneratingAI(true);
    setAiError(null);
    try {
      const res = await fetch(`/api/backend/teacher/submit/${submissionId}/feedback/adopt-ai`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate AI feedback');
      setAiFeedback(data.data.aiFeedback);
      setAiFeedbackGeneratedAt(data.data.aiFeedbackGeneratedAt);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Unexpected error');
    } finally {
      setGeneratingAI(false);
    }
  }, [submissionId]);

  const saveTeacherFeedback = useCallback(
    async (feedbackText: string): Promise<boolean> => {
      setSavingFeedback(true);
      setFeedbackError(null);
      try {
        const res = await fetch(`/api/backend/teacher/submit/${submissionId}/feedback`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ feedback: feedbackText }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to save feedback');
        setTeacherFeedback(data.data.feedback);
        setFeedbackUpdatedAt(data.data.feedbackUpdatedAt);
        return true;
      } catch (e) {
        setFeedbackError(e instanceof Error ? e.message : 'Unexpected error');
        return false;
      } finally {
        setSavingFeedback(false);
      }
    },
    [submissionId]
  );

  return {
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
  };
}
