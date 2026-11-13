import React from "react";
import { CalendarCheck2, DoorOpen, Flag, Video } from "lucide-react";
import { AdminLivePolicyCard } from "./AdminLivePolicyCard";
import {
  BOOKING_MIN_NOTICE_MINUTES,
  FREE_CANCELLATION_CUTOFF_HOURS,
  ISSUE_REPORT_WINDOW_HOURS,
  JOIN_WINDOW_MINUTES_AFTER,
  JOIN_WINDOW_MINUTES_BEFORE,
  MENTORSHIP_SESSION_DURATIONS,
  PACKAGE_WEEKS,
} from "../helpers/liveLessonConfig";
import styles from "./AdminLiveDescription.module.css";

const STEPS = [
  {
    icon: <Video />,
    tone: "powder",
    title: "1:1 sessions",
    body: `Learners book an approved teacher for ${MENTORSHIP_SESSION_DURATIONS.join(" or ")} minutes, as a trial or as part of a ${PACKAGE_WEEKS}-week package, at least ${BOOKING_MIN_NOTICE_MINUTES} minutes ahead.`,
  },
  {
    icon: <DoorOpen />,
    tone: "mint",
    title: "Joining",
    body: `The live room opens ${JOIN_WINDOW_MINUTES_BEFORE} minutes before the start and stays joinable until ${JOIN_WINDOW_MINUTES_AFTER} minutes after it.`,
  },
  {
    icon: <CalendarCheck2 />,
    tone: "butter",
    title: "Cancelling",
    body: `Learners can cancel or reschedule a 1:1 class free until ${FREE_CANCELLATION_CUTOFF_HOURS} hours before it starts. Later than that, it is charged in full.`,
  },
  {
    icon: <Flag />,
    tone: "peach",
    title: "Missed sessions",
    body: `If a teacher does not turn up, the learner can report it within ${ISSUE_REPORT_WINDOW_HOURS} hours of the class ending. An admin settles it under Reports & Issues.`,
  },
] as const;

/* The Description tab, information only: how the feature works and its fixed policy defaults. */
export const AdminLiveDescription: React.FC = () => (
  <div className={styles.wrap}>
    <section className={styles.overview} aria-labelledby="live-overview-title">
      <div className={styles.overviewHead}>
        <h2 id="live-overview-title" className={styles.title}>
          How 1:1 live classes work
        </h2>
        <p className={styles.lead}>
          Approved teachers give 1:1 live classes on Testkart. Learners pay up front and join the live room from the app or the
          website. Multi-week live batches are run as live courses, managed on their own admin page.
        </p>
      </div>
      <ol className={styles.steps}>
        {STEPS.map((s) => (
          <li key={s.title} className={styles.step}>
            <span className={`${styles.stepIcon} ${styles[s.tone]}`} aria-hidden="true">
              {s.icon}
            </span>
            <span className={styles.stepTitle}>{s.title}</span>
            <span className={styles.stepBody}>{s.body}</span>
          </li>
        ))}
      </ol>
    </section>

    <AdminLivePolicyCard />
  </div>
);
