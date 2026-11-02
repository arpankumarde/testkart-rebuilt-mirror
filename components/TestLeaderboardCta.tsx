import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Trophy, Lock } from 'lucide-react';
import { useAuth } from '../helpers/useAuth';
import { Button } from './Button';
import styles from './TestLeaderboardCta.module.css';

interface TestLeaderboardCtaProps {
  seriesId: number;
  canViewLeaderboard: boolean;
  /* Brings the purchase or free-enrol action into view. */
  onEnrol: () => void;
  /* False once the series has expired and can no longer be enrolled in. */
  canEnrol?: boolean;
  className?: string;
}

/*
 * The public series page never shows rankings. This panel points eligible
 * students to their dashboard leaderboard and asks everyone else to log in or
 * enrol. The server enforces the same rule on /_api/tests/leaderboard.
 */
export const TestLeaderboardCta: React.FC<TestLeaderboardCtaProps> = ({
  seriesId,
  canViewLeaderboard,
  onEnrol,
  canEnrol = true,
  className,
}) => {
  const { authState } = useAuth();
  const location = useLocation();
  const redirect = encodeURIComponent(location.pathname);

  let icon = <Lock size={22} />;
  let headline: string;
  let text: string;
  let actions: React.ReactNode;

  if (authState.type !== 'authenticated') {
    headline = 'See where you rank';
    text = 'Log in and enrol in this series, or attempt one of its tests, to unlock rankings, scores and timings.';
    actions = (
      <>
        <Button asChild>
          <Link to={`/login?redirectTo=${redirect}`}>Log in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={`/signup?redirectTo=${redirect}`}>Sign up</Link>
        </Button>
      </>
    );
  } else if (canViewLeaderboard) {
    icon = <Trophy size={22} />;
    headline = 'Your leaderboard is ready';
    text = 'See your rank, scores and timings against other students in this series from your dashboard.';
    actions = (
      <Button asChild>
        <Link to={`/student/tests/leaderboards?series=${seriesId}`}>Open leaderboard</Link>
      </Button>
    );
  } else if (canEnrol) {
    headline = 'Enrol to unlock the leaderboard';
    text = 'Rankings are open only to students enrolled in this series or who have attempted one of its tests.';
    actions = <Button onClick={onEnrol}>Enrol now</Button>;
  } else {
    headline = 'Leaderboard locked';
    text = 'Rankings are open only to students enrolled in this series or who have attempted one of its tests.';
    actions = null;
  }

  return (
    <div className={`${styles.panel} ${className ?? ''}`}>
      <span className={styles.icon} aria-hidden="true">{icon}</span>
      <div className={styles.body}>
        <h3 className={styles.headline}>{headline}</h3>
        <p className={styles.text}>{text}</p>
      </div>
      <div className={styles.actions}>{actions}</div>
    </div>
  );
};