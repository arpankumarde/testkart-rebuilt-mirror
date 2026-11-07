import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, HelpCircle, ArrowLeft, Lock, PauseCircle, Play, RotateCcw } from 'lucide-react';
import { Button } from './Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './Dialog';

import styles from './TestPreTestScreen.module.css';

export interface PausedAttemptSummary {
  answeredCount: number;
  totalQuestions: number;
  // e.g. "34:10 left" or "12:05 spent"; null when there is nothing useful to show
  timeLabel: string | null;
  savedAt: Date;
}

interface TestPreTestScreenProps {
  testItemTitle: string;
  durationMinutes: number;
  totalQuestions: number;
  onStartTest: () => void;
  isStarting: boolean;
  scheduledDate?: Date | null;
  // Still checking for a paused attempt; starting waits for the answer
  isCheckingPaused?: boolean;
  pausedAttempt?: PausedAttemptSummary | null;
  onResume?: () => void;
  onStartOver?: () => void;
  isResuming?: boolean;
}

/** The palette colour key, shown before the test so the colours mean something from the first question. */
export const ExamColourKey: React.FC = () => (
  <ul className={styles.colourKey} aria-label="What the question colours mean">
    <li><span className={`${styles.keySwatch} ${styles.keyAnswered}`} aria-hidden="true" />Answered</li>
    <li><span className={`${styles.keySwatch} ${styles.keyNotAnswered}`} aria-hidden="true" />Not answered</li>
    <li><span className={`${styles.keySwatch} ${styles.keyMarked}`} aria-hidden="true" />Marked for review</li>
    <li><span className={`${styles.keySwatch} ${styles.keyNotVisited}`} aria-hidden="true" />Not visited</li>
  </ul>
);

export const TestPreTestScreen: React.FC<TestPreTestScreenProps> = ({
  testItemTitle,
  durationMinutes,
  totalQuestions,
  onStartTest,
  isStarting,
  scheduledDate,
  isCheckingPaused = false,
  pausedAttempt,
  onResume,
  onStartOver,
  isResuming = false,
}) => {
  const [confirmStartOver, setConfirmStartOver] = useState(false);
  const isScheduledFuture = scheduledDate && new Date(scheduledDate) > new Date();
  const isBusy = isStarting || isResuming;
  const isTimed = durationMinutes > 0;

  return (
    <div className={`${styles.preTestContainer} tk-student tk-flow`}>
      <div className={styles.preTestInner}>
      <Link to="/student/dashboard" className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden="true" /> Back to dashboard
      </Link>
      <div className={styles.briefCard}>
        <h1 className={styles.preTestTitle}>{testItemTitle}</h1>
        <div className={styles.preTestDetails}>
          {(!isScheduledFuture || isTimed) && (
            <span className={`${styles.fact} ${styles.factTime}`}>
              <Clock className={styles.detailIcon} aria-hidden="true" />
              {isTimed ? `${durationMinutes} min` : 'No time limit'}
            </span>
          )}
          {/* A test scheduled for later keeps its question count hidden until it opens. */}
          {!isScheduledFuture && (
            <span className={`${styles.fact} ${styles.factQuestions}`}>
              <HelpCircle className={styles.detailIcon} aria-hidden="true" />
              {totalQuestions} questions
            </span>
          )}
        </div>

        {isScheduledFuture ? (
          <div className={styles.scheduledNotice}>
            <Lock size={20} aria-hidden="true" />
            <p>Opens on <strong>{new Date(scheduledDate!).toLocaleString()}</strong></p>
          </div>
        ) : pausedAttempt ? (
          <div className={styles.pausedCard}>
            <div className={styles.pausedHeading}>
              <PauseCircle size={22} className={styles.pausedIcon} aria-hidden="true" />
              <h2>You paused this test</h2>
            </div>
            <p className={styles.pausedText}>
              Pick up where you left off, or start again from the first question. Starting again clears the answers you saved.
            </p>
            <ul className={styles.pausedFacts}>
              <li>
                <strong>{pausedAttempt.answeredCount}</strong> of {pausedAttempt.totalQuestions} answered
              </li>
              {pausedAttempt.timeLabel && <li>{pausedAttempt.timeLabel}</li>}
              <li>
                Saved{' '}
                {new Date(pausedAttempt.savedAt).toLocaleString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </li>
            </ul>
            <div className={styles.pausedActions}>
              <Button size="lg" onClick={onResume} disabled={isBusy}>
                <Play size={16} /> {isResuming ? 'Resuming...' : 'Resume test'}
              </Button>
              <Button size="lg" variant="outline" onClick={() => setConfirmStartOver(true)} disabled={isBusy}>
                <RotateCcw size={16} /> {isStarting ? 'Starting...' : 'Start a new test'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.instructions}>
              <h2>Before you start</h2>
              <ul>
                <li>
                  {isTimed
                    ? 'The timer starts as soon as you press Start test.'
                    : 'There is no time limit. A timer shows how long you take.'}
                </li>
                <li>Jump to any question from the question panel, and mark the ones you want to check again.</li>
                <li>You can pause and come back later. The timer stops while you are away.</li>
                {isTimed && <li>The test submits itself when the time runs out.</li>}
              </ul>
            </div>
            <ExamColourKey />
          </>
        )}

        {!pausedAttempt && (
          <div className={styles.actions}>
            <Button
              size="lg"
              className={styles.startBtn}
              onClick={onStartTest}
              disabled={isStarting || isCheckingPaused || (isScheduledFuture ?? false)}
            >
              {isScheduledFuture
                ? 'Locked'
                : isStarting
                  ? 'Starting...'
                  : 'Start test'}
            </Button>
          </div>
        )}
      </div>
      </div>

      <Dialog open={confirmStartOver} onOpenChange={setConfirmStartOver}>
        <DialogContent className="tk-student tk-flow">
          <DialogHeader>
            <DialogTitle>Start a new test?</DialogTitle>
            <DialogDescription>
              Your paused attempt and its {pausedAttempt?.answeredCount ?? 0} saved{' '}
              {pausedAttempt?.answeredCount === 1 ? 'answer' : 'answers'} will be cleared, and the timer starts again from the beginning.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmStartOver(false)}>
              Keep paused attempt
            </Button>
            <Button
              onClick={() => {
                setConfirmStartOver(false);
                onStartOver?.();
              }}
            >
              Start new test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
