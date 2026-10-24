import React, { useEffect, useRef } from "react";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderExtension,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { tokenizeHtml, type HtmlTokenKind } from "../helpers/tokenizeHtml";
import styles from "./HtmlCodeEditor.module.css";

interface HtmlCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

const TOKEN_MARKS: Record<HtmlTokenKind, Decoration> = {
  tag: Decoration.mark({ class: "cm-tk-tag" }),
  attribute: Decoration.mark({ class: "cm-tk-attribute" }),
  value: Decoration.mark({ class: "cm-tk-value" }),
  keyword: Decoration.mark({ class: "cm-tk-keyword" }),
  comment: Decoration.mark({ class: "cm-tk-comment" }),
};

// The whole document is tokenized, since a comment or tag can open above the
// viewport, but only what's on screen is decorated.
const buildTokenMarks = (view: EditorView): DecorationSet => {
  const builder = new RangeSetBuilder<Decoration>();
  const tokens = tokenizeHtml(view.state.doc.toString());
  for (const { from, to } of view.visibleRanges) {
    for (const token of tokens) {
      if (token.to <= from) continue;
      if (token.from >= to) break;
      builder.add(Math.max(token.from, from), Math.min(token.to, to), TOKEN_MARKS[token.kind]);
    }
  }
  return builder.finish();
};

const syntaxColours = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildTokenMarks(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) this.decorations = buildTokenMarks(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations }
);

// Colours are CSS variables, so the module stylesheet can set them per theme.
const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "0.8125rem", backgroundColor: "var(--surface)", color: "var(--foreground)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-family-monospace, monospace)", lineHeight: "1.6", overflow: "auto" },
  ".cm-content": { caretColor: "var(--foreground)", padding: "0.75rem 0" },
  ".cm-cursor": { borderLeftColor: "var(--foreground)" },
  ".cm-gutters": { backgroundColor: "var(--muted)", color: "var(--muted-foreground)", border: "none" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--muted)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { backgroundColor: "var(--tk-brand-tint)" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
  ".cm-tk-tag": { color: "var(--code-tag)" },
  ".cm-tk-attribute": { color: "var(--code-attribute)" },
  ".cm-tk-value": { color: "var(--code-value)" },
  ".cm-tk-keyword": { color: "var(--code-keyword)" },
  ".cm-tk-comment": { color: "var(--code-comment)", fontStyle: "italic" },
});

export default function HtmlCodeEditor({ value, onChange, placeholder, ariaLabel = "HTML code" }: HtmlCodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: valueRef.current,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          syntaxColours,
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
          placeholderExtension(placeholder ?? ""),
          theme,
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            const next = update.state.doc.toString();
            if (next !== valueRef.current) onChangeRef.current(next);
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A save rewrites the value with what the sanitizer kept.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  return <div ref={hostRef} className={styles.editor} />;
}