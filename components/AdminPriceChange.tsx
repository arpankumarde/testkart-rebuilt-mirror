import React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import {
  formatPercent,
  formatPriceDelta,
  priceChangePercent,
  priceMovement,
  PRICE_MOVEMENT_LABELS,
} from "../helpers/productPriceHistory";
import styles from "./AdminPriceChange.module.css";

/* Free to paid and paid to free are named outright; other moves show their percentage. */
export const PriceMovementFlag: React.FC<{ previous: number; next: number; className?: string }> = ({
  previous,
  next,
  className,
}) => {
  const movement = priceMovement(previous, next);
  if (movement !== "free_to_paid" && movement !== "paid_to_free") return null;
  return (
    <span className={`${styles.flag} ${movement === "free_to_paid" ? styles.flagUp : styles.flagDown} ${className ?? ""}`}>
      {PRICE_MOVEMENT_LABELS[movement]}
    </span>
  );
};

interface PriceDeltaProps {
  previous: number;
  next: number;
  /* When the selling price held but the list price moved. */
  previousList?: number | null;
  nextList?: number | null;
  layout?: "stack" | "inline";
}

/* The amount and direction of a change: green up, red-orange down, muted when only the list price moved. */
export const PriceDelta: React.FC<PriceDeltaProps> = ({ previous, next, previousList, nextList, layout = "stack" }) => {
  const movement = priceMovement(previous, next);
  if (movement === "list_only") {
    const listMoved = previousList !== null && previousList !== undefined && nextList !== null && nextList !== undefined;
    return (
      <span className={`${styles.delta} ${styles[layout]}`}>
        <span className={styles.flat}>No change</span>
        <span className={styles.note}>
          {listMoved ? `List ${formatPriceDelta(previousList, nextList)}` : "List price only"}
        </span>
      </span>
    );
  }
  const up = next > previous;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const percent = formatPercent(priceChangePercent(previous, next));
  return (
    <span className={`${styles.delta} ${styles[layout]}`}>
      <span className={`${styles.amount} ${up ? styles.up : styles.down}`}>
        <Icon aria-hidden="true" />
        {formatPriceDelta(previous, next)}
        <span className={styles.srOnly}>{up ? " increase" : " decrease"}</span>
      </span>
      {movement === "free_to_paid" || movement === "paid_to_free" ? (
        <PriceMovementFlag previous={previous} next={next} />
      ) : (
        percent && <span className={styles.note}>{percent}</span>
      )}
    </span>
  );
};