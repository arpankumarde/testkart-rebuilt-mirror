import React, { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, UserCheck, UserX, XCircle } from "lucide-react";
import { useAdminCancelLiveLessonMutation } from "../helpers/useAdminLiveLessons";
import { useAdminLiveAttendanceMutation, useAdminLiveOutcomeMutation } from "../helpers/useAdminLiveModule";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { ConsoleDialogContent, ConsoleDialogHeader, ConsoleDialogBody, ConsoleDialogFooter } from "./ConsoleDialog";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { Textarea } from "./Textarea";
import type { LivePaymentStatus } from "../endpoints/admin/live-lessons/bookings_GET.schema";
import type { LiveSessionStatus } from "../endpoints/admin/live-lessons/calendar_GET.schema";
import type { LiveAttendanceStatus } from "../endpoints/admin/live-lessons/session_GET.schema";
import styles from "./AdminLiveBits.module.css";

/*
 * Small shared pieces of the admin 1:1 live classes module. Two status sets, one colour scheme:
 * blue = not happened yet, green = happened, red = missed, grey = cancelled.
 */

const SESSION_STATUS: Record<LiveSessionStatus, { label: string; tone: string }> = {
  scheduled: { label: "Scheduled", tone: "powder" },
  completed: { label: "Completed", tone: "mint" },
  missed: { label: "Missed", tone: "rose" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const ATTENDANCE: Record<LiveAttendanceStatus, { label: string; tone: string }> = {
  upcoming: { label: "Upcoming", tone: "powder" },
  attended: { label: "Attended", tone: "mint" },
  missed: { label: "Missed", tone: "rose" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const sessionStatusLabel = (status: LiveSessionStatus) => SESSION_STATUS[status]?.label ?? status;
export const attendanceLabel = (status: LiveAttendanceStatus) => ATTENDANCE[status]?.label ?? status;

/* The teacher's session status: did the session take place. */
export const LiveSessionStatusPill: React.FC<{ status: LiveSessionStatus }> = ({ status }) => (
  <span className={`${styles.pill} ${styles[`tone_${SESSION_STATUS[status]?.tone ?? "neutral"}`]}`}>
    <span className={styles.dot} aria-hidden="true" />
    {sessionStatusLabel(status)}
  </span>
);

/* One learner's attendance. */
export const LiveAttendancePill: React.FC<{ status: LiveAttendanceStatus }> = ({ status }) => (
  <span className={`${styles.pill} ${styles[`tone_${ATTENDANCE[status]?.tone ?? "neutral"}`]}`}>
    <span className={styles.dot} aria-hidden="true" />
    {attendanceLabel(status)}
  </span>
);

const PAYMENT: Record<LivePaymentStatus, { label: string; tone: string }> = {
  paid: { label: "Paid", tone: "mint" },
  pending: { label: "Pending", tone: "butter" },
  refunded: { label: "Refunded", tone: "powder" },
  failed: { label: "Failed", tone: "rose" },
  credit: { label: "Paid by credit", tone: "mint" },
  free: { label: "Free", tone: "neutral" },
};

export const LivePaymentPill: React.FC<{ status: LivePaymentStatus }> = ({ status }) => (
  <span className={`${styles.pill} ${styles.pillSoft} ${styles[`tone_${PAYMENT[status].tone}`]}`}>{PAYMENT[status].label}</span>
);

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

/* completed_by / cancelled_by / attendance_marked_by values: "admin:<name>", "admin", "teacher", "student", "system". */
export const actorLabel = (v: string | null | undefined) => {
  if (!v) return null;
  if (v.startsWith("admin:")) return `Admin ${v.slice(6)}`;
  if (v === "student") return "The learner";
  if (v === "teacher") return "The teacher";
  if (v === "system") return "Testkart (automatic)";
  if (v === "admin") return "An admin";
  return v;
};

export const copyText = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied.`);
  } catch {
    toast.error(`Could not copy the ${label.toLowerCase()}.`);
  }
};

export type SessionTarget = { kind: "booking"; id: string; title: string };

/* Cancel a 1:1 session. */
export const LiveCancelDialog: React.FC<{ target: SessionTarget | null; onOpenChange: (open: boolean) => void }> = ({
  target,
  onOpenChange,
}) => {
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
          toast.success("Session cancelled.");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not cancel this session."),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="md">
        <ConsoleDialogHeader
          title={`Cancel "${target?.title ?? ""}"?`}
          description="The session is cancelled. A class paid with a trial or package credit goes back to the learner. Order payments are not refunded automatically: refund from Orders if needed."
        />
        <ConsoleDialogBody>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason, e.g. teacher unavailable, duplicate booking"
            aria-label="Reason for cancelling"
          />
        </ConsoleDialogBody>
        <ConsoleDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button type="button" variant="destructive" disabled={cancelMutation.isPending} onClick={handleCancel}>
            {cancelMutation.isPending ? "Cancelling..." : "Cancel session"}
          </Button>
        </ConsoleDialogFooter>
      </ConsoleDialogContent>
    </Dialog>
  );
};

/* Set the teacher's session status: the session took place (completed) or the teacher did not hold it (missed). */
export const LiveSessionOutcomeDialog: React.FC<{
  target: (SessionTarget & { action: "complete" | "missed" }) | null;
  onOpenChange: (open: boolean) => void;
}> = ({ target, onOpenChange }) => {
  const [note, setNote] = useState("");
  const outcome = useAdminLiveOutcomeMutation();
  React.useEffect(() => {
    if (target) setNote("");
  }, [target]);

  const missed = target?.action === "missed";
  const description = missed
    ? "The teacher did not hold this session. The teacher is not paid. A class paid with a credit goes back to the learner, who is emailed. Order payments are not refunded automatically."
    : "The teacher held this session. A class paid with a trial or package credit is settled now and the teacher is paid. Learner attendance is set separately.";

  return (
    <ConsoleConfirmDialog
      open={!!target}
      onOpenChange={onOpenChange}
      tone={missed ? "destructive" : "default"}
      icon={missed ? <XCircle /> : <CheckCircle2 />}
      title={missed ? "Mark session as missed?" : "Mark session as completed?"}
      description={description}
      confirmLabel={missed ? "Mark missed" : "Mark completed"}
      pendingLabel="Saving..."
      isPending={outcome.isPending}
      note={{ label: "Note (optional)", value: note, onChange: setNote, placeholder: missed ? "e.g. Teacher did not join" : "e.g. Confirmed with the teacher" }}
      onConfirm={() => {
        if (!target) return;
        outcome.mutate(
          { kind: target.kind, id: target.id, action: target.action, reason: note.trim() || undefined },
          {
            onSuccess: (r) => {
              toast.success(
                !r.changed
                  ? "This session was already marked."
                  : r.status === "missed"
                    ? r.creditReturned
                      ? "Marked missed. The class credit went back to the learner."
                      : "Marked missed."
                    : "Marked completed."
              );
              onOpenChange(false);
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update this session."),
          }
        );
      }}
    />
  );
};

export type AttendanceTarget = { type: "booking"; id: string; name: string; attendance: "attended" | "missed" };

/* Set one learner's attendance. It does not change the session status or any payment. */
export const LiveAttendanceDialog: React.FC<{ target: AttendanceTarget | null; onOpenChange: (open: boolean) => void }> = ({
  target,
  onOpenChange,
}) => {
  const [note, setNote] = useState("");
  const attendance = useAdminLiveAttendanceMutation();
  React.useEffect(() => {
    if (target) setNote("");
  }, [target]);

  const attended = target?.attendance === "attended";
  return (
    <ConsoleConfirmDialog
      open={!!target}
      onOpenChange={onOpenChange}
      icon={attended ? <UserCheck /> : <UserX />}
      title={`Mark ${target?.name ?? "this learner"} as ${attended ? "attended" : "missed"}?`}
      description="This only records the learner's attendance. The session status and payments do not change."
      confirmLabel={attended ? "Mark attended" : "Mark missed"}
      pendingLabel="Saving..."
      isPending={attendance.isPending}
      note={{ label: "Note (optional)", value: note, onChange: setNote, placeholder: "e.g. Joined by phone" }}
      onConfirm={() => {
        if (!target) return;
        attendance.mutate(
          { type: target.type, id: target.id, attendance: target.attendance, reason: note.trim() || undefined },
          {
            onSuccess: (r) => {
              toast.success(r.changed ? "Attendance updated." : "Attendance was already set.");
              onOpenChange(false);
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update attendance."),
          }
        );
      }}
    />
  );
};
