import React from 'react';
import { Lock } from 'lucide-react';
import type { LiveTestStep } from '../helpers/liveTestFormValues';
import styles from './LiveTestStepIndicator.module.css';

const STEPS: { id: LiveTestStep; label: string }[] = [
  { id: 'info', label: 'Basic Info' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'prizes', label: 'Prizes' },
  { id: 'review', label: 'Review' },
];

interface LiveTestStepIndicatorProps {
  currentStep: LiveTestStep;
  // When provided (edit mode) every step is a button that jumps straight to it.
  onStepSelect?: (step: LiveTestStep) => void;
  // Steps shown with a lock icon because their fields are read-only.
  lockedSteps?: LiveTestStep[];
}

export const LiveTestStepIndicator: React.FC<LiveTestStepIndicatorProps> = ({
  currentStep,
  onStepSelect,
  lockedSteps = [],
}) => {
  return (
    <nav className={styles.stepIndicator} aria-label="Live test steps">
      {STEPS.map((step, index) => {
        const isActive = step.id === currentStep;
        const content = (
          <>
            <span className={styles.stepNumber}>{index + 1}</span>
            <span className={styles.stepLabel}>{step.label}</span>
            {lockedSteps.includes(step.id) && <Lock size={12} className={styles.lockIcon} aria-label="Locked" />}
          </>
        );
        return (
          <React.Fragment key={step.id}>
            {index > 0 && <div className={styles.stepSeparator} />}
            {onStepSelect ? (
              <button
                type="button"
                className={`${styles.step} ${styles.stepButton} ${isActive ? styles.active : ''}`}
                aria-current={isActive ? 'step' : undefined}
                onClick={() => onStepSelect(step.id)}
              >
                {content}
              </button>
            ) : (
              <div className={`${styles.step} ${isActive ? styles.active : ''}`} aria-current={isActive ? 'step' : undefined}>
                {content}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};