import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Edit, Trash2, FileText, Clock, Layers, AlertTriangle, ChevronDown, ChevronUp, GripVertical, CalendarClock, Zap, X, PenLine } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "./Dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Checkbox } from "./Checkbox";
import { DatePicker } from "./DatePicker";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./Collapsible";
import { TestItemSubjectsPanel } from "./TestItemSubjectsPanel";
import { useTeacherTestItemsQuery } from "../helpers/useTeacherTestsQuery";
import { useTeacherTestMutations } from "../helpers/useTeacherTestMutations";
import { useTeacherBulkMutations } from "../helpers/useTeacherBulkMutations";
import { schema as createTestItemSchema } from "../endpoints/teacher/test-items/create_POST.schema";
import { schema as updateTestItemSchema } from "../endpoints/teacher/test-items/update_POST.schema";
import { TestItemWithQuestionsCount } from "../endpoints/teacher/test-items/list_GET.schema";
import { cardTapProps } from "../helpers/cardTap";
import styles from "./TestSeriesItemsEditor.module.css";

/*
 * The tests inside one test series: add, edit, reorder and trash them, and open
 * each one's subjects. Shared by the teacher test items page and the admin editor.
 * `guided` (teacher page only) puts an Add questions button on each card and
 * shows the simpler settings form: one Timer choice, with calculator and
 * schedule folded under More options.
 */

const formatSchedule = (date: Date | string): string =>
  new Date(date).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

// A schedule only holds a test back while it is in the future; a passed one is already live.
const isScheduledAhead = (date: Date | string | null | undefined): date is Date | string =>
  !!date && new Date(date).getTime() > Date.now();

type TimerMode = "test" | "subject" | "question";

const MoreOptions = ({
  guided,
  open,
  onOpenChange,
  children,
}: {
  guided: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) => {
  if (!guided) return <>{children}</>;
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className={styles.moreOptions}>
      <CollapsibleTrigger className={styles.moreOptionsTrigger}>
        More options
        <span className={styles.moreOptionsHint}>Calculator and schedule</span>
        <ChevronDown size={16} aria-hidden="true" className={styles.moreOptionsChevron} />
      </CollapsibleTrigger>
      <CollapsibleContent className={styles.moreOptionsContent}>{children}</CollapsibleContent>
    </Collapsible>
  );
};

const TIMER_MODES: { key: TimerMode; label: string; hint: string }[] = [
  { key: "test", label: "Whole test", hint: "One countdown for the whole test." },
  { key: "subject", label: "Per subject", hint: "Set a time for each subject on the questions page." },
  { key: "question", label: "Per question", hint: "Set a time for each question on the questions page." },
];

