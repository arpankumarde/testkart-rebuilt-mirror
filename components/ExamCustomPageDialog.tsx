import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
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
import { useCreateExamCustomPageMutation } from "../helpers/useAdminExamContent";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import {
  CUSTOM_PAGE_LABEL_MAX,
  CUSTOM_PAGE_SLUG_MAX,
  customPageSlugProblem,
  slugifyCustomPageLabel,
  type CustomExamPageType,
} from "../helpers/examContentTypes";
import styles from "./ExamCustomPageDialog.module.css";

interface ExamCustomPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: number;
  examSlug: string;
  // Slugs this exam's custom pages already use.
  existingSlugs: string[];
  onCreated: (pageType: CustomExamPageType) => void;
}

// Adds a custom page (a new tab in the exam content editor). The slug follows
// the name until the admin edits it, and can't be changed after creation.
export const ExamCustomPageDialog: React.FC<ExamCustomPageDialogProps> = ({
  open,
  onOpenChange,
  examId,
  examSlug,
  existingSlugs,
  onCreated,
}) => {
  const createMutation = useCreateExamCustomPageMutation();
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setSlug("");
    setSlugEdited(false);
    setSubmitted(false);
    createMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const trimmedLabel = label.trim();
  const labelProblem = trimmedLabel ? null : "Give the tab a name.";
  const slugProblem =
    customPageSlugProblem(slug) ??
    (existingSlugs.includes(slug) ? "Another tab on this exam already uses this URL." : null);
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
      const result = await createMutation.mutateAsync({ examId, label: trimmedLabel, slug });
      onCreated(result.customPage.pageType);
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
            <DialogTitle>Add new tab</DialogTitle>
            <DialogDescription>
              A custom page for this exam with its own content, SEO and FAQs. It goes live at its own URL
              once you publish it.
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
                aria-invalid={showSlugProblem ? true : undefined}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                }}
              />
            </div>
            {showSlugProblem ? (
              <p className={styles.error}>{showSlugProblem}</p>
            ) : (
              <p className={styles.hint}>The URL can't be changed after the tab is created.</p>
            )}
          </div>

          {createMutation.isError && (
            <p className={styles.error} role="alert">
              {parseErrorMessage(createMutation.error) || "Couldn't add the tab."}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              <Plus size={16} />
              {createMutation.isPending ? "Adding..." : "Add tab"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};