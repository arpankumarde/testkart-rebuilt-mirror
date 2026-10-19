import type { ReactNode } from "react";
import { DIWALI_THEME_ENABLED, Diya, Hanger, Sparkle, WarmGlow, diwaliPaletteClass } from "./DiwaliOrnaments";
import styles from "./DiwaliHomeSection.module.css";

export type DiwaliSectionAccent =
  | "headerOrnament"
  | "lotusDivider"
  | "diyaDivider"
  | "topHangers"
  | "cornerDiyas"
  | "gutterSparkles"
  | "diyaRow";

function DividerLines({ withLotus }: { withLotus?: boolean }) {
  return (
    <svg className={styles.dividerSvg} viewBox="0 0 240 24">
      <path className={styles.stroke} d={withLotus ? "M0 12 H96 M144 12 H240" : "M0 12 H100 M140 12 H240"} />
      <circle className={styles.fill} cx="2" cy="12" r="1.4" />
      <circle className={styles.fill} cx="238" cy="12" r="1.4" />
      {withLotus && (
        <>
          <path className={styles.fill} d="M100 12 L103 9 L106 12 L103 15 Z" />
          <path className={styles.fill} d="M134 12 L137 9 L140 12 L137 15 Z" />
          <g className={styles.stroke}>
            <path d="M120 19 C124 13 124 7 120 2 C116 7 116 13 120 19 Z" />
            <path d="M120 19 C123 14 123 10 120 7 C117 10 117 14 120 19 Z" transform="rotate(-52 120 19)" />
            <path d="M120 19 C123 14 123 10 120 7 C117 10 117 14 120 19 Z" transform="rotate(52 120 19)" />
            <path d="M110 21 Q120 24 130 21" />
          </g>
        </>
      )}
    </svg>
  );
}

function HeaderRule() {
  return (
    <svg className={styles.ruleSvg} viewBox="0 0 150 12">
      <path className={styles.stroke} d="M0 6 H130" />
      <circle className={styles.fill} cx="135" cy="6" r="1.3" />
      <path className={styles.fill} d="M140 6 L144 2 L148 6 L144 10 Z" />
    </svg>
  );
}

// Homepage section wrapper: a full-width warm band plus a chosen few accents, all in the section's empty areas.
export function DiwaliHomeSection({
  tone = "plain",
  edge,
  accents = [],
  children,
}: {
  tone?: "ivory" | "plain";
  edge?: "first" | "last";
  accents?: DiwaliSectionAccent[];
  children: ReactNode;
}) {
  if (!DIWALI_THEME_ENABLED) return <>{children}</>;
  const has = (accent: DiwaliSectionAccent) => accents.includes(accent);
  const edgeClass = edge ? styles[edge] : "";

  return (
    <div className={`${styles.band} ${tone === "ivory" ? styles.ivory : ""} ${edgeClass} ${diwaliPaletteClass}`}>
      {/* Negative z-index is set inline because module CSS drops it; .band isolates it. */}
      <div className={styles.back} style={{ zIndex: -1 }} aria-hidden="true">
        {tone === "ivory" && <span className={styles.wash} />}
        {(has("lotusDivider") || has("diyaDivider")) && <WarmGlow className={styles.dividerGlow} breathing />}
      </div>

      {children}

      <div className={styles.front} aria-hidden="true">
        {has("lotusDivider") && (
          <div className={styles.divider}>
            <DividerLines withLotus />
          </div>
        )}
        {has("diyaDivider") && (
          <div className={styles.divider}>
            <DividerLines />
            <Diya className={styles.dividerDiya} delay={0.7} />
          </div>
        )}
        {has("headerOrnament") && (
          <div className={styles.headerOrnament}>
            <Sparkle
              className={styles.headerSparkleA}
              spec={{ size: 8, motion: "twinkle", duration: 5.4, delay: 0.4 }}
            />
            <Sparkle
              className={styles.headerSparkleB}
              spec={{ size: 6, motion: "drift", duration: 17, delay: 6, dx: -8, dy: -36 }}
            />
            <HeaderRule />
            <Diya className={styles.headerDiya} delay={1.2} />
          </div>
        )}
        {has("topHangers") && (
          <>
            <Hanger className={`${styles.topHanger} ${styles.left}`} kind="lantern" len={10} duration={6.2} delay={0} />
            <Hanger className={`${styles.topHanger} ${styles.right}`} kind="drop" len={14} duration={7} delay={2.4} />
          </>
        )}
        {has("cornerDiyas") && (
          <div className={styles.cornerDiyas}>
            <Diya className={styles.cornerDiya} floating delay={0.3} />
            <Diya className={styles.cornerDiya} floating delay={2.1} />
          </div>
        )}
        {has("gutterSparkles") && (
          <>
            <Sparkle className={`${styles.gutterSparkle} ${styles.gs1}`} spec={{ size: 7, motion: "twinkle", duration: 6, delay: 1 }} />
            <Sparkle className={`${styles.gutterSparkle} ${styles.gs2}`} spec={{ size: 5, motion: "drift", duration: 19, delay: 4, dx: 6, dy: -60 }} />
            <Sparkle className={`${styles.gutterSparkle} ${styles.gs3}`} spec={{ size: 6, motion: "twinkle", duration: 6.8, delay: 2.7 }} />
            <Sparkle className={`${styles.gutterSparkle} ${styles.gs4}`} spec={{ size: 5, motion: "twinkle", duration: 5.6, delay: 0.2 }} />
          </>
        )}
        {has("diyaRow") && (
          <div className={styles.diyaRow}>
            <Diya className={styles.rowDiyaSmall} delay={0.5} />
            <Diya className={styles.rowDiya} delay={1.5} />
            <Diya className={styles.rowDiyaSmall} delay={2.5} />
          </div>
        )}
      </div>
    </div>
  );
}
