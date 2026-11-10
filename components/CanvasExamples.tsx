"use client";

// The worked example your canvas started with: one product — the Aria
// watch — checked out in three MATERIALS. Every piece is real UI: switch to
// Interact, type in the fields, press Pay. Edit it, or delete it once your
// own screens are on the canvas.

import React, { useEffect, useState } from "react";
import { ArrowRight, Check, Lock, MousePointerClick, Plus, ShieldCheck, Sparkles } from "lucide-react";
import styles from "./CanvasExamples.module.css";

/** The editor's canvas actions ("Start designing"), read from the global
 *  the canvas sets. This file imports nothing from @floot/design: a page may
 *  import these components, and pages are built where it does not exist. */
type DesignCanvasActions = {
  handOffPrompt: (prompt: string) => Promise<boolean>;
  clearCanvas: () => Promise<boolean>;
};
function useDesignCanvasActions(): DesignCanvasActions {
  const actions = (globalThis as { __flootDesignCanvasActions?: Partial<DesignCanvasActions> })
    .__flootDesignCanvasActions;
  return {
    handOffPrompt: (prompt) => actions?.handOffPrompt?.(prompt) ?? Promise.resolve(false),
    clearCanvas: () => actions?.clearCanvas?.() ?? Promise.resolve(false),
  };
}

/* ────────────────────────── The intro tile ───────────────────────────── */

function ExploreArt() {
  return (
    <div className={styles.artExplore}>
      <span className={`${styles.skScreen} ${styles.skMinimal}`}>
        <i className={`${styles.skLine} ${styles.skLineTitle}`} />
        <i className={`${styles.skLine} ${styles.skLineShort}`} />
        <i className={`${styles.skBtn} ${styles.skBtnOutline}`} />
      </span>
      <span className={`${styles.skScreen} ${styles.skBold}`}>
        <i className={styles.skHero} />
        <i className={`${styles.skLine} ${styles.skLineOnDark}`} />
        <i className={`${styles.skBtn} ${styles.skBtnWhite}`} />
      </span>
      <span className={`${styles.skScreen} ${styles.skDense}`}>
        <i className={`${styles.skLine} ${styles.skLineTitle}`} />
        <i className={styles.skGrid}>
          <b />
          <b />
          <b />
          <b />
          <b />
          <b />
        </i>
      </span>
    </div>
  );
}

/** The brief that opens the row — the same size as the screens beside it:
 *  the sketch on a soft colour field, what the example is, the three
 *  materials in order, and how to try them. */
export function DesignExampleCard() {
  return (
    <div className={styles.tile}>
      <span className={styles.tileArt} aria-hidden="true">
        <ExploreArt />
      </span>
      <span className={styles.tileBody}>
        <span className={styles.tileEyebrow}>Example screens</span>
        <span className={styles.tileTitle}>What you can make on canvas</span>
        <span className={styles.tileText}>
          One design, three styles, all made on this canvas.
          <br />
          Use them for inspiration.
        </span>
        <span className={styles.tileTry}>
          <MousePointerClick size={16} />
          <span>
            <strong>Try it.</strong> Double-click any example to interact — the buttons and
            fields work like the real thing.
          </span>
        </span>
      </span>
    </div>
  );
}

/** The prompt "Start Canvas" puts on the clipboard, ready to paste into chat. */
export const START_CANVAS_PROMPT =
  "Let's start designing on this canvas. Design the key screen first, then show it in three different styles " +
  "side by side so I can compare them. Here's what I'm building: ";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // The clipboard API can be blocked inside a frame; fall back to a hidden
    // textarea and the legacy copy command.
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Hands a starter prompt to the user's agent and clears the examples off
 *  the canvas, so they can paste it into chat and begin their own project
 *  right away. It sits in its own frame after the last example, where the
 *  eye lands once the row has been read. The hand-off is the editor's usual
 *  one (clipboard + the blue toast); the button itself does not change.
 *  Without a host (the design lib alone), it copies to the clipboard. */
export function StartCanvasPanel() {
  const actions = useDesignCanvasActions();
  const [busy, setBusy] = useState(false);
  const start = async () => {
    if (busy) return;
    setBusy(true);
    if (!(await actions.handOffPrompt(START_CANVAS_PROMPT))) await copyText(START_CANVAS_PROMPT);
    void actions.clearCanvas();
    setBusy(false);
  };
  return (
    <div className={styles.tileStartWrap}>
      <span className={styles.tileStartIcon} aria-hidden="true">
        <Plus size={26} strokeWidth={2} />
      </span>
      <span className={styles.tileStartTitle}>Your design goes here</span>
      <span className={styles.tileStartText}>
        Ready to make your own? Click the button below to start!
      </span>
      <button
        type="button"
        className={styles.tileStart}
        onClick={start}
        disabled={busy}
        data-floot-design-action
      >
        <Sparkles size={17} /> Start designing
      </button>
    </div>
  );
}

