import React, { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Flame, ListChecks, MonitorPlay, Sparkles, type LucideIcon } from "lucide-react";
import { examNewsPublicKeys, useExamNewsResources } from "../helpers/useExamNewsPublic";
import { itemPriceProps } from "../helpers/homepageItemUtils";
import {
  getExamNewsResources,
  type ExamResource,
  type ExamResourceGroup,
  type ExamResourceKind,
} from "../endpoints/exam-news/resources_GET.schema";
import { Skeleton } from "./Skeleton";
import styles from "./ExamNewsResources.module.css";

const KINDS: Record<ExamResourceKind, { label: string; icon: LucideIcon }> = {
  course: { label: "Course", icon: MonitorPlay },
  test_series: { label: "Test Series", icon: ListChecks },
};
const KIND_ORDER: ExamResourceKind[] = ["course", "test_series"];

const keyOf = (r: ExamResource) => `${r.kind}-${r.id}`;

const ResourceRow: React.FC<{ resource: ExamResource }> = ({ resource }) => {
  const [broken, setBroken] = useState(false);
  const { label, icon: Icon } = KINDS[resource.kind];
  const price = Number.isFinite(resource.price)
    ? itemPriceProps(resource.price, resource.discountPrice, resource.kind === "course" ? resource.couponOffer ?? null : undefined)
    : null;
  return (
    <li>
      <Link to={resource.href} className={styles.row} title={resource.title}>
        {resource.thumbnailUrl && !broken ? (
          <img src={resource.thumbnailUrl} alt="" className={styles.thumb} loading="lazy" onError={() => setBroken(true)} />
        ) : (
          <span className={`${styles.thumb} ${styles.thumbTile} ${styles[`tone_${resource.kind}`]}`} aria-hidden="true">
            <Icon size={12} />
          </span>
        )}
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{resource.title}</span>
          <span className={styles.rowMeta}>
            <span className={`${styles.kindTag} ${styles[`tag_${resource.kind}`]}`}>{label}</span>
            {price && <span className={`${styles.price} ${price.isFree ? styles.free : ""}`}>{price.priceLabel}</span>}
          </span>
        </span>
      </Link>
    </li>
  );
};

/* The section's first resource: the featured teacher's top course, else their top test series. */
const pickFirst = (group: ExamResourceGroup): ExamResource | null => {
  const resources = group.teachers[0]?.resources ?? [];
  for (const kind of KIND_ORDER) {
    const match = resources.find((r) => r.kind === kind);
    if (match) return match;
  }
  return null;
};

const ExamSection: React.FC<{ group: ExamResourceGroup; showName: boolean }> = ({ group, showName }) => {
  const first = pickFirst(group);
  if (!first) return null;
  return (
    <div className={styles.section} data-exam={group.exam.slug}>
      {showName && (
        <h3 className={styles.examName}>
          <Flame size={12} aria-hidden="true" /> {group.exam.name}
        </h3>
      )}
      <ul className={styles.rows}>
        <ResourceRow resource={first} />
      </ul>
    </div>
  );
};

const COLLAPSED_EXAMS = 2;

/*
 * Exam News sidebar card: one course or test series from a verified teacher per exam. On the hub it
 * lists the exams marked Hot on /exams; the first two show and Show more reveals the other Hot exams.
 * On a story or exam listing it shows that exam, and Show more reveals the rest of its resources.
 * Hidden when there is nothing to show.
 */
export const ExamNewsResources: React.FC<{ examSlug?: string }> = ({ examSlug }) => {
  const queryClient = useQueryClient();
  const moreId = useId();
  const { data, isLoading } = useExamNewsResources(examSlug);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setExpanded(false), [examSlug]);

  const groups = (data?.groups ?? []).filter((group) => pickFirst(group));
  const single = data?.source === "exam" ? groups[0] : undefined;
  const all = useExamNewsResources(single?.exam.slug, true, !!single && expanded);

  if (isLoading && !data) {
    return (
      <section className={styles.card} aria-busy="true" aria-label="Loading study resources">
        <Skeleton style={{ height: "1rem", width: "55%" }} />
        <Skeleton style={{ height: "3rem" }} />
      </section>
    );
  }

  if (groups.length === 0) return null;

  let visible: React.ReactNode;
  let more: React.ReactNode;
  let hasMore: boolean;
  let prefetch: (() => void) | undefined;

  if (single) {
    const first = pickFirst(single)!;
    // This exam's own entry in the all-teachers response, matched by id: every verified teacher's
    // courses, then test series, without the one already shown or repeats.
    const own = all.data?.groups.find((g) => g.exam.id === single.exam.id);
    const seen = new Set([keyOf(first)]);
    const rest = KIND_ORDER.flatMap((kind) =>
      (own?.teachers ?? []).flatMap((t) => t.resources.filter((r) => r.kind === kind))
    ).filter((r) => (seen.has(keyOf(r)) ? false : (seen.add(keyOf(r)), true)));
    hasMore = all.data ? rest.length > 0 : single.resourceCount > 1;
    prefetch = () =>
      queryClient.prefetchQuery({
        queryKey: examNewsPublicKeys.resources(single.exam.slug, true),
        queryFn: () => getExamNewsResources({ exam: single.exam.slug, all: true }),
        staleTime: 5 * 60 * 1000,
      });
    visible = <ExamSection group={single} showName={false} />;
    more =
      all.isLoading && !all.data ? (
        <Skeleton style={{ height: "2.25rem", marginTop: "2px" }} />
      ) : all.isError && !all.data ? (
        <p className={styles.note}>
          Could not load more.{" "}
          <button type="button" className={styles.retry} onClick={() => all.refetch()}>
            Try again
          </button>
        </p>
      ) : (
        <ul className={`${styles.rows} ${styles.moreRows}`}>
          {rest.map((resource) => (
            <ResourceRow key={keyOf(resource)} resource={resource} />
          ))}
        </ul>
      );
  } else {
    const extra = groups.slice(COLLAPSED_EXAMS);
    hasMore = extra.length > 0;
    visible = groups.slice(0, COLLAPSED_EXAMS).map((group) => <ExamSection key={group.exam.id} group={group} showName />);
    more = (
      <div className={`${styles.sections} ${styles.moreSections}`}>
        {extra.map((group) => (
          <ExamSection key={group.exam.id} group={group} showName />
        ))}
      </div>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="en-side-resources">
      <h2 id="en-side-resources" className={styles.title}>
        <span className={styles.titleIcon} aria-hidden="true">
          <Sparkles size={12} />
        </span>
        {single ? `Prepare for ${single.exam.name}` : "Prepare for hot exams"}
      </h2>

      <div className={styles.sections}>{visible}</div>

      {hasMore && (
        <div className={styles.moreBlock}>
          <div id={moreId} className={styles.more} data-open={expanded}>
            <div className={styles.moreInner}>{more}</div>
          </div>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={expanded}
            aria-controls={moreId}
            onClick={() => setExpanded((value) => !value)}
            onMouseEnter={prefetch}
            onFocus={prefetch}
          >
            {expanded ? "Show less" : "Show more"}
            {expanded ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />}
          </button>
        </div>
      )}
    </section>
  );
};
