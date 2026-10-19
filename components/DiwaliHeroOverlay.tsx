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

const HANGERS: { kind: HangerKind; len: number; duration: number; delay: number }[] = [
  { kind: "diya", len: 80, duration: 6.4, delay: 0 },
  { kind: "drop", len: 50, duration: 5.2, delay: 1.7 },
];

type HeroSparkle = SparkleSpec & { x: number; y: number; tier: "md" | "lg" };

const SPARKLES: HeroSparkle[] = [
  { x: 3, y: 58, size: 12, duration: 3.6, delay: 0, motion: "twinkle", tier: "md" },
  { x: 9, y: 34, size: 9, duration: 4.2, delay: 1.1, motion: "twinkle", tier: "lg" },
  { x: 12, y: 70, size: 10, duration: 14, delay: 4, motion: "drift", dx: 14, dy: -70, tier: "lg" },
  { x: 17, y: 88, size: 9, duration: 3.9, delay: 0.6, motion: "twinkle", tier: "lg" },
  { x: 6, y: 80, size: 7, duration: 17, delay: 9, motion: "drift", dx: -10, dy: -90, tier: "lg" },
];

function Side({ side }: { side: "left" | "right" }) {
  const mirror = side === "right";
  return (
    <>
      <Mandala className={`${styles.mandala} ${styles[side]}`} spin={mirror ? 56 : 48} reverse={mirror} />
      <Mandala className={`${styles.mobileMandala} ${styles[side]}`} spin={mirror ? 56 : 48} reverse={mirror} />
      <div className={`${styles.hangers} ${styles[side]}`}>
        {HANGERS.map((h, i) => (
          <Hanger
            key={i}
            className={styles.hanger}
            kind={h.kind}
            len={h.len}
            duration={h.duration + (mirror ? 0.9 : 0)}
            delay={h.delay + (mirror ? 2.3 : 0)}
          />
        ))}
        <Hanger
          className={styles.mobileLantern}
          kind="lantern"
          len={16}
          duration={mirror ? 6.9 : 6.1}
          delay={mirror ? 2.2 : 0.4}
        />
      </div>
      {SPARKLES.map(({ x, y, tier, ...spec }, i) => (
        <Sparkle
          key={i}
          className={styles[tier]}
          spec={{ ...spec, delay: spec.delay + (mirror ? 1.3 : 0) }}
          style={{ [side]: `${x}%`, top: `${y}%` }}
        />
      ))}
      <div className={`${styles.diyas} ${styles[side]}`}>
        <Diya className={styles.diya} delay={mirror ? 1.4 : 0} />
        <Diya className={`${styles.diya} ${styles.diyaSmall}`} delay={mirror ? 2.6 : 0.9} />
      </div>
    </>
  );
}

export function DiwaliHeroOverlay() {
  if (!DIWALI_THEME_ENABLED) return null;
  return (
    <div className={`${styles.overlay} ${diwaliPaletteClass}`} aria-hidden="true">
      <Side side="left" />
      <Side side="right" />
    </div>
  );
}