/* ────────────────────────── The product ──────────────────────────────── */

const PRODUCT = {
  name: "Aria Pulse",
  line: "Smartwatch · 41mm",
  variant: "Obsidian sport band",
  price: 349,
  tax: 27.92,
};
const TOTAL = PRODUCT.price + PRODUCT.tax;
const fmt = (n: number) => `$${n.toFixed(2)}`;

type Tone = "silver" | "stone" | "lilac" | "ember";

/** The smartwatch, drawn: a round all-black case with a domed glass face,
 *  a big clock with the date and a thin activity ring tracing the edge,
 *  a side crown, and a matte sport band with pin holes. Geometry scales
 *  with `size`. */
export function ProductArt({ size = 190 }: { tone?: Tone; size?: number }) {
  return (
    <span
      className={styles.pw}
      style={{ width: size, height: size, ["--size" as string]: `${size}px` } as React.CSSProperties}
      aria-hidden="true"
    >
      <i className={styles.pwShadow} />
      <i className={`${styles.pwBand} ${styles.pwBandTop}`} />
      <i className={`${styles.pwBand} ${styles.pwBandBot}`} />
      <i className={styles.pwCrown} />
      <i className={styles.pwCase}>
        <b className={styles.pwScreen}>
          <em className={styles.pwRing} />
          <em className={styles.pwDate}>Mon 19</em>
          <em className={styles.pwTime}>10:09</em>
          <em className={styles.pwStat}>
            <span className={styles.pwDot} /> 8,204 steps
          </em>
          <em className={styles.pwGlint} />
        </b>
      </i>
    </span>
  );
}

/* ────────────────────────── Shared plumbing ──────────────────────────── */

/** A pay button that actually pays: pressed → processing → placed → reset. */
function usePay() {
  const [phase, setPhase] = useState<"idle" | "paying" | "paid">("idle");
  useEffect(() => {
    if (phase === "idle") return;
    const t = setTimeout(
      () => setPhase(phase === "paying" ? "paid" : "idle"),
      phase === "paying" ? 1100 : 2000,
    );
    return () => clearTimeout(t);
  }, [phase]);
  return { phase, pay: () => setPhase("paying") };
}

function PayLabel({ phase, amount }: { phase: "idle" | "paying" | "paid"; amount: string }) {
  if (phase === "paying")
    return (
      <>
        <span className={styles.spinner} /> Processing
      </>
    );
  if (phase === "paid")
    return (
      <>
        <Check size={16} strokeWidth={2.5} /> Order placed
      </>
    );
  return (
    <>
      Pay {amount} <ArrowRight size={16} />
    </>
  );
}

function Field({
  label,
  placeholder,
  defaultValue,
  half,
}: {
  label: string;
  placeholder: string;
  defaultValue?: string;
  half?: boolean;
}) {
  return (
    <label className={`${styles.field} ${half ? styles.fieldHalf : ""}`}>
      <span className={styles.fieldLabel}>{label}</span>
      <input className={styles.input} placeholder={placeholder} defaultValue={defaultValue} />
    </label>
  );
}

function CardFields() {
  return (
    <>
      <Field label="Email" placeholder="you@example.com" defaultValue="ada@lovelace.co" />
      <Field label="Card number" placeholder="1234 1234 1234 1234" />
      <div className={styles.fieldRow}>
        <Field label="Expiry" placeholder="MM / YY" half />
        <Field label="CVC" placeholder="123" half />
      </div>
    </>
  );
}

function Totals({ className }: { className: string }) {
  return (
    <div className={className}>
      <span>Shipping</span>
      <span>Free</span>
      <span>Tax</span>
      <span>{fmt(PRODUCT.tax)}</span>
      <strong>Total</strong>
      <strong>{fmt(TOTAL)}</strong>
    </div>
  );
}

/* ────────────────────────── The three materials ──────────────────────── */

export type Direction = "glass" | "neu" | "liquid";

