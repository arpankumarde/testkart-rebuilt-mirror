import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Award, BookOpen, CalendarCheck, GraduationCap, Tag, Users, type LucideIcon } from "lucide-react";
import { useTeacherPublicProfileQuery } from "../helpers/useTeacherPublicProfile";
import { swmgPromoContent as content } from "../helpers/swmgPromoContent";
import { itemPriceProps, type ItemPriceProps } from "../helpers/homepageItemUtils";
import { Placeholder } from "../helpers/placeholderImages";
import { Skeleton } from "./Skeleton";
import styles from "./HomepageUgcNetSpotlight.module.css";

const MAX_ITEMS = 8;

const NBSP = String.fromCharCode(160);

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

// Keyed by credential value in swmgPromoContent; a credential without an entry renders without an icon.
const CREDENTIAL_ICON: Record<string, LucideIcon> = {
  "JRF": Award,
  "Ph.D.": GraduationCap,
  "10+ years": CalendarCheck,
  "120K+": Users,
};

type SpotlightItem = ItemPriceProps & {
  key: string;
  kind: string;
  title: string;
  link: string;
  meta: string | null;
  thumbnailUrl: string;
};

const joinMeta = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ") || null;

/**
 * UGC NET spotlight on Dr. Mukesh Goyal (teacher 15752): his profile and
 * credentials on an ivory panel above his published Testkart courses, read from
 * the same public profile query as his promo pages (prefetched in
 * pages/_index.prefetch.ts). Only courses are listed; his test series, live
 * tests, study notes and bundles stay on his profile. Hidden when he has no
 * published course.
 */
export function HomepageUgcNetSpotlight() {
  const { data, isFetching } = useTeacherPublicProfileQuery(content.teacherSlug);

  const items = useMemo((): SpotlightItem[] => {
    if (!data) return [];
    return data.courses.slice(0, MAX_ITEMS).map((course) => ({
      key: `course-${course.id}`,
      kind: "Course",
      title: course.title,
      link: `/course/${course.slug}`,
      meta: joinMeta([course.language, course.level ? LEVEL_LABEL[course.level] : null]),
      ...itemPriceProps(course.price, course.discountPrice),
      thumbnailUrl: course.thumbnailImageUrl ?? Placeholder.COURSE,
    }));
  }, [data]);

  const isLoading = !data && isFetching;
  if (!isLoading && items.length === 0) return null;

  const profileLink = `/expert/${content.teacherSlug}`;

  return (
    <section className={styles.section} aria-labelledby="ugc-net-spotlight-title">
      <div className={styles.block}>
        <div className={styles.profile}>
          <div className={styles.profileMain}>
            <span className={styles.chip}>
              <BookOpen size={12} strokeWidth={2.25} aria-hidden />
              UGC NET spotlight
            </span>

            <div className={styles.identity}>
              <span className={styles.portraitWrap}>
                <img
                  src={content.portrait.src600}
                  width={content.portrait.width}
                  height={content.portrait.height}
                  alt={`${content.name}, UGC NET educator`}
                  loading="lazy"
                  decoding="async"
                  className={styles.portrait}
                />
              </span>
              <div className={styles.nameBlock}>
                <h2 id="ugc-net-spotlight-title" className={styles.title}>
                  {content.name.replace(/^Dr\. /, `Dr.${NBSP}`)}
                </h2>
                <svg className={styles.nameUnderline} viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden>
                  <path d="M2 6.5C20 2.5 38 8.5 58 5S98 2 118 5.5" />
                </svg>
                <p className={styles.academy}>{content.academy}</p>
              </div>
            </div>

            <p className={styles.lede}>
              JRF and Ph.D. in Environmental Science, teaching UGC NET Paper 1 and Environmental Science for over 10
              years. Study his complete courses and notes on Testkart.
            </p>

            <div className={styles.actions}>
              <Link to={profileLink} className={styles.action}>
                View profile
                <ArrowRight size={16} aria-hidden className={styles.actionArrow} />
              </Link>
            </div>
          </div>

          <dl className={styles.credentials}>
            {content.credentials.map((item) => {
              const Icon = CREDENTIAL_ICON[item.value];
              return (
                <div key={item.label} className={styles.credential}>
                  <dt className={styles.credentialLabel}>{item.label}</dt>
                  <dd className={styles.credentialValue}>
                    {Icon && (
                      <span className={styles.credentialIcon} aria-hidden>
                        <Icon size={16} strokeWidth={2} />
                      </span>
                    )}
                    {item.value}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>

        <div className={styles.catalog}>
          <div className={styles.catalogHead}>
            <h3 className={styles.catalogTitle}>His UGC NET courses</h3>
            <Link to={profileLink} className={styles.viewAllLink}>
              View all
            </Link>
          </div>

          <ul className={styles.list} aria-busy={isLoading || undefined}>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <li key={i} className={styles.listItem} aria-hidden>
                    <div className={styles.row}>
                      <span className={styles.thumbFrame}>
                        <Skeleton className={styles.skeletonThumb} />
                      </span>
                      <div className={styles.rowBody}>
                        <Skeleton className={styles.skeletonLine} />
                        <Skeleton className={styles.skeletonLineShort} />
                        <Skeleton className={styles.skeletonPanel} />
                      </div>
                    </div>
                  </li>
                ))
              : items.map((item) => (
                  <li key={item.key} className={styles.listItem}>
                    <SpotlightRow item={item} />
                  </li>
                ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function SpotlightRow({ item }: { item: SpotlightItem }) {
  return (
    <Link to={item.link} className={styles.row}>
      <span className={styles.thumbFrame}>
        <img src={item.thumbnailUrl} alt="" loading="lazy" decoding="async" className={styles.thumb} />
      </span>

      <div className={styles.rowBody}>
        <span className={styles.rowInfo}>
          <span className={styles.kind}>{item.kind}</span>
          <span className={styles.rowTitle}>{item.title}</span>
          {item.meta && (
            <span className={styles.meta}>
              <BookOpen size={14} aria-hidden className={styles.metaIcon} />
              {item.meta}
            </span>
          )}
        </span>

        <span className={styles.pricePanel}>
          <svg className={styles.priceDoodle} viewBox="0 0 20 14" aria-hidden>
            <path d="M4 11.5 8 3M12.5 12.5l3-6.5" />
          </svg>
          <span className={styles.priceLabel}>
            <Tag size={14} aria-hidden />
            Price
          </span>
          <span className={styles.priceGroup}>
            {item.originalPriceLabel && <s className={styles.originalPrice}>{item.originalPriceLabel}</s>}
            <span className={item.isFree ? styles.priceFree : styles.price}>{item.priceLabel}</span>
          </span>
        </span>
      </div>
    </Link>
  );
}
