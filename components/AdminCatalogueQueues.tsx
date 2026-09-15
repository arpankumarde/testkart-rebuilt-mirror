import React from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  Trophy,
  ListChecks,
  CircleHelp,
  MonitorPlay,
  FileText,
  Radio,
} from "lucide-react";
import { Skeleton } from "./Skeleton";
import type { ContentQueues } from "../endpoints/admin/catalogue/dashboard_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./AdminCatalogueQueues.module.css";

type Props = {
  queues: ContentQueues | undefined;
  isLoading: boolean;
  className?: string;
};

/** blocker: published but broken. queue: waiting on a decision. ahead: a heads-up. */
type QueueTone = "blocker" | "queue" | "ahead";

type QueueTile = {
  key: string;
  count: number;
  title: string;
  detail: string;
  /** Lands on the list filtered to exactly the rows this tile counted. */
  href: string;
  icon: LucideIcon;
  tone: QueueTone;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const buildTiles = (queues: ContentQueues): QueueTile[] => {
  const all: QueueTile[] = [
    {
      key: "reviewsPending",
      count: queues.reviewsPending,
      title: plural(queues.reviewsPending, "content review", "content reviews"),
      detail:
        queues.reviewsOldestDays > 0
          ? `oldest waiting ${queues.reviewsOldestDays} ${plural(queues.reviewsOldestDays, "day", "days")}`
          : "waiting for a decision",
      href: "/admin/content-reviews?status=pending",
      icon: ClipboardCheck,
      tone: "queue",
    },
    {
      key: "prizesUndistributed",
      count: queues.prizesUndistributed,
      title: plural(queues.prizesUndistributed, "live test", "live tests"),
      detail: "ended with prizes to distribute",
      href: "/admin/live-tests?filter=prizes-pending",
      icon: Trophy,
      tone: "queue",
    },
    {
      key: "emptySeries",
      count: queues.emptySeries,
      title: plural(queues.emptySeries, "published series", "published series"),
      detail: "with no tests inside",
      href: "/admin/test-series?status=published&filter=no-tests",
      icon: ListChecks,
      tone: "blocker",
    },
    {
      key: "testsWithoutQuestions",
      count: queues.testsWithoutQuestions,
      title: plural(queues.testsWithoutQuestions, "test", "tests"),
      detail: "in published series with no questions",
      href: "/admin/test-series?status=published&filter=empty-tests",
      icon: CircleHelp,
      tone: "blocker",
    },
    {
      key: "coursesWithoutLessons",
      count: queues.coursesWithoutLessons,
      title: plural(queues.coursesWithoutLessons, "published course", "published courses"),
      detail: "with no lessons",
      href: "/admin/courses?status=published&filter=no-lessons",
      icon: MonitorPlay,
      tone: "blocker",
    },
    {
      key: "notesWithoutFile",
      count: queues.notesWithoutFile,
      title: plural(queues.notesWithoutFile, "published note", "published notes"),
      detail: "with no file to download",
      href: "/admin/notes?status=published&filter=no-file",
      icon: FileText,
      tone: "blocker",
    },
    {
      key: "liveTestsUpcoming7d",
      count: queues.liveTestsUpcoming7d,
      title: plural(queues.liveTestsUpcoming7d, "live test", "live tests"),
      detail: "starting in the next 7 days",
      href: "/admin/live-tests?status=active&filter=starts-7d",
      icon: Radio,
      tone: "ahead",
    },
  ];

  return all.filter((tile) => tile.count > 0);
};

export const AdminCatalogueQueues = ({ queues, isLoading, className }: Props) => {
  const tiles = queues ? buildTiles(queues) : [];
  const showSkeleton = isLoading && !queues;
  const blockers = tiles.filter((tile) => tile.tone === "blocker").length;

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Content queues">
      <div className={styles.head}>
        <h2 className={styles.title}>Needs attention</h2>
        {tiles.length > 0 && (
          <span className={styles.summary}>
            {blockers > 0
              ? `${adminFormat.count(blockers)} ${plural(blockers, "gap", "gaps")} in published content`
              : `${tiles.length} ${plural(tiles.length, "queue", "queues")}`}
          </span>
        )}
      </div>

      {showSkeleton ? (
        <ul className={styles.tiles} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i}>
              <Skeleton className={styles.skeletonTile} />
            </li>
          ))}
        </ul>
      ) : tiles.length === 0 ? (
        <div className={styles.allClear}>
          <CheckCircle2 size={24} className={styles.allClearIcon} aria-hidden="true" />
          <p className={styles.allClearText}>
            Nothing is waiting for a review and no published item is missing its content.
          </p>
        </div>
      ) : (
        <ul className={styles.tiles}>
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <li key={tile.key} className={`${styles.tile} ${styles[tile.tone]}`}>
                <Link to={tile.href} className={styles.tileLink}>
                  <span className={styles.tileIcon}>
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <span className={styles.tileBody}>
                    <span className={styles.tileHeadline}>
                      <span className={styles.tileCount}>{adminFormat.count(tile.count)}</span>
                      <span className={styles.tileTitle}>{tile.title}</span>
                    </span>
                    <span className={styles.tileDetail}>{tile.detail}</span>
                  </span>
                  <ChevronRight size={16} className={styles.tileChevron} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
