import React from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ChevronRight,
  CheckCircle2,
  MessageCircle,
  FileEdit,
  Search,
  ImageOff,
  Tags,
  HelpCircle,
  UploadCloud,
  CalendarClock,
  MailWarning,
} from "lucide-react";
import { Skeleton } from "./Skeleton";
import {
  CONTENT_STALE_DAYS,
  type ArticleQueueCounts,
  type ArticleSurface,
  type SiteContentQueues,
} from "../endpoints/admin/content/dashboard_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import { ARTICLE_TABS } from "../helpers/adminContentSurfaces";
import styles from "./AdminContentQueues.module.css";

type Props = {
  queues: SiteContentQueues | undefined;
  isLoading: boolean;
  className?: string;
};

/** blocker: live and incomplete. queue: waiting on an editor. gap: worth improving. */
type QueueTone = "blocker" | "queue" | "gap";

type QueueTile = {
  key: string;
  /* Several tiles can show one queue split by type; the header counts queues, not tiles. */
  queue: string;
  count: number;
  title: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  tone: QueueTone;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const ARTICLE_TYPES: ArticleSurface[] = ["blog", "knowledge_base"];

const ARTICLE_NOUNS: Record<ArticleSurface, [one: string, many: string]> = {
  blog: ["blog post", "blog posts"],
  knowledge_base: ["help page", "help pages"],
};

type ArticleTileSpec = Omit<QueueTile, "key" | "count" | "title" | "href"> & {
  field: keyof ArticleQueueCounts;
  live: boolean;
  /* status and filter for /admin/blog, matching the dashboard query's condition for this field. */
  params: Record<string, string>;
};

/* One tile per article type, each linking to that type's tab narrowed to the counted rows. */
const articleTiles = (queues: SiteContentQueues, { field, live, params, ...tile }: ArticleTileSpec): QueueTile[] =>
  ARTICLE_TYPES.map((type) => {
    const count = queues.articles[type][field];
    const [one, many] = ARTICLE_NOUNS[type];
    return {
      ...tile,
      key: `${field}-${type}`,
      count,
      title: `${live ? "live " : ""}${plural(count, one, many)}`,
      href: `/admin/blog?${new URLSearchParams({ tab: ARTICLE_TABS[type], ...params }).toString()}`,
    };
  });

const buildTiles = (queues: SiteContentQueues): QueueTile[] => {
  const staleDetail = `untouched for ${CONTENT_STALE_DAYS} days`;
  const all: QueueTile[] = [
    {
      key: "commentsPending",
      queue: "commentsPending",
      count: queues.commentsPending,
      title: plural(queues.commentsPending, "comment", "comments"),
      detail: "waiting to be moderated",
      href: "/admin/blog/comments?status=pending",
      icon: MessageCircle,
      tone: "queue",
    },
    {
      key: "examPagesUnpublishedEdits",
      queue: "examPagesUnpublishedEdits",
      count: queues.examPagesUnpublishedEdits,
      title: plural(queues.examPagesUnpublishedEdits, "exam page", "exam pages"),
      detail: "edited but not republished",
      href: "/admin/exam-content?filter=unpublished-edits",
      icon: UploadCloud,
      tone: "queue",
    },
    ...articleTiles(queues, {
      field: "drafts",
      queue: "drafts",
      live: false,
      detail: "still in draft",
      params: { status: "draft" },
      icon: FileEdit,
      tone: "queue",
    }),
    ...articleTiles(queues, {
      field: "missingSeo",
      queue: "missingSeo",
      live: true,
      detail: "missing an SEO title or description",
      params: { status: "published", filter: "missing-seo" },
      icon: Search,
      tone: "blocker",
    }),
    {
      key: "examPagesMissingSeo",
      queue: "examPagesMissingSeo",
      count: queues.examPagesMissingSeo,
      title: plural(queues.examPagesMissingSeo, "live exam page", "live exam pages"),
      detail: "missing an SEO title or description",
      href: "/admin/exam-content?filter=missing-seo",
      icon: Search,
      tone: "blocker",
    },
    ...articleTiles(queues, {
      field: "missingSocialImage",
      queue: "missingSocialImage",
      live: true,
      detail: "with no social share image",
      params: { status: "published", filter: "missing-og-image" },
      icon: ImageOff,
      tone: "gap",
    }),
    {
      key: "examPagesMissingFaq",
      queue: "examPagesMissingFaq",
      count: queues.examPagesMissingFaq,
      title: plural(queues.examPagesMissingFaq, "live exam page", "live exam pages"),
      detail: "with no FAQ block",
      href: "/admin/exam-content?filter=missing-faq",
      icon: HelpCircle,
      tone: "gap",
    },
    ...articleTiles(queues, {
      field: "uncategorised",
      queue: "uncategorised",
      live: false,
      detail: "with no category",
      params: { filter: "uncategorised" },
      icon: Tags,
      tone: "gap",
    }),
    ...articleTiles(queues, {
      field: "stale",
      queue: "stalePages",
      live: true,
      detail: staleDetail,
      params: { status: "published", filter: "stale" },
      icon: CalendarClock,
      tone: "gap",
    }),
    {
      key: "staleStaticPages",
      queue: "stalePages",
      count: queues.staleStaticPages,
      title: plural(queues.staleStaticPages, "static page", "static pages"),
      detail: staleDetail,
      href: "/admin/static-pages?filter=stale",
      icon: CalendarClock,
      tone: "gap",
    },
    {
      key: "inactiveTemplates",
      queue: "inactiveTemplates",
      count: queues.inactiveTemplates,
      title: plural(queues.inactiveTemplates, "email template", "email templates"),
      detail: "switched off",
      href: "/admin/email-templates?filter=inactive",
      icon: MailWarning,
      tone: "gap",
    },
  ];

  return all.filter((tile) => tile.count > 0);
};

const countQueues = (tiles: QueueTile[]) => new Set(tiles.map((tile) => tile.queue)).size;

export const AdminContentQueues = ({ queues, isLoading, className }: Props) => {
  const tiles = queues ? buildTiles(queues) : [];
  const showSkeleton = isLoading && !queues;
  const queueCount = countQueues(tiles);
  const blockers = countQueues(tiles.filter((tile) => tile.tone === "blocker"));

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Content queues">
      <div className={styles.head}>
        <h2 className={styles.title}>Needs attention</h2>
        {tiles.length > 0 && (
          <span className={styles.summary}>
            {blockers > 0
              ? `${adminFormat.count(blockers)} ${plural(blockers, "queue", "queues")} affecting live pages`
              : `${queueCount} ${plural(queueCount, "queue", "queues")}`}
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
            Nothing is awaiting moderation and every live page has its metadata filled in.
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
