import React, { useEffect, useState } from "react";
import { Ban, ShieldAlert, UserCheck } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { useAccountStatusMutation } from "../helpers/useAdminUserActions";
import { formatIstDateTime, type AccountStatus } from "../helpers/accountStatus";
import { SUSPENSION_DAY_OPTIONS } from "../endpoints/admin/user/account-status_POST.schema";
import { isPresetInUse, togglePreset, unfilledBlanks, type ReasonPreset } from "../helpers/reasonPresets";
import styles from "./AdminAccountStatusDialog.module.css";

export interface AccountStatusTarget {
  id: number;
  name: string;
  role: "student" | "teacher";
  accountStatus: AccountStatus;
  suspendedUntil: Date | null;
  suspensionReason: string | null;
  suspendedAt: Date | null;
  suspendedBy: string | null;
}

type Mode = "suspend" | "ban";

const UNTIL_LIFTED = "until-lifted";

const STUDENT_PRESETS: ReasonPreset[] = [
  { label: "Shared login", text: "Your account was used by more than one person, which our Terms do not allow." },
  { label: "Shared paid content", text: "Paid content from your account was shared outside Testkart ([where])." },
  { label: "Cheating in a test", text: "We found cheating in [test name], for example using more than one account or outside help." },
  { label: "Offer abuse", text: "Several accounts were used to claim the same offer, Tcoins or rewards more than once." },
  { label: "Abusive behaviour", text: "You sent abusive or threatening messages to [who]." },
];

const TEACHER_PRESETS: ReasonPreset[] = [
  { label: "Copied content", text: "[Product] contains questions or notes copied from [source] without permission." },
  { label: "Leaked paper", text: "[Product] contains a leaked or confidential exam paper." },
  { label: "Misleading listing", text: "[Product] does not deliver what its product page promises." },
  { label: "Fake reviews or sales", text: "We found reviews or purchases of your products made by accounts you control." },
  { label: "Student data misuse", text: "Student personal data from your account was used outside Testkart without their consent." },
  { label: "Payout details", text: "The PAN or bank details given for payouts could not be verified as yours." },
];

const formatDays = (days: number) => (days === 1 ? "1 day" : `${days} days`);

interface Props {
  target: AccountStatusTarget | null;
  onClose: () => void;
}

/*
 * Suspend, ban or reactivate a student or teacher. The reason is emailed to the user, so the
 * copy speaks to them. Suspending or banning signs the account out everywhere.
 */
