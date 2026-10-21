import { Link } from "react-router-dom";
import { ArrowRight, Library, Users } from "lucide-react";
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

const resourceCount = (teacher: HomepageTeacher) => teacher.testCount + teacher.courseCount + teacher.productCount;

interface HomepageTeacherSpotlightProps {
  teachers: HomepageTeacher[];
  isLoading?: boolean;
}

/**
 * Top 5 teachers from homepage/data popularTeachers (ranked by the last
 * year of sales and enrolments). Teachers with nothing published are skipped,
 * so every card leads to a profile with something to buy. Pine showcase panel
 * shared with HomepageFeaturedCourses; hidden when no teacher qualifies.
 */
export function HomepageTeacherSpotlight({ teachers, isLoading = false }: HomepageTeacherSpotlightProps) {
  const spotlight = teachers.filter((t) => resourceCount(t) > 0).slice(0, SPOTLIGHT_SIZE);
  const showSkeleton = isLoading && spotlight.length === 0;

  if (!showSkeleton && spotlight.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="teacher-spotlight-title">
      <div className={styles.block}>
        <span className={styles.blobPeach} aria-hidden />
        <span className={styles.blobButter} aria-hidden />
        <div className={styles.head}>
          <span className={styles.illustration} aria-hidden>
            <Users size={22} strokeWidth={2} />
            <svg className={styles.sparkle} viewBox="0 0 16 16">
              <path d="M8 1.5c.5 3.2 1.3 4 4.5 4.5-3.2.5-4 1.3-4.5 4.5-.5-3.2-1.3-4-4.5-4.5 3.2-.5 4-1.3 4.5-4.5Z" />
            </svg>
          </span>
          <div className={styles.titleGroup}>
            <h2 id="teacher-spotlight-title" className={styles.title}>
              Top teachers on Testkart
            </h2>
            <svg className={styles.titleUnderline} viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden>
              <path d="M2 6.5C20 2.5 38 8.5 58 5S98 2 118 5.5" />
            </svg>
          </div>
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
  const resources = plural(resourceCount(teacher), "Learning Resource", "Learning Resources");
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
          <VerifiedBadge isVerified={teacher.isVerified} size="sm" className={styles.verified} />
        </span>
        {description && <span className={styles.tagline}>{description}</span>}
        <span className={styles.resources}>
          <Library size={15} aria-hidden className={styles.resourcesIcon} />
          {resources}
        </span>
      </div>

      <span className={styles.cta}>
        View profile
        <span className={styles.ctaArrow} aria-hidden>
          <ArrowRight size={16} />
        </span>
      </span>
    </Link>
  );
}
