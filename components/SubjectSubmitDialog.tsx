import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from './Dialog';
import { Button } from './Button';
import styles from './SubjectSubmitDialog.module.css';

interface SubjectSubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectName: string;
  totalQuestions: number;
  answeredCount: number;
  onConfirm: () => void;
  className?: string;
}

export const SubjectSubmitDialog: React.FC<SubjectSubmitDialogProps> = ({
  open,
  onOpenChange,
  subjectName,
  totalQuestions,
  answeredCount,
  onConfirm,
}) => {
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit Subject</DialogTitle>
          <DialogDescription>
            Are you sure you want to submit <strong>{subjectName}</strong>? You will not be able to answer any more questions in this subject.
          </DialogDescription>
        </DialogHeader>
        <div className={styles.summary}>
          <div className={styles.row}>
            <span className={styles.label}>Answered</span>
            <span className={styles.value}>{answeredCount} / {totalQuestions}</span>
          </div>
          {unansweredCount > 0 && (
            <div className={styles.warningRow}>
              <span className={styles.warningText}>
                {unansweredCount} question{unansweredCount !== 1 ? 's' : ''} left unanswered.
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Go Back</Button>
          </DialogClose>
          <Button variant="destructive" onClick={onConfirm}>
            Submit Subject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};