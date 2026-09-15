import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { useNewsListQuery } from "../helpers/useNewsQuery";
import { SEOHead } from "../components/SEOHead";
import { Skeleton } from "../components/Skeleton";
import { Newspaper, Calendar, ArrowRight, ChevronRight } from "lucide-react";
import styles from "./news-and-events.module.css";

const SITE_ORIGIN = "https://testkart.in";
const CANONICAL_URL = `${SITE_ORIGIN}/news-and-events`;
const PAGE_TITLE = "News & Events";
const PAGE_DESCRIPTION =
  "Press coverage, announcements and events featuring Testkart - the marketplace where teachers sell mock tests, courses and study material.";

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));

const NewsAndEventsPage: React.FC = () => {
  const { data, isFetching, isError, error } = useNewsListQuery();

  return (
    <>
      <SEOHead
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        url={CANONICAL_URL}
        image={data?.items[0]?.imageUrl}
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${PAGE_TITLE} | Testkart`,
            description: PAGE_DESCRIPTION,
            url: CANONICAL_URL,
            mainEntity: {
              "@type": "ItemList",
              itemListOrder: "https://schema.org/ItemListOrderDescending",
              numberOfItems: data?.items.length ?? 0,
              itemListElement: (data?.items ?? []).map((item, index) => ({
                "@type": "ListItem",
                position: index + 1,
                url: `${SITE_ORIGIN}/news-and-events/${item.slug}`,
                name: item.title,
              })),
            },
          })}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
              { "@type": "ListItem", position: 2, name: PAGE_TITLE, item: CANONICAL_URL },
            ],
          })}
        </script>
      </Helmet>

      <div className={styles.heroSection}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>News &amp; Events</h1>
          <p className={styles.heroSubtitle}>
            Where Testkart has been featured, and what we have been up to.
          </p>
        </div>
      </div>

      <main className={styles.mainContainer}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <ChevronRight size={16} />
          <span className={styles.current}>News &amp; Events</span>
        </nav>

        {isFetching && !data ? (
          <div className={styles.list}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.skeletonCard}>
                <Skeleton className={styles.skeletonImage} />
                <div className={styles.skeletonBody}>
                  <Skeleton style={{ width: "30%", height: "1rem" }} />
                  <Skeleton style={{ width: "85%", height: "1.75rem" }} />
                  <Skeleton style={{ width: "60%", height: "1rem" }} />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className={styles.emptyState}>
            <Newspaper size={48} className={styles.emptyIcon} />
            <h2>Failed to load coverage</h2>
            <p>{error instanceof Error ? error.message : "Please try again later."}</p>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className={styles.emptyState}>
            <Newspaper size={48} className={styles.emptyIcon} />
            <h2>Nothing here yet</h2>
            <p>Press coverage and event announcements will show up on this page.</p>
          </div>
        ) : (
          <div className={styles.list}>
            {data.items.map((item) => (
              <Link
                key={item.id}
                to={`/news-and-events/${item.slug}`}
                className={styles.banner}
              >
                <div className={styles.bannerImageWrap}>
                  {/* Fills the frame when a creative is not 16:9. A true 16:9
                      image covers this completely, so it is never seen. */}
                  <div
                    className={styles.bannerImageFill}
                    style={{ backgroundImage: `url("${encodeURI(item.imageUrl)}")` }}
                    aria-hidden="true"
                  />
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className={styles.bannerImage}
                    loading="lazy"
                  />
                </div>
                <div className={styles.bannerBody}>
                  <div className={styles.bannerMeta}>
                    {item.publicationName && (
                      <span className={styles.publication}>{item.publicationName}</span>
                    )}
                    <time
                      className={styles.date}
                      dateTime={new Date(item.publishedAt).toISOString()}
                    >
                      <Calendar size={14} />
                      {formatDate(item.publishedAt)}
                    </time>
                  </div>
                  <h2 className={styles.bannerTitle}>{item.title}</h2>
                  {item.excerpt && <p className={styles.excerpt}>{item.excerpt}</p>}
                  <span className={styles.readMore}>
                    Read more
                    <ArrowRight size={16} className={styles.arrowIcon} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
};

export default NewsAndEventsPage;
