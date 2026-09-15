import { useState, useEffect, useRef } from "react";

/**
 * A custom hook that uses the Intersection Observer API to detect when an element
 * enters the viewport. Once the element becomes visible, it stays visible (one-time trigger).
 *
 * @param options - IntersectionObserver options (root, rootMargin, threshold)
 * @returns A tuple containing the ref to attach to the element and a boolean indicating if it's in view.
 */
export function useInView<T extends HTMLElement>(options: IntersectionObserverInit = {}) {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<T>(null);

  /*
   * Depend on the option values, never on the options object.
   *
   * Every caller passes an inline literal - useInView({ threshold: 0.1 }) - which
   * is a new object identity on every render, so an effect keyed on that object
   * re-ran on every render and rebuilt the observer each time. AnimatedCounter in
   * SellPageStatsBar made that pathological: it calls setCount once per animation
   * frame, so the observer was being torn down and recreated ~60 times a second
   * for the length of the count-up.
   *
   * The options object itself is read from a ref at observer-creation time, so an
   * array threshold - also a fresh identity each render - cannot reintroduce the
   * problem while still being passed through faithfully.
   */
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const { root = null, rootMargin = "0px", threshold = 0 } = options;
  const thresholdKey = Array.isArray(threshold) ? threshold.join(",") : threshold;

  useEffect(() => {
    const element = ref.current;
    // Nothing to observe, or the one-time trigger has already fired.
    if (!element || isInView) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        // Disconnect after the first intersection to make it a one-time trigger
        observer.disconnect();
      }
    }, optionsRef.current);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [root, rootMargin, thresholdKey, isInView]);

  return [ref, isInView] as const;
}
