import React, { useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link, useLocation, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, ChevronRight, Newspaper } from "lucide-react";
import { SEOHead } from "../components/SEOHead";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { CurrentAffairsPreview } from "../components/CurrentAffairsPreview";
import { useCurrentAffairsDetails } from "../helpers/useCurrentAffairsPublic";
import { currentAffairsMeta } from "../helpers/currentAffairsMeta";
import styles from "./current-affairs.$digestSlug.module.css";

const SITE_ORIGIN = "https://testkart.in";

/** A published digest, rendered with the same article layout the admin preview uses. */
const CurrentAffairsDigestPage: React.FC = () => {
  const { digestSlug = "" } = useParams<{ digestSlug: string }>();
  const location = useLocation();
  const { data, isFetching, isError, error, refetch } = useCurrentAffairsDetails(digestSlug);
  const post = data?.post;

  // Links like "Take today's quiz" arrive with #quiz; jump there once the article has rendered.
  useEffect(() => {
    if (!post || !location.hash) return;
    const id = decodeURIComponent(location.hash.slice(1));
    const timer = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    return () => clearTimeout(timer);
  }, [post, location.hash]);

  const notFound = isError && /not found/i.test(String(error));
  const typeLabel = post ? currentAffairsMeta.contentTypeShort(post.contentType) : null;
  const canonical = `${SITE_ORIGIN}/current-affairs/${post?.slug ?? digestSlug}`;

  return (
    <>
      {post ? (
        <>
          <SEOHead
            title={post.seoTitle || post.title}
            description={post.seoDescription || post.summary || `${post.title} - current affairs on Testkart.`}
            url={canonical}
            image={post.ogImageUrl || post.coverImageUrl || undefined}
            type="article"
          />
          <Helmet>
            <script type="application/ld+json">
              {JSON.stringify({
                "@context": "https://schema.org",
                "@type": "NewsArticle",
                headline: post.title,
                description: post.summary || undefined,
                image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
                datePublished: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
                dateModified: new Date(post.updatedAt).toISOString(),
                author: post.authorName ? { "@type": "Person", name: post.authorName } : undefined,
                publisher: { "@type": "Organization", name: "Testkart", url: SITE_ORIGIN },
                mainEntityOfPage: canonical,
                inLanguage: post.language,
              })}
            </script>
            <script type="application/ld+json">
              {JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
                  { "@type": "ListItem", position: 2, name: "Current Affairs", item: `${SITE_ORIGIN}/current-affairs` },
                  { "@type": "ListItem", position: 3, name: post.title, item: canonical },
                ],
              })}
            </script>
          </Helmet>
        </>
      ) : (
        <SEOHead title="Current Affairs" description="Current affairs digests on Testkart." url={canonical} noIndex={notFound} />
      )}

      <div className={styles.page}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <ChevronRight size={14} aria-hidden="true" />
          <Link to="/current-affairs">Current Affairs</Link>
          {typeLabel && post && (
            <>
              <ChevronRight size={14} aria-hidden="true" />
              <Link to={`/current-affairs?type=${post.contentType === "editorial_analysis" ? "editorials" : post.contentType.replace("_digest", "")}`}>
                {typeLabel}
              </Link>
            </>
          )}
        </nav>

        {post ? (
          <div className={styles.sheet}>
            <CurrentAffairsPreview
              post={post}
              authorName={post.authorName}
              publishedAt={post.publishedAt}
              updatedAt={post.updatedAt}
              related={post.related.map((r) => ({ id: r.id, title: r.title, href: `/current-affairs/${r.slug}` }))}
              publicView
            />
          </div>
        ) : isFetching ? (
          <div className={styles.sheet} aria-busy="true">
            <Skeleton style={{ height: "2.5rem", width: "70%" }} />
            <Skeleton style={{ height: "1.25rem", width: "90%", marginTop: "1rem" }} />
            <Skeleton style={{ height: "18rem", marginTop: "1.5rem", borderRadius: "var(--radius-lg)" }} />
          </div>
        ) : (
          <div className={styles.state} role={notFound ? undefined : "alert"}>
            <span className={styles.stateIcon} aria-hidden="true">
              {notFound ? <Newspaper size={24} /> : <AlertCircle size={24} />}
            </span>
            <h1 className={styles.stateTitle}>{notFound ? "This digest is not available" : "This digest could not be loaded"}</h1>
            <p className={styles.stateText}>
              {notFound
                ? "It may have been moved or is not published yet."
                : "Check your connection and try again."}
            </p>
            <div className={styles.stateActions}>
              {!notFound && (
                <Button variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
              )}
              <Button asChild>
                <Link to="/current-affairs">
                  <ArrowLeft size={16} /> All current affairs
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CurrentAffairsDigestPage;