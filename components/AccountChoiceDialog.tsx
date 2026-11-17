import React, { useState } from "react";
import { BookOpen, ChevronRight, GraduationCap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./Dialog";
import { Spinner } from "./Spinner";
import { postAccountChoice } from "../endpoints/auth/account-choice_POST.schema";
import { authErrorMessage } from "../helpers/authRequest";
import type { AccountChoiceOutput } from "../helpers/loginAccount";
import type { User } from "../helpers/User";
import styles from "./AccountChoiceDialog.module.css";

interface AccountChoiceDialogProps {
  /** The choice returned by a sign-in; null keeps the dialog closed. */
  choice: AccountChoiceOutput | null;
  /** The side the person was signing in on. */
  side: "student" | "teacher";
  onClose: () => void;
  onSignedIn: (user: User) => void;
}

/**
 * Shown when a sign-in matched only an account on the other side (helpers/loginAccount): continue to
 * that account, or set up one on this side with the same email or number.
 */
export const AccountChoiceDialog: React.FC<AccountChoiceDialogProps> = ({ choice, side, onClose, onSignedIn }) => {
  const [pending, setPending] = useState<"existing" | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const otherSide = side === "student" ? "teacher" : "student";

  const choose = async (option: "existing" | "create") => {
    if (!choice || pending) return;
    setPending(option);
    setError(null);
    try {
      const result = await postAccountChoice({ choiceToken: choice.choiceToken, choice: option });
      onSignedIn(result.user);
    } catch (err) {
      setError(authErrorMessage(err));
      setPending(null);
    }
  };

  const options = [
    {
      key: "existing" as const,
      icon: otherSide === "teacher" ? <BookOpen size={24} /> : <GraduationCap size={24} />,
      iconClass: otherSide === "teacher" ? styles.teacherIcon : styles.studentIcon,
      title: otherSide === "teacher" ? "Continue as teacher" : "Continue as student",
      subtitle: `Sign in to ${choice?.existingAccount.displayName ?? "your account"}`,
    },
    {
      key: "create" as const,
      icon: side === "teacher" ? <BookOpen size={24} /> : <GraduationCap size={24} />,
      iconClass: side === "teacher" ? styles.teacherIcon : styles.studentIcon,
      title: side === "teacher" ? "Set up a teacher account" : "Set up a student account",
      subtitle: "A separate account with the same sign-in",
    },
  ];

  return (
    <Dialog
      open={choice !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle className={styles.title}>
            {otherSide === "teacher" ? "You have a teacher account" : "You have a student account"}
          </DialogTitle>
          <DialogDescription className={styles.description}>
            {otherSide === "teacher"
              ? "This email or number belongs to a teacher account on Testkart."
              : "This email or number belongs to a student account on Testkart."}
          </DialogDescription>
        </DialogHeader>

        <div className={styles.options}>
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              className={styles.option}
              onClick={() => choose(option.key)}
              disabled={pending !== null}
              aria-busy={pending === option.key}
            >
              <span className={`${styles.iconWrapper} ${option.iconClass}`}>{option.icon}</span>
              <span className={styles.optionText}>
                <span className={styles.optionTitle}>{option.title}</span>
                <span className={styles.optionSubtitle}>{option.subtitle}</span>
              </span>
              {pending === option.key ? (
                <Spinner size="sm" />
              ) : (
                <ChevronRight className={styles.chevron} size={20} aria-hidden />
              )}
            </button>
          ))}
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
