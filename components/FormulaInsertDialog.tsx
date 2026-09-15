import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import { Button } from "./Button";
import { HelpCircle, AlertCircle } from "lucide-react";
import katex from "katex";
import { LaTeXGuidelinesDialog } from "./LaTeXGuidelinesDialog";
import "katex/dist/katex.min.css";
import styles from "./FormulaInsertDialog.module.css";

interface FormulaInsertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (formula: string) => void;
  initialValue?: string;
}

export const FormulaInsertDialog = ({
  isOpen,
  onClose,
  onInsert,
  initialValue = "",
}: FormulaInsertDialogProps) => {
  const [formula, setFormula] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFormula(initialValue);
      setError(null);
      // Focus textarea after a short delay to allow dialog animation
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialValue]);

  // Live preview rendering
  useEffect(() => {
    if (previewRef.current) {
      if (!formula.trim()) {
        previewRef.current.innerHTML =
          '<span class="placeholder">Preview will appear here...</span>';
        setError(null);
        return;
      }

      try {
        katex.render(formula, previewRef.current, {
          throwOnError: true,
          displayMode: true,
        });
        setError(null);
      } catch (e) {
        if (e instanceof Error) {
          // Clean up the error message to be more user friendly
          const msg = e.message
            .replace("KaTeX parse error: ", "")
            .split("\n")[0];
          setError(msg);
        }
      }
    }
  }, [formula]);

  const handleInsert = () => {
    if (formula.trim()) {
      onInsert(formula);
      onClose();
    }
  };

  const insertTemplate = (template: string, cursorOffset: number = 0) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formula;
    
    // Insert the template at cursor position
    const newText =
      text.substring(0, start) + template + text.substring(end);
    
    setFormula(newText);

    // Set cursor position inside the template (e.g., inside the braces)
    // We need to use setTimeout to ensure React has updated the value
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + template.length + cursorOffset;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const templates = [
    { label: "Fraction", code: "\\frac{}{}", offset: -3 },
    { label: "Exponent", code: "^{}", offset: -1 },
    { label: "Subscript", code: "_{}", offset: -1 },
    { label: "Square Root", code: "\\sqrt{}", offset: -1 },
    { label: "Greek Pi", code: "\\pi", offset: 0 },
    { label: "Infinity", code: "\\infty", offset: 0 },
    { label: "Sum", code: "\\sum", offset: 0 },
    { label: "Integral", code: "\\int", offset: 0 },
  ];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <div className={styles.headerRow}>
              <DialogTitle>Insert Math Formula</DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                className={styles.helpButton}
                onClick={() => setShowGuidelines(true)}
              >
                <HelpCircle size={16} />
                LaTeX Help
              </Button>
            </div>
            <DialogDescription>
              Type LaTeX code below to create a mathematical formula.
            </DialogDescription>
          </DialogHeader>

          <div className={styles.body}>
            {/* Preview Area */}
            <div className={styles.previewContainer}>
              <div className={styles.previewLabel}>Preview</div>
              <div
                ref={previewRef}
                className={`${styles.preview} ${error ? styles.previewError : ""}`}
              />
              {error && (
                <div className={styles.errorMessage}>
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Quick Templates */}
            <div className={styles.templatesContainer}>
              <span className={styles.templatesLabel}>Quick Insert:</span>
              <div className={styles.templatesList}>
                {templates.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    className={styles.templateButton}
                    onClick={() => insertTemplate(t.code, t.offset)}
                    title={`Insert ${t.label}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Area */}
            <div className={styles.inputContainer}>
              <textarea
                ref={textareaRef}
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                className={styles.textarea}
                placeholder="e.g., x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}"
                spellCheck={false}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleInsert} disabled={!formula.trim() || !!error}>
              Insert Formula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nested Guidelines Dialog */}
      <LaTeXGuidelinesDialog
        open={showGuidelines}
        onOpenChange={setShowGuidelines}
      />
    </>
  );
};