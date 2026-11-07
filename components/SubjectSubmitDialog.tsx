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
      <DialogContent className="tk-student tk-flow">
        <DialogHeader>
          <DialogTitle>Submit {subjectName}?</DialogTitle>
          <DialogDescription>
            You cannot come back to this subject after submitting it.
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
            <Button variant="outline">Keep working</Button>
          </DialogClose>
          <Button variant="destructive" className={styles.submitBtn} onClick={onConfirm}>
            Submit subject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};