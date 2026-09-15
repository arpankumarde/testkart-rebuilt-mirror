import React from "react";
import { BankVerificationStatus } from "../helpers/schema";
import { Badge } from "./Badge";
import styles from "./AdminBankDetails.module.css";

export interface AdminBankDetailsProps {
  bankName: string | null;
  bankAccountHolderName: string | null;
  bankAccountNumber: string | null;
  bankIfscCode: string | null;
  bankUpiId: string | null;
  bankVerificationStatus: BankVerificationStatus | null;
  variant: "table" | "card" | "dialog";
  showFullAccountNumber?: boolean;
}

export const AdminBankDetails: React.FC<AdminBankDetailsProps> = ({
  bankName,
  bankAccountHolderName,
  bankAccountNumber,
  bankIfscCode,
  bankUpiId,
  bankVerificationStatus,
  variant,
  showFullAccountNumber = false,
}) => {
  const hasDetails = bankAccountNumber || bankUpiId;

  if (!hasDetails) {
    return (
      <div className={variant === "table" ? `${styles.noDetails} ${styles.line}` : styles.noDetails}>
        No bank details added
      </div>
    );
  }

  const maskedAccount = bankAccountNumber 
    ? `XXXX${bankAccountNumber.slice(-4)}` 
    : "N/A";
  
  const displayAccount = showFullAccountNumber ? bankAccountNumber : maskedAccount;

  const getStatusClass = (status: BankVerificationStatus | null) => {
    if (status === "verified") return styles.verified;
    if (status === "rejected") return styles.rejected;
    return styles.pending;
  };

  if (variant === "dialog") {
    return (
      <div className={styles.bankInfoBox}>
        <h4>Bank Details</h4>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Account Holder</span>
            <span className={styles.infoValue}>{bankAccountHolderName || "N/A"}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Account Number</span>
            <span className={styles.infoValue}>{displayAccount || "N/A"}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>IFSC Code</span>
            <span className={styles.infoValue}>{bankIfscCode || "N/A"}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Bank Name</span>
            <span className={styles.infoValue}>{bankName || "N/A"}</span>
          </div>
          {bankUpiId && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>UPI ID</span>
              <span className={styles.infoValue}>{bankUpiId}</span>
            </div>
          )}
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Verification Status</span>
            <span className={styles.infoValue} style={{ textTransform: 'capitalize' }}>
              <span className={`${styles.verificationBadge} ${getStatusClass(bankVerificationStatus)}`} style={{ marginRight: '6px' }} />
              {bankVerificationStatus || "Pending"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const holder = bankAccountHolderName || "Unknown holder";
  const accountLine = bankAccountNumber ? `${displayAccount}, ${bankIfscCode || "No IFSC"}` : null;
  const upiLine = bankUpiId ? `UPI: ${bankUpiId}` : null;
  const isRejected = bankVerificationStatus === "rejected";

  /* Verified is the norm, so only the exception gets a flag. */
  const statusFlag = bankVerificationStatus !== "verified" && (
    <Badge
      variant={isRejected ? "destructive" : "warning"}
      className={styles.flag}
      title={isRejected ? "Bank details rejected" : "Bank details not verified yet"}
    >
      {isRejected ? "Rejected" : "Unverified"}
    </Badge>
  );

  if (variant === "table") {
    const holderLine = bankName ? `${holder}, ${bankName}` : holder;
    const detailLine = [accountLine, upiLine].filter(Boolean).join(", ");
    return (
      <div className={styles.stack}>
        <div className={styles.primaryLine}>
          <span className={styles.line} title={holderLine}>{holderLine}</span>
          {statusFlag}
        </div>
        <div className={`${styles.line} ${styles.secondaryLine}`} title={detailLine}>
          {detailLine}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <div className={styles.cardTitle}>
        <span>{holder}</span>
        {statusFlag}
      </div>
      {bankName && <div className={styles.cardLine}>{bankName}</div>}
      {accountLine && <div className={styles.cardLine}>{accountLine}</div>}
      {upiLine && <div className={styles.cardLine}>{upiLine}</div>}
    </div>
  );
};
