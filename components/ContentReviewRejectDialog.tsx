import React, { useState, useEffect } from "react";
import { XCircle } from "lucide-react";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { ContentReviewAdminView } from "../endpoints/admin/content-reviews/list_GET.schema";

interface ContentReviewRejectDialogProps {
  review: ContentReviewAdminView | null;
  onClose: () => void;
  onSubmit: (reviewId: number, notes: string) => void;
  isPending: boolean;
  className?: string;
}

export const ContentReviewRejectDialog: React.FC<
  ContentReviewRejectDialogProps
> = ({ review, onClose, onSubmit, isPending }) => {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!review) setNotes("");
  }, [review]);

  const handleSubmit = () => {
    if (!review || !notes.trim()) return;
    onSubmit(review.id, notes.trim());
  };

  return (
    <ConsoleConfirmDialog
      open={!!review}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      tone="destructive"
      icon={<XCircle size={20} />}
      title="Reject content"
      description={
        <>
          Provide a reason for rejecting &ldquo;{review?.contentTitle}&rdquo;. This will be
          visible to the teacher.
        </>
      }
      confirmLabel="Reject content"
      pendingLabel="Rejecting..."
      isPending={isPending}
      onConfirm={handleSubmit}
      note={{
        label: "Admin notes",
        value: notes,
        onChange: setNotes,
        placeholder: "Explain why this content is being rejected...",
        hint: "Required.",
        required: true,
      }}
    />
  );
};