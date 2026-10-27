import React from "react";
import { AlertTriangle } from "lucide-react";
import styles from "./AuthErrorPage.module.css";

export interface AuthErrorPageProps {
  title?: string;
  message: string;
  icon?: React.ReactNode;
  /** Optional links or buttons shown under the message. */
  actions?: React.ReactNode;
  className?: string;
}

export const AuthErrorPage: React.FC<AuthErrorPageProps> = ({
  title = "Authentication Error",
  message,
  icon,
  actions,
  className,
}) => {
  return (
    <section className={`${styles.container} ${className || ""}`}>
      <div className={styles.card}>
        <div className={styles.iconContainer}>
          {icon || <AlertTriangle className={styles.icon} size={32} aria-hidden="true" />}
        </div>

        <h1 className={styles.title}>{title}</h1>

        <p className={styles.message}>{message}</p>

        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </section>
  );
};