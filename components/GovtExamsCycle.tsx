import React from "react";
import { GEC_CYCLE, GEC_CYCLE_INTRO } from "../helpers/govtExamsCalendarData";
import styles from "./GovtExamsCycle.module.css";

/** The five-step cycle as a timeline: horizontal when the column is wide enough, vertical otherwise. */
export const GovtExamsCycle: React.FC = () => (
  <section id="exam-cycle" data-gec-section className={styles.section} aria-labelledby="exam-cycle-title">
    <h2 id="exam-cycle-title" className={styles.title}>
      How a government exam cycle works
    </h2>
    <p className={styles.intro}>{GEC_CYCLE_INTRO}</p>
    <div className={styles.frame}>
      <ol className={styles.steps}>
        {GEC_CYCLE.map(({ title, text }, index) => (
          <li key={title} className={styles.step}>
            <span className={styles.marker} aria-hidden="true" />
            <span className={styles.label}>
              <span className={styles.srOnly}>Step </span>
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className={styles.stepTitle}>{title}</h3>
            <p className={styles.stepText}>{text}</p>
          </li>
        ))}
      </ol>
    </div>
  </section>
);
