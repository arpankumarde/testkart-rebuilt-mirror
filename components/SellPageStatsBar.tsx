import React, { useState, useEffect } from "react";
import { useInView } from "../helpers/useInView";
import styles from "./SellPageStatsBar.module.css";

// Animated Counter Component (Internal Helper)
const AnimatedCounter = ({
  end,
  duration = 2000,
  prefix = "",
  suffix = "",
}: {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) => {
  const [count, setCount] = useState(0);
  const [ref, isInView] = useInView<HTMLSpanElement>({ threshold: 0.5 });

  useEffect(() => {
    if (!isInView) return;

    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [end, duration, isInView]);

  return (
    <span ref={ref}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
};

export const SellPageStatsBar: React.FC = () => {
  return (
    <section className={styles.statsBar}>
      <div className={styles.statsContainer}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>
            <AnimatedCounter end={15} prefix="₹" suffix=" Cr+" />
          </span>
          <span className={styles.statLabel}>Paid to Teachers</span>
        </div>
        <div className={styles.statDivider}></div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>
            <AnimatedCounter end={50000} suffix="+" />
          </span>
          <span className={styles.statLabel}>Educators</span>
        </div>
        <div className={styles.statDivider}></div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>
            <AnimatedCounter end={5} suffix="M+" />
          </span>
          <span className={styles.statLabel}>Students</span>
        </div>
        <div className={styles.statDivider}></div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>4.8★</span>
          <span className={styles.statLabel}>Teacher Rating</span>
        </div>
      </div>
    </section>
  );
};