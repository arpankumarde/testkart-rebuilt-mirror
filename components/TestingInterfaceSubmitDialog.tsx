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
import { SubjectStat } from '../helpers/testingInterfaceTypes';
import styles from './TestingInterfaceSubmitDialog.module.css';

interface TestingInterfaceSubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalQuestions: number;
  answeredCount: number;
  markedCount?: number;
  subjectGroups: SubjectStat[];
  isSubmitting: boolean;
  onConfirm: () => void;
  className?: string;
}

const hasNamedSections = (subject: SubjectStat) =>
  subject.sections.length > 1 || (subject.sections.length === 1 && subject.sections[0].id !== null);

export const TestingInterfaceSubmitDialog: React.FC<TestingInterfaceSubmitDialogProps> = ({
  open,
  onOpenChange,
  totalQuestions,
  answeredCount,
  markedCount = 0,
  subjectGroups,
  isSubmitting,
  onConfirm,
}) => {
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const showBreakdown = subjectGroups.length > 1 || subjectGroups.some(hasNamedSections);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`tk-student tk-flow ${styles.content}`}>
        <DialogHeader>
          <DialogTitle>Submit your test?</DialogTitle>
          <DialogDescription>
            {unansweredCount > 0
              ? `${unansweredCount} ${unansweredCount === 1 ? 'question is' : 'questions are'} still unanswered. You cannot change answers after submitting.`
              : 'You have answered every question. You cannot change answers after submitting.'}
          </DialogDescription>
        </DialogHeader>

        <div className={styles.tiles}>
          <div className={`${styles.tile} ${styles.tileAnswered}`}>
            <span className={styles.tileValue}>{answeredCount}</span>
            <span className={styles.tileLabel}>Answered</span>
          </div>
          <div className={`${styles.tile} ${styles.tileUnanswered}`}>
            <span className={styles.tileValue}>{unansweredCount}</span>
            <span className={styles.tileLabel}>Not answered</span>
          </div>
          <div className={`${styles.tile} ${styles.tileMarked}`}>
            <span className={styles.tileValue}>{markedCount}</span>
            <span className={styles.tileLabel}>For review</span>
          </div>
        </div>

        {showBreakdown && (
          <div className={styles.subjectList}>
            {subjectGroups.map((subject) => {
              const subjectHasSections = hasNamedSections(subject);
              return (
                <div key={subject.name} className={styles.subjectBlock}>
                  <div className={styles.subjectRow}>
                    <span className={styles.subjectName}>{subject.name}</span>
                    <span className={styles.subjectCount}>
                      {subject.answeredQuestions}/{subject.totalQuestions}
                      {subject.maxAttemptsAllowed !== null && !subjectHasSections && (
                        <span className={styles.limitBadge}>max {subject.maxAttemptsAllowed}</span>
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
                              <span className={styles.limitBadge}>max {section.maxAttemptsAllowed}</span>
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

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Keep working</Button>
          </DialogClose>
          <Button variant="destructive" className={styles.submitBtn} onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit test'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
