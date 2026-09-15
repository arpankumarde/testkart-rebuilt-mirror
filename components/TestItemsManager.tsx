import { useState } from "react";
import { useTeacherTestItemsQuery } from "../helpers/useTeacherTestsQuery";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { Badge } from "./Badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from "./Textarea";
import { Checkbox } from "./Checkbox";
import { DatePicker } from "./DatePicker";
import { useTeacherTestMutations } from "../helpers/useTeacherTestMutations";
import { toast } from "sonner";
import { schema as createTestItemSchema } from "../endpoints/teacher/test-items/create_POST.schema";
import { schema as updateTestItemSchema } from "../endpoints/teacher/test-items/update_POST.schema";
import { Edit, Plus, Trash2, Clock, Timer, Download, LoaderCircle } from "lucide-react";
import { useDownloadTestPdf } from "../helpers/useDownloadTestPdf";

import { TestItemWithQuestionsCount } from "../endpoints/teacher/test-items/list_GET.schema";
import styles from "./TestItemsManager.module.css";

type TestItemsManagerProps = {
  packageId: number;
  onNext: () => void;
  onPrevious: () => void;
};

export const TestItemsManager = ({
  packageId,
  onNext,
  onPrevious,
}: TestItemsManagerProps) => {
  const { data: testItems, isFetching } = useTeacherTestItemsQuery(packageId);

  if (isFetching) {
    return <TestItemsSkeleton />;
  }

  if (!testItems) {
    return (
      <div>
        <p>Unable to load test items. Please try again.</p>
        <Button variant="outline" onClick={onPrevious}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div>
      <header className={styles.header}>
        <h2 className={styles.title}>Manage Test Items</h2>
        <AddTestItemDialog packageId={packageId} />
      </header>

      <div className={styles.itemsList}>
        {testItems.length === 0 && (
          <div className={styles.emptyState}>
            <p>No test items have been added yet.</p>
            <p>
              Add individual tests (e.g., "Section 1: English") to your
              package.
            </p>
          </div>
        )}
        {testItems.map((item) => (
          <TestItemCard key={item.id} item={item} />
        ))}
      </div>

      {testItems.length > 0 && (
        <div className={styles.addItemFooter}>
          <AddTestItemDialog packageId={packageId} variant="footer" />
        </div>
      )}

      <div className={styles.navigation}>
        <Button variant="outline" onClick={onPrevious} className={styles.navButton}>
          Previous
        </Button>
        <Button onClick={onNext} className={styles.navButton}>Next</Button>
      </div>
    </div>
  );
};

const TestItemCard = ({ item }: { item: TestItemWithQuestionsCount }) => {
  const { useDeleteTestItemMutation } = useTeacherTestMutations();
  const deleteItem = useDeleteTestItemMutation();
  const downloadPdf = useDownloadTestPdf();

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this test item?")) {
      deleteItem.mutate(
        { itemId: item.id },
        {
          onSuccess: () => toast.success("Test item deleted."),
          onError: (e) =>
            toast.error(
              e instanceof Error ? e.message : "Failed to delete item."
            ),
        }
      );
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>{item.title}</h3>
          <p className={styles.cardSubject}>{item.subject}</p>
        </div>
        <div className={styles.cardActions}>
          <AddTestItemDialog packageId={item.packageId} itemToEdit={item} />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => downloadPdf.mutate({ testItemId: item.id })}
            disabled={downloadPdf.isPending}
            aria-label="Download PDF"
            title="Download PDF"
          >
            {downloadPdf.isPending ? <LoaderCircle size={16} className={styles.spinner} /> : <Download size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDelete}
            disabled={deleteItem.isPending}
            aria-label="Delete item"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
      {item.description && (
        <p className={styles.cardDescription}>{item.description}</p>
      )}
      {item.scheduledDate && (
        <div className={styles.scheduledInfo}>
          <Clock size={14} />
          <span>
            Scheduled for: {new Date(item.scheduledDate).toLocaleString()}
          </span>
        </div>
      )}
      <div className={styles.cardFooter}>
        <Badge variant={item.isFree ? "success" : "secondary"}>
          {item.isFree ? "Free" : "Paid"}
        </Badge>
        <Badge variant={item.scheduledDate ? "warning" : "outline"}>
          {item.scheduledDate ? "Scheduled" : "Available Immediately"}
        </Badge>
        {item.subjectWiseTiming && (
          <Badge variant="default">
            <Timer size={12} />
            Subject-wise Timing
          </Badge>
        )}
        {item.questionWiseTiming && (
          <Badge variant="default">
            <Timer size={12} />
            Question-wise Timing
          </Badge>
        )}
        <span>{item.subjectWiseTiming ? `${item.totalSubjectDurationMinutes ?? 0} mins` : item.questionWiseTiming ? "Per question" : item.durationMinutes > 0 ? `${item.durationMinutes} mins` : "No Time Limit"}</span>
        <span>{item.questionsCount} questions</span>
      </div>
    </div>
  );
};

