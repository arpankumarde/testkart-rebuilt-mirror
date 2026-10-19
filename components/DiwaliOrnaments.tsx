import type { CSSProperties } from "react";
import styles from "./DiwaliOrnaments.module.css";

// Set to false to switch every Diwali decoration off across the site.
export const DIWALI_THEME_ENABLED = true;

export const diwaliPaletteClass = styles.palette;

type Timing = { duration?: number; delay?: number };

const timingStyle = ({ duration, delay }: Timing, extra?: Record<string, string | number>) =>
  ({
    ...(duration !== undefined ? { "--dw-dur": `${duration}s` } : {}),
    ...(delay !== undefined ? { "--dw-delay": `${delay}s` } : {}),
    ...extra,
  }) as CSSProperties;

export function Mandala({
  className,
  spin,
  reverse,
  style,
}: {
  className?: string;
  spin?: number;
  reverse?: boolean;
  style?: CSSProperties;
}) {
  return (
    <svg className={className} style={style} viewBox="-100 -100 200 200">
      <g
        className={`${spin ? styles.spin : ""} ${reverse ? styles.reverse : ""}`}
        style={timingStyle({ duration: spin })}
      >
        <g className={styles.line}>
          <circle r="96" />
          <circle r="90" className={styles.dotted} />
          <circle r="70" />
          <circle r="40" />
          <circle r="18" />
          <circle r="8" />
          {Array.from({ length: 16 }, (_, i) => (
            <path key={`o${i}`} d="M0,-70 Q9,-80 0,-92 Q-9,-80 0,-70Z" transform={`rotate(${i * 22.5})`} />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <path
              key={`m${i}`}
              d="M0,-40 C15,-50 12,-62 0,-68 C-12,-62 -15,-50 0,-40Z"
              transform={`rotate(${i * 45})`}
            />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <path
              key={`n${i}`}
              d="M0,-42 C8,-48 7,-56 0,-60 C-7,-56 -8,-48 0,-42Z"
              transform={`rotate(${i * 45 + 22.5})`}
            />
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <path key={`i${i}`} d="M0,-18 Q6,-28 0,-38 Q-6,-28 0,-18Z" transform={`rotate(${i * 30})`} />
          ))}
        </g>
        <g className={styles.dots}>
          {Array.from({ length: 16 }, (_, i) => (
            <circle key={i} cy="-80" r="1.6" transform={`rotate(${i * 22.5 + 11.25})`} />
          ))}
        </g>
      </g>
    </svg>
  );
}

function Lantern() {
  return (
    <svg className={styles.ornament} viewBox="0 0 24 40">
      <circle cx="12" cy="2.5" r="1.8" className={styles.ring} />
      <path d="M8 5 H16 L19 9 H5 Z" className={styles.gold} />
      <path d="M5 9 C3 17 7 24 12 27 C17 24 21 17 19 9 Z" className={styles.lanternBody} />
      <path d="M12 9 V27 M8.5 9 C7.5 16 9.5 22 12 27 M15.5 9 C16.5 16 14.5 22 12 27" className={styles.ribs} />
      <circle cx="12" cy="16" r="2.6" className={`${styles.saffron} ${styles.ember}`} />
      <path d="M12 27 V34" className={styles.ribs} />
      <path d="M12 33 C14 35 14 37.5 12 39.5 C10 37.5 10 35 12 33 Z" className={styles.saffron} />
    </svg>
  );
}

function Drop() {
  return (
    <svg className={styles.ornament} viewBox="0 0 24 40">
      <circle cx="12" cy="4" r="2.4" className={styles.gold} />
      <path d="M12 8 L18 18 L12 30 L6 18 Z" className={styles.lanternBody} />
      <path d="M12 13 L15 18 L12 24 L9 18 Z" className={styles.saffron} />
      <circle cx="12" cy="34" r="2" className={styles.gold} />
    </svg>
  );
}

function HangingDiya() {
  return (
    <svg className={`${styles.ornament} ${styles.ornamentWide}`} viewBox="0 0 28 42">
      <circle cx="14" cy="2.5" r="1.8" className={styles.ring} />
      <path d="M14 4.3 L4 25 M14 4.3 L24 25" className={styles.ribs} />
      <g className={styles.flame}>
        <path d="M14 12 C16.8 16 17 20 14 23.5 C11 20 11.2 16 14 12 Z" className={styles.flameOuter} />
        <path d="M14 16.5 C15.2 18.5 15.3 20.5 14 22.8 C12.7 20.5 12.8 18.5 14 16.5 Z" className={styles.flameCore} />
      </g>
      <ellipse cx="14" cy="25" rx="11" ry="1.8" className={styles.oil} />
      <path d="M3 25 C4 32 9 35 14 35 C19 35 24 32 25 25 C20 26.6 8 26.6 3 25 Z" className={styles.clay} />
      <path d="M14 35 V38" className={styles.ribs} />
      <circle cx="14" cy="39.5" r="1.5" className={styles.saffron} />
    </svg>
  );
}

