import React from "react";
import styles from "./LiveField.module.css";

export type LiveTone = "peach" | "mint" | "lavender" | "blue" | "butter" | "sage";

/*
 * The building blocks every live teaching screen shares: a card with a toned
 * icon tile, and field labels that say plainly whether a field is required.
 * The application steps and Live settings both draw from here so they read as
 * one product.
 */
export const LiveCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  hint?: React.ReactNode;
  tone?: LiveTone;
  aside?: React.ReactNode;
  id?: string;
  className?: string;
  children?: React.ReactNode;
}> = ({ icon, title, hint, tone = "peach", aside, id, className, children }) => (
  <section className={`${styles.card} ${className ?? ""}`} id={id} aria-labelledby={id ? `${id}-title` : undefined}>
    <div className={styles.cardHead}>
      <span className={styles.iconTile} data-tone={tone} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.cardHeadText}>
        <h2 className={styles.cardTitle} id={id ? `${id}-title` : undefined}>
          {title}
        </h2>
        {hint && <p className={styles.cardHint}>{hint}</p>}
      </div>
      {aside && <div className={styles.cardAside}>{aside}</div>}
    </div>
    {children}
  </section>
);

export const FieldLabel: React.FC<{
  htmlFor?: string;
  id?: string;
  need: "required" | "optional";
  counter?: React.ReactNode;
  children: React.ReactNode;
}> = ({ htmlFor, id, need, counter, children }) => (
  <div className={styles.labelRow}>
    <label className={styles.label} htmlFor={htmlFor} id={id}>
      {children}
    </label>
    <span className={need === "required" ? styles.requiredTag : styles.optionalTag}>
      {need === "required" ? "Required" : "Optional"}
    </span>
    {counter !== undefined && <span className={styles.counter}>{counter}</span>}
  </div>
);

export const FieldHint: React.FC<{ id?: string; children: React.ReactNode }> = ({ id, children }) => (
  <p className={styles.hint} id={id}>
    {children}
  </p>
);

export const FieldError: React.FC<{ id?: string; message: string | null | undefined }> = ({ id, message }) =>
  message ? (
    <p className={styles.error} id={id} role="alert">
      {message}
    </p>
  ) : null;

export const StatusPill: React.FC<{ tone: LiveTone | "neutral"; children: React.ReactNode; className?: string }> = ({
  tone,
  children,
  className,
}) => (
  <span className={`${styles.pill} ${className ?? ""}`} data-tone={tone}>
    {children}
  </span>
);