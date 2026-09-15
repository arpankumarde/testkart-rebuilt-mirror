import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import { useTeacherAIRewrite } from "../helpers/useTeacherAIRewrite";
import styles from "./AIRewriteButton.module.css";

export interface AIRewriteButtonProps {
  field: "title" | "description" | "shortDescription" | "questionText" | "explanation";
  contentType: "product" | "test" | "liveTest" | "course" | "bundle";
  currentValue?: string;
  context?: {
    examName?: string;
    category?: string;
    subjects?: string[];
    fileTitles?: string[];
    language?: string;
    tags?: string[];
    level?: string;
    bundleItemTitles?: string[];
    title?: string;
    description?: string;
    price?: number;
    duration?: number;
    questionText?: string;
    correctAnswerText?: string;
    optionTexts?: string[];
  };
  onAccept: (suggestion: string) => void;
  disabled?: boolean;
  className?: string;
  // Most fields (title, description...) only make sense to "improve" once
  // something's been typed, so the button hides itself while empty (the
  // original, still-default behavior). A couple of newer uses — drafting an
  // explanation from scratch, drafting storefront copy from the test's own
  // content — are genuinely "generate from nothing" actions, so they opt
  // into showing even when currentValue is empty.
  allowEmpty?: boolean;
}

export const AIRewriteButton: React.FC<AIRewriteButtonProps> = ({
  field,
  contentType,
  currentValue = "",
  context = {},
  onAccept,
  disabled,
  className,
  allowEmpty = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const mutation = useTeacherAIRewrite();

  const handleGenerate = async () => {
    try {
      const res = await mutation.mutateAsync({
        field,
        contentType,
        currentValue,
        context,
      });
      if (res.suggestion) {
        setSuggestion(res.suggestion);
        setIsOpen(true);
      }
    } catch (e) {
      // Errors (except OUT_OF_CREDITS) are handled by the hook via sonner toast.
      // OUT_OF_CREDITS fails silently as requested by platform guidelines.
      console.error("AI Generation failed", e);
    }
  };

  const handleAccept = () => {
    if (suggestion) {
      onAccept(suggestion);
    }
    setIsOpen(false);
  };

  const handleTryAgain = () => {
    handleGenerate();
  };

  const isHtmlField = field === "description" || field === "questionText" || field === "explanation";

  const isValueEmpty = () => {
    if (allowEmpty) return false;
    if (!currentValue) return true;
    if (isHtmlField) {
      const stripped = currentValue.replace(/<[^>]*>?/gm, "");
      return stripped.trim().length === 0;
    }
    return currentValue.trim().length === 0;
  };

  if (isValueEmpty()) return null;

  // Helper text to present a clear label
  const fieldLabel =
    field === "shortDescription"
      ? "short description"
      : field === "description"
        ? "description"
        : field === "questionText"
          ? "question text"
          : field === "explanation"
            ? "explanation"
            : "title";

  return (
    <>
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
            <span className={styles.buttonText}>AI</span>
          </>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle>AI Suggestion</DialogTitle>
            <DialogDescription>
              Review the AI-generated {fieldLabel} below.
            </DialogDescription>
          </DialogHeader>

          <div className={styles.suggestionContainer}>
            {isHtmlField ? (
              <div
                className={styles.htmlPreview}
                dangerouslySetInnerHTML={{ __html: suggestion || "" }}
              />
            ) : (
              <p className={styles.textPreview}>{suggestion}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleTryAgain}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Generating..." : "Try Again"}
            </Button>
            <Button type="button" onClick={handleAccept}>
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};