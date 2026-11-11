import React, { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Users, UserX, Video } from "lucide-react";
import { useAdminCancelLiveLessonMutation } from "../helpers/useAdminLiveLessons";
import { useAdminLiveOutcomeMutation } from "../helpers/useAdminLiveModule";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { ConsoleDialogContent, ConsoleDialogHeader, ConsoleDialogBody, ConsoleDialogFooter } from "./ConsoleDialog";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { Textarea } from "./Textarea";
import type { LivePaymentStatus } from "../endpoints/admin/live-lessons/bookings_GET.schema";
import styles from "./AdminLiveBits.module.css";

/* Small shared pieces of the admin Live Lessons module. */

const STATUS: Record<string, { label: string; tone: string }> = {
  scheduled: { label: "Scheduled", tone: "mint" },
  awaiting_completion: { label: "Awaiting completion", tone: "butter" },
  completed: { label: "Completed", tone: "lavender" },
  cancelled: { label: "Cancelled", tone: "rose" },
  no_show: { label: "No-show", tone: "powder" },
  removed: { label: "Removed", tone: "neutral" },
};

export const liveStatusLabel = (status: string) =>
  STATUS[status]?.label ?? status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const liveStatusTone = (status: string) => STATUS[status]?.tone ?? "neutral";

export const noShowPartyLabel = (party: string | null | undefined) =>
  party === "teacher" ? "teacher absent" : party === "learner" ? "learner absent" : null;

export const LiveStatusPill: React.FC<{ status: string; noShowParty?: string | null; className?: string }> = ({
  status,
  noShowParty,
  className,
}) => {
  const party = status === "no_show" ? noShowPartyLabel(noShowParty) : null;
  return (
    <span className={`${styles.pill} ${styles[`tone_${liveStatusTone(status)}`]} ${className ?? ""}`}>
      <span className={styles.dot} aria-hidden="true" />
      {liveStatusLabel(status)}
      {party ? `, ${party}` : ""}
    </span>
  );
};

/* Awaiting completion past the overdue window. */
export const LiveOverduePill: React.FC = () => (
  <span className={`${styles.pill} ${styles.tone_rose}`} title="Still not marked more than a day after it ended">
    Overdue
  </span>
);

const PAYMENT: Record<LivePaymentStatus, { label: string; tone: string }> = {
  paid: { label: "Paid", tone: "mint" },
  pending: { label: "Pending", tone: "butter" },
  refunded: { label: "Refunded", tone: "powder" },
  failed: { label: "Failed", tone: "rose" },
  credit: { label: "Paid by credit", tone: "mint" },
  free: { label: "Free", tone: "neutral" },
  none: { label: "No payment", tone: "neutral" },
};

export const livePaymentLabel = (status: LivePaymentStatus, _creditKind?: string | null) => PAYMENT[status].label;

export const LivePaymentPill: React.FC<{ status: LivePaymentStatus; creditKind?: string | null }> = ({ status, creditKind }) => (
  <span className={`${styles.pill} ${styles.pillSoft} ${styles[`tone_${PAYMENT[status].tone}`]}`}>
    {livePaymentLabel(status, creditKind)}
  </span>
);

export const LiveKindBadge: React.FC<{ kind: "booking" | "group"; withLabel?: boolean }> = ({ kind, withLabel }) => (
  <span className={`${styles.kind} ${kind === "group" ? styles.kindGroup : styles.kindBooking} ${withLabel ? styles.kindLabelled : ""}`}>
    {kind === "group" ? <Users aria-hidden="true" /> : <Video aria-hidden="true" />}
    {withLabel ? (kind === "group" ? "Group" : "1:1") : null}
  </span>
);

export const liveKindLabel = (kind: "booking" | "group") => (kind === "group" ? "Group lesson" : "1:1 session");

export const initialsOf = (name: string | null | undefined) => {
  if (!name) return "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase() || "?";
};

export const LiveAvatar: React.FC<{ name: string | null; src?: string | null; size?: "sm" | "md" | "lg"; tone?: "peach" | "sage" }> = ({
  name,
  src,
  size = "md",
  tone = "peach",
}) => {
  const [failed, setFailed] = useState(false);
  const usable = src && /^(https?:)?\//.test(src) && !failed;
  return (
    <span className={`${styles.avatar} ${styles[`avatar_${size}`]} ${styles[`avatar_${tone}`]}`} aria-hidden="true">
      {usable ? <img src={src!} alt="" onError={() => setFailed(true)} /> : initialsOf(name)}
    </span>
  );
};

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export type CancelTarget = { kind: "booking" | "group"; id: string; title: string };