const TestItemForm = ({
  packageId,
  item,
  onSuccess,
  guided = false,
}: {
  packageId: number;
  item?: TestItemWithQuestionsCount;
  onSuccess: () => void;
  guided?: boolean;
}) => {
  const isEditMode = !!item;
  const { useCreateTestItemMutation, useUpdateTestItemMutation } = useTeacherTestMutations();
  const createMutation = useCreateTestItemMutation();
  const updateMutation = useUpdateTestItemMutation();

  const formSchema = isEditMode ? updateTestItemSchema.omit({ itemId: true }) : createTestItemSchema.omit({ packageId: true });

  const form = useForm({
    schema: formSchema,
    defaultValues: {
      title: item?.title ?? "",
      description: item?.description ?? null,
      subject: item?.subject ?? "",
      // A stored 0 is a real value (no time limit), so only a missing one takes the default.
      durationMinutes: item?.durationMinutes ?? 60,
      isFree: item?.isFree ?? false,
      calculatorEnabled: item?.calculatorEnabled ?? false,
      subjectWiseTiming: item?.subjectWiseTiming ?? false,
      questionWiseTiming: item?.questionWiseTiming ?? false,
      scheduledDate: item?.scheduledDate ? new Date(item.scheduledDate) : null as Date | null,
    }
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const cleaned = {
      ...values,
      description: values.description ?? null,
      subject: values.subject ?? "",
      calculatorEnabled: values.calculatorEnabled ?? false,
      subjectWiseTiming: values.subjectWiseTiming ?? false,
      questionWiseTiming: values.questionWiseTiming ?? false,
      durationMinutes: (values.subjectWiseTiming || values.questionWiseTiming) ? 0 : values.durationMinutes,
      scheduledDate: values.scheduledDate ?? null,
    };

    if (isEditMode && item) {
      updateMutation.mutate(
        { ...cleaned, itemId: item.id },
        {
          onSuccess: () => {
            toast.success("Test item updated.");
            onSuccess();
          },
          onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed.")
        }
      );
    } else {
      createMutation.mutate(
        { ...cleaned, packageId },
        {
          onSuccess: () => {
            toast.success("Test item created.");
            onSuccess();
          },
          onError: (e) => toast.error(e instanceof Error ? e.message : "Creation failed.")
        }
      );
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  const scheduledDate = form.values.scheduledDate ?? null;
  const timerMode: TimerMode = form.values.subjectWiseTiming
    ? "subject"
    : form.values.questionWiseTiming
      ? "question"
      : "test";
  const [moreOpen, setMoreOpen] = useState(
    !!item && (item.calculatorEnabled || isScheduledAhead(item.scheduledDate))
  );
  const scheduleHint = (() => {
    if (!scheduledDate) {
      return item?.scheduledDate
        ? "Schedule removed. The test becomes available to students as soon as you save."
        : "Leave empty to make this test available immediately, or pick a date and time to schedule it.";
    }
    if (isScheduledAhead(scheduledDate)) {
      return `Students can see this test but cannot start it until ${formatSchedule(scheduledDate)}. Pick another date to reschedule, or make it live now.`;
    }
    return "This time has already passed, so the test is available to students.";
  })();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.dialogForm}>
        <FormItem name="title">
          <FormLabel>Title</FormLabel>
          <FormControl>
            <Input
              placeholder="e.g., Section 1: General Intelligence"
              value={form.values.title}
              onChange={(e) => form.setValues((p) => ({ ...p, title: e.target.value }))} />
          </FormControl>
          <FormMessage />
        </FormItem>
        {guided ? (
          <FormItem name="subjectWiseTiming">
            <FormLabel>Timer</FormLabel>
            <div className={styles.timerChoices} role="radiogroup" aria-label="Timer">
              {TIMER_MODES.map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  role="radio"
                  aria-checked={timerMode === mode.key}
                  className={styles.timerChoice}
                  onClick={() =>
                    form.setValues((p) => ({
                      ...p,
                      subjectWiseTiming: mode.key === "subject",
                      questionWiseTiming: mode.key === "question",
                    }))
                  }
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <FormDescription>{TIMER_MODES.find((m) => m.key === timerMode)?.hint}</FormDescription>
            <FormMessage />
          </FormItem>
        ) : (
        <>
        <FormItem name="subjectWiseTiming" className={styles.checkboxFormItem}>
          <div className={styles.checkboxWrapper}>
            <FormControl>
              <Checkbox
                id="subjectWiseTiming"
                checked={form.values.subjectWiseTiming}
                onChange={(e) => form.setValues((p) => ({
                  ...p,
                  subjectWiseTiming: e.target.checked,
                  ...(e.target.checked ? { questionWiseTiming: false } : {})
                }))}
              />
            </FormControl>
            <FormLabel htmlFor="subjectWiseTiming">Set time at subject level</FormLabel>
          </div>
          <FormDescription>
            {form.values.subjectWiseTiming
              ? "Time will be configured per subject in the questions step."
              : "If unchecked, a single timer is used or configured per question."}
          </FormDescription>
          <FormMessage />
        </FormItem>
        <FormItem name="questionWiseTiming" className={styles.checkboxFormItem}>
          <div className={styles.checkboxWrapper}>
            <FormControl>
              <Checkbox
                id="questionWiseTiming"
                checked={form.values.questionWiseTiming}
                onChange={(e) => form.setValues((p) => ({
                  ...p,
                  questionWiseTiming: e.target.checked,
                  ...(e.target.checked ? { subjectWiseTiming: false } : {})
                }))}
              />
            </FormControl>
            <FormLabel htmlFor="questionWiseTiming">Set time at question level</FormLabel>
          </div>
          <FormDescription>
            {form.values.questionWiseTiming
              ? "Time will be configured per question in the questions step."
              : "If unchecked, a single timer is used or configured per subject."}
          </FormDescription>
          <FormMessage />
        </FormItem>
        </>
        )}
        {!(form.values.subjectWiseTiming || form.values.questionWiseTiming) && (
          <FormItem name="durationMinutes">
            <FormLabel>Duration (minutes)</FormLabel>
            <FormControl>
              <Input
                type="number"
                value={form.values.durationMinutes}
                onChange={(e) => form.setValues((p) => ({ ...p, durationMinutes: Number(e.target.value) }))} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
        <FormItem name="isFree" className={styles.checkboxFormItem}>
          <div className={styles.checkboxWrapper}>
            <FormControl>
              <Checkbox
                id="isFree"
                checked={form.values.isFree}
                onChange={(e) => form.setValues((p) => ({ ...p, isFree: e.target.checked }))}
              />
            </FormControl>
            <FormLabel htmlFor="isFree">This is a free test</FormLabel>
          </div>
          <FormDescription>
            If checked, students can attempt this test without purchasing the package.
          </FormDescription>
          <FormMessage />
        </FormItem>
        <MoreOptions guided={guided} open={moreOpen} onOpenChange={setMoreOpen}>
        <FormItem name="calculatorEnabled" className={styles.checkboxFormItem}>
          <div className={styles.checkboxWrapper}>
            <FormControl>
              <Checkbox
                id="calculatorEnabled"
                checked={form.values.calculatorEnabled}
                onChange={(e) => form.setValues((p) => ({ ...p, calculatorEnabled: e.target.checked }))}
              />
            </FormControl>
            <FormLabel htmlFor="calculatorEnabled">Enable Scientific Calculator</FormLabel>
          </div>
          <FormDescription>
            Students will have access to a scientific calculator during this test.
          </FormDescription>
          <FormMessage />
        </FormItem>
        <FormItem name="scheduledDate">
          <FormLabel>Schedule Availability</FormLabel>
          <div className={styles.scheduleRow}>
            <div className={styles.schedulePicker}>
              <FormControl>
                <DatePicker
                  value={scheduledDate || undefined}
                  onChange={(date) => form.setValues((p) => ({ ...p, scheduledDate: date ?? null }))}
                />
              </FormControl>
            </div>
            {scheduledDate && (
              <Button
                type="button"
                variant="outline"
                onClick={() => form.setValues((p) => ({ ...p, scheduledDate: null }))}
              >
                {isScheduledAhead(scheduledDate) ? <><Zap size={16} /> Make live now</> : <><X size={16} /> Clear</>}
              </Button>
            )}
          </div>
          <FormDescription>{scheduleHint}</FormDescription>
          <FormMessage />
        </FormItem>
        </MoreOptions>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};

const BulkCreateTestItemsForm = ({
  packageId,
  onSuccess
}: {
  packageId: number;
  onSuccess: () => void;
}) => {
  const { useBulkCreateTestItemsMutation } = useTeacherBulkMutations();
  const createBulkMutation = useBulkCreateTestItemsMutation();

  const formSchema = z.object({
    count: z.number().int().min(1, "At least 1 item is required").max(50, "You can add up to 50 items at once"),
  });

  const form = useForm({
    schema: formSchema,
    defaultValues: {
      count: 1,
    }
  });

  // One item or many, the server names them "Test N" with the next free numbers,
  // so adding a single item twice never collides. The hook reports errors.
  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createBulkMutation.mutate(
      { packageId, count: values.count },
      {
        onSuccess: (items) => {
          const names = items.map((item) => item.title);
          toast.success(names.length <= 3 ? `Added ${names.join(", ")}.` : `Added ${names.length} test items.`);
          onSuccess();
        },
      }
    );
  };

  const isLoading = createBulkMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.dialogForm}>
        <FormItem name="count">
          <FormLabel>How many test items would you like to add?</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={1}
              max={50}
              value={form.values.count}
              onChange={(e) => form.setValues((p) => ({ ...p, count: Number(e.target.value) }))}
            />
          </FormControl>
          <FormDescription>
            You can add up to 50 items at once.
          </FormDescription>
          <FormMessage />
        </FormItem>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Creating..." : "Add Items"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};

/* The "Add tests" button and its dialog, placed by each page in its own header. */
export const AddTestItemsButton = ({ packageId }: { packageId: number }) => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} /> Add tests
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add tests</DialogTitle>
          <DialogDescription>
            Add one or more tests to this series. You will add questions in the next step.
          </DialogDescription>
        </DialogHeader>
        <BulkCreateTestItemsForm packageId={packageId} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
};

// With subject-wise or question-wise timing the item's own durationMinutes is
// saved as 0, so the card shows the total across subjects or questions instead.
const getEffectiveDurationLabel = (item: TestItemWithQuestionsCount): string => {
  if (item.subjectWiseTiming) {
    return `${item.totalSubjectDurationMinutes ?? 0} min`;
  }
  if (item.questionWiseTiming) {
    return `${item.totalQuestionDurationMinutes ?? 0} min`;
  }
  return `${item.durationMinutes} min`;
};

// Same checks the review/publish step blocks on, surfaced here so a teacher
// gets a sense of what needs attention without opening every item. A test
// scheduled to open later may stay empty, as on the review page.
const getItemIssues = (item: TestItemWithQuestionsCount): { blocking: string | null } => {
  let blocking: string | null = null;
  const opensLater = isScheduledAhead(item.scheduledDate);
  if (item.questionsCount === 0) {
    if (opensLater) return { blocking: null };
    blocking = "Empty - add questions before you publish";
  } else if (item.missingAnswerCount > 0) {
    blocking = `${item.missingAnswerCount} question${item.missingAnswerCount === 1 ? "" : "s"} missing a correct answer`;
  } else if (item.subjectsCount > 1 && item.minSubjectQuestionCount === 0 && !opensLater) {
    blocking = "One or more subjects have no questions yet";
  }

  return { blocking };
};

const SortableItemCard = ({
  item,
  packageId,
  onEdit,
  onDelete,
  guided,
}: {
  item: TestItemWithQuestionsCount;
  packageId: number;
  onEdit: (item: TestItemWithQuestionsCount) => void;
  onDelete: (item: TestItemWithQuestionsCount) => void;
  guided: boolean;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const [isSubjectsOpen, setIsSubjectsOpen] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const { blocking } = getItemIssues(item);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.itemCard} ${isDragging ? styles.dragging : ""} ${blocking ? styles.itemCardBlocking : ""}`}
      {...cardTapProps}
    >
      <div className={styles.itemRow}>
        <div className={styles.dragHandle} {...attributes} {...listeners} aria-label={`Move ${item.title}`} data-card-tap-ignore>
          <GripVertical size={20} aria-hidden="true" />
        </div>
        <div className={styles.itemContent}>
          <h4 className={styles.itemTitle}>{item.title}</h4>
          <div className={styles.itemMeta}>
            <span><FileText size={14} aria-hidden="true" /> {item.questionsCount} question{item.questionsCount === 1 ? "" : "s"}</span>
            <span><Layers size={14} aria-hidden="true" /> {item.subjectsCount} subject{item.subjectsCount === 1 ? "" : "s"}</span>
            <span><Clock size={14} aria-hidden="true" /> {getEffectiveDurationLabel(item)}</span>
            {item.isFree && <span className={styles.freeBadge}>Free</span>}
            {item.subjectWiseTiming && <span className={styles.subjectTimingBadge}>Subject-wise timing</span>}
            {item.questionWiseTiming && <span className={styles.questionTimingBadge}>Question-wise timing</span>}
            {isScheduledAhead(item.scheduledDate) && (
              <span className={styles.scheduledBadge}>
                <CalendarClock size={14} aria-hidden="true" />
                Scheduled {formatSchedule(item.scheduledDate)}
              </span>
            )}
          </div>
          {blocking && (
            <p className={styles.itemIssueBlocking}>
              <AlertTriangle size={13} aria-hidden="true" /> {blocking}
            </p>
          )}
        </div>
        <div className={styles.itemActions}>
          {guided && (
            <Button asChild variant={item.questionsCount === 0 ? "primary" : "outline"}>
              <Link to={`/teacher/create-test/${packageId}/test-items/${item.id}/questions`} data-card-primary>
                {item.questionsCount === 0 ? <Plus size={16} aria-hidden="true" /> : <PenLine size={16} aria-hidden="true" />}
                {item.questionsCount === 0 ? "Add questions" : "Edit questions"}
              </Link>
            </Button>
          )}
          <Button
            variant={guided ? "ghost" : "outline"}
            aria-expanded={isSubjectsOpen}
            aria-label={`Subjects in ${item.title}`}
            onClick={() => setIsSubjectsOpen((open) => !open)}
            data-card-primary={guided ? undefined : ""}
          >
            Subjects {isSubjectsOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          </Button>
          <Button variant="ghost" size="icon-md" onClick={() => onEdit(item)} aria-label={`Edit ${item.title}`} title="Edit">
            <Edit size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.deleteButton}
            onClick={() => onDelete(item)}
            aria-label={`Move ${item.title} to Trash`}
            title="Move to Trash"
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>
      {isSubjectsOpen && (
        <div data-card-tap-ignore style={{ display: "contents" }}>
          <TestItemSubjectsPanel
            packageId={packageId}
            itemId={item.id}
            subjectWiseTiming={item.subjectWiseTiming}
          />
        </div>
      )}
    </div>
  );
};

export const TestSeriesItemsList = ({ packageId, guided = false }: { packageId: number; guided?: boolean }) => {
  const [editingItem, setEditingItem] = useState<TestItemWithQuestionsCount | null>(null);
  const [deletingItem, setDeletingItem] = useState<TestItemWithQuestionsCount | null>(null);
  const [orderedItems, setOrderedItems] = useState<TestItemWithQuestionsCount[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: testItems, isLoading, error } = useTeacherTestItemsQuery(packageId);
  const { useDeleteTestItemMutation, useReorderTestItemsMutation } = useTeacherTestMutations();
  const deleteMutation = useDeleteTestItemMutation();
  const reorderMutation = useReorderTestItemsMutation();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // The server order wins whenever the list refetches, including after a reorder.
  useEffect(() => {
    if (testItems) {
      setOrderedItems(testItems);
    }
  }, [testItems]);

  // orderedItems lags the query by one render; show the query's list meanwhile.
  const visibleItems = orderedItems.length > 0 || !testItems ? orderedItems : testItems;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = visibleItems.findIndex((item) => item.id === active.id);
    const newIndex = visibleItems.findIndex((item) => item.id === over.id);
    const newOrderedItems = arrayMove(visibleItems, oldIndex, newIndex);
    setOrderedItems(newOrderedItems);

    // The moved card is its own confirmation; only a failure needs a toast.
    reorderMutation.mutate(
      { items: newOrderedItems.map((item, index) => ({ itemId: item.id, orderIndex: index })) },
      {
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : "Could not save the new order.");
          if (testItems) {
            setOrderedItems(testItems);
          }
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deletingItem) return;
    deleteMutation.mutate(
      { itemId: deletingItem.id },
      {
        onSuccess: () => {
          toast.success(`"${deletingItem.title}" moved to Trash.`);
          setDeletingItem(null);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not move the test item to Trash.")
      }
    );
  };

  const renderContent = () => {
    // Skeleton only before the first load. A background refetch keeps the cards
    // mounted, so open Subjects panels stay open.
    if (isLoading) {
      return (
        <div className={styles.list}>
          {[...Array(3)].map((_, i) =>
            <div key={i} className={styles.itemCard}>
              <div className={styles.itemContent}>
                <Skeleton style={{ height: "1.5rem", width: "60%", marginBottom: "var(--spacing-2)" }} />
                <Skeleton style={{ height: "1rem", width: "80%" }} />
              </div>
            </div>
          )}
        </div>
      );
    }

    if (error && !testItems) {
      return (
        <div className={styles.emptyState}>
          <span className={styles.errorIcon} aria-hidden="true"><AlertTriangle size={26} /></span>
          <h3>Could not load these tests</h3>
          <p>{error.message}</p>
        </div>
      );
    }

    if (visibleItems.length === 0) {
      return (
        <div className={styles.emptyState}>
          <h3>No tests in this series yet</h3>
          <p>Add the first test. Each one is a separate paper that students take on its own.</p>
          <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus size={16} aria-hidden="true" /> Add tests
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add tests</DialogTitle>
                <DialogDescription>
                  Add one or more tests to this series. You will add questions in the next step.
                </DialogDescription>
              </DialogHeader>
              <BulkCreateTestItemsForm packageId={packageId} onSuccess={() => setCreateDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    const activeItem = visibleItems.find((item) => item.id === activeId);

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleItems.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className={styles.list}>
            {visibleItems.map((item) => (
              <SortableItemCard
                key={item.id}
                item={item}
                packageId={packageId}
                onEdit={setEditingItem}
                onDelete={setDeletingItem}
                guided={guided}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeItem ? (
            <div className={`${styles.itemCard} ${styles.dragOverlay}`} aria-hidden="true" inert>
              <div className={styles.itemRow}>
                <div className={styles.dragHandle}>
                  <GripVertical size={20} />
                </div>
                <div className={styles.itemContent}>
                  <h4 className={styles.itemTitle}>{activeItem.title}</h4>
                  <div className={styles.itemMeta}>
                    <span><FileText size={14} /> {activeItem.questionsCount} question{activeItem.questionsCount === 1 ? "" : "s"}</span>
                    <span><Layers size={14} /> {activeItem.subjectsCount} subject{activeItem.subjectsCount === 1 ? "" : "s"}</span>
                    <span><Clock size={14} /> {getEffectiveDurationLabel(activeItem)}</span>
                    {activeItem.isFree && <span className={styles.freeBadge}>Free</span>}
                    {activeItem.subjectWiseTiming && <span className={styles.subjectTimingBadge}>Subject-wise timing</span>}
                    {activeItem.questionWiseTiming && <span className={styles.questionTimingBadge}>Question-wise timing</span>}
                    {isScheduledAhead(activeItem.scheduledDate) && (
                      <span className={styles.scheduledBadge}>
                        <CalendarClock size={14} />
                        Scheduled {formatSchedule(activeItem.scheduledDate)}
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.itemActions}>
                  <Button variant="outline">Subjects <ChevronDown size={16} /></Button>
                  <Button variant="ghost" size="icon-md">
                    <Edit size={16} />
                  </Button>
                  <Button variant="ghost" size="icon-md" className={styles.deleteButton}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  };

  return (
    <>
      {renderContent()}

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{guided ? "Test settings" : "Edit Test Item"}</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <TestItemForm
              packageId={packageId}
              item={editingItem}
              guided={guided}
              onSuccess={() => setEditingItem(null)} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Trash?</DialogTitle>
            <DialogDescription>
              "{deletingItem?.title}" leaves this series, with its subjects and questions kept. You can restore it from Trash.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Moving..." : "Move to Trash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
