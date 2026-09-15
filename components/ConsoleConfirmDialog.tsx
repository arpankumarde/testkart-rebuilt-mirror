import React from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import { Button } from "./Button";
import { Textarea } from "./Textarea";
import styles from "./ConsoleConfirmDialog.module.css";

interface ConsoleConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  /* Destructive tones the icon red and makes the confirm button destructive. */
  tone?: "default" | "destructive";
  /* A lucide icon element. Defaults to a warning triangle. */
  icon?: React.ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  /*
   * An optional note captured alongside the confirmation. This is what replaces
   * window.prompt: the reason travels with the action instead of arriving in a
   * separate, unstyled browser dialog.
   */
  note?: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    hint?: string;
    required?: boolean;
  };
}

/*
 * The console's confirmation step for any action worth a second look - ending a
 * trial, deactivating an account, approving content, cancelling a plan.
 *
 * DeleteConfirmationDialog wraps this with fixed deletion wording. Nothing in
 * the console should fall back to window.confirm or window.prompt.
 */
export const ConsoleConfirmDialog: React.FC<ConsoleConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  tone = "default",
  icon,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Cancel",
  isPending = false,
  onConfirm,
  note,
}) => {
  const noteMissing = !!note?.required && note.value.trim() === "";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending || noteMissing) return;
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.content}>
        <DialogHeader>
          <div className={styles.header}>
            <span
              className={`${styles.icon} ${tone === "destructive" ? styles.iconDestructive : ""}`}
              aria-hidden="true"
            >
              {icon ?? <AlertTriangle size={20} />}
            </span>
            <div className={styles.headings}>
              <DialogTitle className={styles.title}>{title}</DialogTitle>
              {description ? (
                <DialogDescription className={styles.description}>
                  {description}
                </DialogDescription>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={styles.form}>
          {note ? (
            <div className={styles.noteField}>
              <label className={styles.noteLabel} htmlFor="console-confirm-note">
                {note.label}
              </label>
              <Textarea
                id="console-confirm-note"
                rows={3}
                value={note.value}
                placeholder={note.placeholder}
                onChange={(e) => note.onChange(e.target.value)}
                disabled={isPending}
              />
              {note.hint ? <p className={styles.noteHint}>{note.hint}</p> : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {cancelLabel}
            </Button>
            <Button
              type="submit"
              variant={tone === "destructive" ? "destructive" : "primary"}
              disabled={isPending || noteMissing}
            >
              {isPending ? (pendingLabel ?? `${confirmLabel}...`) : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
