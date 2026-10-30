import React from "react";
import type { GecPageContent } from "../helpers/gecModel";
import styles from "./GovtExamsCycle.module.css";

interface GovtExamsCycleProps {
  title: string;
  intro: string;
  steps: GecPageContent["cycle"];
}

/** The exam-cycle steps as a timeline: horizontal when the column is wide enough, vertical otherwise. */
export const GovtExamsCycle: React.FC<GovtExamsCycleProps> = ({ title, intro, steps }) => (
  <section id="exam-cycle" data-gec-section className={styles.section} aria-labelledby="exam-cycle-title">
    <h2 id="exam-cycle-title" className={styles.title}>
      {title}
    </h2>
    {intro && <p className={styles.intro}>{intro}</p>}
    <div className={styles.frame}>
      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li key={step.id} className={styles.step}>
            <span className={styles.marker} aria-hidden="true" />
            <span className={styles.label}>
              <span className={styles.srOnly}>Step </span>
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepText}>{step.text}</p>
          </li>
        ))}
      </ol>
    </div>
  </section>
);