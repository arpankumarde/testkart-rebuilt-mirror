import React, { useState } from "react";
import { CheckCircle2, EyeOff, XCircle } from "lucide-react";
import { Button } from "./Button";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { OutputType } from "../endpoints/admin/content-preview/details_GET.schema";
import { ContentStatusAction } from "../endpoints/admin/content-preview/status_POST.schema";
import { PREVIEW_TYPE_LABELS, useAdminContentStatusMutation } from "../helpers/useAdminContentPreview";

/* Status controls on the admin preview page: make live, move back to draft, or reject with a reason. */
export const AdminContentStatusActions = ({ data }: { data: OutputType }) => {
  const [action, setAction] = useState<ContentStatusAction | null>(null);
  const [note, setNote] = useState("");
  const mutation = useAdminContentStatusMutation();

  if (data.status === "trashed") return null;

  const live = data.status === "published";
  const noun = PREVIEW_TYPE_LABELS[data.type].toLowerCase();

  const open = (next: ContentStatusAction) => {
    setNote("");
    setAction(next);
  };

  const confirm = () => {
    if (!action) return;
    mutation.mutate(
      { type: data.type, id: data.id, action, note: note.trim() || undefined },
      { onSuccess: () => setAction(null) }
    );
  };

  const dialog =
    action === "publish"
      ? {
          title: data.inReview ? "Approve and make live" : "Make live",
          description: `Students can find and buy this ${noun} straight away. The teacher gets an approval email.`,
          confirmLabel: data.inReview ? "Approve and make live" : "Make live",
          pendingLabel: "Making live...",
          icon: <CheckCircle2 size={20} />,
          tone: "default" as const,
        }
      : action === "unpublish"
        ? {
            title: "Move back to draft",
            description: `Students can no longer find or buy this ${noun}. Anyone who already bought it keeps access. The teacher is not emailed.`,
            confirmLabel: "Move to draft",
            pendingLabel: "Moving...",
            icon: <EyeOff size={20} />,
            tone: "destructive" as const,
          }
        : {
            title: live ? `Reject this live ${noun}` : `Reject this ${noun}`,
            description: live
              ? `It comes off the site now. Anyone who already bought it keeps access. The teacher is emailed your reason.`
              : `The teacher is emailed your reason and can resubmit after making changes.`,
            confirmLabel: live ? "Reject and take down" : "Reject",
            pendingLabel: "Rejecting...",
            icon: <XCircle size={20} />,
            tone: "destructive" as const,
          };

  return (
    <>
      {data.inReview || !live ? (
        <Button variant="primary" onClick={() => open("publish")}>
          <CheckCircle2 size={16} />
          {data.inReview ? "Approve and make live" : "Make live"}
        </Button>
      ) : (
        <Button variant="outline" onClick={() => open("unpublish")}>
          <EyeOff size={16} />
          Move to draft
        </Button>
      )}
      {(live || data.inReview) && (
        <Button variant="destructive" onClick={() => open("reject")}>
          <XCircle size={16} />
          Reject
        </Button>
      )}

      <ConsoleConfirmDialog
        open={action !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !mutation.isPending) setAction(null);
        }}
        title={dialog.title}
        description={dialog.description}
        tone={dialog.tone}
        icon={dialog.icon}
        confirmLabel={dialog.confirmLabel}
        pendingLabel={dialog.pendingLabel}
        isPending={mutation.isPending}
        onConfirm={confirm}
        note={
          action === "reject"
            ? {
                label: "Reason for the teacher",
                value: note,
                onChange: setNote,
                placeholder: "Explain what needs to change...",
                hint: "Required. Sent to the teacher by email.",
                required: true,
              }
            : undefined
        }
      />
    </>
  );
};