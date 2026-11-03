import React from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import styles from "./TeacherFlowSteps.module.css";

export type TeacherFlowStepState = "done" | "current" | "todo";

export interface TeacherFlowStep {
  key: string;
  label: string;
  hint: string;
  state: TeacherFlowStepState;
  /* A step is a link with href, a button with onSelect, or plain text with neither. */
  href?: string | null;
  onSelect?: () => void;
  /* Gives the step its own colour once reached; without it, done is sage and current coral. */
  tone?: TeacherFlowStepTone;
}

export type TeacherFlowStepTone = "lavender" | "mint" | "butter" | "peach" | "blue";

/*
 * The step track teacher creators open with (test series, study notes), so the
 * teacher always sees where they are and what comes next. Each step has a bar
 * on top: in the step's tone (or sage) when done, the tone (or coral) for the
 * current step, a plain line ahead.
 */
export const TeacherFlowSteps = ({ steps, label }: { steps: TeacherFlowStep[]; label: string }) => (
  <nav className={styles.track} aria-label={label}>
    <ol className={styles.list} style={{ "--step-count": steps.length } as React.CSSProperties}>
      {steps.map((step, index) => {
        const body = (
          <>
            <span className={styles.dot} aria-hidden="true">
              {step.state === "done" ? <Check size={14} strokeWidth={3} /> : index + 1}
            </span>
            <span className={styles.text}>
              <span className={styles.label}>{step.label}</span>
              <span className={styles.hint}>{step.hint}</span>
            </span>
            <span className={styles.srOnly}>
              {step.state === "done" ? ", done" : step.state === "current" ? ", current step" : ""}
            </span>
          </>
        );
        const isCurrent = step.state === "current";
        return (
          <li key={step.key} className={styles.step} data-state={step.state} data-tone={step.tone}>
            {step.href && !isCurrent ? (
              <Link to={step.href} className={styles.stepInner}>{body}</Link>
            ) : step.onSelect ? (
              <button
                type="button"
                className={styles.stepInner}
                onClick={step.onSelect}
                aria-current={isCurrent ? "step" : undefined}
              >
                {body}
              </button>
            ) : (
              <span className={styles.stepInner} aria-current={isCurrent ? "step" : undefined}>
                {body}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);