import React, { useId, useState } from "react";
import {
  useWorkExperiencesQuery,
  useCreateWorkExperienceMutation,
  useUpdateWorkExperienceMutation,
  useDeleteWorkExperienceMutation,
} from "../helpers/useTeacherWorkExperiences";
import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Checkbox } from "./Checkbox";
import { DatePicker } from "./DatePicker";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "./Form";
import { Skeleton } from "./Skeleton";
import { Plus, Pencil, Trash2, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Selectable } from "kysely";
import { TeacherWorkExperiences } from "../helpers/schema";
import { calendarDateToLocal, formatCalendarMonthYear, localToCalendarDate } from "../helpers/calendarDate";
import styles from "./EditProfileWorkExperienceSection.module.css";

const workExperienceFormSchema = z.object({
  companyName: z.string().min(1, "Add the school or institute."),
  position: z.string().min(1, "Add your role."),
  startDate: z.date({ required_error: "Pick a start date." }),
  endDate: z.date().nullable().optional(),
  isCurrent: z.boolean().default(false),
  description: z.string().optional(),
  location: z.string().optional(),
}).refine((data) => {
  if (!data.isCurrent && !data.endDate) {
    return false;
  }
  if (data.endDate && data.startDate > data.endDate) {
    return false;
  }
  return true;
}, {
  message: "Pick an end date after the start date, or tick that you still work here.",
  path: ["endDate"],
});

type WorkExperienceFormValues = z.infer<typeof workExperienceFormSchema>;
type WorkExperience = Selectable<TeacherWorkExperiences>;

// The form works in local dates; the API carries calendar dates as UTC midnight.
const toPayloadDates = (values: WorkExperienceFormValues) => ({
  ...values,
  startDate: localToCalendarDate(values.startDate),
  endDate: values.isCurrent || !values.endDate ? null : localToCalendarDate(values.endDate),
  description: values.description || null,
  location: values.location || null,
});

