import { useState, useEffect } from "react";

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isComplete: boolean;
}

/**
 * A custom React hook for a countdown timer.
 * @param targetTime - The future Date object, string, or timestamp to count down to.
 *
 * @param onComplete - An optional callback function to execute when the countdown finishes.
 * @returns An object with days, hours, minutes, seconds, and an isComplete flag.
 */
export const useCountdownTimer = (
  targetTime: Date | string | number,
  onComplete?: () => void
): Countdown => {
  const normalizedTarget = targetTime instanceof Date ? targetTime : new Date(targetTime);

  const calculateTimeLeft = () => {
    const difference = normalizedTarget.getTime() - new Date().getTime();
    let timeLeft: Countdown = {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isComplete: true,
    };

    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isComplete: false,
      };
    }
    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState<Countdown>(calculateTimeLeft());

  useEffect(() => {
    // Exit early if the target time is already in the past
    if (timeLeft.isComplete) {
      return;
    }

    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);

      if (newTimeLeft.isComplete) {
        clearInterval(timer);
        if (onComplete) {
          onComplete();
        }
      }
    }, 1000);

    // Cleanup function to clear the interval when the component unmounts
    // or when the targetTime changes.
    return () => clearInterval(timer);
  }, [normalizedTarget.getTime(), onComplete, timeLeft.isComplete]);

  return timeLeft;
};