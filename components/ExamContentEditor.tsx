import React, { Suspense, useDeferredValue, useMemo, useState } from "react";
import { Code, Eye, Type } from "lucide-react";
import { Button } from "./Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./Dialog";
import { RichTextEditor } from "./RichTextEditor";
import { Skeleton } from "./Skeleton";
import { ToggleGroup, ToggleGroupItem } from "./ToggleGroup";
import { isInteractiveHtml, serializeExamContent, type ExamContentFormat } from "../helpers/examContentTypes";
import { renderExamContent } from "../helpers/renderExamContent";
import { sanitizeLayoutHtml } from "../helpers/sanitizeLayoutHtml";
import { useHtmlFrame } from "../helpers/useHtmlFrame";
import "katex/dist/katex.min.css";
import previewStyles from "./ExamContentSiloPage.module.css";
import styles from "./ExamContentEditor.module.css";

const HtmlCodeEditor = React.lazy(() => import("./HtmlCodeEditor"));

interface ExamContentEditorProps {
  value: string;
  format: ExamContentFormat;
  onChange: (content: string) => void;
  onFormatChange: (format: ExamContentFormat) => void;
  // Shown between the heading and the editor.
  hint?: React.ReactNode;
}

// The Content field of an exam section: the rich text editor, or a code editor
// with a preview for pasted HTML. The preview goes through the same rendering as
// the public page, sandboxed frame included, so what works here works there.
export const ExamContentEditor: React.FC<ExamContentEditorProps> = ({
  value,
  format,
  onChange,
  onFormatChange,
  hint,
}) => {
  const [htmlView, setHtmlView] = useState<"code" | "preview">("code");
  const [confirmRichOpen, setConfirmRichOpen] = useState(false);
  const isHtml = format === "html";

  const checkedValue = useDeferredValue(value);
  const isInteractive = isHtml && isInteractiveHtml(checkedValue);
  const removed = useMemo(
    () => (isHtml && !isInteractive ? sanitizeLayoutHtml(checkedValue).removed : []),
    [isHtml, isInteractive, checkedValue]
  );
  const previewHtml = useMemo(
    () => (isHtml && htmlView === "preview" ? renderExamContent(serializeExamContent("html", value), { math: true }) : ""),
    [isHtml, htmlView, value]
  );
  const [previewEl, setPreviewEl] = useState<HTMLDivElement | null>(null);
  useHtmlFrame(previewEl, previewHtml);

  const handleModeChange = (next: string) => {
    if (next === "html") {
      setHtmlView("code");
      onFormatChange("html");
    } else if (next === "rich") {
      // The rich text editor only understands its own markup.
      if (value.trim()) setConfirmRichOpen(true);
      else onFormatChange("rich");
    }
  };

  return (
    <>
      <div className={styles.header}>
        <span className={styles.label}>Content</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={format}
          onValueChange={handleModeChange}
          aria-label="Content editor"
        >
          <ToggleGroupItem value="rich" className={styles.toggle}>
            <Type /> Rich Text
          </ToggleGroupItem>
          <ToggleGroupItem value="html" className={styles.toggle}>
            <Code /> HTML
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {hint}

      {isHtml ? (
        <div className={styles.htmlPanel}>
          <div className={styles.htmlToolbar}>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={htmlView}
              onValueChange={(next) => {
                if (next === "code" || next === "preview") setHtmlView(next);
              }}
              aria-label="HTML view"
            >
              <ToggleGroupItem value="code" className={styles.toggle}>
                <Code /> Code
              </ToggleGroupItem>
              <ToggleGroupItem value="preview" className={styles.toggle}>
                <Eye /> Preview
              </ToggleGroupItem>
            </ToggleGroup>
            <span className={styles.htmlNote}>
              {isInteractive
                ? "Interactive: runs in an isolated frame. External scripts and network requests are blocked."
                : "Static HTML: scripts and event handlers are removed when you save."}
            </span>
          </div>

          {/* Stays mounted behind the preview, to keep the cursor and undo history. */}
          <div hidden={htmlView !== "code"}>
            <Suspense fallback={<Skeleton className={styles.codeSkeleton} />}>
              <HtmlCodeEditor
                value={value}
                onChange={onChange}
                placeholder="Paste or write HTML here..."
                ariaLabel="Content HTML"
              />
            </Suspense>
          </div>
          {htmlView === "preview" &&
            (previewHtml ? (
              <div
                ref={setPreviewEl}
                className={`${previewStyles.content} ${styles.preview}`}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <p className={styles.previewEmpty}>Nothing to preview yet.</p>
            ))}

          {removed.length > 0 && (
            <p className={styles.removedNote} role="status">
              Removed when you save: {removed.join(", ")}
            </p>
          )}
        </div>
      ) : (
        <RichTextEditor value={value} onChange={onChange} placeholder="Write or generate the page content..." />
      )}

      <Dialog open={confirmRichOpen} onOpenChange={setConfirmRichOpen}>
        <DialogContent className={styles.confirmDialog}>
          <DialogHeader>
            <DialogTitle>Switch to the rich text editor?</DialogTitle>
            <DialogDescription>
              {isInteractive
                ? "Forms and scripts don't work in the rich text editor, and editing there removes them. Your HTML stays as it is until you edit it."
                : "Custom layouts, classes and styles can be lost, because the rich text editor keeps only the formatting it supports. Your HTML stays as it is until you edit it there."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmRichOpen(false)}>
              Keep HTML
            </Button>
            <Button
              type="button"
              onClick={() => {
                setConfirmRichOpen(false);
                onFormatChange("rich");
              }}
            >
              Switch to Rich Text
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};