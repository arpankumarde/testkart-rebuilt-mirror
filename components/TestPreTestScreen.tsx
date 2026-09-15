import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, HelpCircle, ArrowLeft } from 'lucide-react';
import { Button } from './Button';
import { Lock } from 'lucide-react';

import styles from './TestPreTestScreen.module.css';

interface TestPreTestScreenProps {
  testItemTitle: string;
  durationMinutes: number;
  totalQuestions: number;
  onStartTest: () => void;
  isStarting: boolean;
  scheduledDate?: Date | null;
}

export const TestPreTestScreen: React.FC<TestPreTestScreenProps> = ({
  testItemTitle,
  durationMinutes,
  totalQuestions,
  onStartTest,
  isStarting,
  scheduledDate,
}) => {
  const isScheduledFuture = scheduledDate && new Date(scheduledDate) > new Date();

  return (
    <div className={styles.preTestContainer}>
      <h1 className={styles.preTestTitle}>{testItemTitle}</h1>
      <div className={styles.preTestDetails}>
        <div>
          <Clock className={styles.detailIcon} />
          <span>{durationMinutes > 0 ? `${durationMinutes} Minutes` : "No Time Limit"}</span>
        </div>
        <div>
          <HelpCircle className={styles.detailIcon} />
          <span>{totalQuestions} Questions</span>
        </div>
      </div>
      
      {isScheduledFuture ? (
        <div className={styles.scheduledNotice}>
          <Lock size={24} />
          <p>This test will be available on <strong>{new Date(scheduledDate!).toLocaleString()}</strong></p>
        </div>
      ) : (
        <div className={styles.instructions}>
          <h3>Instructions</h3>
          <p>
            {durationMinutes === 0
              ? "There is no time limit for this test. A timer will track how long you take. Click 'Submit Test' when you are finished."
              : "Answer all questions to the best of your ability. You can navigate between questions. Click 'Submit Test' when you are finished. The test will be submitted automatically when the timer runs out."}
          </p>
        </div>
      )}
      
      <Button
        size="lg"
        onClick={onStartTest}
        disabled={isStarting || (isScheduledFuture ?? false)}
      >
        {isScheduledFuture 
          ? 'Locked' 
          : isStarting 
            ? 'Starting...' 
            : 'Start Test'}
      </Button>
      <Button variant="ghost" asChild>
        <Link to="/student/dashboard">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </Button>
    </div>
  );
};