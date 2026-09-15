import { useState } from "react";
import { Link } from "react-router-dom";
import { ImportFromBankDialog } from "./ImportFromBankDialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { BulkQuestionUpload } from "./BulkQuestionUpload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "./Dialog";
import { useTeacherTestMutations } from "../helpers/useTeacherTestMutations";
import {
  useTeacherQuestionsBySubjectQuery,
  useReorderQuestionsMutation,
  useAssignSectionsMutation,
} from "../helpers/useTeacherQuestionsBySubject";
import { toast } from "sonner";
import { Plus, ChevronRight, Library, X } from "lucide-react";
import { QuestionForm } from "./QuestionForm";
import { AIQuestionGeneratorDialog } from "./AIQuestionGeneratorDialog";
import { useAuth } from "../helpers/useAuth";
import { Switch } from "./Switch";
import { Input } from "./Input";
import { useBulkUpdateMarks } from "../helpers/useBulkUpdateMarks";
import { useBulkUpdateTiming } from "../helpers/useBulkUpdateTiming";
import { SortableQuestionCard } from "./SortableQuestionCard";
import { Selectable } from "kysely";
import { TestQuestions, SubjectSections } from "../helpers/schema";
import styles from "./QuestionsManager.module.css";

type QuestionsManagerProps = {
  testId: number;
  itemId?: number;
  subjectId: number;
  examName: string;
  subjectName: string;
  sections?: Selectable<SubjectSections>[];
  refetchSubjects?: () => void;
  className?: string;
  questionWiseTiming?: boolean;
};

