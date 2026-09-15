import { Link, useNavigate } from "react-router-dom";
import { Skeleton } from "./Skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "./Avatar";
import { VerifiedBadge } from "./VerifiedBadge";
import styles from "./HomepageContentSection.module.css";

interface TeacherProductCardProps {
  link: string;
  teacherName: string;
  teacherAvatarUrl: string | null;
  teacherTagline: string | null;
  teacherYearsOfExperience: number | null;
  teacherSlug: string | null;
  teacherIsVerified: boolean;
  productTitle: string;
  stats: string;
  // Thumbnails are DISCONTINUED for study notes / digital products
  // site-wide (product decision) — never pass these two props when
  // rendering a study-notes card, on any page. Only mock tests and courses
  // still show a thumbnail. If thumbnailUrl/placeholderUrl are both
  // omitted, no thumbnail area renders at all — that's the correct call
  // for a study-notes card.
  thumbnailUrl?: string | null;
  placeholderUrl?: string;
  priceLabel?: string;
  isFree?: boolean;
  examName?: string | null;
}

export function TeacherProductCard({
  link,
  teacherName,
  teacherAvatarUrl,
  teacherTagline,
  teacherYearsOfExperience,
  teacherSlug,
  teacherIsVerified,
  productTitle,
  stats,
  thumbnailUrl,
  placeholderUrl,
  priceLabel,
  isFree,
  examName,
}: TeacherProductCardProps) {
  const navigate = useNavigate();

  const handleTeacherClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (teacherSlug) {
      navigate(`/expert/${teacherSlug}`);
    }
  };

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

    // Credentials hidden by design - only show teacher name and exam name

  return (
    <Link to={link} className={styles.productCard}>
      <div className={styles.cardHeader}>
        <div 
          className={styles.teacherInfo} 
          onClick={handleTeacherClick}
          role="button"
          tabIndex={0}
        >
          <Avatar className={styles.avatar}>
            {teacherAvatarUrl && <AvatarImage src={teacherAvatarUrl} alt={teacherName} />}
            <AvatarFallback>{getInitials(teacherName)}</AvatarFallback>
          </Avatar>
          <div className={styles.teacherDetails}>
            <div className={styles.teacherNameWrapper}>
              <span className={styles.teacherName}>{teacherName}</span>
              <VerifiedBadge isVerified={teacherIsVerified} size="sm" />
            </div>
                        {examName && examName !== 'Unspecified' && <span className={styles.examLabel}>Exam: {examName}</span>}
          </div>
        </div>
      </div>
      <div className={styles.cardBody}>
        <h3 className={styles.productTitle}>{productTitle}</h3>
        {(thumbnailUrl || placeholderUrl) && (
          <div className={styles.thumbnailWrapper}>
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="" className={styles.thumbnail} loading="lazy" />
            ) : (
              <img src={placeholderUrl} alt="" className={styles.thumbnail} loading="lazy" />
            )}
          </div>
        )}
        <p className={styles.productStats}>
          <span className={styles.statsText}>{stats}</span>
          {priceLabel && (
            <span className={`${styles.priceTag} ${isFree ? styles.priceTagFree : styles.priceTagPaid}`}>
              {priceLabel}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}

interface HomepageContentSectionProps {
  title: string;
  viewAllLink?: string;
  items: any[];
  renderCard: (item: any, index: number) => React.ReactNode;
  isLoading?: boolean;
}

export function HomepageContentSection({
  title,
  viewAllLink,
  items,
  renderCard,
  isLoading = false,
}: HomepageContentSectionProps) {

  if (!isLoading && (!items || items.length === 0)) {
    return null;
  }

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {viewAllLink && (
          <Link to={viewAllLink} className={styles.viewAllLink}>
            View all &rarr;
          </Link>
        )}
      </div>

      <div className={styles.gridContainer}>
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={`skeleton-${i}`} className={styles.skeletonCard}>
                <div className={styles.cardHeader}>
                  <Skeleton className={styles.skeletonAvatar} />
                  <div className={styles.skeletonTeacherDetails}>
                    <Skeleton className={styles.skeletonTeacherName} />
                    <Skeleton className={styles.skeletonTeacherCredentials} />
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <Skeleton className={styles.skeletonProductTitle} />
                  <Skeleton className={styles.skeletonThumbnail} />
                  <Skeleton className={styles.skeletonProductStats} />
                </div>
              </div>
            ))
          : items.map((item, index) => (
              <div key={index} className={styles.cardWrapper}>
                {renderCard(item, index)}
              </div>
            ))}
      </div>
    </div>
  );
}