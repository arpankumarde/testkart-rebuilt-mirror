import React, { useState } from "react";
import { LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./Dialog";
import { Button } from "./Button";
import styles from "./LogoutConfirmDialog.module.css";

interface LogoutConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Signs the user out. The dialog owns the pending state, closes itself once
   * this resolves, and keeps itself open with the message if it rejects.
   */
  onConfirm: () => Promise<void> | void;
  /** What the user is being signed out of, e.g. "the admin panel". */
  panelLabel: string;
}

/**
 * Shared logout confirmation for every panel - admin, student and teacher.
 * Logging out is one click away from destructive in a half-finished session,
 * so no call site should sign a user out without passing through this.
 */
export const LogoutConfirmDialog: React.FC<LogoutConfirmDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  panelLabel,
}) => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (isPending) return;
    setError(null);
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    setIsPending(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not log you out. Please try again."
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className={styles.content} hideCloseButton={isPending}>
        <DialogHeader>
          <div className={styles.titleRow}>
            <span className={styles.iconTile} aria-hidden="true">
              <LogOut size={20} />
            </span>
            <DialogTitle className={styles.title}>Log out?</DialogTitle>
          </div>
        </DialogHeader>
        <DialogDescription className={styles.description}>
          Are you sure you want to log out of {panelLabel}? You will need to log in
          again to continue.
        </DialogDescription>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Logging out..." : "Log out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
