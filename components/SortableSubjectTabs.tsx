import { useState } from "react";
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
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Selectable } from "kysely";
import { TestItemSubjects } from "../helpers/schema";
import { useTestItemSubjectsMutations } from "../helpers/useTestItemSubjectsQuery";
import { toast } from "sonner";
import styles from "./SortableSubjectTabs.module.css";

type SubjectWithCount = Selectable<TestItemSubjects> & {
  actualQuestionCount: number;
};

type SortableSubjectTabsProps = {
  subjects: SubjectWithCount[];
  selectedSubjectId: number | null;
  onSelectSubject: (id: number) => void;
  testItemId: number;
  onReorderSuccess: (reorderedSubjects: SubjectWithCount[]) => void;
  className?: string;
};

type SortableTabItemProps = {
  subject: SubjectWithCount;
  isActive: boolean;
  onClick: () => void;
};

const SortableTabItem = ({ subject, isActive, onClick }: SortableTabItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subject.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.sortableTab} ${isActive ? styles.sortableTabActive : ""} ${isDragging ? styles.dragging : ""}`}
      onClick={onClick}
    >
      <span
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} />
      </span>
      <span className={styles.tabLabel}>
        {subject.subjectName}
        <span className={styles.questionCount}>({subject.actualQuestionCount})</span>
      </span>
    </div>
  );
};

export const SortableSubjectTabs = ({
  subjects,
  selectedSubjectId,
  onSelectSubject,
  testItemId,
  onReorderSuccess,
  className,
}: SortableSubjectTabsProps) => {
  const [localSubjects, setLocalSubjects] = useState<SubjectWithCount[]>(subjects);

  // Sync local state when subjects prop changes (e.g., after refetch)
  if (
    subjects.length !== localSubjects.length ||
    subjects.some((s, i) => s.id !== localSubjects[i]?.id || s.actualQuestionCount !== localSubjects[i]?.actualQuestionCount)
  ) {
    setLocalSubjects(subjects);
  }

  const { useReorderSubjectsMutation } = useTestItemSubjectsMutations(testItemId);
  const reorderSubjects = useReorderSubjectsMutation();

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localSubjects.findIndex((s) => s.id.toString() === active.id);
    const newIndex = localSubjects.findIndex((s) => s.id.toString() === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(localSubjects, oldIndex, newIndex);
    setLocalSubjects(reordered);
    onReorderSuccess(reordered);

    const items = reordered.map((s, index) => ({
      subjectId: s.id,
      orderIndex: index,
    }));

    reorderSubjects.mutate(
      { items },
      {
        onError: (e) => {
          // Revert on error
          setLocalSubjects(subjects);
          onReorderSuccess(subjects);
          toast.error(e instanceof Error ? e.message : "Failed to reorder subjects.");
        },
      }
    );
  };

  return (
    <div className={`${styles.tabsRow} ${className || ""}`}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localSubjects.map((s) => s.id.toString())}
          strategy={horizontalListSortingStrategy}
        >
          <div className={styles.tabsList}>
            {localSubjects.map((subject) => (
              <SortableTabItem
                key={subject.id}
                subject={subject}
                isActive={selectedSubjectId === subject.id}
                onClick={() => onSelectSubject(subject.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};