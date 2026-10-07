import { useEffect, useState } from "react";

const pad = (n: number) => n.toString().padStart(2, "0");

function formatDuration(diff: number): string {
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  if (days > 0) return `${days}d ${pad(hours)}h`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Ticking status label for a live test. A null startTime means the test is
 * open until endTime. initialIsLive seeds the first render (and SSR) so the
 * status badge does not flash before the first tick.
 */
export function useLiveCountdown(startTime: Date | null, endTime: Date, initialIsLive = false) {
  const [label, setLabel] = useState<string>(initialIsLive ? "Live now" : "");
  const [isLive, setIsLive] = useState<boolean>(initialIsLive);
  const [isEnded, setIsEnded] = useState<boolean>(false);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const start = startTime === null ? null : new Date(startTime).getTime();
      const end = new Date(endTime).getTime();

      if (now > end) {
        setLabel("Ended");
        setIsLive(false);
        setIsEnded(true);
      } else if (start === null || now >= start) {
        setLabel(`Ends in ${formatDuration(end - now)}`);
        setIsLive(true);
        setIsEnded(false);
      } else {
        setLabel(`Starts in ${formatDuration(start - now)}`);
        setIsLive(false);
        setIsEnded(false);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime, endTime]);

  return { label, isLive, isEnded };
}