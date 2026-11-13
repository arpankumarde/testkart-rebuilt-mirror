import React, { useId } from "react";
import { Input } from "./Input";
import styles from "./ReviewerNameField.module.css";

interface ReviewerNameFieldProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  disabled?: boolean;
  className?: string;
}

/** The required name input review forms show while the student still has a generated User_<id> name (see useReviewerName). */
export const ReviewerNameField: React.FC<ReviewerNameFieldProps> = ({ value, onChange, error, disabled, className }) => {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={`${styles.field} ${className ?? ""}`}>
      <label htmlFor={id} className={styles.label}>
        Your name
      </label>
      <Input
        id={id}
        type="text"
        autoComplete="name"
        placeholder="Enter your full name"
        maxLength={100}
        required
        value={value}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={hintId}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <p id={hintId} className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        <p id={hintId} className={styles.hint}>
          Shown with your review and saved to your profile.
        </p>
      )}
    </div>
  );
};
