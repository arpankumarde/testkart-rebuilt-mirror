import React, { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./Dialog";
import { useCreateExamCustomPageMutation, useUpdateExamCustomPageMutation } from "../helpers/useAdminExamContent";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import {
  CUSTOM_PAGE_LABEL_MAX,
  CUSTOM_PAGE_SLUG_MAX,
  customPageSlugProblem,
  slugifyCustomPageLabel,
  type CustomExamPageType,
  type ExamCustomPage,
} from "../helpers/examContentTypes";
import styles from "./ExamCustomPageDialog.module.css";

interface ExamCustomPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: number;
  examSlug: string;
  // Slugs this exam's custom pages already use.
  existingSlugs: string[];
  onCreated?: (pageType: CustomExamPageType) => void;
  // Set to rename an existing tab instead of adding one.
  editing?: {
    page: ExamCustomPage;
    isPublished: boolean;
    // The URL is the key of the tab's form state, so it waits for a save.
    hasUnsavedEdits: boolean;
  };
  onRenamed?: (previous: ExamCustomPage, saved: ExamCustomPage) => void;
}

// Adds a custom page (a new tab in the exam content editor) or renames one. When
// adding, the slug follows the name until the admin edits it. When renaming it
// stays as it is unless the admin edits it.
export const ExamCustomPageDialog: React.FC<ExamCustomPageDialogProps> = ({
  open,
  onOpenChange,
  examId,
  examSlug,
  existingSlugs,
  onCreated,
  editing,
  onRenamed,
}) => {
  const createMutation = useCreateExamCustomPageMutation();
  const updateMutation = useUpdateExamCustomPageMutation();
  const mutation = editing ? updateMutation : createMutation;
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabel(editing?.page.label ?? "");
    setSlug(editing?.page.slug ?? "");
    setSlugEdited(!!editing);
    setSubmitted(false);
    createMutation.reset();
    updateMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const trimmedLabel = label.trim();
  const labelProblem = trimmedLabel ? null : "Give the tab a name.";
  const slugChanged = !!editing && slug !== editing.page.slug;
  const slugProblem =
    customPageSlugProblem(slug) ??
    (existingSlugs.includes(slug) && slug !== editing?.page.slug
      ? "Another tab on this exam already uses this URL."
      : null);
  const showLabelProblem = submitted && labelProblem;
  const showSlugProblem = submitted || slugEdited ? slugProblem : null;

  const handleLabelChange = (value: string) => {
    setLabel(value);
    if (!slugEdited) setSlug(slugifyCustomPageLabel(value));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (labelProblem || slugProblem) return;
    try {
      if (editing) {
        const { page } = editing;
        if (trimmedLabel !== page.label || slugChanged) {
          const result = await updateMutation.mutateAsync({
            examId,
            slug: page.slug,
            label: trimmedLabel,
            newSlug: slugChanged ? slug : undefined,
          });
          onRenamed?.(page, result.customPage);
        }
        onOpenChange(false);
        return;
      }
      const result = await createMutation.mutateAsync({ examId, label: trimmedLabel, slug });
      onCreated?.(result.customPage.pageType);
      onOpenChange(false);
    } catch {
      // Shown inline below.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog}>
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? "Rename tab" : "Add new tab"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "The new name shows in this sidebar and in the exam page navigation right away. The tab's content stays as it is."
                : "A custom page for this exam with its own content, SEO and FAQs. It goes live at its own URL once you publish it."}
            </DialogDescription>
          </DialogHeader>

          <div className={styles.field}>
            <label htmlFor="custom-page-label" className={styles.label}>
              Tab name
            </label>
            <Input
              id="custom-page-label"
              value={label}
              maxLength={CUSTOM_PAGE_LABEL_MAX}
              placeholder="e.g. Previous Year Papers"
              autoFocus
              aria-invalid={showLabelProblem ? true : undefined}
              onChange={(e) => handleLabelChange(e.target.value)}
            />
            {showLabelProblem && <p className={styles.error}>{labelProblem}</p>}
          </div>

          <div className={styles.field}>
            <label htmlFor="custom-page-slug" className={styles.label}>
              URL
            </label>
            <div className={styles.slugRow}>
              <span className={styles.slugPrefix}>/exams/{examSlug}/</span>
              <Input
                id="custom-page-slug"
                value={slug}
                maxLength={CUSTOM_PAGE_SLUG_MAX}
                placeholder="previous-year-papers"
                className={styles.slugInput}
                disabled={editing?.hasUnsavedEdits}
                aria-invalid={showSlugProblem ? true : undefined}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                }}
              />
            </div>
            {showSlugProblem ? (
              <p className={styles.error}>{showSlugProblem}</p>
            ) : editing?.hasUnsavedEdits ? (
              <p className={styles.hint}>Save this tab's draft before changing its URL.</p>
            ) : slugChanged && editing?.isPublished ? (
              <p className={styles.warning}>
                The current URL will stop working and send visitors to the exam page. Update any links to it.
              </p>
            ) : (
              <p className={styles.hint}>
                {editing ? "Stays the same unless you edit it." : "You can change this later, but the old URL will stop working."}
              </p>
            )}
          </div>

          {mutation.isError && (
            <p className={styles.error} role="alert">
              {parseErrorMessage(mutation.error) || (editing ? "Couldn't update the tab." : "Couldn't add the tab.")}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {editing ? <Check size={16} /> : <Plus size={16} />}
              {editing ? (mutation.isPending ? "Saving..." : "Save") : mutation.isPending ? "Adding..." : "Add tab"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};