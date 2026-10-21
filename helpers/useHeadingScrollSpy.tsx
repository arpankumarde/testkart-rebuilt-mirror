import { RefObject, useCallback, useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* The sticky header, the site notice when it shows, and a little air. Keep in
   step with the scroll-margin-top on help article headings. */
const headingOffset = () => {
  const root = getComputedStyle(document.documentElement);
  const header = parseFloat(root.getPropertyValue("--header-height")) || 72;
  const notice = parseFloat(root.getPropertyValue("--site-notice-offset")) || 0;
  return header + notice + 24;
};

/**
 * Tracks which of `ids` (headings inside `rootRef`) the reader is in, and
 * scrolls to one on request. Headings are looked up inside the root on every
 * pass rather than once, because after client-side navigation the article
 * can still be detached when the effect first runs.
 *
 * A heading picked from the TOC stays active until the reader scrolls, taps
 * or types, so sections too short to reach the top of the window (the last
 * few on the page, or two close together) still show as the one clicked.
 */
export function useHeadingScrollSpy(rootRef: RefObject<HTMLElement | null>, ids: string[]) {
  const [activeId, setActiveId] = useState("");
  const pinnedRef = useRef<string | null>(null);

  const find = useCallback(
    (id: string) => rootRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`) ?? null,
    [rootRef]
  );

  useEffect(() => {
    if (!ids.length) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      if (pinnedRef.current) return;
      const offset = headingOffset();
      let current = "";
      for (const id of ids) {
        const el = find(id);
        if (el && el.getBoundingClientRect().top - offset <= 1) current = id;
      }
      const last = find(ids[ids.length - 1]);
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (current && atEnd && last && last.getBoundingClientRect().top < window.innerHeight) {
        current = ids[ids.length - 1];
      }
      setActiveId(current);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const release = () => {
      pinnedRef.current = null;
      schedule();
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchstart", release, { passive: true });
    window.addEventListener("keydown", release);

    // Landing on /help/<slug>#<heading> goes to that heading once it exists.
    const hashId = decodeURIComponent(window.location.hash.slice(1));
    const hashTimer = hashId && ids.includes(hashId)
      ? window.setTimeout(() => find(hashId)?.scrollIntoView({ block: "start" }), 60)
      : 0;

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchstart", release);
      window.removeEventListener("keydown", release);
      if (frame) cancelAnimationFrame(frame);
      if (hashTimer) window.clearTimeout(hashTimer);
    };
  }, [ids, find]);

  const scrollTo = useCallback(
    (id: string) => {
      const el = find(id);
      if (!el) return;
      pinnedRef.current = id;
      setActiveId(id);
      el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      // Moves keyboard focus with the reader, without a second scroll.
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
      window.history.replaceState(window.history.state, "", `#${id}`);
    },
    [find]
  );

  return { activeId, scrollTo };
}
