import React, { useMemo } from "react";
import { Helmet } from "react-helmet";
import { Link, Navigate, useParams } from "react-router-dom";
import { sanitizeHtml } from "../helpers/sanitizeHtml";
import { useNewsDetailsQuery } from "../helpers/useNewsQuery";
import { writeupToHtml, writeupToPlainText } from "../helpers/newsWriteup";
import { renderMathInHtml } from "../helpers/renderMathInHtml";
import { wrapContentTables } from "../helpers/contentTables";
import "katex/dist/katex.min.css";
import { SEOHead } from "../components/SEOHead";
import { BRAND_APP_ICON } from "../helpers/brandAssets";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { ShareButton } from "../components/ShareButton";
import { PUBLIC_PAGE_SHARE_CAMPAIGN } from "../helpers/shareLinks";
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  ExternalLink,
  Newspaper,
} from "lucide-react";
import styles from "./news-and-events.$newsSlug.module.css";

const SITE_ORIGIN = "https://testkart.in";

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));

const hostnameOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const NewsDetailPage: React.FC = () => {
  const { newsSlug } = useParams<{ newsSlug: string }>();
  const { data, isFetching, isError, error } = useNewsDetailsQuery(newsSlug ?? "");
  const writeup = data?.item.writeup;

  const writeupHtml = useMemo(
    () =>
      writeup
        ? renderMathInHtml(sanitizeHtml(writeupToHtml(writeup)))
        : "",
    [writeup]
  );

  if (isFetching && !data) {
    return (
      <main className={styles.container}>
        <Skeleton style={{ width: "120px", height: "1.25rem" }} />
        <Skeleton style={{ width: "80%", height: "2.75rem", marginTop: "var(--spacing-6)" }} />
        <Skeleton style={{ width: "40%", height: "1rem", marginTop: "var(--spacing-4)" }} />
        <Skeleton className={styles.skeletonImage} />
        <Skeleton style={{ width: "100%", height: "1rem", marginTop: "var(--spacing-6)" }} />
        <Skeleton style={{ width: "95%", height: "1rem", marginTop: "var(--spacing-3)" }} />
        <Skeleton style={{ width: "70%", height: "1rem", marginTop: "var(--spacing-3)" }} />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <>
        <SEOHead
          title="Coverage not found"
          description="This news story is no longer available on Testkart."
          noIndex
        />
        <main className={styles.container}>
          <div className={styles.errorState}>
            <Newspaper size={48} className={styles.errorIcon} />
            <h1>Coverage not found</h1>
            <p>
              {error instanceof Error
                ? error.message
                : "This story may have been removed."}
            </p>
            <Button asChild>
              <Link to="/news-and-events">Back to News &amp; Events</Link>
            </Button>
          </div>
        </main>
      </>
    );
  }

  const { item } = data;

  // Reached through a retired slug on a client-side navigation - the SSR
  // prefetch 301s this case, so this only covers in-app links.
  if (item.slug !== newsSlug) {
    return <Navigate to={`/news-and-events/${item.slug}`} replace />;
  }

  const canonicalUrl = `${SITE_ORIGIN}/news-and-events/${item.slug}`;
  const plainWriteup = writeupToPlainText(item.writeup);
  const description =
    item.excerpt ??
    (plainWriteup.length > 157 ? `${plainWriteup.slice(0, 157).trimEnd()}...` : plainWriteup);

  const breadcrumbList = [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
    {
      "@type": "ListItem",
      position: 2,
      name: "News & Events",
      item: `${SITE_ORIGIN}/news-and-events`,
    },
    { "@type": "ListItem", position: 3, name: item.title, item: canonicalUrl },
  ];

  return (
    <>
      <SEOHead
        title={item.title}
        description={description}
        image={item.imageUrl}
        url={canonicalUrl}
        type="article"
      />
      <Helmet>
        {item.keywords && <meta name="keywords" content={item.keywords} />}
        <meta property="article:published_time" content={new Date(item.publishedAt).toISOString()} />
        <meta property="article:modified_time" content={new Date(item.updatedAt).toISOString()} />
        <meta property="article:section" content="News" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: item.title,
            description,
            image: [item.imageUrl],
            datePublished: new Date(item.publishedAt).toISOString(),
            dateModified: new Date(item.updatedAt).toISOString(),
            author: [
              {
                "@type": "Organization",
                name: item.publicationName ?? "Testkart",
              },
            ],
            publisher: {
              "@type": "Organization",
              name: "Testkart",
              logo: { "@type": "ImageObject", url: BRAND_APP_ICON },
            },
            mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
            ...(item.keywords ? { keywords: item.keywords } : {}),
            ...(item.coverageUrl ? { isBasedOn: item.coverageUrl } : {}),
          })}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: breadcrumbList,
          })}
        </script>
      </Helmet>

      <main className={styles.container}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <ChevronRight size={16} />
          <Link to="/news-and-events">News &amp; Events</Link>
          <ChevronRight size={16} />
          <span className={styles.current}>{item.title}</span>
        </nav>

        <article>
          <h1 className={styles.title}>{item.title}</h1>

          <div className={styles.meta}>
            <div className={styles.metaInfo}>
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
            <ShareButton
              kind="news"
              handle={item.slug}
              title={item.title}
              campaign={PUBLIC_PAGE_SHARE_CAMPAIGN}
            />
          </div>

          <div className={styles.imageFrame}>
            {/* Only visible for an off-ratio creative - see the list page. */}
            <div
              className={styles.imageFill}
              style={{ backgroundImage: `url("${encodeURI(item.imageUrl)}")` }}
              aria-hidden="true"
            />
            <img
              src={item.imageUrl}
              alt={item.title}
              className={styles.image}
              width={1200}
              height={675}
            />
          </div>

          <div
            className={styles.writeup}
            dangerouslySetInnerHTML={{ __html: wrapContentTables(writeupHtml) }}
          />

          {item.coverageUrl && (
            <div className={styles.coverageCard}>
              <div className={styles.coverageText}>
                <h2 className={styles.coverageHeading}>Read the original coverage</h2>
                <p className={styles.coverageSource}>
                  {item.publicationName
                    ? `${item.publicationName} - ${hostnameOf(item.coverageUrl)}`
                    : hostnameOf(item.coverageUrl)}
                </p>
              </div>
              <Button asChild>
                <a
                  href={item.coverageUrl}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                >
                  Open coverage page
                  <ExternalLink size={16} />
                </a>
              </Button>
            </div>
          )}
        </article>

        <Link to="/news-and-events" className={styles.backLink}>
          <ArrowLeft size={16} />
          All News &amp; Events
        </Link>
      </main>
    </>
  );
};

export default NewsDetailPage;
