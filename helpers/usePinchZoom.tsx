import { useEffect, useRef, type RefObject } from "react";

export type PinchPoint = { x: number; y: number };

export type PinchResult = {
  zoom: number;
  start: PinchPoint;
  end: PinchPoint;
};

export interface UsePinchZoomOptions {
  scrollRef: RefObject<HTMLElement | null>;
  frameRef: RefObject<HTMLElement | null>;
  getZoom: () => number;
  getLimits: () => { min: number; max: number };
  onStart: (point: PinchPoint) => void;
  onEnd: (result: PinchResult) => void;
}

type Gesture = {
  startDistance: number;
  startZoom: number;
  start: PinchPoint;
  last: PinchPoint;
  scale: number;
  minScale: number;
  maxScale: number;
};

const MIN_START_DISTANCE = 24;
const MIN_SCALE_CHANGE = 0.02;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const distanceBetween = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

const midpointOf = (a: Touch, b: Touch): PinchPoint => ({
  x: (a.clientX + b.clientX) / 2,
  y: (a.clientY + b.clientY) / 2,
});

// Two-finger pinch on a scroller. While the fingers are down the frame is scaled with a CSS transform, so the
// gesture stays smooth and heavy content re-renders once; the final zoom goes to onEnd when a finger lifts.
// Pair it with `touch-action: pan-x pan-y` on the scroller so the browser leaves the pinch to this hook
// instead of zooming the whole page.
export const usePinchZoom = (options: UsePinchZoomOptions) => {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const scroll = optionsRef.current.scrollRef.current;
    if (!scroll) return;

    let gesture: Gesture | null = null;

    const resetFrame = () => {
      const frame = optionsRef.current.frameRef.current;
      if (!frame) return;
      frame.style.transform = "";
      frame.style.transformOrigin = "";
      frame.style.willChange = "";
    };

    const finish = () => {
      if (!gesture) return;
      const { startZoom, scale, start, last } = gesture;
      gesture = null;
      resetFrame();
      const hasZoomed = Math.abs(scale - 1) >= MIN_SCALE_CHANGE;
      optionsRef.current.onEnd({
        zoom: hasZoomed ? Math.round(startZoom * scale * 100) / 100 : startZoom,
        start,
        end: last,
      });
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (gesture || event.touches.length !== 2) return;
      const first = event.touches[0];
      const second = event.touches[1];
      if (!scroll.contains(first.target as Node) || !scroll.contains(second.target as Node)) return;
      const distance = distanceBetween(first, second);
      if (distance < MIN_START_DISTANCE) return;

      const { getZoom, getLimits, onStart, frameRef } = optionsRef.current;
      const start = midpointOf(first, second);
      const startZoom = getZoom();
      const { min, max } = getLimits();
      onStart(start);

      const frame = frameRef.current;
      if (frame) {
        const rect = frame.getBoundingClientRect();
        frame.style.transformOrigin = `${start.x - rect.left}px ${start.y - rect.top}px`;
        frame.style.willChange = "transform";
      }
      gesture = {
        startDistance: distance,
        startZoom,
        start,
        last: start,
        scale: 1,
        minScale: min / startZoom,
        maxScale: max / startZoom,
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!gesture || event.touches.length < 2) return;
      if (event.cancelable) event.preventDefault();
      const first = event.touches[0];
      const second = event.touches[1];
      const scale = clamp(distanceBetween(first, second) / gesture.startDistance, gesture.minScale, gesture.maxScale);
      const mid = midpointOf(first, second);
      gesture.scale = scale;
      gesture.last = mid;
      const frame = optionsRef.current.frameRef.current;
      if (frame) {
        frame.style.transform = `translate(${mid.x - gesture.start.x}px, ${mid.y - gesture.start.y}px) scale(${scale})`;
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (gesture && event.touches.length < 2) finish();
    };

    // Safari reports its own page-zoom gesture; cancelling it keeps the page at 1:1.
    const preventPageGesture = (event: Event) => event.preventDefault();

    scroll.addEventListener("touchstart", handleTouchStart, { passive: true });
    scroll.addEventListener("touchmove", handleTouchMove, { passive: false });
    scroll.addEventListener("touchend", handleTouchEnd, { passive: true });
    scroll.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    scroll.addEventListener("gesturestart", preventPageGesture);
    scroll.addEventListener("gesturechange", preventPageGesture);

    return () => {
      scroll.removeEventListener("touchstart", handleTouchStart);
      scroll.removeEventListener("touchmove", handleTouchMove);
      scroll.removeEventListener("touchend", handleTouchEnd);
      scroll.removeEventListener("touchcancel", handleTouchEnd);
      scroll.removeEventListener("gesturestart", preventPageGesture);
      scroll.removeEventListener("gesturechange", preventPageGesture);
      if (gesture) {
        gesture = null;
        resetFrame();
      }
    };
  }, []);
};
