import React from "react";
import {
  BookOpen,
  Layers,
  Trophy,
  Tag,
  Users,
  Calendar,
  Clock,
  HardDrive,
  Package,
  FileText,
} from "lucide-react";
import {
  ContentMeta,
  CourseBundleMeta,
  CourseMeta,
  DigitalProductMeta,
  LiveTestMeta,
  MockTestMeta,
} from "../endpoints/admin/content-reviews/list_GET.schema";
import styles from "./ContentReviewMetaDisplay.module.css";

const formatDate = (date: Date | null | string): string => {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(date));
};

const formatPrice = (price: string | number): string => {
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (num === 0) return "Free";
  return `₹${num.toLocaleString("en-IN")}`;
};

const formatFileSize = (bytes: string | null): string | null => {
  if (!bytes) return null;
  const b = parseInt(bytes, 10);
  if (isNaN(b)) return null;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

const StatPill: React.FC<{ icon: React.ReactNode; label: string }> = ({
  icon,
  label,
}) => (
  <span className={styles.statPill}>
    <span className={styles.statPillIcon}>{icon}</span>
    {label}
  </span>
);

const MockTestMetaDisplay: React.FC<{ meta: MockTestMeta }> = ({ meta }) => (
  <div className={styles.metaPills}>
    <StatPill icon={<Layers size={11} />} label={`${meta.totalTests} tests`} />
    <StatPill
      icon={<FileText size={11} />}
      label={`${meta.totalQuestions} questions`}
    />
    <StatPill icon={<Tag size={11} />} label={formatPrice(meta.price)} />
    {meta.examName && (
      <StatPill icon={<BookOpen size={11} />} label={meta.examName} />
    )}
  </div>
);

const CourseMetaDisplay: React.FC<{ meta: CourseMeta }> = ({ meta }) => (
  <div className={styles.metaPills}>
    <StatPill
      icon={<Layers size={11} />}
      label={`${meta.sectionsCount} sections`}
    />
    <StatPill
      icon={<BookOpen size={11} />}
      label={`${meta.lessonsCount} lessons`}
    />
    <StatPill icon={<Tag size={11} />} label={formatPrice(meta.price)} />
    <StatPill
      icon={<FileText size={11} />}
      label={meta.level.charAt(0).toUpperCase() + meta.level.slice(1)}
    />
    {meta.category && (
      <StatPill icon={<Package size={11} />} label={meta.category} />
    )}
    {meta.estimatedDurationMinutes != null && (
      <StatPill
        icon={<Clock size={11} />}
        label={`${Math.round(meta.estimatedDurationMinutes / 60)}h`}
      />
    )}
  </div>
);

const DigitalProductMetaDisplay: React.FC<{ meta: DigitalProductMeta }> = ({
  meta,
}) => {
  const size = formatFileSize(meta.fileSizeBytes);
  return (
    <div className={styles.metaPills}>
      {meta.pageCount != null && (
        <StatPill
          icon={<FileText size={11} />}
          label={`${meta.pageCount} pages`}
        />
      )}
      <StatPill icon={<Tag size={11} />} label={formatPrice(meta.price)} />
      {meta.category && (
        <StatPill icon={<Package size={11} />} label={meta.category} />
      )}
      {size && <StatPill icon={<HardDrive size={11} />} label={size} />}
    </div>
  );
};

const CourseBundleMetaDisplay: React.FC<{ meta: CourseBundleMeta }> = ({
  meta,
}) => {
  const discount = meta.discountPercentage
    ? parseFloat(meta.discountPercentage)
    : null;
  return (
    <div className={styles.metaPills}>
      <StatPill
        icon={<Package size={11} />}
        label={`${meta.itemsCount} items`}
      />
      <StatPill icon={<Tag size={11} />} label={formatPrice(meta.price)} />
      {discount && discount > 0 && (
        <StatPill
          icon={<FileText size={11} />}
          label={`was ${formatPrice(meta.originalPrice)} · ${Math.round(discount)}% off`}
        />
      )}
    </div>
  );
};

const LiveTestMetaDisplay: React.FC<{ meta: LiveTestMeta }> = ({ meta }) => (
  <div className={styles.metaPills}>
    <StatPill icon={<Users size={11} />} label={`${meta.maxSeats} seats`} />
    <StatPill
      icon={<Tag size={11} />}
      label={`${formatPrice(meta.price)} entry`}
    />
    {meta.hasPrizes && (
      <StatPill
        icon={<Trophy size={11} />}
        label={`${formatPrice(meta.totalPrizePool)} prizes`}
      />
    )}
    {meta.startTime && (
      <StatPill
        icon={<Calendar size={11} />}
        label={`Starts ${formatDate(meta.startTime)}`}
      />
    )}
    <StatPill
      icon={<Users size={11} />}
      label={`${meta.enrolledCount} enrolled`}
    />
  </div>
);

interface ContentReviewMetaDisplayProps {
  meta: ContentMeta | null;
  className?: string;
}

export const ContentReviewMetaDisplay: React.FC<
  ContentReviewMetaDisplayProps
> = ({ meta }) => {
  if (!meta) return null;
  switch (meta.type) {
    case "mock_test":
      return <MockTestMetaDisplay meta={meta} />;
    case "course":
      return <CourseMetaDisplay meta={meta} />;
    case "digital_product":
      return <DigitalProductMetaDisplay meta={meta} />;
    case "course_bundle":
      return <CourseBundleMetaDisplay meta={meta} />;
    case "live_test":
      return <LiveTestMetaDisplay meta={meta} />;
  }
};