const AddTestItemDialog = ({
  packageId,
  itemToEdit,
  variant = "default",
}: {
  packageId: number;
  itemToEdit?: TestItemWithQuestionsCount;
  variant?: "default" | "footer";
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isEditMode = !!itemToEdit;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {isEditMode ? (
          <Button variant="ghost" size="icon-sm" aria-label="Edit item">
            <Edit size={16} />
          </Button>
        ) : variant === "footer" ? (
          <Button variant="outline">
            <Plus size={16} /> Add New Test Item
          </Button>
        ) : (
          <Button>
            <Plus size={16} /> Add Test Item
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Test Item" : "Add New Test Item"}
          </DialogTitle>
        </DialogHeader>
        {isEditMode ? (
          <EditTestItemForm
            itemToEdit={itemToEdit}
            onSuccess={() => setIsOpen(false)}
          />
        ) : (
          <CreateTestItemForm
            packageId={packageId}
            onSuccess={() => setIsOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

const CreateTestItemForm = ({
  packageId,
  onSuccess,
}: {
  packageId: number;
  onSuccess: () => void;
}) => {
  const { useCreateTestItemMutation } = useTeacherTestMutations();
  const createItem = useCreateTestItemMutation();

  const form = useForm({
    schema: createTestItemSchema,
    defaultValues: {
      packageId: packageId,
      title: "",
      subject: "General",
      description: "",
      durationMinutes: 60,
      isFree: false,
      calculatorEnabled: false,
      subjectWiseTiming: false,
      questionWiseTiming: false,
      scheduledDate: null as Date | null,
    },
  });

  const onSubmit = (values: typeof form.values) => {
    const finalValues = values.subjectWiseTiming || values.questionWiseTiming
      ? { ...values, durationMinutes: 0 }
      : values;
    createItem.mutate(finalValues, {
      onSuccess: () => {
        toast.success("Test item created successfully.");
        onSuccess();
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "An error occurred."
        );
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
        <FormItem name="title">
          <FormLabel>Title</FormLabel>
          <FormControl>
            <Input
              value={form.values.title}
              onChange={(e) =>
                form.setValues((p) => ({ ...p, title: e.target.value }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        <FormItem name="subject">
          <FormLabel>Subject</FormLabel>
          <FormControl>
            <Input
              value={form.values.subject}
              onChange={(e) =>
                form.setValues((p) => ({ ...p, subject: e.target.value }))
              }
              placeholder="e.g., Mathematics, Physics, General Knowledge"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        <FormItem name="description">
          <FormLabel>Description</FormLabel>
          <FormControl>
            <Textarea
              value={form.values.description ?? ""}
              onChange={(e) =>
                form.setValues((p) => ({ ...p, description: e.target.value }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        {!(form.values.subjectWiseTiming || form.values.questionWiseTiming) && (
        <FormItem name="durationMinutes">
          <FormLabel>Duration (minutes)</FormLabel>
          <FormControl>
            <Input
              type="number"
              value={form.values.durationMinutes || ''}
              onChange={(e) =>
                form.setValues((p) => ({
                  ...p,
                  durationMinutes: e.target.value === '' ? 0 : Number(e.target.value),
                }))
              }
            />
          </FormControl>
          <FormDescription>Set to 0 for no time limit.</FormDescription>
          <FormMessage />
        </FormItem>
        )}
        <FormItem name="isFree">
          <div className={styles.checkboxContainer}>
            <FormControl>
              <Checkbox
                id="isFree-create"
                checked={form.values.isFree}
                onChange={(e) =>
                  form.setValues((p) => ({ ...p, isFree: e.target.checked }))
                }
              />
            </FormControl>
            <FormLabel htmlFor="isFree-create">This is a free test</FormLabel>
          </div>
          <FormMessage />
        </FormItem>
        <FormItem name="calculatorEnabled">
          <div className={styles.checkboxContainer}>
            <FormControl>
              <Checkbox
                id="calculatorEnabled-create"
                checked={form.values.calculatorEnabled}
                onChange={(e) =>
                  form.setValues((p) => ({ ...p, calculatorEnabled: e.target.checked }))
                }
              />
            </FormControl>
            <FormLabel htmlFor="calculatorEnabled-create">Enable Scientific Calculator</FormLabel>
          </div>
          <FormDescription>Students will have access to a scientific calculator during this test.</FormDescription>
          <FormMessage />
        </FormItem>
        <FormItem name="subjectWiseTiming">
          <div className={styles.checkboxContainer}>
            <FormControl>
              <Checkbox
                id="subjectWiseTiming-create"
                checked={form.values.subjectWiseTiming}
                onChange={(e) =>
                  form.setValues((p) => ({
                    ...p,
                    subjectWiseTiming: e.target.checked,
                    ...(e.target.checked ? { questionWiseTiming: false } : {}),
                  }))
                }
              />
            </FormControl>
            <FormLabel htmlFor="subjectWiseTiming-create">Enable Subject-wise Timing</FormLabel>
          </div>
          <FormDescription>Each subject will have its own timer instead of a single overall timer.</FormDescription>
          <FormMessage />
        </FormItem>
        <FormItem name="questionWiseTiming">
          <div className={styles.checkboxContainer}>
            <FormControl>
              <Checkbox
                id="questionWiseTiming-create"
                checked={form.values.questionWiseTiming}
                onChange={(e) =>
                  form.setValues((p) => ({
                    ...p,
                    questionWiseTiming: e.target.checked,
                    ...(e.target.checked ? { subjectWiseTiming: false } : {}),
                  }))
                }
              />
            </FormControl>
            <FormLabel htmlFor="questionWiseTiming-create">Enable Question-wise Timing</FormLabel>
          </div>
          <FormDescription>Each question will have its own timer instead of a single overall timer.</FormDescription>
          <FormMessage />
        </FormItem>
        <FormItem name="scheduledDate">
          <FormLabel>Schedule Test Availability</FormLabel>
          <FormControl>
            <DatePicker
              value={form.values.scheduledDate || undefined}
              onChange={(date) =>
                form.setValues((p) => ({ ...p, scheduledDate: date ?? null }))
              }
            />
          </FormControl>
          <FormDescription>
            Set a date and time when this test becomes available to students. Leave empty for immediate availability.
          </FormDescription>
          <FormMessage />
        </FormItem>
        <Button type="submit" disabled={createItem.isPending}>
          {createItem.isPending ? "Creating..." : "Create Item"}
        </Button>
      </form>
    </Form>
  );
};

const EditTestItemForm = ({
  itemToEdit,
  onSuccess,
}: {
  itemToEdit: TestItemWithQuestionsCount;
  onSuccess: () => void;
}) => {
  const { useUpdateTestItemMutation } = useTeacherTestMutations();
  const updateItem = useUpdateTestItemMutation();

  const form = useForm({
    schema: updateTestItemSchema,
    defaultValues: {
      itemId: itemToEdit.id,
      title: itemToEdit.title,
      subject: itemToEdit.subject,
      description: itemToEdit.description,
      durationMinutes: itemToEdit.durationMinutes,
      isFree: itemToEdit.isFree,
      calculatorEnabled: itemToEdit.calculatorEnabled || false,
      subjectWiseTiming: itemToEdit.subjectWiseTiming || false,
      questionWiseTiming: itemToEdit.questionWiseTiming || false,
      scheduledDate: itemToEdit.scheduledDate ? new Date(itemToEdit.scheduledDate) : null as Date | null,
    },
  });

  const onSubmit = (values: typeof form.values) => {
    const finalValues = values.subjectWiseTiming || values.questionWiseTiming
      ? { ...values, durationMinutes: 0 }
      : values;
    updateItem.mutate(finalValues, {
      onSuccess: () => {
        toast.success("Test item updated successfully.");
        onSuccess();
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "An error occurred."
        );
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
        <FormItem name="title">
          <FormLabel>Title</FormLabel>
          <FormControl>
            <Input
              value={form.values.title}
              onChange={(e) =>
                form.setValues((p) => ({ ...p, title: e.target.value }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        <FormItem name="subject">
          <FormLabel>Subject</FormLabel>
          <FormControl>
            <Input
              value={form.values.subject}
              onChange={(e) =>
                form.setValues((p) => ({ ...p, subject: e.target.value }))
              }
              placeholder="e.g., Mathematics, Physics, General Knowledge"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        <FormItem name="description">
          <FormLabel>Description</FormLabel>
          <FormControl>
            <Textarea
              value={form.values.description ?? ""}
              onChange={(e) =>
                form.setValues((p) => ({ ...p, description: e.target.value }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        {!(form.values.subjectWiseTiming || form.values.questionWiseTiming) && (
        <FormItem name="durationMinutes">
          <FormLabel>Duration (minutes)</FormLabel>
          <FormControl>
            <Input
              type="number"
              value={form.values.durationMinutes || ''}
              onChange={(e) =>
                form.setValues((p) => ({
                  ...p,
                  durationMinutes: e.target.value === '' ? 0 : Number(e.target.value),
                }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        )}
        <FormItem name="isFree">
          <div className={styles.checkboxContainer}>
            <FormControl>
              <Checkbox
                id="isFree-edit"
                checked={form.values.isFree}
                onChange={(e) =>
                  form.setValues((p) => ({ ...p, isFree: e.target.checked }))
                }
              />
            </FormControl>
            <FormLabel htmlFor="isFree-edit">This is a free test</FormLabel>
          </div>
          <FormMessage />
        </FormItem>
        <FormItem name="calculatorEnabled">
          <div className={styles.checkboxContainer}>
            <FormControl>
              <Checkbox
                id="calculatorEnabled-edit"
                checked={form.values.calculatorEnabled}
                onChange={(e) =>
                  form.setValues((p) => ({ ...p, calculatorEnabled: e.target.checked }))
                }
              />
            </FormControl>
            <FormLabel htmlFor="calculatorEnabled-edit">Enable Scientific Calculator</FormLabel>
          </div>
          <FormDescription>Students will have access to a scientific calculator during this test.</FormDescription>
          <FormMessage />
        </FormItem>
        <FormItem name="subjectWiseTiming">
          <div className={styles.checkboxContainer}>
            <FormControl>
              <Checkbox
                id="subjectWiseTiming-edit"
                checked={form.values.subjectWiseTiming}
                onChange={(e) =>
                  form.setValues((p) => ({
                    ...p,
                    subjectWiseTiming: e.target.checked,
                    ...(e.target.checked ? { questionWiseTiming: false } : {}),
                  }))
                }
              />
            </FormControl>
            <FormLabel htmlFor="subjectWiseTiming-edit">Enable Subject-wise Timing</FormLabel>
          </div>
          <FormDescription>Each subject will have its own timer instead of a single overall timer.</FormDescription>
          <FormMessage />
        </FormItem>
        <FormItem name="questionWiseTiming">
          <div className={styles.checkboxContainer}>
            <FormControl>
              <Checkbox
                id="questionWiseTiming-edit"
                checked={form.values.questionWiseTiming}
                onChange={(e) =>
                  form.setValues((p) => ({
                    ...p,
                    questionWiseTiming: e.target.checked,
                    ...(e.target.checked ? { subjectWiseTiming: false } : {}),
                  }))
                }
              />
            </FormControl>
            <FormLabel htmlFor="questionWiseTiming-edit">Enable Question-wise Timing</FormLabel>
          </div>
          <FormDescription>Each question will have its own timer instead of a single overall timer.</FormDescription>
          <FormMessage />
        </FormItem>
        <FormItem name="scheduledDate">
          <FormLabel>Schedule Test Availability</FormLabel>
          <FormControl>
            <DatePicker
              value={form.values.scheduledDate || undefined}
              onChange={(date) =>
                form.setValues((p) => ({ ...p, scheduledDate: date ?? null }))
              }
            />
          </FormControl>
          <FormDescription>
            Set a date and time when this test becomes available to students. Leave empty for immediate availability.
          </FormDescription>
          <FormMessage />
        </FormItem>
        <Button type="submit" disabled={updateItem.isPending}>
          {updateItem.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </Form>
  );
};

const TestItemsSkeleton = () => (
  <div>
    <div className={styles.header}>
      <Skeleton style={{ height: "2rem", width: "200px" }} />
      <Skeleton style={{ height: "2.5rem", width: "150px" }} />
    </div>
    <div className={styles.itemsList}>
      {[...Array(2)].map((_, i) => (
        <div className={styles.card} key={i}>
          <Skeleton style={{ height: "1.5rem", width: "70%" }} />
          <Skeleton style={{ height: "3rem", marginTop: "0.5rem" }} />
          <div
            className={styles.cardFooter}
            style={{ justifyContent: "flex-start", gap: "1rem" }}
          >
            <Skeleton style={{ height: "1.5rem", width: "60px" }} />
            <Skeleton style={{ height: "1.5rem", width: "80px" }} />
            <Skeleton style={{ height: "1.5rem", width: "100px" }} />
          </div>
        </div>
      ))}
    </div>
  </div>
);