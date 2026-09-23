import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, FileText } from "lucide-react";
import { useTeacherPublicProfileQuery } from "../helpers/useTeacherPublicProfile";
import { swmgPromoContent as content } from "../helpers/swmgPromoContent";
import { formatItemPrice } from "../helpers/homepageItemUtils";
import { Placeholder } from "../helpers/placeholderImages";
import { Skeleton } from "./Skeleton";
import styles from "./HomepageUgcNetSpotlight.module.css";

const MAX_ITEMS = 6;

const NBSP = String.fromCharCode(160);

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

type SpotlightItem = {
  key: string;
  kind: string;
  title: string;
  link: string;
  meta: string | null;
  priceLabel: string;
  isFree: boolean;
  thumbnailUrl: string | null;
  notesCover?: { pageCount: number | null; language: string | null };
};

const joinMeta = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ") || null;

/**
 * UGC NET spotlight on Dr. Mukesh Goyal (teacher 15752): his profile on a coral
 * brand band above his published Testkart items, read from the same public
 * profile query as his promo pages (prefetched in pages/_index.prefetch.ts).
 * Hidden when he has nothing published.
 */
export function HomepageUgcNetSpotlight() {
  const { data, isFetching } = useTeacherPublicProfileQuery(content.teacherSlug);

  const items = useMemo((): SpotlightItem[] => {
    if (!data) return [];
    const { courses, tests, liveTests, products } = data;
    return [
      ...courses.map((course) => ({
        key: `course-${course.id}`,
        kind: "Course",
        title: course.title,
        link: `/course/${course.slug}`,
        meta: joinMeta([course.language, course.level ? LEVEL_LABEL[course.level] : null]),
        priceLabel: formatItemPrice(course.price, course.discountPrice),
        isFree: course.price === 0,
        thumbnailUrl: course.thumbnailImageUrl ?? Placeholder.COURSE,
      })),
      ...tests.map((test) => ({
        key: `test-${test.id}`,
        kind: "Test series",
        title: test.title,
        link: `/mock-test/${test.slug}`,
        meta: test.examName ?? null,
        priceLabel: formatItemPrice(test.price, test.discountPrice),
        isFree: (test.discountPrice ?? test.price) === 0,
        thumbnailUrl: test.thumbnailUrl ?? Placeholder.TEST,
      })),
      ...liveTests.map((liveTest) => ({
        key: `live-${liveTest.id}`,
        kind: "Live test",
        title: liveTest.title,
        link: `/mock-test/live/${liveTest.id}`,
        meta: liveTest.examName ?? null,
        priceLabel: formatItemPrice(liveTest.price),
        isFree: liveTest.price === 0,
        thumbnailUrl: liveTest.thumbnailUrl ?? Placeholder.LIVE,
      })),
      ...products.map((product) => ({
        key: `product-${product.id}`,
        kind: "Study notes",
        title: product.title,
        link: `/study-notes/${product.slug}`,
        meta: product.fileCount ? `${product.fileCount} ${product.fileCount === 1 ? "file" : "files"}` : null,
        priceLabel: formatItemPrice(product.price),
        isFree: product.price === 0,
        thumbnailUrl: null,
        notesCover: { pageCount: product.pageCount ?? null, language: product.language ?? null },
      })),
    ].slice(0, MAX_ITEMS);
  }, [data]);

  const isLoading = !data && isFetching;
  if (!isLoading && items.length === 0) return null;

  const profileLink = `/expert/${content.teacherSlug}`;

  return (
    <section className={styles.section} aria-labelledby="ugc-net-spotlight-title">
      <div className={styles.block}>
        <div className={styles.profile}>
          <span className={styles.chip}>UGC NET spotlight</span>

          <div className={styles.identity}>
            <img
              src={content.portrait.src600}
              width={content.portrait.width}
              height={content.portrait.height}
              alt={`${content.name}, UGC NET educator`}
              loading="lazy"
              decoding="async"
              className={styles.portrait}
            />
            <div className={styles.nameBlock}>
              <h2 id="ugc-net-spotlight-title" className={styles.title}>
                {content.name.replace(/^Dr\. /, `Dr.${NBSP}`)}
              </h2>
              <p className={styles.academy}>{content.academy}</p>
            </div>
          </div>

          <p className={styles.lede}>
            JRF and Ph.D. in Environmental Science, teaching UGC NET Paper 1 and Environmental Science for over 10
            years. Study his complete courses and notes on Testkart.
          </p>

          <dl className={styles.credentials}>
            {content.credentials.map((item) => (
              <div key={item.label} className={styles.credential}>
                <dt className={styles.credentialLabel}>{item.label}</dt>
                <dd className={styles.credentialValue}>{item.value}</dd>
              </div>
            ))}
          </dl>

          <div className={styles.actions}>
            <Link to={profileLink} className={styles.action}>
              View profile
            </Link>
          </div>
        </div>

        <div className={styles.catalog}>
          <div className={styles.catalogHead}>
            <h3 className={styles.catalogTitle}>His UGC NET courses and notes</h3>
            <Link to={profileLink} className={styles.viewAllLink}>
              View all
            </Link>
          </div>

          <ul className={styles.list} aria-busy={isLoading || undefined}>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <li key={i} className={styles.listItem} aria-hidden>
                    <div className={styles.row}>
                      <Skeleton className={styles.skeletonThumb} />
                      <div className={styles.rowBody}>
                        <Skeleton className={styles.skeletonLine} />
                        <Skeleton className={styles.skeletonLineShort} />
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
      {item.thumbnailUrl ? (
        <img src={item.thumbnailUrl} alt="" loading="lazy" decoding="async" className={styles.thumb} />
      ) : (
        <NotesCover cover={item.notesCover} />
      )}

      <div className={styles.rowBody}>
        <span className={styles.kind}>{item.kind}</span>
        <span className={styles.rowTitle}>{item.title}</span>
        <span className={styles.rowFooter}>
          {item.meta && <span className={styles.meta}>{item.meta}</span>}
          <span className={item.isFree ? styles.priceFree : styles.price}>{item.priceLabel}</span>
        </span>
      </div>

      <ChevronRight size={18} aria-hidden className={styles.chevron} />
    </Link>
  );
}

/**
 * Study notes have no thumbnails (discontinued site-wide), so their slot shows
 * a typographic cover: page count, language and a document mark on brand ink.
 */
function NotesCover({ cover }: { cover?: SpotlightItem["notesCover"] }) {
  const pageCount = cover?.pageCount ?? null;
  const language = cover?.language?.trim() || null;

  return (
    <span className={styles.cover}>
      {language && <span className={styles.coverChip}>{language}</span>}
      {pageCount ? (
        <span className={styles.coverCount}>
          <span className={styles.coverNumber}>{pageCount.toLocaleString("en-IN")}</span>
          <span className={styles.coverUnit}>pages</span>
        </span>
      ) : (
        <span className={styles.coverCount}>
          <span className={styles.coverUnit}>Study notes</span>
        </span>
      )}
      <FileText aria-hidden strokeWidth={1.5} className={styles.coverMark} />
    </span>
  );
}
