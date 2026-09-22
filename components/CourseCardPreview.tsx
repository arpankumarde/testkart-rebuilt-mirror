import React from "react";
import { BarChart3, Clock, ExternalLink, Globe, ListVideo, PlayCircle } from "lucide-react";
import { Placeholder } from "../helpers/placeholderImages";
import { formatCourseMinutes, pluralize } from "../helpers/courseDraft";
import styles from "./CourseCardPreview.module.css";

interface CourseCardPreviewProps {
  title: string;
  category?: string | null;
  language?: string | null;
  /* Omitted on the start form, where the teacher has not picked one yet. */
  level?: string | null;
  thumbnailUrl: string | null;
  hasIntroVideo: boolean;
  creatorName: string | null;
  price: number;
  /* Null before the course exists, so the card does not claim "0 lessons". */
  lessonCount: number | null;
  totalMinutes: number;
  /* The public course page. Pass it only while the course is live. */
  pageUrl?: string;
  className?: string;
}

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const formatRupees = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(amount);

/*
 * The course card as students meet it in the store, drawn from the editor's
 * unsaved values so it changes as the teacher types. Same order as CourseCard -
 * category, cover, title, creator, facts, price - without the cart controls.
 * The coral stage is TeacherCtaBanner's brand block, fixed in both themes, so
 * the card on it uses fixed light colours too (as TestSeriesCardPreview does).
 */
export const CourseCardPreview: React.FC<CourseCardPreviewProps> = ({
  title,
  category,
  language,
  level,
  thumbnailUrl,
  hasIntroVideo,
  creatorName,
  price,
  lessonCount,
  totalMinutes,
  pageUrl,
  className,
}) => {
  const headingId = React.useId();
  const shownTitle = title.trim();
  const shownCategory = category?.trim();
  const shownLanguage = language?.trim();
  const levelLabel = level ? LEVEL_LABELS[level] ?? level : null;
  const listPrice = Number.isFinite(price) && price > 0 ? price : 0;

  return (
    <section className={`${styles.stage} ${className ?? ""}`} aria-labelledby={headingId}>
      <div className={styles.stageHead}>
        <h2 id={headingId} className={styles.stageTitle}>
          What students see
        </h2>
        {pageUrl ? (
          <a href={pageUrl} target="_blank" rel="noopener noreferrer" className={styles.pageLink}>
            View page
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : null}
      </div>

      <div className={styles.card}>
        {shownCategory ? (
          <div className={styles.chips}>
            <span className={styles.categoryChip}>{shownCategory}</span>
          </div>
        ) : null}

        <div className={styles.thumbnail}>
          <img
            src={thumbnailUrl || Placeholder.COURSE}
            alt=""
            width={600}
            height={338}
            className={styles.thumbnailImage}
          />
          {hasIntroVideo ? (
            <span className={styles.videoTag}>
              <PlayCircle size={14} aria-hidden="true" />
              Intro video
            </span>
          ) : null}
        </div>

        <div className={styles.body}>
          <p className={shownTitle ? styles.title : `${styles.title} ${styles.titleEmpty}`}>
            {shownTitle || "Your course title"}
          </p>
          {creatorName ? <p className={styles.creator}>By {creatorName}</p> : null}
          <ul className={styles.facts}>
            {levelLabel ? (
              <li>
                <BarChart3 size={14} aria-hidden="true" />
                {levelLabel}
              </li>
            ) : null}
            {lessonCount !== null ? (
              <li>
                <ListVideo size={14} aria-hidden="true" />
                {pluralize(lessonCount, "lesson")}
              </li>
            ) : null}
            {totalMinutes > 0 ? (
              <li>
                <Clock size={14} aria-hidden="true" />
                {formatCourseMinutes(totalMinutes)}
              </li>
            ) : null}
            {shownLanguage ? (
              <li>
                <Globe size={14} aria-hidden="true" />
                {shownLanguage}
              </li>
            ) : null}
          </ul>
        </div>

        <div className={styles.priceRow}>
          {listPrice > 0 ? (
            <span className={styles.price}>{formatRupees(listPrice)}</span>
          ) : (
            <span className={`${styles.price} ${styles.priceFree}`}>Free</span>
          )}
        </div>
      </div>
    </section>
  );
};
