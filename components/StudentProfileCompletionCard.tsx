import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronRight } from 'lucide-react';
import { useStudentProfileCompletion } from '../helpers/useStudentProfileCompletion';
import { Button } from './Button';
import styles from './StudentProfileCompletionCard.module.css';

const RADIUS = 30;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The dashboard's profile nudge. Renders nothing once the profile is complete -
 * a permanent "all done" card is noise, and the sidebar meter disappears at the
 * same moment for the same reason.
 */
export const StudentProfileCompletionCard: React.FC = () => {
  const completion = useStudentProfileCompletion();

  if (!completion.isReady || completion.isComplete) return null;

  const { percent, doneCount, total, remaining } = completion;
  const nextTask = remaining[0];
  // What is left comes first: the actionable rows sit at the top of the list
  // rather than interleaved with the finished ones.
  const orderedTasks = [...completion.tasks].sort(
    (a, b) => Number(a.done) - Number(b.done)
  );

  return (
    <section className={styles.card} aria-labelledby="profile-completion-title">
      <div className={styles.head}>
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
          <p className={styles.subtitle}>
            {doneCount} of {total} done. {remaining.length} step
            {remaining.length === 1 ? '' : 's'} left before your account is fully set up.
          </p>
        </div>

        {nextTask && (
          <Button asChild variant="primary" className={styles.cta}>
            <Link to={nextTask.href}>
              Finish setup <ArrowRight size={16} />
            </Link>
          </Button>
        )}
      </div>

      <ul className={styles.tasks}>
        {orderedTasks.map((task) => (
          <li key={task.key} className={styles.task}>
            {task.done ? (
              <span className={`${styles.taskRow} ${styles.taskDone}`}>
                <span className={styles.markDone} aria-hidden="true">
                  <Check size={12} strokeWidth={3} />
                </span>
                <span className={styles.taskText}>
                  <span className={styles.taskLabel}>{task.label}</span>
                </span>
                <span className={styles.doneTag}>Done</span>
              </span>
            ) : (
              <Link to={task.href} className={styles.taskRow}>
                <span className={styles.markTodo} aria-hidden="true" />
                <span className={styles.taskText}>
                  <span className={styles.taskLabel}>{task.label}</span>
                  <span className={styles.taskHint}>{task.hint}</span>
                </span>
                <ChevronRight size={16} className={styles.taskChevron} aria-hidden="true" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};
