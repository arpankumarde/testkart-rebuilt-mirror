import React from "react";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogHeader } from "./ConsoleDialog";
import { StudentBankDetailsForm } from "./StudentBankDetailsForm";

interface StudentBankDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* The bank details form, opened from the wallet's Bank details button. */
export const StudentBankDetailsDialog: React.FC<StudentBankDetailsDialogProps> = ({ open, onOpenChange }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <ConsoleDialogContent size="lg">
      <ConsoleDialogHeader
        title="Bank details"
        description="Where Testkart pays your withdrawals. Our team checks them before the first payout."
      />
      <ConsoleDialogBody>
        <StudentBankDetailsForm embedded onDone={() => onOpenChange(false)} />
      </ConsoleDialogBody>
    </ConsoleDialogContent>
  </Dialog>
);