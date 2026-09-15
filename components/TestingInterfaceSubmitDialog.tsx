import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './Dialog';
import { DialogClose } from './Dialog';
import { Button } from './Button';
import { SubjectStat } from '../helpers/testingInterfaceTypes';
import styles from './TestingInterfaceSubmitDialog.module.css';

interface TestingInterfaceSubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalQuestions: number;
  answeredCount: number;
  subjectGroups: SubjectStat[];
  isSubmitting: boolean;
  onConfirm: () => void;
  className?: string;
}

export const TestingInterfaceSubmitDialog: React.FC<TestingInterfaceSubmitDialogProps> = ({
  open,
  onOpenChange,
  totalQuestions,
  answeredCount,
  subjectGroups,
  isSubmitting,
  onConfirm,
}) => {
  const hasMultipleSubjects = subjectGroups.length > 1;

  const hasSectionDetails = subjectGroups.some(s =>
    s.sections.length > 1 ||
    (s.sections.length === 1 && s.sections[0].id !== null)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Submission</DialogTitle>
          <DialogDescription>
            Are you sure you want to submit your test?
          </DialogDescription>
        </DialogHeader>
        <div className={styles.submitSummary}>
          <div className={styles.overallRow}>
            <span className={styles.label}>Overall Progress</span>
            <span className={styles.value}>
              {answeredCount} / {totalQuestions} answered
            </span>
          </div>
          {(hasMultipleSubjects || hasSectionDetails) && (
            <div className={styles.subjectList}>
              {subjectGroups.map((subject) => {
                const subjectHasSections =
                  subject.sections.length > 1 ||
                  (subject.sections.length === 1 && subject.sections[0].id !== null);

                return (
                  <div key={subject.name} className={styles.subjectBlock}>
                    <div className={styles.subjectRow}>
                      <span className={styles.subjectName}>{subject.name}</span>
                      <span className={styles.subjectCount}>
                        {subject.answeredQuestions}/{subject.totalQuestions}
                        {subject.maxAttemptsAllowed !== null && !subjectHasSections && (
                          <span className={styles.limitBadge}>
                            {' '}(max {subject.maxAttemptsAllowed})
                          </span>
                        )}
                      </span>
                    </div>
                    {subjectHasSections && (
                      <div className={styles.sectionList}>
                        {subject.sections.map((section) => (
                          <div key={section.id ?? 'general'} className={styles.sectionRow}>
                            <span className={styles.sectionName}>{section.name}</span>
                            <span className={styles.sectionCount}>
                              {section.answeredQuestions}/{section.totalQuestions}
                              {section.maxAttemptsAllowed !== null && (
                                <span className={styles.limitBadge}>
                                  {' '}(max {section.maxAttemptsAllowed})
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Go Back</Button>
          </DialogClose>
          <Button variant="destructive" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Test'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};