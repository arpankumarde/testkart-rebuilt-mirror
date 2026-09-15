import React from "react";
import { Eye } from "lucide-react";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { MathMLContent } from "./MathMLContent";
import { Dialog, DialogTrigger } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogHeader } from "./ConsoleDialog";
import { AIQuestionListItem } from "../endpoints/admin/ai-questions/list_GET.schema";
import styles from "./PreviewQuestionDialog.module.css";

type PreviewQuestionDialogProps = {
  question: AIQuestionListItem;
};

export const PreviewQuestionDialog: React.FC<PreviewQuestionDialogProps> = ({ question }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Preview question"><Eye size={16} /></Button>
      </DialogTrigger>
      <ConsoleDialogContent size="xl" aria-describedby={undefined}>
        <ConsoleDialogHeader title="Question preview">
          <div className={styles.headerBadges}>
            <Badge variant="secondary">AI generated</Badge>
            {question.markedForReview && <Badge variant="warning">Marked for review</Badge>}
            {(question.aiGenerationMetadata as any)?.customPrompt && <Badge variant="secondary">Custom prompt</Badge>}
          </div>
        </ConsoleDialogHeader>
        <ConsoleDialogBody>
          <div className={styles.layout}>
            <div className={styles.questionArea}>
              <div className={styles.questionContainer}>
                <MathMLContent html={question.questionText} />
              </div>
              <div className={styles.options}>
                {['A', 'B', 'C', 'D', 'E']
                  .filter(opt => opt !== 'E' || !!question.optionE)
                  .map(opt => (
                  <div key={opt} className={`${styles.option} ${question.correctOption === opt ? styles.correct : ''}`}>
                    <span className={styles.optionLabel}>{opt}</span>
                    <div className={styles.optionContent}>
                      <MathMLContent html={question[`option${opt}` as keyof AIQuestionListItem] as string} />
                    </div>
                    {question.correctOption === opt && (
                      <Badge variant="success" className={styles.correctBadge}>Correct</Badge>
                    )}
                  </div>
                ))}
              </div>
              {question.explanation && (
                <section className={styles.explanation}>
                  <h3 className={styles.blockTitle}>Explanation</h3>
                  <MathMLContent html={question.explanation} />
                </section>
              )}
            </div>
            <aside className={styles.metadata}>
              <h3 className={styles.blockTitle}>Details</h3>
              <dl className={styles.details}>
                <div className={styles.detailItem}>
                  <dt className={styles.detailLabel}>Exam</dt>
                  <dd className={styles.detailValue}>{question.examName}</dd>
                </div>
                <div className={styles.detailItem}>
                  <dt className={styles.detailLabel}>Test item</dt>
                  <dd className={styles.detailValue}>{question.testItemTitle}</dd>
                </div>
                <div className={styles.detailItem}>
                  <dt className={styles.detailLabel}>Subject</dt>
                  <dd className={styles.detailValue}>{question.subjectName || 'N/A'}</dd>
                </div>
                <div className={styles.detailItem}>
                  <dt className={styles.detailLabel}>Teacher</dt>
                  <dd className={styles.detailValue}>{question.teacherName}</dd>
                </div>
                <div className={styles.detailItem}>
                  <dt className={styles.detailLabel}>Created</dt>
                  <dd className={`${styles.detailValue} ${styles.figure}`}>
                    {new Date(question.createdAt!).toLocaleDateString()}
                  </dd>
                </div>
                {(question.aiGenerationMetadata as any)?.customPrompt && (
                  <div className={styles.detailItem}>
                    <dt className={styles.detailLabel}>Custom prompt</dt>
                    <dd className={styles.customPrompt}>{(question.aiGenerationMetadata as any).customPrompt}</dd>
                  </div>
                )}
              </dl>
            </aside>
          </div>
        </ConsoleDialogBody>
      </ConsoleDialogContent>
    </Dialog>
  );
};