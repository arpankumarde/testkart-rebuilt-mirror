import type { CSSProperties } from "react";
import {
  DIWALI_THEME_ENABLED,
  Diya,
  Hanger,
  Mandala,
  Sparkle,
  diwaliPaletteClass,
  type HangerKind,
  type SparkleSpec,
} from "./DiwaliOrnaments";
import styles from "./DiwaliHeroOverlay.module.css";

// "wide" pieces show from 1024px only; "all" pieces also show on tablets
type Tier = "all" | "wide";

const tierClass = (tier: Tier) => (tier === "wide" ? styles.wide : "");

type HangerSpec = {
  kind: HangerKind;
  x: number;
  len: number;
  duration: number;
  delay: number;
  tier: Tier;
};

const HANGERS: HangerSpec[] = [
  { kind: "lantern", x: 6, len: 34, duration: 6.1, delay: 0.4, tier: "all" },
  { kind: "diya", x: 25, len: 18, duration: 6.4, delay: 0, tier: "wide" },
  { kind: "drop", x: 75, len: 26, duration: 5.2, delay: 1.7, tier: "wide" },
  { kind: "lantern", x: 94, len: 46, duration: 6.9, delay: 2.2, tier: "all" },
];

const SPARKLES: (SparkleSpec & { x: number; y: number; tier: Tier })[] = [
  { x: 12, y: 60, size: 12, duration: 3.6, delay: 0, motion: "twinkle", tier: "all" },
  { x: 88, y: 56, size: 11, duration: 4.2, delay: 1.1, motion: "twinkle", tier: "all" },
  { x: 28, y: 84, size: 9, duration: 3.9, delay: 0.6, motion: "twinkle", tier: "wide" },
  { x: 72, y: 82, size: 9, duration: 4.6, delay: 1.9, motion: "twinkle", tier: "wide" },
  { x: 20, y: 72, size: 8, duration: 14, delay: 4, motion: "drift", dx: 12, dy: -70, tier: "wide" },
  { x: 80, y: 76, size: 8, duration: 17, delay: 9, motion: "drift", dx: -10, dy: -80, tier: "wide" },
];

const CORNER_HANGERS: Omit<HangerSpec, "tier">[] = [
  { kind: "lantern", x: 30, len: 8, duration: 6.1, delay: 0.4 },
  { kind: "lantern", x: 74, len: 20, duration: 6.9, delay: 2.2 },
];

// "scene" is the hero's right-hand column (tablet and up); "corner" floats beside the heading on phones.
export function DiwaliHeroOverlay({ variant = "scene" }: { variant?: "scene" | "corner" }) {
  if (!DIWALI_THEME_ENABLED) return null;
  if (variant === "corner") {
    return (
      <span className={`${styles.corner} ${diwaliPaletteClass}`} aria-hidden="true">
        {CORNER_HANGERS.map(({ x, ...h }, i) => (
          <span key={i} className={styles.hangerSlot} style={{ "--x": `${x}%` } as CSSProperties}>
            <Hanger {...h} />
          </span>
        ))}
        <Sparkle
          spec={{ size: 8, duration: 3.8, delay: 0.5, motion: "twinkle" }}
          style={{ left: "4%", top: "62%" }}
        />
      </span>
    );
  }
  return (
    <div className={`${styles.scene} ${diwaliPaletteClass}`} aria-hidden="true">
      <Mandala className={styles.mandala} spin={48} />
      {HANGERS.map(({ x, tier, ...h }, i) => (
        <span key={i} className={`${styles.hangerSlot} ${tierClass(tier)}`} style={{ "--x": `${x}%` } as CSSProperties}>
          <Hanger {...h} />
        </span>
      ))}
      {SPARKLES.map(({ x, y, tier, ...spec }, i) => (
        <Sparkle key={i} className={tierClass(tier)} spec={spec} style={{ left: `${x}%`, top: `${y}%` }} />
      ))}
      <div className={styles.diyas}>
        <Diya className={styles.diyaSmall} delay={0.9} />
        <Diya className={styles.diyaLarge} />
        <Diya className={styles.diyaSmall} delay={2.6} />
      </div>
    </div>
  );
}
