import { useEffect, useState } from "react";

export function useLiveCountdown(startTime: Date, endTime: Date) {
  const [label, setLabel] = useState<string>("");
  const [isLive, setIsLive] = useState<boolean>(false);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();

      if (now >= start && now <= end) {
        setLabel("Live now");
        setIsLive(true);
      } else if (now < start) {
        const diff = start - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        const pad = (n: number) => n.toString().padStart(2, "0");
        if (days > 0) {
          setLabel(`Starts in ${days}d ${pad(hours)}h`);
        } else {
          setLabel(`Starts in ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
        }
        setIsLive(false);
      } else {
        setLabel("Ended");
        setIsLive(false);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime, endTime]);

  return { label, isLive };
}