import React, { useLayoutEffect, useRef } from "react";
import { AlertTriangle, Check, Plus } from "lucide-react";
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
import {
  ReasonPreset,
  nextBlank,
  isPresetInUse,
  togglePreset,
  unfilledBlanks,
} from "../helpers/reasonPresets";
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
    /* Pills under the box that drop in a ready-made reason to edit. Confirm
       stays disabled while any [bracketed] blank from them is left in. */
    presets?: ReasonPreset[];
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<number | null>(null);
  const presets = note?.presets ?? [];
  const blanks = note ? unfilledBlanks(note.value, presets) : [];
  const noteMissing =
    (!!note?.required && note.value.trim() === "") || blanks.length > 0;

  /* After a pill adds text, select its first blank so typing replaces it. */
  useLayoutEffect(() => {
    const from = pendingSelection.current;
    const el = textareaRef.current;
    if (from === null || !el || !note) return;
    pendingSelection.current = null;
    const range = nextBlank(note.value, from) ?? [note.value.length, note.value.length];
    el.focus();
    el.setSelectionRange(range[0], range[1]);
    el.scrollTop = from > 0 ? el.scrollHeight : 0;
  }, [note?.value]);

  const applyPreset = (preset: ReasonPreset) => {
    if (!note) return;
    const next = togglePreset(note.value, preset, presets);
    pendingSelection.current = next.insertedAt >= 0 ? next.insertedAt : null;
    note.onChange(next.value);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending || noteMissing) return;
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${styles.content} ${presets.length > 0 ? styles.contentWide : ""}`}
      >
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
                ref={textareaRef}
                id="console-confirm-note"
                rows={presets.length > 0 ? 4 : 3}
                value={note.value}
                placeholder={note.placeholder}
                onChange={(e) => note.onChange(e.target.value)}
                disabled={isPending}
                aria-describedby={
                  blanks.length > 0 ? "console-confirm-blanks" : undefined
                }
              />
              {presets.length > 0 ? (
                <div className={styles.presets} role="group" aria-label="Common reasons">
                  {presets.map((preset) => {
                    const inUse = isPresetInUse(note.value, preset);
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        className={`${styles.preset} ${inUse ? styles.presetInUse : ""}`}
                        aria-pressed={inUse}
                        title={preset.text}
                        onClick={() => applyPreset(preset)}
                        disabled={isPending}
                      >
                        {inUse ? (
                          <Check size={14} aria-hidden="true" />
                        ) : (
                          <Plus size={14} aria-hidden="true" />
                        )}
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {blanks.length > 0 ? (
                <p className={styles.noteBlanks} id="console-confirm-blanks">
                  Fill in the blanks first: {blanks.join(", ")}
                </p>
              ) : null}
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
