import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Star } from "lucide-react";
import type { ItemPriceProps } from "../helpers/homepageItemUtils";
import { formatStatCount } from "../helpers/teacherProfileStats";
import { VerifiedBadge } from "./VerifiedBadge";
import styles from "./ExpertResourceCard.module.css";

export type ExpertResourceKind = "course" | "test" | "live" | "notes" | "bundle";

interface ExpertResourceCardProps {
  to: string;
  kind: ExpertResourceKind;
  title: string;
  teacherName: string;
  teacherAvatarUrl: string | null;
  teacherIsVerified: boolean;
  examName?: string | null;
  /** Ignored for study notes, which carry no thumbnail by product decision. */
  thumbnailUrl?: string | null;
  placeholderUrl?: string;
  /** Shown only when there are reviews behind it. */
  rating?: number | null;
  ratingsCount?: number;
  /** One short purchase-relevant fact, e.g. "24 tests" or "Upcoming". */
  detail?: string | null;
  /** What a bundle saves over buying its items separately. */
  savePercent?: number | null;
  price: ItemPriceProps;
}

const initialsOf = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "T";
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
};

/**
 * A resource card for the public expert profile only. The site-wide
 * TeacherProductCard is left alone; this one drops enrolment, page and file
 * counts, and shows a fact only when real data backs it. The educator row is
 * plain text: the card already sits on that educator's own page.
 */
export const ExpertResourceCard: React.FC<ExpertResourceCardProps> = ({
  to,
  kind,
  title,
  teacherName,
  teacherAvatarUrl,
  teacherIsVerified,
  examName,
  thumbnailUrl,
  placeholderUrl,
  rating,
  ratingsCount = 0,
  detail,
  savePercent,
  price,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const isNotes = kind === "notes";
  const imageSrc = isNotes ? null : thumbnailUrl && !imageFailed ? thumbnailUrl : placeholderUrl;
  const exam = examName?.trim();
  const showExam = !!exam && exam !== "Unspecified";

  const meta: React.ReactNode[] = [];
  if (rating != null && rating > 0 && ratingsCount > 0) {
    meta.push(
      <span key="rating" className={styles.rating}>
        <Star size={13} aria-hidden="true" className={styles.star} />
        {rating.toFixed(1)}
        <span className={styles.ratingCount}>({formatStatCount(ratingsCount)})</span>
      </span>
    );
  }
  if (detail) meta.push(<span key="detail">{detail}</span>);
  if (savePercent != null && savePercent > 0) {
    meta.push(
      <span key="save" className={styles.save}>
        Save {savePercent}%
      </span>
    );
  }

  const heading = <h4 className={styles.title}>{title}</h4>;

  return (
    <Link to={to} className={`${styles.card} ${isNotes ? styles.notes : ""}`}>
      <div className={styles.educator}>
        <span className={styles.avatar} aria-hidden="true">
          {teacherAvatarUrl ? <img src={teacherAvatarUrl} alt="" loading="lazy" /> : initialsOf(teacherName)}
        </span>
        <span className={styles.educatorText}>
          <span className={styles.educatorName}>
            <span className={styles.educatorNameText}>{teacherName}</span>
            <VerifiedBadge isVerified={teacherIsVerified} size="sm" />
          </span>
          {showExam && <span className={styles.exam}>{exam}</span>}
        </span>
      </div>

      {isNotes ? (
        <div className={styles.notesHead}>
          <span className={styles.docIcon} aria-hidden="true">
            <FileText size={16} />
          </span>
          {heading}
        </div>
      ) : (
        heading
      )}

      {imageSrc && (
        <div className={styles.media}>
          <img src={imageSrc} alt="" loading="lazy" onError={() => setImageFailed(true)} />
        </div>
      )}

      <div className={styles.footer}>
        {meta.length > 0 && (
          <span className={styles.meta}>
            {meta.map((node, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <span className={styles.dot} aria-hidden="true">
                    ·
                  </span>
                )}
                {node}
              </React.Fragment>
            ))}
          </span>
        )}
        <span className={styles.price}>
          {price.originalPriceLabel && <s className={styles.originalPrice}>{price.originalPriceLabel}</s>}
          <span className={price.isFree ? styles.priceFree : styles.priceValue}>{price.priceLabel}</span>
          {price.offerLabel && <span className={`${styles.save} ${styles.offerBadge}`}>{price.offerLabel}</span>}
        </span>
      </div>
    </Link>
  );
};