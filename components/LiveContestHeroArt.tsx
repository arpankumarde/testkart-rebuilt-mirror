import React, { useEffect, useState } from "react";
import { ArrowUp, Trophy, Users, Wallet } from "lucide-react";
import styles from "./LiveContestHeroArt.module.css";

type Row = {
  rank: number;
  name: string;
  initials: string;
  score: number;
  tone: "sage" | "blue" | "butter" | "lavender" | "mint";
  you?: boolean;
  rise?: number;
};

const ROWS: Row[] = [
  { rank: 1, name: "Aarav Sharma", initials: "AS", score: 186, tone: "blue" },
  { rank: 2, name: "Diya Kulkarni", initials: "DK", score: 181, tone: "lavender" },
  { rank: 3, name: "You", initials: "YO", score: 178, tone: "sage", you: true, rise: 4 },
  { rank: 4, name: "Rohan Mehta", initials: "RM", score: 174, tone: "butter" },
  { rank: 5, name: "Kabir Joshi", initials: "KJ", score: 169, tone: "mint" },
];

const START_SECONDS = 42 * 60 + 18;
const pad = (value: number) => String(value).padStart(2, "0");

/*
 * Ticks down once a second after mount, so the server render and the first
 * client render agree. Stays still for reduced motion.
 */
const useCountdown = () => {
  const [seconds, setSeconds] = useState(START_SECONDS);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setSeconds((current) => (current <= 1 ? START_SECONDS : current - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60];
};

/*
 * The /sell/host-live-exam hero illustration: a running contest with its
 * countdown, prize pool and live leaderboard, plus a small results note. Sizes
 * are in em off a container-relative font size, so it scales as one piece.
 * Sample data only.
 */
export const LiveContestHeroArt = () => {
  const [hours, minutes, secs] = useCountdown();

  return (
    <figure
      className={styles.art}
      role="img"
      aria-label="Testkart live mock test contest leaderboard with countdown timer and student ranks"
    >
      <div className={styles.stage} aria-hidden="true">
        <span className={styles.backdrop} />

        <div className={styles.window}>
          <div className={styles.head}>
            <span className={styles.livePill}>
              <span className={styles.liveDot} />
              Live
            </span>
            <span className={styles.headText}>
              <span className={styles.title}>SSC CGL Full Mock Contest</span>
              <span className={styles.meta}>100 questions &middot; 60 min</span>
            </span>
            <span className={styles.prize}>
              <Trophy />
              ₹5,000 pool
            </span>
          </div>

          <div className={styles.timerRow}>
            <span className={styles.timerLabel}>Ends in</span>
            <span className={styles.digits}>
              <span className={styles.digit}>{pad(hours)}</span>
              <span className={styles.colon}>:</span>
              <span className={styles.digit}>{pad(minutes)}</span>
              <span className={styles.colon}>:</span>
              <span className={styles.digit}>{pad(secs)}</span>
            </span>
            <span className={styles.joined}>
              <Users />
              1,248 competing
            </span>
          </div>

          <div className={styles.boardHead}>
            <span>#</span>
            <span>Student</span>
            <span className={styles.scoreHead}>Score</span>
          </div>
          <ol className={styles.board}>
            {ROWS.map((row) => (
              <li key={row.rank} className={`${styles.row} ${row.you ? styles.you : ""}`}>
                <span className={`${styles.rank} ${row.rank <= 3 ? styles[`medal${row.rank}`] : ""}`}>
                  {row.rank}
                </span>
                <span className={styles.student}>
                  <span className={`${styles.avatar} ${styles[row.tone]}`}>{row.initials}</span>
                  <span className={styles.name}>{row.name}</span>
                  {row.rise && (
                    <span className={styles.rise}>
                      <ArrowUp strokeWidth={3} />
                      {row.rise}
                    </span>
                  )}
                </span>
                <span className={styles.score}>
                  {row.score}
                  <span className={styles.outOf}>/200</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className={styles.note}>
          <span className={styles.noteIcon}>
            <Wallet />
          </span>
          <span className={styles.noteText}>
            <span className={styles.noteTitle}>Prizes sent</span>
            <span className={styles.noteMeta}>Top 3 paid automatically</span>
          </span>
        </div>
      </div>
    </figure>
  );
};