export function CheckoutScreen({ direction }: { direction: Direction }) {
  const { phase, pay } = usePay();

  /* Glassmorphism: frosted rectangular panels with a bright edge, over a
     soft pastel glow. */
  if (direction === "glass") {
    return (
      <div className={`${styles.co} ${styles.co_glass}`}>
        <span className={`${styles.wash} ${styles.washA}`} aria-hidden="true" />
        <span className={`${styles.wash} ${styles.washB}`} aria-hidden="true" />
        <span className={`${styles.wash} ${styles.washC}`} aria-hidden="true" />

        <header className={styles.head}>
          <span className={styles.wordmark}>aria</span>
          <span className={`${styles.gmChip}`}>
            <Lock size={11} /> Secure checkout
          </span>
        </header>

        {/* One tall sheet of glass holds the whole checkout. */}
        <div className={`${styles.gm} ${styles.gmSheet}`}>
          <div className={styles.gmHero}>
            <ProductArt tone="ember" size={200} />
            <div className={styles.heroText}>
              <span className={styles.name}>{PRODUCT.name}</span>
              <span className={styles.line}>
                {PRODUCT.line} · {PRODUCT.variant}
              </span>
              <span className={styles.price}>{fmt(PRODUCT.price)}</span>
            </div>
          </div>

          <div className={styles.gmPanel}>
            <div className={styles.gmFields}>
              <CardFields />
            </div>
            <Totals className={styles.totals} />
            <button
              type="button"
              className={`${styles.gmPay} ${phase === "paid" ? styles.paid : ""}`}
              disabled={phase === "paying"}
              onClick={pay}
            >
              <PayLabel phase={phase} amount={fmt(TOTAL)} />
            </button>
          </div>
        </div>

        <span className={styles.foot}>
          <ShieldCheck size={12} /> Encrypted · Free returns
        </span>
      </div>
    );
  }

  /* Neumorphism: one soft surface; controls are pressed into or raised
     out of it by light alone. */
  if (direction === "neu") {
    return (
      <div className={`${styles.co} ${styles.co_neu}`}>
        <header className={styles.head}>
          <span className={styles.wordmark}>aria</span>
          <span className={styles.neuChip}>
            <Lock size={11} /> Secure checkout
          </span>
        </header>

        <div className={styles.neuHero}>
          <span className={styles.neuDisc}>
            <ProductArt tone="ember" size={200} />
          </span>
          <div className={styles.heroText}>
            <span className={styles.name}>{PRODUCT.name}</span>
            <span className={styles.line}>
              {PRODUCT.line} · {PRODUCT.variant}
            </span>
            <span className={styles.price}>{fmt(PRODUCT.price)}</span>
          </div>
        </div>

        <div className={styles.neuFields}>
          <CardFields />
        </div>

        <Totals className={`${styles.totals} ${styles.neuTotals}`} />

        <button
          type="button"
          className={`${styles.neuPay} ${phase === "paid" ? styles.neuPaid : ""}`}
          disabled={phase === "paying"}
          onClick={pay}
        >
          <PayLabel phase={phase} amount={fmt(TOTAL)} />
        </button>

        <span className={styles.foot}>
          <ShieldCheck size={12} /> Encrypted · Free returns
        </span>
      </div>
    );
  }

  /* Liquid Glass: organic surfaces with a chromatic rim that bend the
     colour behind them. */
  return (
    <div className={`${styles.co} ${styles.co_liquid}`}>
      <span className={`${styles.wash} ${styles.washA}`} aria-hidden="true" />
      <span className={`${styles.wash} ${styles.washB}`} aria-hidden="true" />
      <span className={`${styles.wash} ${styles.washC}`} aria-hidden="true" />

      <header className={styles.head}>
        <span className={styles.wordmark}>aria</span>
        <span className={`${styles.lq} ${styles.lqChip}`}>
          <Lock size={11} /> Secure checkout
        </span>
      </header>

      <div className={`${styles.lq} ${styles.lqBlob}`}>
        <span className={`${styles.lq} ${styles.lqDrop}`} aria-hidden="true" />
        <ProductArt tone="ember" size={200} />
        <div className={styles.heroText}>
          <span className={styles.name}>{PRODUCT.name}</span>
          <span className={styles.line}>
            {PRODUCT.line} · {PRODUCT.variant}
          </span>
          <span className={styles.price}>{fmt(PRODUCT.price)}</span>
        </div>
      </div>

      <div className={styles.lqFields}>
        <CardFields />
      </div>

      <Totals className={`${styles.totals} ${styles.lqTotals}`} />

      <button
        type="button"
        className={`${styles.lq} ${styles.lqPay} ${phase === "paid" ? styles.lqPaid : ""}`}
        disabled={phase === "paying"}
        onClick={pay}
      >
        <PayLabel phase={phase} amount={fmt(TOTAL)} />
      </button>

      <span className={styles.foot}>
        <ShieldCheck size={12} /> Encrypted · Free returns
      </span>
    </div>
  );
}
