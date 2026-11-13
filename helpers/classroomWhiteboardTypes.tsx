/** Whiteboard drawing operations, shared by the classroom board and the endpoints that save it. */

export type WbStrokeKind = "pen" | "highlighter" | "eraser";
export type WbShapeKind = "line" | "rect" | "ellipse";

export type WbStroke = { id: string; by: string; kind: WbStrokeKind; color: string; size: number; pts: number[] };
export type WbShape = { id: string; by: string; kind: WbShapeKind; color: string; size: number; x1: number; y1: number; x2: number; y2: number };
export type WbText = { id: string; by: string; kind: "text"; color: string; size: number; x: number; y: number; text: string };
export type WbOp = WbStroke | WbShape | WbText;

export type WbStrokeHead = Omit<WbStroke, "pts">;
