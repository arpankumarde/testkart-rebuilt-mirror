import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useStudentProfileCompletion } from '../helpers/useStudentProfileCompletion';
import { Button } from './Button';
import styles from './StudentProfileCompletionCard.module.css';

const RADIUS = 30;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The dashboard's profile nudge: how far along the profile is, the next step,
 * and one button to do it. The full checklist lives on the profile page.
 * Renders nothing once the profile is complete - a permanent "all done" card
 * is noise, and the sidebar meter disappears at the same moment for the same
 * reason.
 */
export const StudentProfileCompletionCard: React.FC = () => {
  const completion = useStudentProfileCompletion();

  if (!completion.isReady || completion.isComplete) return null;

  const { percent, remaining } = completion;
  const nextTask = remaining[0];

  return (
    <section className={styles.card} aria-labelledby="profile-completion-title">
      <div
        className={styles.ring}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Profile completion"
      >
        <svg viewBox="0 0 72 72" className={styles.ringSvg} aria-hidden="true">
          <circle className={styles.ringTrack} cx="36" cy="36" r={RADIUS} />
          <circle
            className={styles.ringFill}
            cx="36"
            cy="36"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
          />
        </svg>
        <span className={styles.ringValue}>{percent}%</span>
      </div>

      <div className={styles.headText}>
        <h2 id="profile-completion-title" className={styles.title}>
          Complete your profile
        </h2>
        {nextTask && <p className={styles.subtitle}>Next: {nextTask.label}</p>}
      </div>

      {nextTask && (
        <Button asChild variant="outline" size="sm" className={styles.cta}>
          <Link to={nextTask.href}>
            Finish setup <ArrowRight size={15} />
          </Link>
        </Button>
      )}
    </section>
  );
};
