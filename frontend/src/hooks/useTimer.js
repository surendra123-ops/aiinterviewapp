import { useState, useEffect, useRef } from 'react';

export const useTimer = (initialTime = 0) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(false);
  const [hasExpired, setHasExpired] = useState(false);
  const intervalRef = useRef(null);

  const startTimer = (time) => {
    if (time !== undefined) {
      setTimeLeft(time);
    }
    setHasExpired(false);
    setIsRunning(true);
  };

  const stopTimer = () => {
    setIsRunning(false);
  };

  const resetTimer = (time) => {
    if (time !== undefined) {
      setTimeLeft(time);
    } else {
      setTimeLeft(0);
    }
    setIsRunning(false);
    setHasExpired(false);
  };

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setHasExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isRunning, timeLeft]);

  return {
    timeLeft,
    isRunning,
    hasExpired,
    startTimer,
    stopTimer,
    resetTimer
  };
};
