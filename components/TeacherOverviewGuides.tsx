import React from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { Skeleton } from "./Skeleton";
import { useBlogPostsQuery } from "../helpers/useBlogQuery";
import styles from "./TeacherOverviewGuides.module.css";

type Props = {
  className?: string;
};

// Matches the six rows Best sellers and Recent sales show, so every list card
// on the dashboard comes out the same height.
const GUIDE_COUNT = 6;

// The list endpoint has no sort option and returns newest-first, which for the
// knowledge base surfaces small edits rather than the walkthroughs worth
// recommending. So pull a page and rank here: editorially featured first, then
// most read. Revisit with a real `sort` param on /blog/list if the knowledge
// base ever outgrows one page.
const FETCH_COUNT = 24;

/**
 * The knowledge base, surfaced where a teacher is already deciding what to do
 * next. These are the "how to create and sell X" walkthroughs, so the card
 * sits opposite Recent sales and reinforces the same push as the catalogue
 * card above it.
 */
export const TeacherOverviewGuides = ({ className }: Props) => {
  const { data, isFetching } = useBlogPostsQuery({ type: "knowledge_base", limit: FETCH_COUNT });

  const guides = React.useMemo(() => {
    const posts = data?.posts ?? [];
    return [...posts]
      .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.viewCount - a.viewCount)
      .slice(0, GUIDE_COUNT);
  }, [data]);

  const showSkeleton = isFetching && guides.length === 0;

  return (
    <section className={`${styles.card} ${className ?? ""}`.trim()} aria-label="Recommended guides">
      <div className={styles.head}>
        <h2 className={styles.title}>Recommended guides</h2>
        <Link to="/help" className={styles.link}>
          All guides
        </Link>
      </div>

      {showSkeleton ? (
        <div className={styles.skeletonRows}>
          {Array.from({ length: GUIDE_COUNT }).map((_, i) => (
            <Skeleton key={i} style={{ height: "2.75rem", width: "100%" }} />
          ))}
        </div>
      ) : guides.length === 0 ? (
        <p className={styles.empty}>No guides published yet.</p>
      ) : (
        <ul className={styles.rows}>
          {guides.map((guide) => (
            <li key={guide.id}>
              <Link to={`/help/${guide.slug}`} className={styles.row}>
                <span className={styles.thumb}>
                  {guide.featuredImage ? (
                    <img src={guide.featuredImage} alt="" className={styles.thumbImage} loading="lazy" />
                  ) : (
                    <span className={styles.thumbIcon}>
                      <BookOpen size={18} aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className={styles.body}>
                  <span className={styles.rowTitle} title={guide.title}>
                    {guide.title}
                  </span>
                  <span className={styles.rowMeta}>
                    {guide.categoryName ? `${guide.categoryName} · ` : ""}
                    {guide.readingTimeMinutes} min read
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
