import React from "react";
import styles from "./SpinWinWheel.module.css";

export type SpinWheelSegment = { key: string | number; label: string; color: string };

type Props = {
  segments: SpinWheelSegment[];
  /** Rendered width in px; the SVG scales down on narrow screens. */
  size?: number;
  className?: string;
  /** Degrees the slices are turned by; the pointer and rim stay put. */
  rotation?: number;
  /** How long a change of rotation animates for; 0 jumps straight there. */
  spinMs?: number;
  /** Rendered over the hub, e.g. the student wheel's Spin button. */
  center?: React.ReactNode;
  /** "festive" is the student popup's gold rim, pointer and glow; the default suits the admin preview. */
  tone?: "default" | "festive";
};

/* A quick start held at an even pace, then a long, gradual slowdown into the winning slice. */
const SPIN_EASING = "cubic-bezier(0.25, 0.3, 0.35, 1)";

const DARK_INK = "#33164F";
const LIGHT_INK = "#FFFFFF";
const VIEW = 200;
const CX = VIEW / 2;
const CY = CX + 10;
const RADIUS = 92;

/* Picks the label ink by relative luminance, so an admin-chosen dark slice still reads. */
function inkFor(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return DARK_INK;
  const value = parseInt(match[1], 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  return luminance > 0.36 ? DARK_INK : LIGHT_INK;
}

const point = (r: number, angle: number) => ({ x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) });

/**
 * The rotation that brings slice `index` under the pointer, at least `turns` full turns past
 * `from`, landing a little off-centre (within the middle 60% of the slice) so it looks natural.
 * Slice i is centred at -90 + i * slice degrees before rotation, which is where the pointer is.
 */
export function rotationForSlice(index: number, count: number, from: number, turns = 6, jitter = Math.random() - 0.5): number {
  const slice = 360 / Math.max(count, 1);
  const target = (((-index * slice) % 360) + 360) % 360;
  const current = ((from % 360) + 360) % 360;
  const delta = (target - current + 360) % 360;
  return from + turns * 360 + delta + jitter * slice * 0.6;
}

/*
 * Equal slices in reward order, as students see them. Slice size says nothing about odds, which
 * are disclosed separately. Used both as the admin preview and, with `rotation` and `center`,
 * as the student wheel.
 */
export const SpinWinWheel: React.FC<Props> = ({ segments, size = 280, className, rotation = 0, spinMs = 0, center, tone = "default" }) => {
  const count = segments.length;
  const slice = count > 0 ? (2 * Math.PI) / count : 0;
  const start = -Math.PI / 2 - slice / 2;
  const labelSize = count > 8 ? 6.5 : count > 6 ? 7.5 : 8.5;

  return (
    <figure className={`${styles.figure} ${tone === "festive" ? styles.festive : ""} ${className ?? ""}`} style={{ maxWidth: size }}>
      <svg viewBox={`0 0 ${VIEW} ${VIEW + 10}`} role="img" aria-label={count > 0 ? `Prize wheel with ${count} slices` : "Empty wheel"} className={styles.svg}>
        <circle cx={CX} cy={CY} r={RADIUS + 6} className={styles.rim} />
        {tone === "festive" ? <circle cx={CX} cy={CY} r={RADIUS + 0.8} className={styles.innerRing} /> : null}
        <g
          className={styles.rotor}
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transition: spinMs > 0 ? `transform ${spinMs}ms ${SPIN_EASING}` : "none",
          }}
        >
          {count === 0 ? (
            <circle cx={CX} cy={CY} r={RADIUS} className={styles.empty} />
          ) : count === 1 ? (
            <circle cx={CX} cy={CY} r={RADIUS} fill={segments[0].color} className={styles.slice} />
          ) : (
            segments.map((segment, i) => {
              const a0 = start + i * slice;
              const p0 = point(RADIUS, a0);
              const p1 = point(RADIUS, a0 + slice);
              const large = slice > Math.PI ? 1 : 0;
              return (
                <path
                  key={segment.key}
                  d={`M ${CX} ${CY} L ${p0.x} ${p0.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${p1.x} ${p1.y} Z`}
                  fill={segment.color}
                  className={styles.slice}
                />
              );
            })
          )}
          {segments.map((segment, i) => {
            const mid = start + (i + 0.5) * slice;
            const at = point(RADIUS * 0.6, count === 1 ? -Math.PI / 2 : mid);
            // Radial labels, flipped on the left half so none reads upside down at rest.
            const degrees = ((((mid * 180) / Math.PI) % 360) + 540) % 360 - 180;
            const rotate = count === 1 ? 0 : Math.abs(degrees) > 90 ? degrees + 180 : degrees;
            // A "\n" in a label stacks it: a small first line over the main one.
            const lines = segment.label.split("\n").map((line) => (line.length > 14 ? `${line.slice(0, 13)}…` : line));
            return (
              <text
                key={`label-${segment.key}`}
                x={at.x}
                y={at.y}
                fill={inkFor(segment.color)}
                fontSize={labelSize}
                className={styles.label}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${rotate} ${at.x} ${at.y})`}
              >
                {lines.length === 1
                  ? lines[0]
                  : lines.map((line, n) => (
                      <tspan key={n} x={at.x} dy={n === 0 ? `${-0.55 * (lines.length - 1)}em` : "1.1em"} fontSize={n === 0 ? labelSize * 0.78 : labelSize}>
                        {line}
                      </tspan>
                    ))}
              </text>
            );
          })}
        </g>
        {Array.from({ length: 16 }, (_, i) => {
          const bulb = point(RADIUS + 3, (i / 16) * 2 * Math.PI);
          return <circle key={`bulb-${i}`} cx={bulb.x} cy={bulb.y} r={1.6} className={styles.bulb} />;
        })}
        {center ? null : (
          <>
            <circle cx={CX} cy={CY} r={14} className={styles.hub} />
            <circle cx={CX} cy={CY} r={5} className={styles.hubDot} />
          </>
        )}
        {tone === "festive" ? (
          <path
            d={`M ${CX} 27 C ${CX - 2.5} 21 ${CX - 7.5} 15 ${CX - 7.5} 9.5 A 7.5 7.5 0 0 1 ${CX + 7.5} 9.5 C ${CX + 7.5} 15 ${CX + 2.5} 21 ${CX} 27 Z`}
            className={styles.pointer}
          />
        ) : (
          <path d={`M ${CX - 8} 2 L ${CX + 8} 2 L ${CX} 20 Z`} className={styles.pointer} />
        )}
        {tone === "festive" ? <circle cx={CX} cy={9.5} r={2.8} className={styles.pointerGem} /> : null}
      </svg>
      {center ? <div className={styles.center}>{center}</div> : null}
    </figure>
  );
};