const ORNAMENTS = { lantern: Lantern, drop: Drop, diya: HangingDiya };

export type HangerKind = keyof typeof ORNAMENTS;

export function Hanger({
  kind,
  len,
  duration,
  delay,
  className,
}: {
  kind: HangerKind;
  len: number;
  duration: number;
  delay: number;
  className?: string;
}) {
  const Ornament = ORNAMENTS[kind];
  return (
    <div
      className={`${styles.hanger} ${className ?? ""}`}
      style={timingStyle({ duration, delay }, { "--len": `${len}px` })}
    >
      <span className={styles.string} />
      <span className={styles.bob}>
        <Ornament />
      </span>
    </div>
  );
}

export function CornerFlourish({ className }: { className?: string }) {
  return (
    <svg className={`${styles.flourish} ${className ?? ""}`} viewBox="0 0 120 120">
      <g className={styles.line}>
        <path d="M0 22 C52 26 94 68 98 120" />
        <path d="M0 46 C36 50 70 84 74 120" />
        <path d="M0 22 C10 14 22 14 26 22 C29 28 22 33 17 29" />
        <g transform="translate(67 53) rotate(45)">
          <path d="M0 0 C4 -6 4 -12 0 -16 C-4 -12 -4 -6 0 0 Z" />
          <path d="M0 0 C4 -6 4 -11 0 -13 C-4 -11 -4 -6 0 0 Z" transform="rotate(-42)" />
          <path d="M0 0 C4 -6 4 -11 0 -13 C-4 -11 -4 -6 0 0 Z" transform="rotate(42)" />
        </g>
        <path d="M0 0 C3 -4 8 -4 10 0 C8 4 3 4 0 0 Z" transform="translate(36.7 31.7) rotate(-62)" />
        <path d="M0 0 C3 -4 8 -4 10 0 C8 4 3 4 0 0 Z" transform="translate(88.3 83.3) rotate(-28)" />
      </g>
      <g className={styles.dots}>
        <circle cx="67" cy="53" r="1.6" />
        <circle cx="26.2" cy="54.2" r="1.4" />
        <circle cx="49" cy="71" r="1.4" />
        <circle cx="65.8" cy="93.8" r="1.4" />
      </g>
    </svg>
  );
}

export function WarmGlow({ className, breathing }: { className?: string; breathing?: boolean }) {
  return <span className={`${styles.warmGlow} ${breathing ? styles.glowBreathe : ""} ${className ?? ""}`} />;
}

export function Diya({
  className,
  delay = 0,
  floating,
}: {
  className?: string;
  delay?: number;
  floating?: boolean;
}) {
  return (
    <span
      className={`${styles.diyaWrap} ${floating ? styles.float : ""} ${className ?? ""}`}
      style={timingStyle({ delay })}
    >
      <span className={styles.glow} />
      <svg className={styles.diyaSvg} viewBox="0 0 64 50">
        <g className={styles.flame}>
          <path d="M32 3 C37.5 11 38.5 18 32 24 C25.5 18 26.5 11 32 3 Z" className={styles.flameOuter} />
          <path d="M32 11 C34.5 15 34.8 19 32 23 C29.2 19 29.5 15 32 11 Z" className={styles.flameCore} />
        </g>
        <path d="M32 23.5 V27" className={styles.wick} />
        <ellipse cx="32" cy="28" rx="26" ry="4" className={styles.oil} />
        <path
          d="M6 28 C8 42 20 48 32 48 C44 48 56 42 58 28 C50 31 42 32 32 32 C22 32 14 31 6 28 Z"
          className={styles.clay}
        />
        <path d="M12 36 Q32 43 52 36" className={styles.band} />
        <circle cx="20" cy="40.5" r="1.3" className={styles.gold} />
        <circle cx="32" cy="43.5" r="1.3" className={styles.gold} />
        <circle cx="44" cy="40.5" r="1.3" className={styles.gold} />
      </svg>
    </span>
  );
}

export type SparkleSpec = {
  size: number;
  duration: number;
  delay: number;
  motion: "twinkle" | "drift";
  dx?: number;
  dy?: number;
};

export function Sparkle({
  spec,
  className,
  style,
}: {
  spec: SparkleSpec;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`${styles.sparkle} ${styles[spec.motion]} ${className ?? ""}`}
      style={{
        width: spec.size,
        height: spec.size,
        ...timingStyle(
          { duration: spec.duration, delay: spec.delay },
          { "--dw-dx": `${spec.dx ?? 0}px`, "--dw-dy": `${spec.dy ?? -60}px` },
        ),
        ...style,
      }}
    >
      <svg viewBox="0 0 24 24" className={styles.sparkleSvg}>
        <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z" />
      </svg>
    </span>
  );
}
