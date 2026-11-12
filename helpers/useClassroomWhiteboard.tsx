import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Shared whiteboard state for the live classroom. Everyone in the call keeps the same ordered
 * list of drawing operations, kept in step over Daily app messages:
 *   wb-add / wb-del / wb-clear  change the list (undo and redo are a del and an add),
 *   wb-draft                    streams a pen stroke while it is being drawn,
 *   wb-req / wb-snap            a newcomer asks and anyone already drawing answers with the list,
 *   wb-open                     tells the others someone opened the board.
 * Daily caps one app message at about 4 KB, so anything larger goes out as wb-part chunks.
 * The list also lives in sessionStorage, so a reload in the same tab gets it back.
 */

export const BOARD_W = 1600;
export const BOARD_H = 1000;
export const BOARD_PAPER = "#fbfaf7";

export type WbStrokeKind = "pen" | "highlighter" | "eraser";
export type WbShapeKind = "line" | "rect" | "ellipse";

export type WbStroke = { id: string; by: string; kind: WbStrokeKind; color: string; size: number; pts: number[] };
export type WbShape = { id: string; by: string; kind: WbShapeKind; color: string; size: number; x1: number; y1: number; x2: number; y2: number };
export type WbText = { id: string; by: string; kind: "text"; color: string; size: number; x: number; y: number; text: string };
export type WbOp = WbStroke | WbShape | WbText;

export type WbStrokeHead = Omit<WbStroke, "pts">;

type WbMessage =
  | { t: "wb-add"; op: WbOp }
  | { t: "wb-del"; id: string }
  | { t: "wb-clear" }
  | { t: "wb-draft"; id: string; head?: WbStrokeHead; pts: number[] }
  | { t: "wb-req" }
  | { t: "wb-snap"; ops: WbOp[] }
  | { t: "wb-open"; name: string }
  | { t: "wb-part"; mid: string; i: number; n: number; s: string };

const MAX_MESSAGE_BYTES = 3500;
const PART_CHARS = 1000;

export const newOpId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const byteLength = (s: string) => new TextEncoder().encode(s).length;

const encode = (msg: WbMessage): WbMessage[] => {
  const json = JSON.stringify(msg);
  if (byteLength(json) <= MAX_MESSAGE_BYTES) return [msg];
  const mid = newOpId();
  const n = Math.ceil(json.length / PART_CHARS);
  return Array.from({ length: n }, (_, i) => ({ t: "wb-part" as const, mid, i, n, s: json.slice(i * PART_CHARS, (i + 1) * PART_CHARS) }));
};

const isOp = (v: unknown): v is WbOp => !!v && typeof v === "object" && typeof (v as WbOp).id === "string" && typeof (v as WbOp).kind === "string";

/* ------------------------------------------------------------- drawing --- */

const strokeWidth = (op: WbStroke) => (op.kind === "pen" ? op.size : op.size * 4);
export const textFontSize = (size: number) => 14 + size * 4;

