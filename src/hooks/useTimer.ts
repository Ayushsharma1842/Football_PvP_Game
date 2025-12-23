import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTimerOptions {
  duration: number; // Total duration in seconds
  onComplete?: () => void;
  autoStart?: boolean;
}

interface UseTimerReturn {
  timeRemaining: number;
  isRunning: boolean;
  isComplete: boolean;
  progress: number; // 0 to 1 (1 = full, 0 = empty)
  start: () => void;
  pause: () => void;
  reset: () => void;
}

export function useTimer({
  duration,
  onComplete,
  autoStart = false,
}: UseTimerOptions): UseTimerReturn {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [isComplete, setIsComplete] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  const hasCalledCompleteRef = useRef(false);

  // Keep callback ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Call onComplete when timer finishes (outside of setState)
  useEffect(() => {
    if (isComplete && !hasCalledCompleteRef.current) {
      hasCalledCompleteRef.current = true;
      // Use setTimeout to ensure this runs after render
      setTimeout(() => {
        onCompleteRef.current?.();
      }, 0);
    }
  }, [isComplete]);

  // Timer tick logic
  useEffect(() => {
    if (!isRunning || isComplete) return;

    intervalRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => {
        const next = prev - 0.1;
        if (next <= 0) {
          setIsComplete(true);
          setIsRunning(false);
          return 0;
        }
        return next;
      });
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isComplete]);

  const start = useCallback(() => {
    if (!isComplete) {
      setIsRunning(true);
    }
  }, [isComplete]);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setTimeRemaining(duration);
    setIsRunning(false);
    setIsComplete(false);
    hasCalledCompleteRef.current = false;
  }, [duration]);

  const progress = timeRemaining / duration;

  return {
    timeRemaining,
    isRunning,
    isComplete,
    progress,
    start,
    pause,
    reset,
  };
}

// Hook for the two-phase timer (watch lock + answer time)
interface UseGameTimerOptions {
  watchLockDuration: number;
  answerDuration: number;
  onWatchLockComplete?: () => void;
  onAnswerTimeout?: () => void;
}

interface UseGameTimerReturn {
  phase: 'watching' | 'answering' | 'locked';
  watchLockRemaining: number;
  answerTimeRemaining: number;
  answerProgress: number;
  canAnswer: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useGameTimer({
  watchLockDuration,
  answerDuration,
  onWatchLockComplete,
  onAnswerTimeout,
}: UseGameTimerOptions): UseGameTimerReturn {
  const [phase, setPhase] = useState<'watching' | 'answering' | 'locked'>('watching');
  const [watchLockRemaining, setWatchLockRemaining] = useState(watchLockDuration);
  const [answerTimeRemaining, setAnswerTimeRemaining] = useState(answerDuration);
  const [isActive, setIsActive] = useState(false);
  
  const intervalRef = useRef<number | null>(null);
  const onWatchLockCompleteRef = useRef(onWatchLockComplete);
  const onAnswerTimeoutRef = useRef(onAnswerTimeout);

  useEffect(() => {
    onWatchLockCompleteRef.current = onWatchLockComplete;
    onAnswerTimeoutRef.current = onAnswerTimeout;
  }, [onWatchLockComplete, onAnswerTimeout]);

  useEffect(() => {
    if (!isActive || phase === 'locked') return;

    intervalRef.current = window.setInterval(() => {
      if (phase === 'watching') {
        setWatchLockRemaining((prev) => {
          const next = prev - 0.1;
          if (next <= 0) {
            setPhase('answering');
            setTimeout(() => onWatchLockCompleteRef.current?.(), 0);
            return 0;
          }
          return next;
        });
      } else if (phase === 'answering') {
        setAnswerTimeRemaining((prev) => {
          const next = prev - 0.1;
          if (next <= 0) {
            setPhase('locked');
            setIsActive(false);
            setTimeout(() => onAnswerTimeoutRef.current?.(), 0);
            return 0;
          }
          return next;
        });
      }
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, phase]);

  const start = useCallback(() => {
    setIsActive(true);
  }, []);

  const stop = useCallback(() => {
    setIsActive(false);
    setPhase('locked');
  }, []);

  const reset = useCallback(() => {
    setPhase('watching');
    setWatchLockRemaining(watchLockDuration);
    setAnswerTimeRemaining(answerDuration);
    setIsActive(false);
  }, [watchLockDuration, answerDuration]);

  return {
    phase,
    watchLockRemaining,
    answerTimeRemaining,
    answerProgress: answerTimeRemaining / answerDuration,
    canAnswer: phase === 'answering',
    start,
    stop,
    reset,
  };
}
