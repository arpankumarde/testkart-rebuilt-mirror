import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { TeacherAttentionCounts, TeacherStageItem } from "../endpoints/teacher/dashboard/overview_GET.schema";
import { teacherAttention } from "../helpers/teacherAttention";
import { teacherContentEditPath } from "../helpers/teacherContentKinds";
import { TeacherKindTile } from "./TeacherKindTile";
import styles from "./TeacherOverviewNeedsYou.module.css";

const REVIEW_TILE_KEYS = new Set([
  "reviewsTests",
  "reviewsCourses",
  "reviewsProducts",
  "reviewsBundles",
  "reviewsLiveTests",
]);

/* The few words after the count, in place of each queue's longer detail line. */
const SHORT_STATUS: Record<string, string> = {
  withdrawals: "processing",
  support: "new reply",
  reviewsTests: "in review",
  reviewsCourses: "in review",
  reviewsProducts: "in review",
  reviewsBundles: "in review",
  reviewsLiveTests: "in review",
  prizes: "prizes to give",
  liveSoon: "this week",
  subscription: "expiring",
};

type Props = {
  attention: TeacherAttentionCounts;
  availableBalance: number;
  rejected: TeacherStageItem[];
  /** Items the stage panel already leads with, so they are not listed twice. */
  skipFirstRejected?: boolean;
  hideReviewCounts?: boolean;
  /** Leaves out the bank account row; the Overview does not ask for bank details for now. */
  hideBank?: boolean;
};

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Things waiting on the teacher, one line each; renders nothing when there are none. */
export const TeacherOverviewNeedsYou = ({
  attention,
  availableBalance,
  rejected,
  skipFirstRejected = false,
  hideReviewCounts = false,
  hideBank = false,
}: Props) => {
  const sentBack = (skipFirstRejected ? rejected.slice(1) : rejected).slice(0, 3);
  const tiles = teacherAttention
    .tiles(attention, availableBalance)
    .filter((tile) => !(hideReviewCounts && REVIEW_TILE_KEYS.has(tile.key)))
    .filter((tile) => !(hideBank && tile.key === "bank"));

  if (sentBack.length === 0 && tiles.length === 0) return null;

  return (
    <section className={styles.card} aria-labelledby="teacher-needs-you">
      <h2 id="teacher-needs-you" className={styles.title}>
        To do
      </h2>
      <ul className={styles.list}>
        {sentBack.map((item) => (
          <li key={`${item.kind}-${item.id}`}>
            <Link to={teacherContentEditPath(item.kind, item.id)} className={styles.row}>
              <TeacherKindTile kind={item.kind} size="sm" />
              <span className={styles.rowTitle}>{item.title}</span>
              <span className={`${styles.status} ${styles.statusFix}`}>Fix</span>
              <ChevronRight className={styles.chevron} aria-hidden="true" />
            </Link>
          </li>
        ))}
        {tiles.map((tile) => (
          <li key={tile.key}>
            <Link to={tile.href} className={styles.row}>
              <span className={styles.icon} aria-hidden="true">
                <tile.icon size={16} />
              </span>
              <span className={styles.rowTitle}>
                {tile.key === "bank" ? sentence(tile.title) : `${tile.count} ${tile.title}`}
              </span>
              {SHORT_STATUS[tile.key] && <span className={styles.status}>{SHORT_STATUS[tile.key]}</span>}
              <ChevronRight className={styles.chevron} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
