import React from 'react';
import { Mail } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { OAuthLoginButton } from './OAuthLoginButton';
import styles from './EmailConnectionPrompt.module.css';

interface EmailConnectionPromptProps {
  userRole: 'student' | 'teacher';
  className?: string;
}

export const EmailConnectionPrompt: React.FC<EmailConnectionPromptProps> = ({
  userRole,
  className,
}) => {
  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.iconWrapper}>
        <Mail className={styles.icon} size={24} />
      </div>
      <div className={styles.content}>
        <h3 className={styles.title}>Connect Your Email</h3>
        <p className={styles.description}>
          Add your email address to receive important updates, order
          confirmations, and enable password recovery.
        </p>
      </div>
      <div className={styles.actions}>
        <OAuthLoginButton provider="google" role={userRole} linkAccount={true}>
          <FcGoogle size={18} aria-hidden="true" />
          Connect with Google
        </OAuthLoginButton>
      </div>
    </div>
  );
};