import React, { useState } from "react";
import { Trash2, FileDown, CheckCircle, XCircle } from "lucide-react";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import { MathMLContent } from "./MathMLContent";
import { PreviewQuestionDialog } from "./PreviewQuestionDialog";
import { EditQuestionDialog } from "./EditQuestionDialog";
import { useDeleteAIQuestion, useBulkDeleteAIQuestions, useBulkMarkReview, useBulkExportAIQuestions } from "../helpers/useAdminAIQuestions";
import { AIQuestionListItem } from "../endpoints/admin/ai-questions/list_GET.schema";
import styles from "./AIQuestionsTable.module.css";

type BulkActionsBarProps = {
  selectedCount: number;
  selectedIds: number[];
  onClear: () => void;
};

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({ selectedCount, selectedIds, onClear }) => {
  const bulkDelete = useBulkDeleteAIQuestions();
  const bulkMarkReview = useBulkMarkReview();
  const bulkExport = useBulkExportAIQuestions();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const confirmDelete = () => {
    bulkDelete.mutate(
      { ids: selectedIds },
      {
        onSuccess: () => {
          setIsDeleteOpen(false);
          onClear();
        },
      }
    );
  };

  const handleMarkReview = (mark: boolean) => {
    bulkMarkReview.mutate({ ids: selectedIds, markForReview: mark }, { onSuccess: onClear });
  };

  const handleExport = () => {
    bulkExport.mutate({ ids: selectedIds });
  };

  return (
    <div className={styles.bulkActionsBar}>
      <span>{selectedCount} selected</span>
      <div className={styles.bulkActionsButtons}>
        <Button variant="outline" size="sm" onClick={() => handleMarkReview(true)} disabled={bulkMarkReview.isPending}><CheckCircle size={16} /> Mark for Review</Button>
        <Button variant="outline" size="sm" onClick={() => handleMarkReview(false)} disabled={bulkMarkReview.isPending}><XCircle size={16} /> Unmark for Review</Button>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={bulkExport.isPending}><FileDown size={16} /> Export</Button>
        <Button variant="destructive" size="sm" onClick={() => setIsDeleteOpen(true)} disabled={bulkDelete.isPending}><Trash2 size={16} /> Delete</Button>
      </div>

      <ConsoleConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        tone="destructive"
        icon={<Trash2 size={20} />}
        title={`Delete ${selectedCount} ${selectedCount === 1 ? "question" : "questions"}?`}
        description="They are removed for good. Any test already using them keeps its copy."
        confirmLabel="Delete"
        pendingLabel="Deleting..."
        isPending={bulkDelete.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

/* The preview and edit dialogs own their trigger buttons, so the tooltip
   wraps them in a slot that also sizes those triggers to match. */
const QuestionActions: React.FC<{ question: AIQuestionListItem }> = ({ question }) => {
  const deleteMutation = useDeleteAIQuestion();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const confirmDelete = () => {
    deleteMutation.mutate(
      { id: question.id },
      { onSuccess: () => setIsDeleteOpen(false) }
    );
  };

  return (
    <div className={styles.rowActions}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={styles.triggerSlot}>
            <PreviewQuestionDialog question={question} />
          </span>
        </TooltipTrigger>
        <TooltipContent>Preview</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={styles.triggerSlot}>
            <EditQuestionDialog question={question} />
          </span>
        </TooltipTrigger>
        <TooltipContent>Edit</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={`${styles.iconButton} ${styles.iconButtonDanger}`}
            onClick={() => setIsDeleteOpen(true)}
            disabled={deleteMutation.isPending}
            aria-label="Delete this question"
          >
            <Trash2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>

      <ConsoleConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        tone="destructive"
        icon={<Trash2 size={20} />}
        title="Delete this question?"
        description="It is removed for good. Any test already using it keeps its copy."
        confirmLabel="Delete"
        pendingLabel="Deleting..."
        isPending={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

const QuestionIdentity: React.FC<{ question: AIQuestionListItem }> = ({ question }) => (
  <div className={styles.stack}>
    <span className={styles.primaryLine}>
      <span className={styles.questionText}>
        <MathMLContent html={question.questionText} maxLength={100} className={styles.questionMath} />
      </span>
      {question.markedForReview && <Badge variant="warning" className={styles.flag}>Review</Badge>}
      {(question.aiGenerationMetadata as any)?.customPrompt && <Badge variant="secondary" className={styles.flag}>Custom</Badge>}
    </span>
    <span className={styles.secondaryLine} title={question.teacherName}>{question.teacherName}</span>
  </div>
);

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col className={styles.colSelect} />
    <col />
    <col className={styles.colSource} />
    <col className={styles.colActions} />
  </colgroup>
);

const StackSkeleton = ({ top, bottom }: { top: string; bottom: string }) => (
  <div className={styles.stack}>
    <Skeleton style={{ height: "0.875rem", width: top }} />
    <Skeleton style={{ height: "0.75rem", width: bottom }} />
  </div>
);

const QuestionRowSkeleton: React.FC = () => (
  <tr>
    <td><Skeleton className={styles.skeletonCheckbox} /></td>
    <td><StackSkeleton top="85%" bottom="30%" /></td>
    <td><StackSkeleton top="70%" bottom="85%" /></td>
    <td><Skeleton style={{ height: "1.5rem", width: "5.5rem", marginLeft: "auto" }} /></td>
  </tr>
);

const QuestionCardSkeleton: React.FC = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <StackSkeleton top="14rem" bottom="7rem" />
      <Skeleton style={{ height: "2rem", width: "6rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

type AIQuestionsTableProps = {
  questions?: AIQuestionListItem[];
  isFetching: boolean;
  error?: Error | null;
  selectedIds: number[];
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: number, checked: boolean) => void;
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  currentPage: number;
  onPageChange: (page: number) => void;
};

export const AIQuestionsTable: React.FC<AIQuestionsTableProps> = ({
  questions,
  isFetching,
  error,
  selectedIds,
  onSelectAll,
  onSelectOne,
  pagination,
  currentPage,
  onPageChange,
}) => {
  const isAllSelected = questions?.length ? selectedIds.length === questions.length : false;

  const renderContent = () => {
    if (isFetching) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 10 }).map((_, i) => <QuestionRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsView}>
            <div className={styles.cardsContainer}>
              {Array.from({ length: 4 }).map((_, i) => <QuestionCardSkeleton key={i} />)}
            </div>
          </div>
        </>
      );
    }

    if (error) {
      return <div className={styles.emptyState} role="alert">Error loading questions: {error.message}</div>;
    }

    if (!questions || questions.length === 0) {
      return <div className={styles.emptyState}>No questions found matching your criteria.</div>;
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                <th>
                  <Checkbox
                    checked={isAllSelected}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    aria-label="Select all questions on this page"
                  />
                </th>
                <th>Question</th>
                <th>Exam and test</th>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id}>
                  <td>
                    <Checkbox
                      checked={selectedIds.includes(q.id)}
                      onChange={(e) => onSelectOne(q.id, e.target.checked)}
                      aria-label="Select this question"
                    />
                  </td>
                  <td><QuestionIdentity question={q} /></td>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.valueLine} title={q.examName}>{q.examName}</span>
                      <span className={styles.secondaryLine} title={q.testItemTitle}>{q.testItemTitle}</span>
                    </div>
                  </td>
                  <td><QuestionActions question={q} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsView}>
          <label className={styles.selectAll}>
            <Checkbox checked={isAllSelected} onChange={(e) => onSelectAll(e.target.checked)} />
            Select all
          </label>
          <div className={styles.cardsContainer}>
            {questions.map((q) => (
              <article key={q.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardSelect}>
                    <Checkbox
                      checked={selectedIds.includes(q.id)}
                      onChange={(e) => onSelectOne(q.id, e.target.checked)}
                      aria-label="Select this question"
                    />
                  </span>
                  <QuestionIdentity question={q} />
                  <QuestionActions question={q} />
                </div>
                <dl className={styles.cardStats}>
                  <div className={styles.cardStat}><dt>Exam</dt><dd>{q.examName}</dd></div>
                  <div className={styles.cardStat}><dt>Test</dt><dd>{q.testItemTitle}</dd></div>
                  <div className={styles.cardStat}><dt>Teacher</dt><dd>{q.teacherName}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className={styles.root}>
      {selectedIds.length > 0 && <BulkActionsBar selectedCount={selectedIds.length} selectedIds={selectedIds} onClear={() => onSelectAll(false)} />}

      <div className={styles.results}>{renderContent()}</div>

      {pagination && pagination.totalPages > 1 && (
        <div className={styles.pagination}>
          <span>
            Showing {((currentPage - 1) * pagination.pageSize) + 1}-
            {Math.min(currentPage * pagination.pageSize, pagination.total)} of {pagination.total} questions
          </span>
          <div>
            <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= pagination.totalPages}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
};
