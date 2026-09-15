import React from "react";
import { Trash2 } from "lucide-react";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  itemName?: string;
  itemType: string;
}

/* Fixed deletion wording on top of ConsoleConfirmDialog, so every delete in the
   console reads and looks the same. */
export const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isPending,
  itemName,
  itemType,
}) => (
  <ConsoleConfirmDialog
    open={isOpen}
    onOpenChange={(open) => {
      if (!open) onClose();
    }}
    tone="destructive"
    icon={<Trash2 size={20} />}
    title={`Delete this ${itemType}?`}
    description={
      <>
        <strong>{itemName || `This ${itemType}`}</strong> will be removed permanently. This
        cannot be undone.
      </>
    }
    confirmLabel="Delete"
    pendingLabel="Deleting..."
    isPending={isPending}
    onConfirm={onConfirm}
  />
);