export function drawOp(ctx: CanvasRenderingContext2D, op: WbOp) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = op.color;
  ctx.fillStyle = op.color;

  if (op.kind === "pen" || op.kind === "highlighter" || op.kind === "eraser") {
    if (op.kind === "highlighter") ctx.globalAlpha = 0.35;
    if (op.kind === "eraser") ctx.globalCompositeOperation = "destination-out";
    const w = strokeWidth(op);
    const p = op.pts;
    if (p.length >= 2) {
      if (p.length === 2) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        for (let i = 2; i < p.length - 2; i += 2) {
          const mx = (p[i] + p[i + 2]) / 2;
          const my = (p[i + 1] + p[i + 3]) / 2;
          ctx.quadraticCurveTo(p[i], p[i + 1], mx, my);
        }
        ctx.lineTo(p[p.length - 2], p[p.length - 1]);
        ctx.stroke();
      }
    }
  } else if (op.kind === "line" || op.kind === "rect" || op.kind === "ellipse") {
    ctx.lineWidth = op.size;
    ctx.beginPath();
    if (op.kind === "line") {
      ctx.moveTo(op.x1, op.y1);
      ctx.lineTo(op.x2, op.y2);
    } else if (op.kind === "rect") {
      ctx.rect(Math.min(op.x1, op.x2), Math.min(op.y1, op.y2), Math.abs(op.x2 - op.x1), Math.abs(op.y2 - op.y1));
    } else {
      ctx.ellipse((op.x1 + op.x2) / 2, (op.y1 + op.y2) / 2, Math.abs(op.x2 - op.x1) / 2, Math.abs(op.y2 - op.y1) / 2, 0, 0, Math.PI * 2);
    }
    ctx.stroke();
  } else if (op.kind === "text") {
    const fontSize = textFontSize(op.size);
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textBaseline = "top";
    op.text.split("\n").forEach((line, i) => ctx.fillText(line, op.x, op.y + i * fontSize * 1.25));
  }
  ctx.restore();
}

/** Draws the board onto a white-paper PNG and starts a download. */
export function exportBoardPng(ops: WbOp[], fileName: string) {
  const layer = document.createElement("canvas");
  layer.width = BOARD_W;
  layer.height = BOARD_H;
  const lctx = layer.getContext("2d");
  const out = document.createElement("canvas");
  out.width = BOARD_W;
  out.height = BOARD_H;
  const octx = out.getContext("2d");
  if (!lctx || !octx) return;
  ops.forEach((op) => drawOp(lctx, op));
  octx.fillStyle = BOARD_PAPER;
  octx.fillRect(0, 0, BOARD_W, BOARD_H);
  octx.drawImage(layer, 0, 0);
  out.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

/* ---------------------------------------------------------------- state --- */

interface Options {
  /** This viewer's identity, "user-<id>"; marks which operations undo can take back. */
  selfId: string;
  storageKey: string;
  send: (data: unknown, to?: string) => void;
  /** A remote change arrived (used to flag the toolbar button while the board is closed). */
  onRemoteChange?: () => void;
  onRemoteOpen?: (name: string) => void;
}

const loadStored = (key: string): WbOp[] => {
  try {
    const raw = sessionStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isOp) : [];
  } catch {
    return [];
  }
};

