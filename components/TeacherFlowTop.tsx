import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "./Button";
import { TeacherFlowSteps, type TeacherFlowStep } from "./TeacherFlowSteps";
import styles from "./TeacherFlowTop.module.css";

/*
 * The top of a guided teacher creator page (bundles, live tests): a Go back
 * button over the step track, laid out like TestSeriesSteps so every step page
 * opens the same way. `back` is a path, or a handler for a form that must
 * confirm before leaving.
 */
export const TeacherFlowTop = ({
  back,
  label,
  steps,
}: {
  back: string | (() => void);
  label: string;
  steps: TeacherFlowStep[];
}) => {
  const backContent = (
    <>
      <ArrowLeft size={16} aria-hidden="true" /> Go back
    </>
  );

  return (
    <div className={styles.top}>
      {typeof back === "string" ? (
        <Button asChild variant="ghost" size="sm" className={styles.back}>
          <Link to={back}>{backContent}</Link>
        </Button>
      ) : (
        <Button type="button" variant="ghost" size="sm" className={styles.back} onClick={back}>
          {backContent}
        </Button>
      )}
      <TeacherFlowSteps label={label} steps={steps} />
    </div>
  );
};