// Each entry saves through its own endpoint, apart from the profile form.
export const EditProfileWorkExperienceSection: React.FC = () => {
  const { data: workExperiences, isLoading, error } = useWorkExperiencesQuery();
  const createMutation = useCreateWorkExperienceMutation();
  const updateMutation = useUpdateWorkExperienceMutation();
  const deleteMutation = useDeleteWorkExperienceMutation();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WorkExperience | null>(null);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteMutation.mutateAsync({ id: pendingDelete.id });
      toast.success("Removed from your profile.");
      setPendingDelete(null);
    } catch {
      toast.error("Could not remove it. Try again.");
    }
  };

  if (isLoading) {
    return (
      <div className={styles.list}>
        <Skeleton className={styles.itemSkeleton} />
        <Skeleton className={styles.itemSkeleton} />
      </div>
    );
  }

  if (error) {
    return <p className={styles.error}>Work experience could not be loaded. Refresh the page to try again.</p>;
  }

  const items = workExperiences ?? [];

  return (
    <div className={styles.list}>
      {items.length === 0 && !isCreating && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <Briefcase size={20} />
          </span>
          <p className={styles.emptyText}>
            Nothing added yet. Students trust a teaching record they can see.
          </p>
        </div>
      )}

      {items.map((experience) => (
        <div key={experience.id} className={styles.card}>
          {editingId === experience.id ? (
            <WorkExperienceForm
              initialValues={{
                companyName: experience.companyName,
                position: experience.position,
                startDate: calendarDateToLocal(experience.startDate),
                endDate: experience.endDate ? calendarDateToLocal(experience.endDate) : null,
                isCurrent: experience.isCurrent ?? false,
                description: experience.description ?? "",
                location: experience.location ?? "",
              }}
              onSubmit={async (values) => {
                try {
                  await updateMutation.mutateAsync({
                    id: experience.id,
                    ...toPayloadDates(values),
                  });
                  toast.success("Work experience saved.");
                  setEditingId(null);
                } catch {
                  toast.error("Could not save it. Try again.");
                }
              }}
              onCancel={() => setEditingId(null)}
              isSubmitting={updateMutation.isPending}
            />
          ) : (
            <WorkExperienceDisplay
              experience={experience}
              onEdit={() => {
                setEditingId(experience.id);
                setIsCreating(false);
              }}
              onDelete={() => setPendingDelete(experience)}
            />
          )}
        </div>
      ))}

      {isCreating ? (
        <div className={styles.card}>
          <WorkExperienceForm
            onSubmit={async (values) => {
              try {
                await createMutation.mutateAsync(toPayloadDates(values));
                toast.success("Work experience added.");
                setIsCreating(false);
              } catch {
                toast.error("Could not add it. Try again.");
              }
            }}
            onCancel={() => setIsCreating(false)}
            isSubmitting={createMutation.isPending}
          />
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => {
            setIsCreating(true);
            setEditingId(null);
          }}
          className={styles.addButton}
        >
          <Plus size={16} /> Add work experience
        </Button>
      )}

      <ConsoleConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        tone="destructive"
        icon={<Trash2 size={20} />}
        title="Remove this role?"
        description={
          pendingDelete
            ? `${pendingDelete.position} at ${pendingDelete.companyName} comes off your public profile.`
            : undefined
        }
        confirmLabel="Remove"
        pendingLabel="Removing..."
        isPending={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

const WorkExperienceDisplay: React.FC<{
  experience: WorkExperience;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ experience, onEdit, onDelete }) => {
  const startDate = formatCalendarMonthYear(experience.startDate);
  const endDate = experience.isCurrent ? "Present" : formatCalendarMonthYear(experience.endDate);

  return (
    <div className={styles.displayItem}>
      <div className={styles.iconWrapper} aria-hidden="true">
        <Briefcase size={18} />
      </div>
      <div className={styles.content}>
        <div className={styles.itemHeader}>
          <div className={styles.itemText}>
            <h3 className={styles.position}>{experience.position}</h3>
            <p className={styles.companyLine}>
              {experience.companyName}
              {experience.location ? ` - ${experience.location}` : ""}
            </p>
            <p className={styles.dateRange}>
              {startDate} to {endDate}
              {experience.isCurrent && <span className={styles.currentTag}>Current</span>}
            </p>
          </div>
          <div className={styles.actions}>
            <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Edit ${experience.position}`}>
              <Pencil size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              className={styles.deleteBtn}
              aria-label={`Remove ${experience.position}`}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
        {experience.description && <p className={styles.description}>{experience.description}</p>}
      </div>
    </div>
  );
};

const WorkExperienceForm: React.FC<{
  initialValues?: WorkExperienceFormValues;
  onSubmit: (values: WorkExperienceFormValues) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}> = ({ initialValues, onSubmit, onCancel, isSubmitting }) => {
  const currentId = useId();
  const form = useForm({
    defaultValues: initialValues || {
      companyName: "",
      position: "",
      startDate: new Date(),
      endDate: null,
      isCurrent: false,
      description: "",
      location: "",
    },
    schema: workExperienceFormSchema,
  });

  const isCurrent = form.values.isCurrent;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
        <div className={styles.formGrid}>
          <FormItem name="position">
            <FormLabel>Role</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. Senior Maths Faculty"
                value={form.values.position}
                onChange={(e) => form.setValues((prev) => ({ ...prev, position: e.target.value }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="companyName">
            <FormLabel>School or institute</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. Delhi Public School"
                value={form.values.companyName}
                onChange={(e) => form.setValues((prev) => ({ ...prev, companyName: e.target.value }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="location">
            <FormLabel>Location</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. New Delhi"
                value={form.values.location || ""}
                onChange={(e) => form.setValues((prev) => ({ ...prev, location: e.target.value }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <div className={styles.checkboxRow}>
          <Checkbox
            id={currentId}
            checked={isCurrent}
            onChange={(e) => {
              const checked = e.target.checked;
              form.setValues((prev) => ({
                ...prev,
                isCurrent: checked,
                endDate: checked ? null : prev.endDate,
              }));
            }}
          />
          <label htmlFor={currentId} className={styles.checkboxLabel}>
            I still work here
          </label>
        </div>

        <div className={styles.formGrid}>
          <FormItem name="startDate">
            <FormLabel>Start date</FormLabel>
            <FormControl>
              <DatePicker
                showTime={false}
                value={form.values.startDate}
                onChange={(date) => form.setValues((prev) => ({ ...prev, startDate: date as Date }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          {!isCurrent && (
            <FormItem name="endDate">
              <FormLabel>End date</FormLabel>
              <FormControl>
                <DatePicker
                  showTime={false}
                  value={form.values.endDate || undefined}
                  onChange={(date) => form.setValues((prev) => ({ ...prev, endDate: date || null }))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        </div>

        <FormItem name="description">
          <FormLabel>What you did</FormLabel>
          <FormControl>
            <Textarea
              placeholder="Classes and subjects you taught, results, batch sizes..."
              value={form.values.description || ""}
              onChange={(e) => form.setValues((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <div className={styles.formActions}>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save role"}
          </Button>
        </div>
      </form>
    </Form>
  );
};
