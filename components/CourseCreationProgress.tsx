import React from 'react';
import { Check } from 'lucide-react';
import styles from './CourseCreationProgress.module.css';

interface CourseCreationProgressProps {
  currentStep: number;
  courseId: number | null;
  className?: string;
  onStepClick?: (step: number) => void;
  /** Blocks step changes, e.g. while an upload is still running. */
  disabled?: boolean;
}

const steps = [
  { number: 1, title: 'Basic Info' },
  { number: 2, title: 'Curriculum' },
  { number: 3, title: 'Review & Publish' },
];

/*
 * Step switcher for the course editor. Once a course exists every step can be
 * opened directly; the parent decides whether leaving the current step needs a
 * confirmation first.
 */
export const CourseCreationProgress: React.FC<CourseCreationProgressProps> = ({
  currentStep,
  courseId,
  className,
  onStepClick,
  disabled = false,
}) => {
  return (
    <div className={`${styles.progressContainer} ${className || ''}`}>
      <div className={styles.steps}>
        {steps.map((step, index) => {
          const isCompleted = step.number < currentStep;
          const isCurrent = step.number === currentStep;
          const isClickable = courseId !== null && !!onStepClick && !isCurrent && !disabled;

          return (
            <React.Fragment key={step.number}>
              <button
                type="button"
                className={`${styles.step} ${isCurrent ? styles.currentStep : ''}`}
                onClick={() => onStepClick?.(step.number)}
                disabled={!isClickable}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span
                  className={`${styles.stepIndicator} ${isCompleted ? styles.completed : ''} ${isCurrent ? styles.current : ''}`}
                  aria-hidden="true"
                >
                  {isCompleted ? <Check size={14} /> : step.number}
                </span>
                <span className={styles.stepTitle}>{step.title}</span>
              </button>
              {index < steps.length - 1 && (
                <div
                  className={`${styles.connector} ${isCompleted ? styles.connectorActive : ''}`}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