export const AdminAccountStatusDialog: React.FC<Props> = ({ target, onClose }) => {
  const mutation = useAccountStatusMutation();
  const [mode, setMode] = useState<Mode>("suspend");
  const [duration, setDuration] = useState<string>("7");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!target) return;
    setMode("suspend");
    setDuration("7");
    setReason("");
    setNote("");
  }, [target?.id]);

  const blocked = target ? target.accountStatus !== "active" : false;
  const presets = target?.role === "teacher" ? TEACHER_PRESETS : STUDENT_PRESETS;
  const blanks = unfilledBlanks(reason, presets);
  const reasonTooShort = reason.trim().length < 5;
  const pending = mutation.isPending;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!target || pending) return;
    const done = { onSuccess: onClose };
    if (blocked) {
      mutation.mutate({ action: "reactivate", userId: target.id, note: note.trim() || undefined }, done);
      return;
    }
    if (reasonTooShort || blanks.length > 0) return;
    if (mode === "ban") {
      mutation.mutate({ action: "ban", userId: target.id, reason: reason.trim() }, done);
    } else {
      mutation.mutate(
        {
          action: "suspend",
          userId: target.id,
          durationDays: duration === UNTIL_LIFTED ? null : Number(duration),
          reason: reason.trim(),
        },
        done
      );
    }
  };

  const roleWord = target?.role === "teacher" ? "teacher" : "student";
  const consequences =
    target?.role === "teacher"
      ? "They are signed out everywhere and cannot sign in, and their team members lose access too. Their published products stay on sale until you unpublish them."
      : "They are signed out everywhere and cannot sign in or open their purchases.";

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className={styles.content}>
        <DialogHeader>
          <div className={styles.header}>
            <span className={`${styles.icon} ${blocked ? "" : styles.iconDanger}`} aria-hidden="true">
              {blocked ? <UserCheck size={20} /> : <ShieldAlert size={20} />}
            </span>
            <div className={styles.headings}>
              <DialogTitle className={styles.title}>
                {blocked ? `Reactivate this ${roleWord}?` : `Suspend or ban this ${roleWord}`}
              </DialogTitle>
              <DialogDescription className={styles.description}>
                {blocked
                  ? `${target?.name} will be able to sign in again, and we will email them.`
                  : `${target?.name}: ${consequences}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={submit} className={styles.form}>
          {blocked && target ? (
            <>
              <dl className={styles.current}>
                <div>
                  <dt>Status</dt>
                  <dd>
                    {target.accountStatus === "banned"
                      ? "Banned"
                      : target.suspendedUntil
                        ? `Suspended until ${formatIstDateTime(target.suspendedUntil)}`
                        : "Suspended until lifted"}
                  </dd>
                </div>
                {target.suspendedAt && (
                  <div>
                    <dt>Since</dt>
                    <dd>
                      {formatIstDateTime(target.suspendedAt)}
                      {target.suspendedBy ? `, by ${target.suspendedBy}` : ""}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Reason given</dt>
                  <dd className={styles.reasonText}>{target.suspensionReason || "No reason recorded"}</dd>
                </div>
              </dl>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="account-status-note">
                  Note for the record (optional)
                </label>
                <Textarea
                  id="account-status-note"
                  rows={2}
                  value={note}
                  maxLength={500}
                  placeholder="For example: appeal accepted on 14-11-2026"
                  onChange={(e) => setNote(e.target.value)}
                  disabled={pending}
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.modes} role="radiogroup" aria-label="Action">
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "suspend"}
                  className={styles.mode}
                  onClick={() => setMode("suspend")}
                  disabled={pending}
                >
                  <span className={styles.modeTitle}>Suspend</span>
                  <span className={styles.modeText}>For a set time, or until you lift it</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "ban"}
                  className={styles.mode}
                  onClick={() => setMode("ban")}
                  disabled={pending}
                >
                  <span className={styles.modeTitle}>Ban permanently</span>
                  <span className={styles.modeText}>Access to purchases ends for good</span>
                </button>
              </div>

              {mode === "suspend" && (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="account-status-duration">
                    Suspend for
                  </label>
                  <Select value={duration} onValueChange={setDuration} disabled={pending}>
                    <SelectTrigger id="account-status-duration" className={styles.select}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUSPENSION_DAY_OPTIONS.map((days) => (
                        <SelectItem key={days} value={String(days)}>
                          {formatDays(days)}
                        </SelectItem>
                      ))}
                      <SelectItem value={UNTIL_LIFTED}>Until I lift it</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.label} htmlFor="account-status-reason">
                  Reason (emailed to the {roleWord})
                </label>
                <Textarea
                  id="account-status-reason"
                  rows={4}
                  value={reason}
                  maxLength={500}
                  placeholder="Say what happened in plain words. The user reads this."
                  onChange={(e) => setReason(e.target.value)}
                  disabled={pending}
                />
                <div className={styles.presets} role="group" aria-label="Common reasons">
                  {presets.map((preset) => {
                    const inUse = isPresetInUse(reason, preset);
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        className={`${styles.preset} ${inUse ? styles.presetInUse : ""}`}
                        aria-pressed={inUse}
                        title={preset.text}
                        onClick={() => setReason(togglePreset(reason, preset, presets).value)}
                        disabled={pending}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                {blanks.length > 0 ? (
                  <p className={styles.blanks}>Fill in the blanks first: {blanks.join(", ")}</p>
                ) : (
                  <p className={styles.hint}>
                    The email links to the Account Suspension Policy and explains how to appeal.
                  </p>
                )}
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            {blocked ? (
              <Button type="submit" variant="primary" disabled={pending}>
                <UserCheck size={16} />
                {pending ? "Reactivating..." : "Reactivate"}
              </Button>
            ) : (
              <Button
                type="submit"
                variant="destructive"
                disabled={pending || reasonTooShort || blanks.length > 0}
              >
                <Ban size={16} />
                {pending
                  ? mode === "ban"
                    ? "Banning..."
                    : "Suspending..."
                  : mode === "ban"
                    ? "Ban permanently"
                    : duration === UNTIL_LIFTED
                      ? "Suspend until lifted"
                      : `Suspend for ${formatDays(Number(duration))}`}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};