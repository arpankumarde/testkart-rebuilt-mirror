import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../helpers/useAuth';
import { useStopImpersonatingMutation } from '../helpers/useImpersonation';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';
import styles from './ImpersonationBanner.module.css';

const INTERNAL_PREFIXES = ['/student', '/teacher', '/admin', '/portal', '/live-portal'];

export const ImpersonationBanner = () => {
  const { authState } = useAuth();
  const { pathname } = useLocation();

  const stopImpersonatingMutation = useStopImpersonatingMutation();

  const isInternalPage = INTERNAL_PREFIXES.some(prefix => pathname.startsWith(prefix));

  if (isInternalPage) {
    return null;
  }

  if (authState.type !== 'authenticated' || !authState.impersonatorAdminId) {
    return null;
  }

  const { user } = authState;
  const role = user.role.charAt(0).toUpperCase() + user.role.slice(1);

  return (
    <div className={styles.banner} data-impersonation-banner="">
      <div className={styles.content}>
        <AlertTriangle className={styles.icon} />
        <p className={styles.message}>
          <span className={styles.longOnly}>You are viewing</span>
          <span className={styles.shortOnly}>Viewing</span> as <strong>{user.displayName}</strong> ({role}).
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => stopImpersonatingMutation.mutate()}
        disabled={stopImpersonatingMutation.isPending}
        className={styles.button}
      >
        {stopImpersonatingMutation.isPending ? 'Switching...' : (
          <>
            <span className={styles.longOnly}>Switch Back to Admin</span>
            <span className={styles.shortOnly}>Back to Admin</span>
          </>
        )}
      </Button>
    </div>
  );
};