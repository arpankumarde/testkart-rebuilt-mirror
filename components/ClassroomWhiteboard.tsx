import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  PenLine,
  Highlighter,
  Eraser,
  Minus,
  Square,
  Circle,
  Type,
  Undo2,
  Redo2,
  Trash2,
  Download,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  BOARD_H,
  BOARD_W,
  ClassroomWhiteboardState,
  WbOp,
  WbShape,
  WbStroke,
  drawOp,
  exportBoardPng,
  newOpId,
  textFontSize,
} from "../helpers/useClassroomWhiteboard";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import styles from "./ClassroomWhiteboard.module.css";

type Tool = "pen" | "highlighter" | "eraser" | "line" | "rect" | "ellipse" | "text";

const TOOLS: { key: Tool; label: string; icon: React.ReactNode }[] = [
  { key: "pen", label: "Pen", icon: <PenLine size={16} /> },
  { key: "highlighter", label: "Highlighter", icon: <Highlighter size={16} /> },
  { key: "eraser", label: "Eraser", icon: <Eraser size={16} /> },
  { key: "line", label: "Line", icon: <Minus size={16} /> },
  { key: "rect", label: "Rectangle", icon: <Square size={16} /> },
  { key: "ellipse", label: "Circle", icon: <Circle size={16} /> },
  { key: "text", label: "Text", icon: <Type size={16} /> },
];

const COLORS = [
  { value: "#1f2937", label: "Ink" },
  { value: "#e03131", label: "Red" },
  { value: "#f2711c", label: "Orange" },
  { value: "#f5b700", label: "Yellow" },
  { value: "#2f9e44", label: "Green" },
  { value: "#1c7ed6", label: "Blue" },
  { value: "#7048e8", label: "Violet" },
];

const SIZES = [
  { value: 2, label: "Thin" },
  { value: 4, label: "Medium" },
  { value: 8, label: "Thick" },
];

const DRAFT_FLUSH_MS = 70;

interface ClassroomWhiteboardProps {
  board: ClassroomWhiteboardState;
  onClose: () => void;
  fileName: string;
  /** When given, an expand button lets the board take the whole stage (and back). */
  expanded?: boolean;
  onToggleExpand?: () => void;
}