export const QuestionsManager = ({
  testId,
  itemId,
  subjectId,
  examName,
  subjectName,
  sections = [],
  refetchSubjects,
  questionWiseTiming,
}: QuestionsManagerProps) => {
  const [localQuestions, setLocalQuestions] = useState<
    Selectable<TestQuestions>[] | null
  >(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<number | string>>(new Set());

  const [isImportOpen, setIsImportOpen] = useState(false);

  const [generationError, setGenerationError] = useState<string | null>(null);

  const { authState } = useAuth();

  const [markingSchemeOpen, setMarkingSchemeOpen] = useState(false);
  const [bulkPositiveMarks, setBulkPositiveMarks] = useState<string>("");
  const [bulkNegativeMarks, setBulkNegativeMarks] = useState<string>("");

  const [timingSchemeOpen, setTimingSchemeOpen] = useState(false);
  const [bulkDurationSeconds, setBulkDurationSeconds] = useState<string>("");

  const bulkUpdateMutation = useBulkUpdateMarks();
  const bulkTimingMutation = useBulkUpdateTiming();

  const toggleSection = (id: number | string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const {
    data: questions,
    isFetching: isQuestionsFetching,
    refetch: refetchQuestions,
  } = useTeacherQuestionsBySubjectQuery(subjectId);

  // localQuestions holds the optimistic order while a drag or delete is in
  // flight; any fresh server result replaces it.
  const displayQuestions = localQuestions ?? questions ?? [];
  const [adoptedServerQuestions, setAdoptedServerQuestions] = useState(questions);

  const { useDeleteQuestionMutation } = useTeacherTestMutations();
  const deleteQuestion = useDeleteQuestionMutation();
  const reorderQuestions = useReorderQuestionsMutation(subjectId);
  const assignSections = useAssignSectionsMutation(subjectId);

  const handleMoveToSection = (questionId: number, sectionId: number | null) => {
    const promise = assignSections.mutateAsync({
      subjectId,
      assignments: [{ sectionId, questionIds: [questionId] }],
    });
    toast.promise(promise, {
      loading: 'Moving question...',
      success: () => {
        setLocalQuestions(null);
        refetchQuestions();
        refetchSubjects?.();
        return 'Question moved successfully.';
      },
      error: (err) => err instanceof Error ? err.message : 'Failed to move question.',
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Adopt server data only when a new result (or another subject's list)
  // arrives. Comparing against the cached list instead snapped a just-dragged
  // question back to its old slot until the reorder request finished.
  const [localSubjectId, setLocalSubjectId] = useState(subjectId);
  if (localSubjectId !== subjectId) {
    setLocalSubjectId(subjectId);
    setLocalQuestions(null);
  }
  if (questions && questions !== adoptedServerQuestions) {
    setAdoptedServerQuestions(questions);
    setLocalQuestions(questions);
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentQuestions = localQuestions ?? questions ?? [];
    const oldIndex = currentQuestions.findIndex(
      (q) => q.id.toString() === active.id
    );
    const newIndex = currentQuestions.findIndex(
      (q) => q.id.toString() === over.id
    );

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(currentQuestions, oldIndex, newIndex);
    setLocalQuestions(reordered);

    const items = reordered.map((q, index) => ({
      questionId: q.id,
      orderIndex: index,
    }));

    reorderQuestions.mutate(
      { items },
      {
        onError: (e) => {
          // Revert on error
          setLocalQuestions(questions ?? null);
          toast.error(
            e instanceof Error ? e.message : "Failed to reorder questions."
          );
        },
      }
    );
  };

  const handleDelete = (questionId: number) => {
    if (window.confirm("Are you sure you want to delete this question?")) {
      deleteQuestion.mutate(
        { questionId },
        {
          onSuccess: () => {
            toast.success("Question deleted.");
            setLocalQuestions((current) =>
              (current ?? questions ?? []).filter((q) => q.id !== questionId)
            );
            refetchQuestions();
            refetchSubjects?.();
          },
          onError: (e) =>
            toast.error(
              e instanceof Error ? e.message : "Failed to delete question."
            ),
        }
      );
    }
  };

  const handleAddOrUpdateSuccess = () => {
    setLocalQuestions(null);
    refetchQuestions();
    refetchSubjects?.();
  };

  const handleApplyMarkingScheme = () => {
    const pos = parseFloat(bulkPositiveMarks);
    const neg = parseFloat(bulkNegativeMarks);

    if (isNaN(pos) || pos < 0 || isNaN(neg) || neg < 0) {
      toast.error("Please enter valid positive numbers for both fields.");
      return;
    }

    bulkUpdateMutation.mutate(
      {
        subjectId,
        positiveMarks: pos,
        negativeMarks: neg,
      },
      {
        onSuccess: () => {
          setLocalQuestions(null);
          refetchQuestions();
          refetchSubjects?.();
          setMarkingSchemeOpen(false);
        },
      }
    );
  };

  const handleApplyTimingScheme = () => {
    const duration = parseInt(bulkDurationSeconds, 10);

    if (isNaN(duration) || duration <= 0) {
      toast.error("Please enter a valid positive number for duration.");
      return;
    }

    bulkTimingMutation.mutate(
      {
        subjectId,
        durationSeconds: duration,
      },
      {
        onSuccess: () => {
          setLocalQuestions(null);
          refetchQuestions();
          refetchSubjects?.();
          setTimingSchemeOpen(false);
        },
      }
    );
  };

  const lastQuestion = displayQuestions.length > 0 ? displayQuestions[displayQuestions.length - 1] : null;
  const lastPositiveMarks = lastQuestion && lastQuestion.positiveMarks != null ? parseFloat(lastQuestion.positiveMarks.toString()) : undefined;
  const lastNegativeMarks = lastQuestion && lastQuestion.negativeMarks != null ? parseFloat(lastQuestion.negativeMarks.toString()) : undefined;

  const addUpdateButtons = (
    <div className={styles.controls}>
      <AIQuestionGeneratorDialog
        subjectId={subjectId}
        examName={examName}
        subjectName={subjectName}
        onSuccess={handleAddOrUpdateSuccess}
        onGenerationError={(err) => setGenerationError(err)}
      />
      <BulkQuestionUpload
        subjectId={subjectId}
        onSuccess={() => {
          setLocalQuestions(null);
          refetchQuestions();
          refetchSubjects?.();
        }}
      />
      <Button variant="outline" onClick={() => setIsImportOpen(true)}>
        <Library size={16} /> Import
      </Button>
      <AddQuestionTrigger
        subjectId={subjectId}
        sections={sections}
        onSuccess={handleAddOrUpdateSuccess}
        questionWiseTiming={questionWiseTiming}
        defaultPositiveMarks={lastPositiveMarks}
        defaultNegativeMarks={lastNegativeMarks}
        testId={testId}
        itemId={itemId}
      />
    </div>
  );

  const sectionsExist = sections && sections.length > 0;
  const unsectionedQuestions = displayQuestions.filter((q) => !q.sectionId);

  const renderQuestion = (q: Selectable<TestQuestions>, originalIndex: number) => (
    <div key={q.id} className={styles.questionWrapper}>
      <div className={styles.questionCardContainer}>
        <SortableQuestionCard
          question={q}
          index={originalIndex}
          testId={testId}
          itemId={itemId}
          subjectId={subjectId}
          onDelete={handleDelete}
          onUpdateSuccess={handleAddOrUpdateSuccess}
          isDeleting={deleteQuestion.isPending}
          sections={sections}
          onMoveToSection={sectionsExist ? handleMoveToSection : undefined}
          questionWiseTiming={questionWiseTiming}
        />
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.markingSchemeRow}>
        <div className={styles.markingSchemeToggle}>
          <label htmlFor="marking-scheme-toggle">Marking Scheme</label>
          <Switch 
            id="marking-scheme-toggle" 
            checked={markingSchemeOpen} 
            onCheckedChange={setMarkingSchemeOpen} 
          />
        </div>
        {questionWiseTiming && (
          <div className={styles.markingSchemeToggle}>
            <label htmlFor="timing-scheme-toggle">Question Timing</label>
            <Switch 
              id="timing-scheme-toggle" 
              checked={timingSchemeOpen} 
              onCheckedChange={setTimingSchemeOpen} 
            />
          </div>
        )}
      </div>

      {markingSchemeOpen && (
        <div className={styles.markingSchemePanel}>
          <div className={styles.markingSchemeInputs}>
            <Input 
              type="number" 
              step="0.25" 
              min="0" 
              placeholder="Positive Marks" 
              value={bulkPositiveMarks} 
              onChange={(e) => setBulkPositiveMarks(e.target.value)} 
            />
            <Input 
              type="number" 
              step="0.25" 
              min="0" 
              placeholder="Negative Marks" 
              value={bulkNegativeMarks} 
              onChange={(e) => setBulkNegativeMarks(e.target.value)} 
            />
          </div>
          <Button 
            onClick={handleApplyMarkingScheme} 
            disabled={bulkUpdateMutation.isPending}
          >
            Apply to All Questions
          </Button>
        </div>
      )}

      {timingSchemeOpen && questionWiseTiming && (
        <div className={styles.markingSchemePanel}>
          <div className={styles.markingSchemeInputs}>
            <Input 
              type="number" 
              step="1" 
              min="1" 
              placeholder="Duration (seconds)" 
              value={bulkDurationSeconds} 
              onChange={(e) => setBulkDurationSeconds(e.target.value)} 
            />
          </div>
          <Button 
            onClick={handleApplyTimingScheme} 
            disabled={bulkTimingMutation.isPending}
          >
            Apply to All Questions
          </Button>
        </div>
      )}

      {addUpdateButtons}

      <ImportFromBankDialog
        subjectId={subjectId}
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onSuccess={() => {
          setLocalQuestions(null);
          refetchQuestions();
          refetchSubjects?.();
        }}
      />

      {generationError && (
        <div className={styles.errorState}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 className={styles.errorTitle}>Generation Failed</h3>
              <p className={styles.errorMessage}>{generationError}</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setGenerationError(null)}>
              <X size={16} />
            </Button>
          </div>
        </div>
      )}

      {!questions && isQuestionsFetching && <QuestionsSkeleton />}

      {(questions || !isQuestionsFetching) && (
        <div className={styles.questionsList}>
          {displayQuestions.length === 0 && (
            <div className={styles.emptyState}>
              <p>No questions added for this subject yet.</p>
            </div>
          )}
          {displayQuestions.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displayQuestions.map((q) => q.id.toString())}
                strategy={verticalListSortingStrategy}
              >
                {!sectionsExist ? (
                  displayQuestions.map((q, index) => renderQuestion(q, index))
                ) : (
                  <div className={styles.sectionsContainer}>
                    {sections.map((section) => {
                      const sectionQuestions = displayQuestions.filter(
                        (q) => q.sectionId === section.id
                      );
                      const isCollapsed = collapsedSections.has(section.id);
                      return (
                        <div key={section.id} className={styles.sectionGroup}>
                          <div
                            className={`${styles.sectionHeader} ${styles.sectionHeaderClickable}`}
                            onClick={() => toggleSection(section.id)}
                          >
                            <ChevronRight
                              className={`${styles.chevronIcon} ${!isCollapsed ? styles.chevronIconExpanded : ""}`}
                              size={20}
                            />
                            <span className={styles.sectionTitle}>
                              {section.sectionName}
                            </span>
                            <span className={styles.sectionStats}>
                              ({sectionQuestions.length} questions
                              {section.maxAttemptsAllowed
                                ? `, Max attempts: ${section.maxAttemptsAllowed}`
                                : ""})
                            </span>
                          </div>
                          {!isCollapsed && (
                            <>
                              {sectionQuestions.map((q) => {
                                const originalIndex = displayQuestions.findIndex(
                                  (dq) => dq.id === q.id
                                );
                                return renderQuestion(q, originalIndex);
                              })}
                              <div className={styles.sectionAddButtonWrapper}>
                                <AddQuestionTrigger
                                  subjectId={subjectId}
                                  sections={sections}
                                  defaultSectionId={section.id}
                                  onSuccess={handleAddOrUpdateSuccess}
                                  isInline
                                  questionWiseTiming={questionWiseTiming}
                                  defaultPositiveMarks={lastPositiveMarks}
                                  defaultNegativeMarks={lastNegativeMarks}
                                  testId={testId}
                                  itemId={itemId}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}

                    {unsectionedQuestions.length > 0 && (() => {
                      const isCollapsed = collapsedSections.has("unsectioned");
                      return (
                        <div className={styles.sectionGroup}>
                          <div
                            className={`${styles.sectionHeader} ${styles.sectionHeaderClickable}`}
                            onClick={() => toggleSection("unsectioned")}
                          >
                            <ChevronRight
                              className={`${styles.chevronIcon} ${!isCollapsed ? styles.chevronIconExpanded : ""}`}
                              size={20}
                            />
                            <span className={styles.sectionTitle}>
                              Unsectioned Questions
                            </span>
                            <span className={styles.sectionStats}>
                              ({unsectionedQuestions.length} questions)
                            </span>
                          </div>
                          {!isCollapsed && (
                            <>
                              {unsectionedQuestions.map((q) => {
                                const originalIndex = displayQuestions.findIndex(
                                  (dq) => dq.id === q.id
                                );
                                return renderQuestion(q, originalIndex);
                              })}
                              <div className={styles.sectionAddButtonWrapper}>
                                <AddQuestionTrigger
                                  subjectId={subjectId}
                                  sections={sections}
                                  defaultSectionId={null}
                                  onSuccess={handleAddOrUpdateSuccess}
                                  isInline
                                  questionWiseTiming={questionWiseTiming}
                                  defaultPositiveMarks={lastPositiveMarks}
                                  defaultNegativeMarks={lastNegativeMarks}
                                  testId={testId}
                                  itemId={itemId}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  );
};

const AddQuestionDialog = ({
  subjectId,
  sections,
  defaultSectionId,
  onSuccess,
  isInline,
  questionWiseTiming,
  defaultPositiveMarks,
  defaultNegativeMarks,
}: {
  subjectId: number;
  sections?: Selectable<SubjectSections>[];
  defaultSectionId?: number | null;
  onSuccess: () => void;
  isInline?: boolean;
  questionWiseTiming?: boolean;
  defaultPositiveMarks?: number;
  defaultNegativeMarks?: number;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {isInline ? (
          <Button variant="ghost" size="sm" className={styles.sectionAddButton}>
            <Plus size={16} /> Add Question
          </Button>
        ) : (
          <Button variant="outline">
            <Plus size={16} /> Add Question
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>Add New Question</DialogTitle>
        </DialogHeader>
        <QuestionForm
          subjectId={subjectId}
          sections={sections}
          defaultSectionId={defaultSectionId}
          questionWiseTiming={questionWiseTiming}
          defaultPositiveMarks={defaultPositiveMarks}
          defaultNegativeMarks={defaultNegativeMarks}
          onSuccess={() => {
            onSuccess();
            setIsOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

// Routes "+ Add Question" to the dedicated full-page creation flow when this
// QuestionsManager instance has enough route context (testId + itemId) to
// build that URL — i.e. the mock-test creation flow. Falls back to the
// original in-place dialog everywhere else (e.g. live tests, which render
// QuestionsManager without an itemId), so that flow is completely
// unaffected.
const AddQuestionTrigger = ({
  subjectId,
  sections,
  defaultSectionId,
  onSuccess,
  isInline,
  questionWiseTiming,
  defaultPositiveMarks,
  defaultNegativeMarks,
  testId,
  itemId,
}: {
  subjectId: number;
  sections?: Selectable<SubjectSections>[];
  defaultSectionId?: number | null;
  onSuccess: () => void;
  isInline?: boolean;
  questionWiseTiming?: boolean;
  defaultPositiveMarks?: number;
  defaultNegativeMarks?: number;
  testId?: number;
  itemId?: number;
}) => {
  if (testId != null && itemId != null) {
    const params = new URLSearchParams({ subjectId: String(subjectId) });
    if (defaultSectionId != null) {
      params.set("sectionId", String(defaultSectionId));
    }
    const url = `/teacher/create-test/${testId}/test-items/${itemId}/questions/new?${params.toString()}`;

    return isInline ? (
      <Button variant="ghost" size="sm" className={styles.sectionAddButton} asChild>
        <Link to={url}>
          <Plus size={16} /> Add Question
        </Link>
      </Button>
    ) : (
      <Button variant="outline" asChild>
        <Link to={url}>
          <Plus size={16} /> Add Question
        </Link>
      </Button>
    );
  }

  return (
    <AddQuestionDialog
      subjectId={subjectId}
      sections={sections}
      defaultSectionId={defaultSectionId}
      onSuccess={onSuccess}
      isInline={isInline}
      questionWiseTiming={questionWiseTiming}
      defaultPositiveMarks={defaultPositiveMarks}
      defaultNegativeMarks={defaultNegativeMarks}
    />
  );
};

const QuestionsSkeleton = () => (
  <div className={styles.questionsList}>
    {[...Array(3)].map((_, i) => (
      <div key={i} className={styles.questionCard}>
        <Skeleton
          style={{ height: "1.2rem", width: "80%", marginBottom: "1rem" }}
        />
        <div className={styles.optionsGrid}>
          <Skeleton style={{ height: "1rem", width: "40%" }} />
          <Skeleton style={{ height: "1rem", width: "45%" }} />
          <Skeleton style={{ height: "1rem", width: "35%" }} />
          <Skeleton style={{ height: "1rem", width: "50%" }} />
        </div>
      </div>
    ))}
  </div>
);