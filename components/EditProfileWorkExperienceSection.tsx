import React, { useState } from "react";
import { format } from "date-fns";
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
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "./Form";
import { Skeleton } from "./Skeleton";
import { Plus, Pencil, Trash2, X, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Selectable } from "kysely";
import { TeacherWorkExperiences } from "../helpers/schema";
import styles from "./EditProfileWorkExperienceSection.module.css";

// Schema for the form, matching the endpoint schema but adapted for UI
const workExperienceFormSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  position: z.string().min(1, "Position is required"),
  startDate: z.date({ required_error: "Start date is required" }),
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
  message: "End date is required for past roles and must be after start date",
  path: ["endDate"],
});

type WorkExperienceFormValues = z.infer<typeof workExperienceFormSchema>;

export const EditProfileWorkExperienceSection: React.FC = () => {
  const { data: workExperiences, isLoading, error } = useWorkExperiencesQuery();
  const createMutation = useCreateWorkExperienceMutation();
  const updateMutation = useUpdateWorkExperienceMutation();
  const deleteMutation = useDeleteWorkExperienceMutation();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this work experience?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        toast.success("Work experience deleted");
      } catch (err) {
        toast.error("Failed to delete work experience");
      }
    }
  };

  if (isLoading) {
    return (
      <div className={styles.section}>
        <Skeleton className={styles.titleSkeleton} />
        <Skeleton className={styles.itemSkeleton} />
        <Skeleton className={styles.itemSkeleton} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        Failed to load work experiences. Please try again later.
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.sectionTitle}>Work Experience</h2>
          <p className={styles.sectionDescription}>
            Add your past and current work experiences to showcase your professional background.
          </p>
        </div>
      </div>

      <div className={styles.list}>
        {workExperiences?.map((experience) => (
          <div key={experience.id} className={styles.card}>
            {editingId === experience.id ? (
              <WorkExperienceForm
                initialValues={{
                  companyName: experience.companyName,
                  position: experience.position,
                  startDate: new Date(experience.startDate),
                  endDate: experience.endDate ? new Date(experience.endDate) : null,
                  isCurrent: experience.isCurrent ?? false,
                  description: experience.description ?? "",
                  location: experience.location ?? "",
                }}
                onSubmit={async (values) => {
                  try {
                    await updateMutation.mutateAsync({
                      id: experience.id,
                      ...values,
                      description: values.description || null,
                      location: values.location || null,
                    });
                    toast.success("Work experience updated");
                    setEditingId(null);
                  } catch (err) {
                    toast.error("Failed to update work experience");
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
                onDelete={() => handleDelete(experience.id)}
              />
            )}
          </div>
        ))}

        {isCreating ? (
          <div className={styles.card}>
            <WorkExperienceForm
              onSubmit={async (values) => {
                try {
                  await createMutation.mutateAsync({
                    ...values,
                    description: values.description || null,
                    location: values.location || null,
                  });
                  toast.success("Work experience added");
                  setIsCreating(false);
                } catch (err) {
                  toast.error("Failed to add work experience");
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
            <Plus size={16} /> Add Work Experience
          </Button>
        )}
      </div>
    </div>
  );
};

const WorkExperienceDisplay: React.FC<{
  experience: Selectable<TeacherWorkExperiences>;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ experience, onEdit, onDelete }) => {
  const startDate = format(new Date(experience.startDate), "MMM yyyy");
  const endDate = experience.isCurrent
    ? "Present"
    : experience.endDate
    ? format(new Date(experience.endDate), "MMM yyyy")
    : "";

  return (
    <div className={styles.displayItem}>
      <div className={styles.iconWrapper}>
        <Briefcase size={20} />
      </div>
      <div className={styles.content}>
        <div className={styles.itemHeader}>
          <div>
            <h3 className={styles.position}>{experience.position}</h3>
            <div className={styles.companyLine}>
              <span className={styles.company}>{experience.companyName}</span>
              {experience.location && (
                <>
                  <span className={styles.dot}>•</span>
                  <span className={styles.location}>{experience.location}</span>
                </>
              )}
            </div>
            <div className={styles.dateRange}>
              {startDate} - {endDate}
            </div>
          </div>
          <div className={styles.actions}>
            <Button variant="ghost" size="icon-sm" onClick={onEdit}>
              <Pencil size={16} />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onDelete} className={styles.deleteBtn}>
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
        {experience.description && (
          <p className={styles.description}>{experience.description}</p>
        )}
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
            <FormLabel>Position</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. Senior Mathematics Teacher"
                value={form.values.position}
                onChange={(e) =>
                  form.setValues((prev) => ({ ...prev, position: e.target.value }))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="companyName">
            <FormLabel>Company / School Name</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. Delhi Public School"
                value={form.values.companyName}
                onChange={(e) =>
                  form.setValues((prev) => ({ ...prev, companyName: e.target.value }))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <div className={styles.formGrid}>
          <FormItem name="location">
            <FormLabel>Location</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. New Delhi, India"
                value={form.values.location || ""}
                onChange={(e) =>
                  form.setValues((prev) => ({ ...prev, location: e.target.value }))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <div className={styles.checkboxRow}>
          <Checkbox
            id="isCurrent"
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
          <label htmlFor="isCurrent" className={styles.checkboxLabel}>
            I am currently working in this role
          </label>
        </div>

        <div className={styles.formGrid}>
          <FormItem name="startDate">
            <FormLabel>Start Date</FormLabel>
            <FormControl>
              <DatePicker
                showTime={false}
                value={form.values.startDate}
                onChange={(date) =>
                  form.setValues((prev) => ({ ...prev, startDate: date as Date }))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          {!isCurrent && (
            <FormItem name="endDate">
              <FormLabel>End Date</FormLabel>
              <FormControl>
                <DatePicker
                  showTime={false}
                  value={form.values.endDate || undefined}
                  onChange={(date) =>
                    form.setValues((prev) => ({ ...prev, endDate: date || null }))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        </div>

        <FormItem name="description">
          <FormLabel>Description</FormLabel>
          <FormControl>
            <Textarea
              placeholder="Describe your responsibilities and achievements..."
              value={form.values.description || ""}
              onChange={(e) =>
                form.setValues((prev) => ({ ...prev, description: e.target.value }))
              }
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
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
};