import React from "react";
import { Clock, ExternalLink, FileText, ListChecks } from "lucide-react";
import { Placeholder } from "../helpers/placeholderImages";
import styles from "./TestSeriesCardPreview.module.css";

interface TestSeriesCardPreviewProps {
  title: string;
  examName: string;
  language: string;
  thumbnailUrl: string;
  creatorName: string | null;
  isFree: boolean;
  price: number;
  discountPrice: number | null;
  testCount: number;
  freeTestCount: number;
  questionCount: number;
  durationMinutes: number | null;
  /* The public series page. Pass it only while the series is live. */
  pageUrl?: string;
  className?: string;
}

const formatRupees = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(amount);

const formatCount = (value: number, word: string) =>
  `${new Intl.NumberFormat("en-IN").format(value)} ${word}${value === 1 ? "" : "s"}`;

/*
 * The series card as students meet it in the store, drawn from the editor's
 * unsaved values so it changes as the teacher types. Same order as TestCard -
 * chips, thumbnail, title, creator, counts, price - without the cart controls.
 * The coral stage is TeacherCtaBanner's brand block, fixed in both themes, so
 * the card sitting on it uses fixed light colours too.
 */
export const TestSeriesCardPreview: React.FC<TestSeriesCardPreviewProps> = ({
  title,
  examName,
  language,
  thumbnailUrl,
  creatorName,
  isFree,
  price,
  discountPrice,
  testCount,
  freeTestCount,
  questionCount,
  durationMinutes,
  pageUrl,
  className,
}) => {
  const headingId = React.useId();
  const shownTitle = title.trim();
  const exam = examName.trim();
  const lang = language.trim();
  const listPrice = Number.isFinite(price) ? price : 0;
  const free = isFree || listPrice === 0;
  const salePrice =
    !free && discountPrice !== null && discountPrice > 0 && discountPrice < listPrice ? discountPrice : null;
  const percentOff = salePrice !== null ? Math.round(((listPrice - salePrice) / listPrice) * 100) : 0;

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
        {exam || lang ? (
          <div className={styles.chips}>
            {exam ? <span className={styles.examChip}>{exam}</span> : null}
            {lang ? <span className={styles.languageChip}>{lang}</span> : null}
          </div>
        ) : null}

        <div className={styles.thumbnail}>
          <img
            src={thumbnailUrl || Placeholder.TEST}
            alt=""
            width={600}
            height={338}
            className={styles.thumbnailImage}
          />
        </div>

        <div className={styles.body}>
          <p className={shownTitle ? styles.title : `${styles.title} ${styles.titleEmpty}`}>
            {shownTitle || "Your series title"}
          </p>
          {creatorName ? <p className={styles.creator}>By {creatorName}</p> : null}
          <ul className={styles.facts}>
            <li>
              <ListChecks size={14} aria-hidden="true" />
              {formatCount(testCount, "test")}
              {freeTestCount > 0 ? `, ${freeTestCount} free` : ""}
            </li>
            <li>
              <FileText size={14} aria-hidden="true" />
              {formatCount(questionCount, "question")}
            </li>
            {durationMinutes !== null ? (
              <li>
                <Clock size={14} aria-hidden="true" />
                {durationMinutes > 0 ? `${durationMinutes} min` : "No time limit"}
              </li>
            ) : null}
          </ul>
        </div>

        <div className={styles.priceRow}>
          {free ? (
            <span className={`${styles.price} ${styles.priceFree}`}>Free</span>
          ) : salePrice !== null ? (
            <>
              <span className={styles.price}>{formatRupees(salePrice)}</span>
              <s className={styles.listPrice}>{formatRupees(listPrice)}</s>
              <span className={styles.saving}>{percentOff}% off</span>
            </>
          ) : (
            <span className={styles.price}>{formatRupees(listPrice)}</span>
          )}
        </div>
      </div>
    </section>
  );
};