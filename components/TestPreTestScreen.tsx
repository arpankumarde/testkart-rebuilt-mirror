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

  return (
    <div className={styles.preTestContainer}>
      <h1 className={styles.preTestTitle}>{testItemTitle}</h1>
      <div className={styles.preTestDetails}>
        {(!isScheduledFuture || durationMinutes > 0) && (
          <div>
            <Clock className={styles.detailIcon} />
            <span>{durationMinutes > 0 ? `${durationMinutes} Minutes` : "No Time Limit"}</span>
          </div>
        )}
        {/* A test scheduled for later keeps its question count hidden until it opens. */}
        {!isScheduledFuture && (
          <div>
            <HelpCircle className={styles.detailIcon} />
            <span>{totalQuestions} Questions</span>
          </div>
        )}
      </div>

      {isScheduledFuture ? (
        <div className={styles.scheduledNotice}>
          <Lock size={24} />
          <p>This test will be available on <strong>{new Date(scheduledDate!).toLocaleString()}</strong></p>
        </div>
      ) : pausedAttempt ? (
        <div className={styles.pausedCard}>
          <div className={styles.pausedHeading}>
            <PauseCircle size={22} className={styles.pausedIcon} />
            <h3>You paused this test</h3>
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
        <div className={styles.instructions}>
          <h3>Instructions</h3>
          <p>
            {durationMinutes === 0
              ? "There is no time limit for this test. A timer will track how long you take. Click 'Submit Test' when you are finished."
              : "Answer all questions to the best of your ability. You can navigate between questions. Click 'Submit Test' when you are finished. The test will be submitted automatically when the timer runs out."}{' '}
            You can pause and come back later; the timer stops while you are away.
          </p>
        </div>
      )}

      {!pausedAttempt && (
        <Button
          size="lg"
          onClick={onStartTest}
          disabled={isStarting || isCheckingPaused || (isScheduledFuture ?? false)}
        >
          {isScheduledFuture
            ? 'Locked'
            : isStarting
              ? 'Starting...'
              : 'Start Test'}
        </Button>
      )}
      <Button variant="ghost" asChild>
        <Link to="/student/dashboard">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </Button>

      <Dialog open={confirmStartOver} onOpenChange={setConfirmStartOver}>
        <DialogContent>
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