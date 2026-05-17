import { useState, useEffect } from 'react';

function formatTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${String(h).padStart(2, '0')}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export interface ExamTimerResult {
  timeLeft: number;
  isExpired: boolean;
  isWarning: boolean;
  isCritical: boolean;
  display: string;
}

export function useExamTimer(expiresAt: string | null): ExamTimerResult {
  const [timeLeft, setTimeLeft] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;

    const tick = () => {
      const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
      if (diff <= 0) {
        setTimeLeft(0);
        setIsExpired(true);
      } else {
        setTimeLeft(diff);
        setIsExpired(false);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return {
    timeLeft,
    isExpired,
    isWarning: timeLeft > 0 && timeLeft <= 5 * 60,
    isCritical: timeLeft > 0 && timeLeft <= 60,
    display: formatTime(timeLeft),
  };
}
