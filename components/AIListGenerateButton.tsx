import React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { useTeacherAIGenerateList } from "../helpers/useTeacherAIGenerateList";
import styles from "./AIListGenerateButton.module.css";

export interface AIListGenerateButtonProps {
  field: "whatYouLearn" | "requirements";
  context?: {
    title?: string;
    examName?: string;
    shortDescription?: string;
    longDescription?: string;
    subjects?: string[];
    existingItems?: string[];
  };
  // Appends the AI-drafted items to the caller's list — additive, like the
  // existing "Add item" button, so a teacher never loses items they already
  // typed by clicking this.
  onGenerate: (items: string[]) => void;
  disabled?: boolean;
  className?: string;
}

// Unlike AIRewriteButton (which improves a single existing text value), this
// button drafts a whole bullet list from scratch — "generate and auto fill"
// per the product ask — so it stays visible regardless of whether the list
// is currently empty.
export const AIListGenerateButton: React.FC<AIListGenerateButtonProps> = ({
  field,
  context = {},
  onGenerate,
  disabled,
  className,
}) => {
  const mutation = useTeacherAIGenerateList();

  const handleGenerate = async () => {
    try {
      const res = await mutation.mutateAsync({ field, context });
      if (res.items && res.items.length > 0) {
        onGenerate(res.items);
      }
    } catch (e) {
      // Errors (except OUT_OF_CREDITS) are handled by the hook via sonner toast.
      console.error("AI list generation failed", e);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`${styles.triggerButton} ${className || ""}`}
      disabled={disabled || mutation.isPending}
      onClick={handleGenerate}
    >
      {mutation.isPending ? (
        <>
          <Spinner size="sm" />
          <span className={styles.buttonText}>Generating...</span>
        </>
      ) : (
        <>
          <Sparkles className={styles.sparklesIcon} />
          <span className={styles.buttonText}>Generate with AI</span>
        </>
      )}
    </Button>
  );
};
