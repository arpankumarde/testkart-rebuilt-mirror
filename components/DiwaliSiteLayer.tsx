import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  CornerFlourish,
  DIWALI_THEME_ENABLED,
  Diya,
  Hanger,
  Sparkle,
  WarmGlow,
  diwaliPaletteClass,
  type HangerKind,
  type SparkleSpec,
} from "./DiwaliOrnaments";
import styles from "./DiwaliSiteLayer.module.css";

type Side = "left" | "right";
type PageKind = "home" | "listing" | "detail" | "page";
type Particle = SparkleSpec & { side: Side; x: number; y: number; tier: "all" | "tablet" | "desktop" };
type HangerSpec = { side: Side; kind: HangerKind; len: number; duration: number; delay: number };

type Plan = {
  particles: Particle[];
  hangers: HangerSpec[];
  corner?: Side;
  topFlourish?: Side;
};

const LISTING_PATH = /^\/(course|mock-test|study-notes|live-test|exams|bundles|search|current-affairs|blog)\/?$/;
const HANGER_KINDS: HangerKind[] = ["lantern", "drop", "diya"];

const pageKind = (pathname: string): PageKind => {
  if (pathname === "/") return "home";
  if (LISTING_PATH.test(pathname)) return "listing";
  return pathname.split("/").filter(Boolean).length >= 2 ? "detail" : "page";
};

const seededRandom = (text: string) => {
  let seed = 5381;
  for (let i = 0; i < text.length; i++) seed = ((seed << 5) + seed + text.charCodeAt(i)) | 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Each route gets its own deterministic mix and placement, so pages do not look identical.
const buildPlan = (pathname: string): Plan => {
  const kind = pageKind(pathname);
  const rand = seededRandom(pathname);
  const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)];
  const sideA: Side = rand() < 0.5 ? "left" : "right";
  const sideB: Side = sideA === "left" ? "right" : "left";

  const particles: Particle[] = Array.from({ length: 8 }, (_, i) => {
    const drift = kind !== "home" && rand() < 0.3;
    return {
      side: i % 2 === 0 ? "left" : "right",
      x: 15 + rand() * 70,
      y: 12 + rand() * 68,
      size: 4 + Math.round(rand() * 3),
      motion: drift ? "drift" : "twinkle",
      duration: drift ? 15 + rand() * 7 : 5.5 + rand() * 2.5,
      delay: rand() * 8,
      dx: Math.round(rand() * 16 - 8),
      dy: -50 - Math.round(rand() * 40),
      tier: i < 2 ? "all" : i < 4 ? "tablet" : "desktop",
    };
  });

  const hanger = (side: Side): HangerSpec => ({
    side,
    kind: pick(HANGER_KINDS),
    len: 26 + Math.round(rand() * 28),
    duration: 5.6 + rand() * 1.8,
    delay: rand() * 4,
  });

  switch (kind) {
    case "home":
      return { particles, hangers: [] };
    case "listing":
      return { particles, hangers: [hanger(sideA), hanger(sideA)], corner: sideA, topFlourish: sideB };
    case "detail":
      return { particles, hangers: [hanger(sideA)], corner: sideB };
    default:
      return { particles, hangers: [hanger("left"), hanger("right")], corner: sideA };
  }
};

export function DiwaliSiteLayer() {
  const { pathname } = useLocation();
  const plan = useMemo(() => buildPlan(pathname), [pathname]);
  const edgeRef = useRef<HTMLDivElement>(null);
  const pageEndRef = useRef<HTMLDivElement>(null);

  // Desktop: the edge layer is pinned to the viewport and ends at the footer's top edge once the footer scrolls in,
  // so the corner decoration rests on the footer instead of being covered by it.
  // Mobile: the page-end layer is placed in page coordinates just above the footer (footer height from the bottom).
  useEffect(() => {
    const layer = edgeRef.current;
    const pageEnd = pageEndRef.current;
    const container = layer?.parentElement;
    const footer = container?.querySelector(":scope > footer");
    if (!(plan.corner || plan.topFlourish) || !layer || !container || !footer) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const footerTop = footer.getBoundingClientRect().top;
      layer.style.setProperty("--dw-footer-lift", `${Math.round(Math.max(0, window.innerHeight - footerTop))}px`);
      pageEnd?.style.setProperty(
        "--dw-footer-offset",
        `${Math.round(Math.max(0, container.getBoundingClientRect().bottom - footerTop))}px`,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [plan.corner, plan.topFlourish, pathname]);

  if (!DIWALI_THEME_ENABLED) return null;

  return (
    <>
      {/* Negative z-index is set inline because module CSS drops it; the layout container isolates it. */}
      <div className={`${styles.back} ${diwaliPaletteClass}`} style={{ zIndex: -1 }} aria-hidden="true">
        {(["left", "right"] as const).map((side) => (
          <div key={side} className={`${styles.gutter} ${styles[side]}`}>
            {plan.particles
              .filter((p) => p.side === side)
              .map(({ side: _side, x, y, tier, ...spec }, i) => (
                <Sparkle key={i} className={styles[tier]} spec={spec} style={{ left: `${x}%`, top: `${y}%` }} />
              ))}
          </div>
        ))}
      </div>
      {/* Above page backgrounds (full-width wrappers would hide it) but kept inside the side margin, clear of content. */}
      <div ref={edgeRef} className={`${styles.edge} ${diwaliPaletteClass}`} aria-hidden="true">
        {plan.topFlourish && (
          <CornerFlourish className={`${styles.topFlourish} ${styles[plan.topFlourish]}`} />
        )}
        {plan.corner && (
          <div className={`${styles.corner} ${styles[plan.corner]}`}>
            <WarmGlow className={styles.cornerGlow} />
            <CornerFlourish className={styles.cornerFlourish} />
            <Diya className={styles.cornerDiya} floating delay={plan.corner === "left" ? 0 : 1.6} />
          </div>
        )}
      </div>
      {/* Phones and tablets: the corner group rests in the empty bottom-nav clearance just above the footer. */}
      {plan.corner && (
        <div ref={pageEndRef} className={`${styles.pageEnd} ${diwaliPaletteClass}`} aria-hidden="true">
          <div className={`${styles.pageEndCorner} ${styles[plan.corner]}`}>
            <CornerFlourish className={styles.cornerFlourish} />
            <Diya className={styles.pageEndDiya} floating delay={plan.corner === "left" ? 0.4 : 1.8} />
          </div>
        </div>
      )}
      {plan.hangers.length > 0 && (
        <div className={`${styles.front} ${diwaliPaletteClass}`} aria-hidden="true">
          {(["left", "right"] as const).map((side) => (
            <div key={side} className={`${styles.hangers} ${styles[side]}`}>
              {plan.hangers
                .filter((h) => h.side === side)
                .map((h, i) => (
                  <Hanger
                    key={i}
                    className={styles.hanger}
                    kind={h.kind}
                    len={h.len}
                    duration={h.duration}
                    delay={h.delay}
                  />
                ))}
            </div>
          ))}
          {(["left", "right"] as const)
            .filter((side) => plan.hangers.some((h) => h.side === side))
            .map((side) => (
              <Hanger
                key={side}
                className={`${styles.mobileLantern} ${styles[side]}`}
                kind="lantern"
                len={10}
                duration={side === "left" ? 6.2 : 6.9}
                delay={side === "left" ? 0.3 : 2}
              />
            ))}
        </div>
      )}
    </>
  );
}
