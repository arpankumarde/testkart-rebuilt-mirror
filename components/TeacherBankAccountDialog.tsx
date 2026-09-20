import React from "react";
import { type Selectable } from "kysely";
import { AlertCircle, CheckCircle, Clock, Info, Pencil, Plus, XCircle } from "lucide-react";
import { Dialog } from "./Dialog";
import {
  ConsoleDialogBody,
  ConsoleDialogContent,
  ConsoleDialogFooter,
  ConsoleDialogHeader,
} from "./ConsoleDialog";
import { Button } from "./Button";
import { type TeacherBankDetails } from "../helpers/schema";
import styles from "./TeacherBankAccountDialog.module.css";

interface TeacherBankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankDetails: Selectable<TeacherBankDetails> | null;
  /* True once the available balance reaches ₹100. A verified account can be edited below that too. */
  canManage: boolean;
  onEdit: () => void;
}

const STATUS = {
  pending: { label: "Pending verification", Icon: Clock, className: styles.statusPending },
  verified: { label: "Verified", Icon: CheckCircle, className: styles.statusVerified },
  rejected: { label: "Rejected", Icon: XCircle, className: styles.statusRejected },
};

const maskPan = (pan: string) => `${pan.slice(0, 2)}••••••${pan.slice(-2)}`;

const DetailRow = ({ label, value, code = false }: { label: string; value: string; code?: boolean }) => (
  <div className={styles.row}>
    <dt className={styles.label}>{label}</dt>
    <dd className={code ? styles.code : styles.value}>{value}</dd>
  </div>
);

/*
 * The teacher's payout account, kept off the Earnings page itself and opened
 * from its Bank account button. Read-only; editing hands over to
 * BankDetailsDialog through onEdit.
 */
export const TeacherBankAccountDialog: React.FC<TeacherBankAccountDialogProps> = ({
  open,
  onOpenChange,
  bankDetails,
  canManage,
  onEdit,
}) => {
  const status = bankDetails ? STATUS[bankDetails.verificationStatus] : null;
  const isVerified = bankDetails?.verificationStatus === "verified";
  const canEdit = canManage || isVerified;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="md">
        <ConsoleDialogHeader title="Bank account" description="Where Testkart sends your withdrawals.">
          {status && (
            <span className={`${styles.status} ${status.className}`}>
              <status.Icon size={14} aria-hidden="true" />
              {status.label}
            </span>
          )}
        </ConsoleDialogHeader>

        <ConsoleDialogBody>
          {bankDetails ? (
            <dl className={styles.details}>
              <DetailRow label="Account holder" value={bankDetails.bankAccountHolderName} />
              <DetailRow
                label="Account number"
                value={`•••• ${bankDetails.bankAccountNumber.slice(-4)}`}
                code
              />
              <DetailRow label="Bank" value={bankDetails.bankName} />
              <DetailRow label="IFSC" value={bankDetails.bankIfscCode} code />
              {bankDetails.upiId && <DetailRow label="UPI ID" value={bankDetails.upiId} code />}
              <DetailRow label="PAN" value={maskPan(bankDetails.panNumber)} code />
            </dl>
          ) : (
            <p className={styles.empty}>
              No bank account yet. Add one so your withdrawals have somewhere to go.
            </p>
          )}

          {bankDetails?.verificationStatus === "pending" && (
            <div className={`${styles.note} ${styles.noteInfo}`}>
              <Info size={16} aria-hidden="true" />
              <p>We are checking these details. You can withdraw once they are verified.</p>
            </div>
          )}

          {bankDetails?.verificationStatus === "rejected" && (
            <div className={`${styles.note} ${styles.noteError}`} role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <div className={styles.noteBody}>
                {bankDetails.rejectionReason && (
                  <p>
                    <strong>Why it was rejected:</strong> {bankDetails.rejectionReason}
                  </p>
                )}
                <p>Correct the details and submit them again.</p>
              </div>
            </div>
          )}

          {!canEdit && (
            <div className={`${styles.note} ${styles.noteInfo}`}>
              <Info size={16} aria-hidden="true" />
              <p>
                {bankDetails
                  ? "You can change these details once your available balance reaches ₹100."
                  : "You can add a bank account once your available balance reaches ₹100."}
              </p>
            </div>
          )}
        </ConsoleDialogBody>

        <ConsoleDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onEdit} disabled={!canEdit}>
            {bankDetails ? <Pencil size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {bankDetails ? "Edit bank details" : "Add bank details"}
          </Button>
        </ConsoleDialogFooter>
      </ConsoleDialogContent>
    </Dialog>
  );
};