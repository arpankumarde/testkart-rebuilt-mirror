import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Edit, Trash2, FileText, Clock, Layers, AlertTriangle, ChevronRight, ChevronDown, ChevronUp, GripVertical, CalendarClock, Pencil } from "lucide-react";
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
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose } from
'../components/Dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
  useForm } from
'../components/Form';
import { Input } from '../components/Input';
import { Textarea } from '../components/Textarea';
import { Checkbox } from '../components/Checkbox';
import { DatePicker } from '../components/DatePicker';
import { TeacherFormHeader } from '../components/TeacherFormHeader';
import { useTeacherTestItemsQuery, useTeacherTestsQuery } from '../helpers/useTeacherTestsQuery';
import { useTeacherTestMutations } from '../helpers/useTeacherTestMutations';
import { useTeacherBulkMutations } from '../helpers/useTeacherBulkMutations';
import { TestItemSubjectsPanel } from '../components/TestItemSubjectsPanel';
import { schema as createTestItemSchema } from '../endpoints/teacher/test-items/create_POST.schema';
import { schema as updateTestItemSchema } from '../endpoints/teacher/test-items/update_POST.schema';
import { TestItemWithQuestionsCount } from '../endpoints/teacher/test-items/list_GET.schema';
import styles from "./teacher.create-test.$testId.test-items.module.css";

