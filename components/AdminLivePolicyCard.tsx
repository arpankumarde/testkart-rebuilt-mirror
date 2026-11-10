import React from "react";
import { CalendarClock, CalendarX2, DoorOpen, Lock, Timer, Users, Video } from "lucide-react";
import {
  JOIN_WINDOW_MINUTES_BEFORE,
  JOIN_WINDOW_MINUTES_AFTER,
  FREE_CANCELLATION_CUTOFF_HOURS,
  BOOKING_MIN_NOTICE_MINUTES,
  GROUP_LESSON_MIN_CAPACITY,
  GROUP_LESSON_MAX_CAPACITY,
  MENTORSHIP_SESSION_DURATIONS,
  VIDEO_PROVIDER_MODE,
} from "../helpers/liveLessonConfig";
import styles from "./AdminLivePolicyCard.module.css";

type Tone = "lavender" | "powder" | "butter" | "sage" | "mint" | "peach";

type Policy = {
  key: string;
  label: string;
  value: React.ReactNode;
  hint: string;
  icon: React.ReactNode;
  tone: Tone;
};

/* Read-only view of the code-level live lesson policy constants in helpers/liveLessonConfig. */
export const AdminLivePolicyCard: React.FC<{ className?: string }> = ({ className }) => {
  const isMock = VIDEO_PROVIDER_MODE === "mock";

  const policies: Policy[] = [
    {
      key: "join",
      label: "Join window",
      value: `${JOIN_WINDOW_MINUTES_BEFORE} min before to ${JOIN_WINDOW_MINUTES_AFTER} min after start`,
      hint: "When join links open and close",
      icon: <DoorOpen />,
      tone: "lavender",
    },
    {
      key: "notice",
      label: "Minimum booking notice",
      value: `${BOOKING_MIN_NOTICE_MINUTES} min`,
      hint: "Shortest lead time to book or reschedule",
      icon: <CalendarClock />,
      tone: "powder",
    },
    {
      key: "cancel",
      label: "Free cancellation until",
      value: `${FREE_CANCELLATION_CUTOFF_HOURS}h before start`,
      hint: "Later cancellations are charged in full",
      icon: <CalendarX2 />,
      tone: "butter",
    },
    {
      key: "durations",
      label: "1:1 durations",
      value: `${MENTORSHIP_SESSION_DURATIONS.join(" / ")} min`,
      hint: "Every approved teacher offers both",
      icon: <Timer />,
      tone: "sage",
    },
    {
      key: "capacity",
      label: "Group capacity",
      value: `${GROUP_LESSON_MIN_CAPACITY}-${GROUP_LESSON_MAX_CAPACITY} learners`,
      hint: "Enforced on every group lesson",
      icon: <Users />,
      tone: "mint",
    },
    {
      key: "video",
      label: "Video provider",
      value: (
        <span className={`${styles.providerChip} ${isMock ? styles.providerMock : styles.providerLive}`}>
          <span className={styles.providerDot} aria-hidden="true" />
          {isMock ? "Development mock - not live video" : "Live"}
        </span>
      ),
      hint: "Used for every join link",
      icon: <Video />,
      tone: "peach",
    },
  ];

  return (
    <section className={`${styles.card} ${className ?? ""}`} aria-labelledby="live-policy-title">
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id="live-policy-title" className={styles.title}>
            Session policies
          </h2>
          <p className={styles.subtitle}>Rules the platform enforces on every booking and group lesson.</p>
        </div>
        <span className={styles.readOnly} title="These are system-level defaults set in code. They cannot be edited here.">
          <Lock aria-hidden="true" />
          System defaults, read-only
        </span>
      </header>

      <dl className={styles.grid}>
        {policies.map((p) => (
          <div key={p.key} className={styles.item}>
            <span className={`${styles.iconTile} ${styles[p.tone]}`} aria-hidden="true">
              {p.icon}
            </span>
            <div className={styles.itemText}>
              <dt className={styles.label}>{p.label}</dt>
              <dd className={styles.value}>{p.value}</dd>
              <dd className={styles.hint}>{p.hint}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
};