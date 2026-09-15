import React from "react";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import { Button } from "./Button";
import { CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import styles from "./SponsorSuccessView.module.css";

interface SponsorSuccessViewProps {
  enrollmentSuccess: {
    phone?: string;
    email?: string;
    temporaryPassword?: string;
    credentialsSent?: boolean;
  };
  onClose: () => void;
}

export const SponsorSuccessView: React.FC<SponsorSuccessViewProps> = ({
  enrollmentSuccess,
  onClose,
}) => {
  const copyCredentials = () => {
    if (!enrollmentSuccess) return;
    const identifierText = enrollmentSuccess.phone
      ? `Phone: ${enrollmentSuccess.phone}`
      : `Email: ${enrollmentSuccess.email}`;
    const text = `Here are your login details for Testkart:\n${identifierText}\nPassword: ${enrollmentSuccess.temporaryPassword}`;
    navigator.clipboard.writeText(text);
    toast.success("Credentials copied to clipboard");
  };

  return (
    <DialogContent className={styles.dialogContent}>
      <DialogHeader>
        <DialogTitle className={styles.successTitle}>
          <CheckCircle2 className={styles.successIcon} size={24} />
          Student Account Created!
        </DialogTitle>
        <DialogDescription>
          A new student account has been created and enrolled.
        </DialogDescription>
      </DialogHeader>

      <div className={styles.successContent}>
        <p className={styles.successIntro}>Login details:</p>
        <div className={styles.credentialsBox}>
          {enrollmentSuccess.phone && (
            <div className={styles.credentialRow}>
              <span className={styles.credentialLabel}>Phone:</span>
              <span className={styles.credentialValue}>
                {enrollmentSuccess.phone}
              </span>
            </div>
          )}
          {enrollmentSuccess.email && !enrollmentSuccess.phone && (
            <div className={styles.credentialRow}>
              <span className={styles.credentialLabel}>Email:</span>
              <span className={styles.credentialValue}>
                {enrollmentSuccess.email}
              </span>
            </div>
          )}
          <div className={styles.credentialRow}>
            <span className={styles.credentialLabel}>Password:</span>
            <span className={styles.credentialValue}>
              {enrollmentSuccess.temporaryPassword}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className={styles.copyButton}
            onClick={copyCredentials}
            title="Copy details"
          >
            <Copy size={14} />
          </Button>
        </div>

        {enrollmentSuccess.credentialsSent && (
          <p className={styles.smsNote}>
            <CheckCircle2 size={14} /> SMS sent with login credentials.
          </p>
        )}

        <p className={styles.shareNote}>
          Please share these credentials with the student so they can log in.
        </p>
      </div>

      <DialogFooter>
        <Button onClick={onClose}>Close</Button>
      </DialogFooter>
    </DialogContent>
  );
};