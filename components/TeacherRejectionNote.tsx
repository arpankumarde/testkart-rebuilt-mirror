import React from 'react';
import { AlertCircle } from 'lucide-react';
import type { ContentRejection } from '../helpers/contentReviewStatus';
import styles from './TeacherRejectionNote.module.css';

interface TeacherRejectionNoteProps {
  rejection: ContentRejection;
  /** "large" for the top of an editor page. */
  size?: 'default' | 'large';
  className?: string;
}

/* The admin's reason on a rejected item, on the teacher's list cards and rows and atop its editor. */
export const TeacherRejectionNote: React.FC<TeacherRejectionNoteProps> = ({ rejection, size = 'default', className }) => (
  <div className={`${styles.note} ${size === 'large' ? styles.large : ''} ${className ?? ''}`}>
    <AlertCircle size={size === 'large' ? 18 : 15} className={styles.icon} aria-hidden="true" />
    <div className={styles.body}>
      <p className={styles.label}>Why it was rejected</p>
      <p className={styles.reason}>
        {rejection.reason ?? 'Our team asked for changes. Check the email we sent you for details.'}
      </p>
      <p className={styles.hint}>Fix it, then submit it for review again.</p>
    </div>
  </div>
);