const TestItemForm = ({
  packageId,
  item,
  onSuccess
}: {
  packageId: number;
  item?: TestItemWithQuestionsCount;
  onSuccess: () => void;
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
          <FormControl>
            <DatePicker
              value={form.values.scheduledDate || undefined}
              onChange={(date) => form.setValues((p) => ({ ...p, scheduledDate: date ?? null }))}
            />
          </FormControl>
          <FormDescription>
            Set a future date when this test becomes available to students. Leave empty for immediate availability.
          </FormDescription>
          <FormMessage />
        </FormItem>
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
// gets a sense of what needs attention without opening every item.
const getItemIssues = (item: TestItemWithQuestionsCount): { blocking: string | null } => {
  let blocking: string | null = null;
  if (item.questionsCount === 0) {
    blocking = "Empty - add questions before you publish";
  } else if (item.missingAnswerCount > 0) {
    blocking = `${item.missingAnswerCount} question${item.missingAnswerCount === 1 ? "" : "s"} missing a correct answer`;
  } else if (item.subjectsCount > 1 && item.minSubjectQuestionCount === 0) {
    blocking = "One or more subjects have no questions yet";
  }

  return { blocking };
};

const SortableItemCard = ({
  item,
  packageId,
  onEdit,
  onDelete,
}: {
  item: TestItemWithQuestionsCount;
  packageId: number;
  onEdit: (item: TestItemWithQuestionsCount) => void;
  onDelete: (item: TestItemWithQuestionsCount) => void;
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
    >
      <div className={styles.itemRow}>
        <div className={styles.dragHandle} {...attributes} {...listeners}>
          <GripVertical size={20} />
        </div>
        <div className={styles.itemContent}>
          <h4 className={styles.itemTitle}>{item.title}</h4>
          <div className={styles.itemMeta}>
            <span><FileText size={14} /> {item.questionsCount} Questions</span>
            <span><Layers size={14} /> {item.subjectsCount} Subject{item.subjectsCount === 1 ? "" : "s"}</span>
            <span><Clock size={14} /> {getEffectiveDurationLabel(item)}</span>
            {item.isFree && <span className={styles.freeBadge}>Free</span>}
            {item.subjectWiseTiming && <span className={styles.subjectTimingBadge}>Subject-wise Timing</span>}
            {item.questionWiseTiming && <span className={styles.questionTimingBadge}>Question-wise Timing</span>}
            {item.scheduledDate && (
              <span className={styles.scheduledBadge}>
                <CalendarClock size={14} />
                {new Date(item.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
          {blocking && (
            <p className={styles.itemIssueBlocking}>
              <AlertTriangle size={13} /> {blocking}
            </p>
          )}
        </div>
        <div className={styles.itemActions}>
          <Button variant="outline" onClick={() => setIsSubjectsOpen((open) => !open)}>
            Subjects {isSubjectsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
          <Button variant="ghost" size="icon-md" onClick={() => onEdit(item)}>
            <Edit size={16} />
          </Button>
          <Button variant="ghost" size="icon-md" className={styles.deleteButton} onClick={() => onDelete(item)}>
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
      {isSubjectsOpen && (
        <TestItemSubjectsPanel
          packageId={packageId}
          itemId={item.id}
          subjectWiseTiming={item.subjectWiseTiming}
        />
      )}
    </div>
  );
};

const Page = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const packageId = Number(testId);

  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TestItemWithQuestionsCount | null>(null);
  const [deletingItem, setDeletingItem] = useState<TestItemWithQuestionsCount | null>(null);
  const [orderedItems, setOrderedItems] = useState<TestItemWithQuestionsCount[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);

  const { data: testItems, isLoading, error } = useTeacherTestItemsQuery(packageId);
  const { data: tests } = useTeacherTestsQuery();
  const series = tests?.find((t) => t.id === packageId);
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

  const handleNext = () => {
    navigate(`/teacher/create-test/${packageId}/review`);
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
          <h3>No Test Items Yet</h3>
          <p>Add the first test item to your package. Each item is a separate test within the package.</p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus size={16} /> Add Test Items
          </Button>
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
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeItem ? (
            <div className={`${styles.itemCard} ${styles.dragOverlay}`}>
              <div className={styles.itemRow}>
                <div className={styles.dragHandle}>
                  <GripVertical size={20} />
                </div>
                <div className={styles.itemContent}>
                  <h4 className={styles.itemTitle}>{activeItem.title}</h4>
                  <div className={styles.itemMeta}>
                    <span><FileText size={14} /> {activeItem.questionsCount} Questions</span>
                    <span><Layers size={14} /> {activeItem.subjectsCount} Subject{activeItem.subjectsCount === 1 ? "" : "s"}</span>
                    <span><Clock size={14} /> {getEffectiveDurationLabel(activeItem)}</span>
                    {activeItem.isFree && <span className={styles.freeBadge}>Free</span>}
                    {activeItem.subjectWiseTiming && <span className={styles.subjectTimingBadge}>Subject-wise Timing</span>}
                    {activeItem.questionWiseTiming && <span className={styles.questionTimingBadge}>Question-wise Timing</span>}
                    {activeItem.scheduledDate && (
                      <span className={styles.scheduledBadge}>
                        <CalendarClock size={14} />
                        {new Date(activeItem.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
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
      <Helmet>
        <title>Manage Test Items | Testkart</title>
        <meta name="description" content="Add, edit, or remove individual tests within your mock test package." />
      </Helmet>
      <div className={styles.page}>
        <TeacherFormHeader
          backTo="/teacher/test-series"
          backLabel="Test series"
          title="Manage test items"
          subtitle={series?.title ?? "Add or edit the tests in this series. Drag a card to reorder."}
        >
          <Button asChild variant="outline">
            <Link to={`/teacher/create-test/basic-info?testId=${packageId}`}>
              <Pencil size={16} /> Edit details
            </Link>
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus size={16} /> Add Test Items
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Test Items</DialogTitle>
                <DialogDescription>
                  Add one or multiple test items to this package. You'll add questions in the next step.
                </DialogDescription>
              </DialogHeader>
              <BulkCreateTestItemsForm
                packageId={packageId}
                onSuccess={() => setCreateDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </TeacherFormHeader>

        {renderContent()}

        {/* Edit Dialog */}
        <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Test Item</DialogTitle>
            </DialogHeader>
            {editingItem && (
              <TestItemForm
                packageId={packageId}
                item={editingItem}
                onSuccess={() => setEditingItem(null)} />
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
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

        <div className={styles.navigation}>
          <Button onClick={handleNext} disabled={visibleItems.length === 0}>
            Next: Review <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </>
  );
};

export default Page;