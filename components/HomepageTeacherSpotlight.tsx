import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { HomepageTeacher } from "../endpoints/homepage/data_GET.schema";
import { Avatar, AvatarImage, AvatarFallback } from "./Avatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { Skeleton } from "./Skeleton";
import styles from "./HomepageTeacherSpotlight.module.css";

const SPOTLIGHT_SIZE = 5;

const plural = (count: number, one: string, many: string) =>
  `${count.toLocaleString("en-IN")} ${count === 1 ? one : many}`;

const getInitials = (name: string) => name.trim().substring(0, 2).toUpperCase();

function describeTeacher(teacher: HomepageTeacher): string | null {
  const tagline = teacher.tagline?.trim().replace(/^"(.*)"$/, "$1");
  if (tagline) return tagline;
  const exams = (teacher.targetExams ?? []).filter((exam) => exam && exam !== "Other");
  return exams.length > 0 ? `Teaches ${exams.slice(0, 2).join(", ")}` : null;
}

function describeCatalog(teacher: HomepageTeacher): string {
  return [
    teacher.testCount > 0 ? plural(teacher.testCount, "test series", "test series") : null,
    teacher.courseCount > 0 ? plural(teacher.courseCount, "course", "courses") : null,
    teacher.productCount > 0 ? plural(teacher.productCount, "study note", "study notes") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

interface HomepageTeacherSpotlightProps {
  teachers: HomepageTeacher[];
  isLoading?: boolean;
}

/**
 * Top 5 teachers from homepage/data popularTeachers (ranked by the last
 * year of sales and enrolments). Teachers with nothing published are skipped,
 * so every card leads to a profile with something to buy. Coral block in
 * TeacherCtaBanner's colours; hidden when no teacher qualifies.
 */
export function HomepageTeacherSpotlight({ teachers, isLoading = false }: HomepageTeacherSpotlightProps) {
  const spotlight = teachers
    .filter((t) => t.testCount + t.courseCount + t.productCount > 0)
    .slice(0, SPOTLIGHT_SIZE);
  const showSkeleton = isLoading && spotlight.length === 0;

  if (!showSkeleton && spotlight.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="teacher-spotlight-title">
      <div className={styles.block}>
        <div className={styles.head}>
          <span className={styles.chip}>Teacher spotlight</span>
          <h2 id="teacher-spotlight-title" className={styles.title}>
            Top teachers on Testkart
          </h2>
        </div>

        <ol className={styles.list} aria-busy={showSkeleton || undefined}>
          {showSkeleton
            ? Array.from({ length: SPOTLIGHT_SIZE }).map((_, i) => (
                <li key={i} className={styles.listItem} aria-hidden>
                  <div className={styles.card}>
                    <Skeleton className={styles.skeletonAvatar} />
                    <div className={styles.body}>
                      <Skeleton className={styles.skeletonLine} />
                      <Skeleton className={styles.skeletonLineShort} />
                    </div>
                  </div>
                </li>
              ))
            : spotlight.map((teacher, index) => (
                <li key={teacher.id} className={styles.listItem}>
                  <TeacherCard teacher={teacher} rank={index + 1} />
                </li>
              ))}
        </ol>
      </div>
    </section>
  );
}

function TeacherCard({ teacher, rank }: { teacher: HomepageTeacher; rank: number }) {
  const description = describeTeacher(teacher);
  const catalog = describeCatalog(teacher);
  const name = teacher.displayName.trim();

  return (
    <Link to={`/expert/${teacher.slug}`} className={styles.card}>
      <span className={styles.rank} aria-label={`Rank ${rank}`}>
        #{rank}
      </span>

      <Avatar className={styles.avatar}>
        {teacher.avatarUrl && <AvatarImage src={teacher.avatarUrl} alt="" />}
        <AvatarFallback className={styles.avatarFallback}>{getInitials(name)}</AvatarFallback>
      </Avatar>

      <div className={styles.body}>
        <span className={styles.nameRow}>
          <span className={styles.name}>{name}</span>
          <VerifiedBadge isVerified={teacher.isVerified} size="sm" />
        </span>
        {description && <span className={styles.tagline}>{description}</span>}
        <span className={styles.stats}>
          {catalog && <span className={styles.catalog}>{catalog}</span>}
        </span>
      </div>

      <span className={styles.cta}>
        View profile <ArrowRight size={16} aria-hidden />
      </span>
    </Link>
  );
}
