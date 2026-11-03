import React, { useId, useRef, useState } from "react";
import { AlertCircle, Sparkles } from "lucide-react";
import { useTeacherAIGenerateAll } from "../helpers/useTeacherAIGenerateAll";
import { getAiErrorMessage, validateAiPrompt } from "../helpers/aiPromptValidation";
import { Spinner } from "./Spinner";
import styles from "./TeacherAIFillPanel.module.css";

export type TeacherAIFillValues = {
  title: string;
  shortDescription?: string;
  description: string;
  examName?: string;
  category?: string;
  language?: string;
  tags?: string[];
  suggestedPrice?: number;
  level?: string;
  durationMinutes?: number;
};

type Props = {
  contentType: "product" | "test" | "liveTest" | "course" | "bundle";
  /** What the AI fills, said in the collapsed row, e.g. "title, description and price". */
  fills: string;
  placeholder: string;
  onGenerated: (values: TeacherAIFillValues) => void;
  bundleItemTitles?: string[];
};

/**
 * An optional helper above a creator form: one line until the teacher asks
 * for it, then a short description box. The form itself is always on screen,
 * so nobody has to get past AI to start typing.
 */
export const TeacherAIFillPanel = ({ contentType, fills, placeholder, onGenerated, bundleItemTitles }: Props) => {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaId = useId();
  const errorId = useId();
  const mutation = useTeacherAIGenerateAll();

  const error = problem ?? (mutation.isError ? getAiErrorMessage(mutation.error) : null);

  const generate = () => {
    if (mutation.isPending) return;
    const invalid = validateAiPrompt(prompt);
    if (invalid) {
      setProblem(invalid);
      textareaRef.current?.focus();
      return;
    }
    setProblem(null);
    mutation.mutate(
      { prompt: prompt.trim(), contentType, bundleItemTitles },
      {
        onSuccess: (data) => {
          onGenerated(data);
          setOpen(false);
          setPrompt("");
        },
      }
    );
  };

  if (!open) {
    return (
      <div className={styles.row}>
        <span className={styles.icon} aria-hidden="true">
          <Sparkles size={16} />
        </span>
        <span className={styles.rowText}>Describe it in a sentence and AI fills the {fills}.</span>
        <button type="button" className={styles.openButton} onClick={() => setOpen(true)}>
          Fill with AI
        </button>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <label htmlFor={textareaId} className={styles.label}>
        Describe what you are making
      </label>
      <textarea
        id={textareaId}
        ref={textareaRef}
        className={styles.textarea}
        rows={3}
        autoFocus
        value={prompt}
        placeholder={placeholder}
        onChange={(event) => {
          setPrompt(event.target.value);
          if (problem) setProblem(null);
          if (mutation.isError) mutation.reset();
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            generate();
          }
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          {error}
        </p>
      )}
      <p className={styles.note}>This replaces what you have typed in those fields. Check the result before you save.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.generate} onClick={generate} disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner size="sm" /> : <Sparkles size={16} aria-hidden="true" />}
          {mutation.isPending ? "Filling in" : "Fill the form"}
        </button>
        <button type="button" className={styles.cancel} onClick={() => setOpen(false)} disabled={mutation.isPending}>
          Cancel
        </button>
      </div>
    </div>
  );
};