/* Admin cancellation of a 1:1 booking or a whole group lesson, through the existing cancel endpoint. */
export const LiveCancelDialog: React.FC<{
  target: CancelTarget | null;
  onOpenChange: (open: boolean) => void;
  onCancelled?: () => void;
}> = ({ target, onOpenChange, onCancelled }) => {
  const [reason, setReason] = useState("");
  const cancelMutation = useAdminCancelLiveLessonMutation();
  const open = !!target;

  React.useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const handleCancel = () => {
    if (!target) return;
    if (reason.trim().length < 3) {
      toast.error("Give a short reason for the cancellation.");
      return;
    }
    cancelMutation.mutate(
      { kind: target.kind, id: target.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success("Cancelled. Affected people are not yet auto-notified - this records the decision for now.");
          onOpenChange(false);
          onCancelled?.();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not cancel this session."),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="md">
        <ConsoleDialogHeader
          title={`Cancel "${target?.title ?? ""}"`}
          description={
            target?.kind === "group"
              ? "This immediately marks the whole group lesson cancelled for every enrolled learner. Refund/credit handling follows the existing order and wallet rules for each payment, if any."
              : "This immediately marks the session cancelled. Refund/credit handling follows the existing order and wallet rules for its payment, if any."
          }
        />
        <ConsoleDialogBody>
          <Textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Reported policy violation, teacher unreachable, duplicate booking..."
          />
        </ConsoleDialogBody>
        <ConsoleDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button type="button" variant="destructive" disabled={cancelMutation.isPending} onClick={handleCancel}>
            {cancelMutation.isPending ? "Cancelling..." : target?.kind === "group" ? "Cancel group lesson" : "Cancel session"}
          </Button>
        </ConsoleDialogFooter>
      </ConsoleDialogContent>
    </Dialog>
  );
};

export const copyText = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied.`);
  } catch {
    toast.error(`Could not copy the ${label.toLowerCase()}.`);
  }
};

export type OutcomeTarget = { kind: "booking" | "group"; id: string; title: string };

/* Admin confirms that the session took place. Settles a credit-paid class at once. */
export const LiveCompleteDialog: React.FC<{ target: OutcomeTarget | null; onOpenChange: (open: boolean) => void }> = ({
  target,
  onOpenChange,
}) => {
  const [note, setNote] = useState("");
  const outcome = useAdminLiveOutcomeMutation();
  React.useEffect(() => {
    if (target) setNote("");
  }, [target]);

  return (
    <ConsoleConfirmDialog
      open={!!target}
      onOpenChange={onOpenChange}
      icon={<CheckCircle2 />}
      title={`Mark "${target?.title ?? ""}" completed?`}
      description={
        target?.kind === "group"
          ? "Confirm the lesson took place. Learners' seats stay as they are and the lesson moves to Completed."
          : "Confirm the class took place. A class paid with a trial or package credit is settled now: the credit is used and the teacher is paid. Order payments are not changed."
      }
      confirmLabel="Mark completed"
      pendingLabel="Saving..."
      isPending={outcome.isPending}
      note={{ label: "Note (optional)", value: note, onChange: setNote, placeholder: "e.g. Confirmed with the teacher by phone" }}
      onConfirm={() => {
        if (!target) return;
        outcome.mutate(
          { kind: target.kind, id: target.id, action: "complete", reason: note.trim() || undefined },
          {
            onSuccess: (r) => {
              toast.success(r.changed ? "Marked completed." : "This session was already closed.");
              onOpenChange(false);
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : "Could not mark this session completed."),
          }
        );
      }}
    />
  );
};

/* Admin records who did not attend a 1:1 session. */
export const LiveNoShowDialog: React.FC<{ target: OutcomeTarget | null; onOpenChange: (open: boolean) => void }> = ({
  target,
  onOpenChange,
}) => {
  const [party, setParty] = useState<"teacher" | "learner" | null>(null);
  const [reason, setReason] = useState("");
  const outcome = useAdminLiveOutcomeMutation();
  React.useEffect(() => {
    if (target) {
      setParty(null);
      setReason("");
    }
  }, [target]);

  const save = () => {
    if (!target || !party) return;
    outcome.mutate(
      { kind: "booking", id: target.id, action: "no_show", party, reason: reason.trim() || undefined },
      {
        onSuccess: (r) => {
          toast.success(
            !r.changed
              ? "This session was already marked a no-show."
              : r.creditReturned
                ? "Marked a teacher no-show. The class credit went back to the learner."
                : "Marked a no-show."
          );
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not mark this no-show."),
      }
    );
  };

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="md">
        <ConsoleDialogHeader title={`Mark "${target?.title ?? ""}" a no-show`} description="Who did not attend?" />
        <ConsoleDialogBody>
          <div className={styles.choices} role="radiogroup" aria-label="Who did not attend">
            {(
              [
                {
                  value: "learner",
                  label: "The learner",
                  hint: "Charged like a completed class. The teacher is paid.",
                },
                {
                  value: "teacher",
                  label: "The teacher",
                  hint: "The teacher is not paid. A credit-paid class goes back to the learner, who is emailed. Order payments are not refunded automatically: refund from Orders if needed.",
                },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={party === o.value}
                className={`${styles.choice} ${party === o.value ? styles.choiceOn : ""}`}
                onClick={() => setParty(o.value)}
              >
                <span className={styles.choiceLabel}>{o.label}</span>
                <span className={styles.choiceHint}>{o.hint}</span>
              </button>
            ))}
          </div>
          <label className={styles.fieldLabel} htmlFor="live-no-show-reason">
            Reason (optional)
          </label>
          <Textarea
            id="live-no-show-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Learner did not join and did not reply to messages"
          />
        </ConsoleDialogBody>
        <ConsoleDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button type="button" disabled={!party || outcome.isPending} onClick={save}>
            <UserX aria-hidden="true" /> {outcome.isPending ? "Saving..." : "Mark no-show"}
          </Button>
        </ConsoleDialogFooter>
      </ConsoleDialogContent>
    </Dialog>
  );
};