/** The shared board: a fixed 1600 x 1000 drawing surface scaled to fit, with its own tool bar. */
export const ClassroomWhiteboard: React.FC<ClassroomWhiteboardProps> = ({ board, onClose, fileName, expanded = false, onToggleExpand }) => {
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0].value);
  const [size, setSize] = useState(4);
  const [fit, setFit] = useState({ w: 0, h: 0 });
  const [clearOpen, setClearOpen] = useState(false);
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string } | null>(null);

  const areaRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef<WbOp | null>(null);
  const pendingRef = useRef<number[]>([]);
  const headSentRef = useRef(false);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const boardRef = useRef(board);
  boardRef.current = board;

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const measure = () => {
      const { width, height } = area.getBoundingClientRect();
      const w = Math.max(0, Math.min(width, height * (BOARD_W / BOARD_H)));
      setFit({ w: Math.floor(w), h: Math.floor(w * (BOARD_H / BOARD_W)) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(area);
    return () => ro.disconnect();
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fit.w) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const scale = (fit.w / BOARD_W) * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const { ops, drafts } = boardRef.current;
    ops.forEach((op) => drawOp(ctx, op));
    drafts.forEach((op) => drawOp(ctx, op));
    if (liveRef.current) drawOp(ctx, liveRef.current);
  }, [fit.w]);

  const scheduleRedraw = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      redraw();
    });
  }, [redraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fit.w) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(fit.w * dpr);
    canvas.height = Math.round(fit.h * dpr);
    redraw();
  }, [fit, redraw]);

  useEffect(() => {
    redraw();
  }, [board.ops, board.drafts, redraw]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (flushTimer.current) clearTimeout(flushTimer.current);
    },
    []
  );

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y) while the board is open and no field has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        boardRef.current.undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        boardRef.current.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toBoard = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - rect.left) / rect.width) * BOARD_W),
      y: Math.round(((e.clientY - rect.top) / rect.height) * BOARD_H),
    };
  };

  const flushDraft = () => {
    flushTimer.current = null;
    const live = liveRef.current;
    if (!live || (live.kind !== "pen" && live.kind !== "highlighter" && live.kind !== "eraser")) return;
    if (!pendingRef.current.length) return;
    const { pts: _pts, ...head } = live;
    boardRef.current.draftLocal(live.id, headSentRef.current ? undefined : head, pendingRef.current);
    headSentRef.current = true;
    pendingRef.current = [];
  };

  const commitText = () => {
    if (!textDraft) return;
    const text = textDraft.value.replace(/\s+$/, "");
    if (text) {
      board.addLocal({ id: newOpId(), by: board.selfId, kind: "text", color, size, x: textDraft.x, y: textDraft.y, text });
    }
    setTextDraft(null);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const { x, y } = toBoard(e);
    if (tool === "text") {
      if (textDraft) commitText();
      setTextDraft({ x, y, value: "" });
      return;
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nicety; drawing still works without it.
    }
    const base = { id: newOpId(), by: board.selfId, size };
    if (tool === "pen" || tool === "highlighter" || tool === "eraser") {
      liveRef.current = { ...base, kind: tool, color: tool === "eraser" ? "#000000" : color, pts: [x, y] } as WbStroke;
      pendingRef.current = [x, y];
      headSentRef.current = false;
    } else {
      liveRef.current = { ...base, kind: tool, color, x1: x, y1: y, x2: x, y2: y } as WbShape;
    }
    scheduleRedraw();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const live = liveRef.current;
    if (!live) return;
    const { x, y } = toBoard(e);
    if (live.kind === "pen" || live.kind === "highlighter" || live.kind === "eraser") {
      const p = live.pts;
      const dx = x - p[p.length - 2];
      const dy = y - p[p.length - 1];
      if (dx * dx + dy * dy < 4) return;
      p.push(x, y);
      pendingRef.current.push(x, y);
      if (!flushTimer.current) flushTimer.current = setTimeout(flushDraft, DRAFT_FLUSH_MS);
    } else if (live.kind === "line" || live.kind === "rect" || live.kind === "ellipse") {
      live.x2 = x;
      live.y2 = y;
    }
    scheduleRedraw();
  };

  const onPointerUp = () => {
    const live = liveRef.current;
    if (!live) return;
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    liveRef.current = null;
    pendingRef.current = [];
    if (live.kind === "line" || live.kind === "rect" || live.kind === "ellipse") {
      if (Math.abs(live.x2 - live.x1) + Math.abs(live.y2 - live.y1) > 4) board.addLocal({ ...live });
    } else if (live.kind === "pen" || live.kind === "highlighter" || live.kind === "eraser") {
      const stroke = live as WbStroke;
      board.addLocal({ ...stroke, pts: [...stroke.pts] });
    }
    scheduleRedraw();
  };

  const scale = fit.w ? fit.w / BOARD_W : 1;
  const isEmpty = board.ops.length === 0 && board.drafts.length === 0;

  return (
    <section className={styles.board} aria-label="Whiteboard">
      <div className={styles.toolbar} role="toolbar" aria-label="Whiteboard tools">
        <div className={styles.group}>
          {TOOLS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`${styles.tool} ${tool === t.key ? styles.toolActive : ""}`}
              onClick={() => {
                if (textDraft) commitText();
                setTool(t.key);
              }}
              aria-pressed={tool === t.key}
              aria-label={t.label}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <span className={styles.divider} aria-hidden="true" />

        <div className={styles.group} role="radiogroup" aria-label="Colour">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={color === c.value}
              aria-label={c.label}
              title={c.label}
              className={`${styles.swatch} ${color === c.value ? styles.swatchActive : ""}`}
              style={{ "--swatch": c.value } as React.CSSProperties}
              onClick={() => setColor(c.value)}
            />
          ))}
        </div>

        <span className={styles.divider} aria-hidden="true" />

        <div className={styles.group} role="radiogroup" aria-label="Stroke width">
          {SIZES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={size === s.value}
              aria-label={s.label}
              title={s.label}
              className={`${styles.tool} ${size === s.value ? styles.toolActive : ""}`}
              onClick={() => setSize(s.value)}
            >
              <span className={styles.sizeDot} style={{ width: s.value + 3, height: s.value + 3 }} />
            </button>
          ))}
        </div>

        <div className={styles.spacer} />

        <div className={styles.group}>
          <button type="button" className={styles.tool} onClick={board.undo} disabled={!board.canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">
            <Undo2 size={16} />
          </button>
          <button type="button" className={styles.tool} onClick={board.redo} disabled={!board.canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
            <Redo2 size={16} />
          </button>
          <button type="button" className={styles.tool} onClick={() => setClearOpen(true)} disabled={isEmpty} aria-label="Clear board" title="Clear board">
            <Trash2 size={16} />
          </button>
          <button
            type="button"
            className={styles.tool}
            onClick={() => exportBoardPng(board.ops, fileName)}
            disabled={board.ops.length === 0}
            aria-label="Download as PNG"
            title="Download as PNG"
          >
            <Download size={16} />
          </button>
          {onToggleExpand && (
            <button
              type="button"
              className={styles.tool}
              onClick={onToggleExpand}
              aria-label={expanded ? "Shrink whiteboard to the side panel" : "Expand whiteboard to the full stage"}
              title={expanded ? "Shrink" : "Expand"}
            >
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
          <button type="button" className={`${styles.tool} ${styles.close}`} onClick={onClose} aria-label="Close whiteboard" title="Close whiteboard">
            <X size={16} />
          </button>
        </div>
      </div>

      <div ref={areaRef} className={styles.area}>
        <div className={styles.paper} style={{ width: fit.w, height: fit.h }}>
          <canvas
            ref={canvasRef}
            className={`${styles.canvas} ${tool === "text" ? styles.canvasText : ""}`}
            style={{ width: fit.w, height: fit.h }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          {textDraft && (
            <textarea
              autoFocus
              className={styles.textInput}
              style={{
                left: textDraft.x * scale,
                top: textDraft.y * scale,
                color,
                fontSize: textFontSize(size) * scale,
              }}
              value={textDraft.value}
              placeholder="Type, then Enter"
              aria-label="Whiteboard text"
              onChange={(e) => setTextDraft((d) => (d ? { ...d, value: e.target.value } : d))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitText();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setTextDraft(null);
                }
              }}
              onBlur={commitText}
            />
          )}
          {isEmpty && !textDraft && <p className={styles.hint}>Draw, write or add shapes. Everyone in the call sees it live.</p>}
        </div>
      </div>

      <ConsoleConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear the whiteboard?"
        description="This removes everything on the board for everyone in the call. It cannot be undone."
        tone="destructive"
        confirmLabel="Clear board"
        isPending={false}
        onConfirm={() => {
          board.clear();
          setClearOpen(false);
        }}
      />
    </section>
  );
};
