import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './Dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from './Form';
import { Input } from './Input';
import { Button } from './Button';
import { R2FileUploader } from './R2FileUploader';
import { BankIfscFields } from './BankIfscFields';
import {
  schema as bankDetailsSchema,
  type InputType as BankDetailsInput,
} from '../endpoints/teacher/bank-details/add_POST.schema';
import { useAddOrUpdateBankDetailsMutation } from '../helpers/useTeacherBankDetails';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { type Selectable } from 'kysely';
import { type TeacherBankDetails } from '../helpers/schema';
import { useUploadLimits } from '../helpers/useUploadLimits';
import styles from './BankDetailsDialog.module.css';

interface BankDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingDetails: Selectable<TeacherBankDetails> | null;
}

const VerificationStatusBadge: React.FC<{
  status: Selectable<TeacherBankDetails>['verificationStatus'];
}> = ({ status }) => {
  const statusConfig = {
    pending: {
      icon: <Clock size={14} />,
      text: 'Pending Verification',
      className: styles.statusPending,
    },
    verified: {
      icon: <CheckCircle size={14} />,
      text: 'Verified',
      className: styles.statusVerified,
    },
    rejected: {
      icon: <AlertCircle size={14} />,
      text: 'Rejected',
      className: styles.statusRejected,
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`${styles.statusBadge} ${config.className}`}>
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
};

export const BankDetailsDialog: React.FC<BankDetailsDialogProps> = ({
  open,
  onOpenChange,
  existingDetails,
}) => {
  const limits = useUploadLimits();
  const maxFileSizeMb = limits.kycDocumentMaxMb;

  const [panFileId, setPanFileId] = React.useState<string>('');

  const form = useForm({
    schema: bankDetailsSchema,
    defaultValues: {
      bankAccountHolderName: '',
      bankAccountNumber: '',
      bankIfscCode: '',
      bankName: '',
      upiId: '',
      panNumber: '',
      panCardImageBase64: '',
    },
  });

  const { mutate, isPending } = useAddOrUpdateBankDetailsMutation();

  React.useEffect(() => {
    if (open && existingDetails) {
      form.setValues({
        bankAccountHolderName: existingDetails.bankAccountHolderName,
        bankAccountNumber: existingDetails.bankAccountNumber,
        bankIfscCode: existingDetails.bankIfscCode,
        bankName: existingDetails.bankName,
        upiId: existingDetails.upiId || '',
        panNumber: existingDetails.panNumber,
        panCardImageBase64: existingDetails.panCardImageBase64,
      });
      setPanFileId('');
    } else if (open) {
      form.setValues({
        bankAccountHolderName: '',
        bankAccountNumber: '',
        bankIfscCode: '',
        bankName: '',
        upiId: '',
        panNumber: '',
        panCardImageBase64: '',
      });
      setPanFileId('');
    }
  }, [open, existingDetails, form.setValues]);

  const onSubmit = (data: BankDetailsInput) => {
    toast.promise(
      new Promise((resolve, reject) => {
        mutate(data, {
          onSuccess: (response) => {
            form.setValues({
              bankAccountHolderName: '',
              bankAccountNumber: '',
              bankIfscCode: '',
              bankName: '',
              upiId: '',
              panNumber: '',
              panCardImageBase64: '',
            });
            onOpenChange(false);
            resolve(response);
          },
          onError: (error) => {
            reject(error);
          },
        });
      }),
      {
        loading: 'Submitting details...',
        success: 'Bank details submitted successfully for verification.',
        error: (err) =>
          err instanceof Error ? err.message : 'Failed to submit details.',
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>
            {existingDetails ? 'Update Bank Details' : 'Add Bank Details'}
          </DialogTitle>
          <DialogDescription>
            Your details will be sent for verification. Payouts will be processed
            once your account is verified by an admin.
          </DialogDescription>
        </DialogHeader>

        {existingDetails && (
          <div className={styles.statusContainer}>
            <span className={styles.statusLabel}>Current Status:</span>
            <VerificationStatusBadge
              status={existingDetails.verificationStatus}
            />
            {existingDetails.verificationStatus === 'rejected' &&
              existingDetails.rejectionReason && (
                <p className={styles.rejectionReason}>
                  <strong>Reason:</strong> {existingDetails.rejectionReason}
                </p>
              )}
          </div>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className={styles.form}
            id="bank-details-form"
          >
            <div className={styles.formGrid}>
              <FormItem name="bankAccountHolderName">
                <FormLabel>Bank Account Holder Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. John Doe"
                    value={form.values.bankAccountHolderName}
                    onChange={(e) =>
                      form.setValues((prev) => ({
                        ...prev,
                        bankAccountHolderName: e.target.value,
                      }))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="bankAccountNumber">
                <FormLabel>Bank Account Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your account number"
                    value={form.values.bankAccountNumber}
                    onChange={(e) =>
                      form.setValues((prev) => ({
                        ...prev,
                        bankAccountNumber: e.target.value,
                      }))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <BankIfscFields
                ifsc={form.values.bankIfscCode}
                bankName={form.values.bankName}
                onIfscChange={(bankIfscCode) =>
                  form.setValues((prev) => ({ ...prev, bankIfscCode }))
                }
                onBankNameChange={(bankName) =>
                  form.setValues((prev) => ({ ...prev, bankName }))
                }
              />

              <FormItem name="upiId">
                <FormLabel>UPI ID (Optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. yourname@upi"
                    value={form.values.upiId}
                    onChange={(e) =>
                      form.setValues((prev) => ({
                        ...prev,
                        upiId: e.target.value,
                      }))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="panNumber">
                <FormLabel>PAN Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. ABCDE1234F"
                    value={form.values.panNumber}
                    onChange={(e) =>
                      form.setValues((prev) => ({
                        ...prev,
                        panNumber: e.target.value,
                      }))
                    }
                  />
                </FormControl>
                <FormDescription>
                  10-character code, e.g., AAAAA9999A
                </FormDescription>
                <FormMessage />
              </FormItem>
            </div>

            <FormItem name="panCardImageBase64">
              <FormLabel>PAN Card Image</FormLabel>
              <FormControl>
                <R2FileUploader
                  folder="kyc/teachers"
                  acceptedTypes="image/png, image/jpeg, image/webp"
                  maxSizeInMB={maxFileSizeMb}
                  label="Upload PAN Card Image"
                  aspectRatio="3 / 2"
                  currentImageUrl={
                    form.values.panCardImageBase64 && form.values.panCardImageBase64.startsWith('https://')
                      ? form.values.panCardImageBase64
                      : undefined
                  }
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
          </form>
        </Form>
        <DialogFooter>
          <p className={styles.securityNote}>
            Your data is encrypted and stored securely.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="bank-details-form"
            disabled={isPending}
          >
            {isPending ? 'Submitting...' : 'Submit for Verification'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};