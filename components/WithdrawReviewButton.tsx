import React, { useState } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "./Button";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { useWithdrawContentReview } from "../helpers/useWithdrawContentReview";
import { CONTENT_NOUNS } from "../helpers/contentReviewStatus";
import { useAdminContentEdit } from "../helpers/useAdminContentEdit";
import type { InputType } from "../endpoints/teacher/content-reviews/withdraw_POST.schema";

type ContentKind = InputType["contentType"];

export const WITHDRAW_REVIEW_LABEL = "Take back from review";

interface WithdrawReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: ContentKind;
  contentId: number;
  title: string;
  onWithdrawn?: () => void;
}

/* Confirms taking an item out of the review queue. It goes back to draft; nothing is published or deleted. */
export const WithdrawReviewDialog: React.FC<WithdrawReviewDialogProps> = ({
  open,
  onOpenChange,
  contentType,
  contentId,
  title,
  onWithdrawn,
}) => {
  const withdraw = useWithdrawContentReview();
  const noun = CONTENT_NOUNS[contentType];

  return (
    <ConsoleConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!withdraw.isPending) onOpenChange(next);
      }}
      icon={<Undo2 size={20} />}
      title={`Take this ${noun} back from review?`}
      description={
        <>
          <strong>{title}</strong> leaves the review queue and goes back to draft. Nothing is deleted. Edit it and
          submit it for review again whenever you are ready.
        </>
      }
      confirmLabel="Take back"
      pendingLabel="Taking back..."
      isPending={withdraw.isPending}
      onConfirm={() =>
        withdraw.mutate(
          { contentType, contentId },
          {
            onSettled: () => onOpenChange(false),
            onSuccess: () => onWithdrawn?.(),
          }
        )
      }
    />
  );
};

interface WithdrawReviewButtonProps extends Omit<WithdrawReviewDialogProps, "open" | "onOpenChange"> {
  /* "inline" renders a plain text button styled by className, for list rows. */
  appearance?: "button" | "inline";
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}

/* Status is the teacher's call, so this is not offered while an admin edits their item. */
export const WithdrawReviewButton: React.FC<WithdrawReviewButtonProps> = (props) =>
  useAdminContentEdit() ? null : <WithdrawReviewButtonBody {...props} />;

const WithdrawReviewButtonBody: React.FC<WithdrawReviewButtonProps> = ({
  appearance = "button",
  size,
  className,
  ...dialogProps
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {appearance === "inline" ? (
        <button
          type="button"
          className={className}
          aria-label={`${WITHDRAW_REVIEW_LABEL}: ${dialogProps.title}`}
          onClick={() => setOpen(true)}
        >
          {WITHDRAW_REVIEW_LABEL}
        </button>
      ) : (
        <Button type="button" variant="outline" size={size} className={className} onClick={() => setOpen(true)}>
          <Undo2 size={16} />
          {WITHDRAW_REVIEW_LABEL}
        </Button>
      )}
      <WithdrawReviewDialog open={open} onOpenChange={setOpen} {...dialogProps} />
    </>
  );
};