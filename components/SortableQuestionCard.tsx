import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Selectable } from "kysely";
import { TestQuestions } from "../helpers/schema";
import { QuestionCard } from "./QuestionCard";
import styles from "./SortableQuestionCard.module.css";

type SortableQuestionCardProps = {
  question: Selectable<TestQuestions>;
  index: number;
  testId?: number;
  itemId?: number;
  subjectId: number;
  onDelete: (id: number) => void;
  onUpdateSuccess: () => void;
  isDeleting?: boolean;
  className?: string;
  sections?: Array<{ id: number; sectionName: string }>;
  onMoveToSection?: (questionId: number, sectionId: number | null) => void;
  questionWiseTiming?: boolean;
};

export const SortableQuestionCard = ({
  question,
  index,
  testId,
  itemId,
  subjectId,
  onDelete,
  onUpdateSuccess,
  isDeleting,
  className,
  sections,
  onMoveToSection,
  questionWiseTiming,
}: SortableQuestionCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.sortableWrapper} ${isDragging ? styles.dragging : ""} ${className || ""}`}
    >
      <div
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder question"
      >
        <GripVertical size={16} />
      </div>
      <div className={styles.cardContent}>
        <QuestionCard
          question={question}
          index={index}
          testId={testId}
          itemId={itemId}
          subjectId={subjectId}
          onDelete={onDelete}
          onUpdateSuccess={onUpdateSuccess}
          isDeleting={isDeleting}
          sections={sections}
          onMoveToSection={onMoveToSection ? (sectionId: number | null) => onMoveToSection(question.id, sectionId) : undefined}
          questionWiseTiming={questionWiseTiming}
        />
      </div>
    </div>
  );
};
