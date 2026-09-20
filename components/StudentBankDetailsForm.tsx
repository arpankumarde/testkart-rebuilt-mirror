import React, { useEffect, useState } from "react";
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage } from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { R2FileUploader } from "./R2FileUploader";
import { BankIfscFields } from "./BankIfscFields";
import { useStudentBankDetailsQuery, useAddStudentBankDetails } from "../helpers/useStudentBankDetails";
import { useStudentWalletBalance } from "../helpers/useStudentWallet";
import { useUploadLimits } from "../helpers/useUploadLimits";
import { schema as bankDetailsSchema, type InputType as BankDetailsInput } from "../endpoints/student/bank-details/add_POST.schema";
import { AlertCircle, CheckCircle, Info, Lock } from "lucide-react";
import { toast } from "sonner";
import styles from "./StudentBankDetailsForm.module.css";

const MIN_BANK_DETAILS_BALANCE = 50;

const formatINR = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
};

interface StudentBankDetailsFormProps {
  /* Inside a dialog: drop the form's own panel, the dialog is the surface. */
  embedded?: boolean;
  /* Called once the details are saved. */
  onDone?: () => void;
}

export const StudentBankDetailsForm: React.FC<StudentBankDetailsFormProps> = ({ embedded = false, onDone }) => {
  const { data: existingDetails, isFetching } = useStudentBankDetailsQuery();
  const { mutateAsync: saveBankDetails, isPending: isSaving } = useAddStudentBankDetails();
  const { data: balanceData, isFetching: isLoadingBalance } = useStudentWalletBalance();
  const uploadLimits = useUploadLimits();

  const availableBalance = balanceData?.availableBalance ?? 0;
  const isEligible = availableBalance >= MIN_BANK_DETAILS_BALANCE;
  const isFieldsDisabled = isSaving || isLoadingBalance || !isEligible;

  const [isEditing, setIsEditing] = useState(false);
  const [panFileId, setPanFileId] = useState<string>("");

  const form = useForm({
    schema: bankDetailsSchema,
    defaultValues: {
      bankAccountHolderName: "",
      bankAccountNumber: "",
      bankIfscCode: "",
      bankName: "",
      upiId: "",
      panNumber: "",
      panCardImageBase64: "",
    },
  });

  useEffect(() => {
    if (existingDetails) {
      form.setValues({
        bankAccountHolderName: existingDetails.bankAccountHolderName,
        bankAccountNumber: existingDetails.bankAccountNumber,
        bankIfscCode: existingDetails.bankIfscCode,
        bankName: existingDetails.bankName,
        upiId: existingDetails.upiId || "",
        panNumber: existingDetails.panNumber,
        panCardImageBase64: existingDetails.panCardImageBase64,
      });
      // Lock form if already verified and not actively editing
      if (existingDetails.verificationStatus === "verified") {
        setIsEditing(false);
      } else {
        setIsEditing(true);
      }
    } else {
      setIsEditing(true);
    }
  }, [existingDetails, form.setValues]);

  const onSubmit = async (values: BankDetailsInput) => {
    try {
      await saveBankDetails(values);
      toast.success("Bank details submitted for verification.");
      setIsEditing(false);
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your bank details. Try again.");
    }
  };

  if (isFetching && !existingDetails) {
    return (
      <div className={embedded ? undefined : styles.loadingContainer}>
        <Skeleton style={{ height: "4rem", width: "100%", marginBottom: "1rem" }} />
        <Skeleton style={{ height: "10rem", width: "100%" }} />
      </div>
    );
  }

  const isVerified = existingDetails?.verificationStatus === "verified";
  const isRejected = existingDetails?.verificationStatus === "rejected";
  const isPending = existingDetails?.verificationStatus === "pending";

  return (
    <div className={`${styles.container} ${embedded ? styles.embedded : ""}`}>
      {existingDetails && (
        <div className={styles.status}>
          <div className={styles.statusRow}>
            {isVerified && <Badge variant="success"><CheckCircle size={14} className={styles.badgeIcon} /> Verified</Badge>}
            {isPending && <Badge variant="warning"><Info size={14} className={styles.badgeIcon} /> In review</Badge>}
            {isRejected && <Badge variant="destructive"><AlertCircle size={14} className={styles.badgeIcon} /> Rejected</Badge>}
            <span className={styles.statusHint}>
              {isVerified && "Withdrawals are paid to this account."}
              {isPending && "Your details are with our team for review."}
              {isRejected && "Update the details below and submit them again."}
            </span>
          </div>

          {isRejected && existingDetails.rejectionReason && (
            <div className={styles.reasonNote}>
              <span className={styles.reasonLabel}>Why it was rejected</span>
              <p className={styles.reasonText}>{existingDetails.rejectionReason}</p>
            </div>
          )}
        </div>
      )}

      {isVerified && !isEditing && (
        <div className={styles.lockedSection}>
          <div className={styles.lockedIconContainer}>
            <Lock size={32} className={styles.lockedIcon} />
          </div>
          <h3 className={styles.lockedTitle}>Your bank details are verified</h3>
          <p className={styles.lockedText}>
            If you change these details they go back for review, and you cannot request a withdrawal until that finishes.
          </p>
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            Edit details
          </Button>
        </div>
      )}

      {isEditing && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
            {isVerified && (
              <div className={styles.editWarning}>
                <Info size={16} />
                <span>Submitting new details will change your status to pending verification.</span>
              </div>
            )}

            {!isLoadingBalance && !isEligible && (
              <div className={styles.ineligibleAlert}>
                <Lock size={16} />
                <span>
                  You need at least {formatINR(MIN_BANK_DETAILS_BALANCE)} in prize money before you can submit bank details.
                  Your current balance is {formatINR(availableBalance)}.
                </span>
              </div>
            )}

            {/* No extra disabled styling: the fieldset is natively disabled, so
                Input's own :disabled rules already render the fields as
                unavailable. It used to carry opacity: 0.55 on top of that,
                which put every label at roughly half contrast. */}
            <fieldset
              className={styles.formGrid}
              disabled={isFieldsDisabled}
              aria-disabled={isFieldsDisabled}
            >
              <FormItem name="bankAccountHolderName">
                <FormLabel>Account holder name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="As it appears on your bank account"
                    value={form.values.bankAccountHolderName}
                    onChange={(e) => form.setValues(prev => ({ ...prev, bankAccountHolderName: e.target.value }))}
                    disabled={isFieldsDisabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="bankAccountNumber">
                <FormLabel>Account number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Your bank account number"
                    value={form.values.bankAccountNumber}
                    onChange={(e) => form.setValues(prev => ({ ...prev, bankAccountNumber: e.target.value }))}
                    disabled={isFieldsDisabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <BankIfscFields
                ifsc={form.values.bankIfscCode}
                bankName={form.values.bankName}
                onIfscChange={(bankIfscCode) => form.setValues(prev => ({ ...prev, bankIfscCode }))}
                onBankNameChange={(bankName) => form.setValues(prev => ({ ...prev, bankName }))}
                disabled={isFieldsDisabled}
              />

              <FormItem name="panNumber">
                <FormLabel>PAN number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. ABCDE1234F"
                    value={form.values.panNumber}
                    onChange={(e) => form.setValues(prev => ({ ...prev, panNumber: e.target.value.toUpperCase() }))}
                    disabled={isFieldsDisabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="upiId">
                <FormLabel>UPI ID (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. user@bank"
                    value={form.values.upiId}
                    onChange={(e) => form.setValues(prev => ({ ...prev, upiId: e.target.value }))}
                    disabled={isFieldsDisabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </fieldset>

            <div className={`${styles.panUploadSection} ${isFieldsDisabled ? styles.uploaderDisabled : ""}`}>
              <FormItem name="panCardImageBase64">
                <FormLabel>PAN card image</FormLabel>
                <FormControl>
                  <R2FileUploader
                    folder="kyc/students"
                    label="Upload your PAN card"
                    maxSizeInMB={uploadLimits.kycDocumentMaxMb}
                    acceptedTypes="image/jpeg,image/png,image/webp"
                    aspectRatio="3 / 2"
                    currentImageUrl={form.values.panCardImageBase64 && form.values.panCardImageBase64.startsWith("https://") ? form.values.panCardImageBase64 : undefined}
                    currentFileId={panFileId || undefined}
                    onSuccess={(result) => {
                      form.setValues((prev) => ({
                        ...prev,
                        panCardImageBase64: result.url,
                      }));
                      setPanFileId(result.fileId);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </div>

            <div className={styles.formActions}>
              {isVerified && (
                <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} disabled={isSaving}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isFieldsDisabled}>
                {isSaving ? "Submitting..." : !isEligible ? "Minimum balance not reached" : "Submit for verification"}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
};