export function useClassroomWhiteboard({ selfId, storageKey, send, onRemoteChange, onRemoteOpen }: Options) {
  const [ops, setOps] = useState<WbOp[]>(() => loadStored(storageKey));
  const [drafts, setDrafts] = useState<Record<string, WbStroke>>({});
  const [history, setHistory] = useState<{ undo: string[]; redo: WbOp[] }>({ undo: [], redo: [] });
  const opsRef = useRef(ops);
  opsRef.current = ops;
  const historyRef = useRef(history);
  historyRef.current = history;
  const parts = useRef(new Map<string, { n: number; got: string[]; count: number }>());
  const cb = useRef({ send, onRemoteChange, onRemoteOpen });
  cb.current = { send, onRemoteChange, onRemoteOpen };

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(ops));
      } catch {
        // Storage full or blocked; the board still works for this call.
      }
    }, 400);
    return () => clearTimeout(t);
  }, [ops, storageKey]);

  const post = useCallback((msg: WbMessage, to?: string) => {
    encode(msg).forEach((m) => cb.current.send(m, to));
  }, []);

  const addLocal = useCallback(
    (op: WbOp) => {
      setOps((prev) => [...prev, op]);
      setHistory((h) => ({ undo: [...h.undo, op.id], redo: [] }));
      post({ t: "wb-add", op });
    },
    [post]
  );

  const draftLocal = useCallback((id: string, head: WbStrokeHead | undefined, pts: number[]) => {
    post({ t: "wb-draft", id, head, pts });
  }, [post]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    const undoIds = [...h.undo];
    while (undoIds.length) {
      const id = undoIds.pop()!;
      const op = opsRef.current.find((o) => o.id === id);
      if (op) {
        setOps((prev) => prev.filter((o) => o.id !== id));
        setHistory({ undo: undoIds, redo: [...h.redo, op] });
        post({ t: "wb-del", id });
        return;
      }
    }
    setHistory({ undo: [], redo: h.redo });
  }, [post]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (!h.redo.length) return;
    const redoOps = [...h.redo];
    const op = redoOps.pop()!;
    setOps((prev) => (prev.some((o) => o.id === op.id) ? prev : [...prev, op]));
    setHistory({ undo: [...h.undo, op.id], redo: redoOps });
    post({ t: "wb-add", op });
  }, [post]);

  const clear = useCallback(() => {
    setOps([]);
    setDrafts({});
    setHistory({ undo: [], redo: [] });
    post({ t: "wb-clear" });
  }, [post]);

  const requestSync = useCallback(() => post({ t: "wb-req" }), [post]);
  const announceOpen = useCallback((name: string) => post({ t: "wb-open", name }), [post]);

  const handleMessage = useCallback(
    (data: unknown, fromId: string): boolean => {
      if (!data || typeof data !== "object") return false;
      const msg = data as WbMessage;
      switch (msg.t) {
        case "wb-part": {
          const entry = parts.current.get(msg.mid) ?? { n: msg.n, got: new Array<string>(msg.n), count: 0 };
          if (entry.got[msg.i] === undefined) {
            entry.got[msg.i] = msg.s;
            entry.count += 1;
          }
          parts.current.set(msg.mid, entry);
          if (entry.count === entry.n) {
            parts.current.delete(msg.mid);
            try {
              return handleMessage(JSON.parse(entry.got.join("")), fromId);
            } catch {
              return true;
            }
          }
          return true;
        }
        case "wb-add":
          if (!isOp(msg.op)) return true;
          setOps((prev) => (prev.some((o) => o.id === msg.op.id) ? prev : [...prev, msg.op]));
          setDrafts((prev) => {
            if (!prev[msg.op.id]) return prev;
            const next = { ...prev };
            delete next[msg.op.id];
            return next;
          });
          cb.current.onRemoteChange?.();
          return true;
        case "wb-del":
          setOps((prev) => prev.filter((o) => o.id !== msg.id));
          cb.current.onRemoteChange?.();
          return true;
        case "wb-clear":
          setOps([]);
          setDrafts({});
          setHistory({ undo: [], redo: [] });
          cb.current.onRemoteChange?.();
          return true;
        case "wb-draft":
          setDrafts((prev) => {
            const current = prev[msg.id] ?? (msg.head ? { ...msg.head, pts: [] } : null);
            if (!current || !Array.isArray(msg.pts)) return prev;
            return { ...prev, [msg.id]: { ...current, pts: [...current.pts, ...msg.pts] } };
          });
          return true;
        case "wb-req":
          if (opsRef.current.length) post({ t: "wb-snap", ops: opsRef.current }, fromId);
          return true;
        case "wb-snap":
          if (!Array.isArray(msg.ops)) return true;
          setOps((prev) => {
            const known = new Set(prev.map((o) => o.id));
            const incoming = msg.ops.filter((o) => isOp(o) && !known.has(o.id));
            return incoming.length ? [...prev, ...incoming] : prev;
          });
          return true;
        case "wb-open":
          cb.current.onRemoteOpen?.(typeof msg.name === "string" ? msg.name : "Someone");
          return true;
        default:
          return false;
      }
    },
    [post]
  );

  return {
    ops,
    drafts: Object.values(drafts),
    selfId,
    canUndo: history.undo.some((id) => ops.some((o) => o.id === id)),
    canRedo: history.redo.length > 0,
    addLocal,
    draftLocal,
    undo,
    redo,
    clear,
    requestSync,
    announceOpen,
    handleMessage,
  };
}

export type ClassroomWhiteboardState = ReturnType<typeof useClassroomWhiteboard>;
