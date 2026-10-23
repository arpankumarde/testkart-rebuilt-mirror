import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, Navigate, useLocation } from "react-router-dom";
import { AlertCircle, ArrowLeft, ArrowRight, ChevronRight, Newspaper } from "lucide-react";
import { SEOHead } from "./SEOHead";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { CurrentAffairsPreview } from "./CurrentAffairsPreview";
import { useCurrentAffairsDetails } from "../helpers/useCurrentAffairsPublic";
import { currentAffairsMeta } from "../helpers/currentAffairsMeta";
import type { InputType as DetailsInput, PublicDigestDetail, PublicRelatedArticle } from "../endpoints/current-affairs/details_GET.schema";
import styles from "./CurrentAffairsDigestView.module.css";

const SITE_ORIGIN = "https://testkart.in";
const HIGHLIGHT_MS = 2400;
/* Images and the contents list settle after the first paint; the story is held in place this long. */
const SETTLE_MS = 3000;
const HEADING_GAP = 12;

/** The section a #hash names: its id, or the "item-3-..." form story links used before, by position. */
const findSection = (hash: string): HTMLElement | null => {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  if (!id) return null;
  const direct = document.getElementById(id);
  if (direct) return direct;
  const legacy = /^item-(\d+)-/.exec(id);
  return legacy ? document.querySelectorAll<HTMLElement>("[data-toc-section]")[Number(legacy[1]) - 1] ?? null : null;
};

/** How far down the viewport sticky or fixed bars (notice, impersonation banner, site header) reach. */
const coveredTop = (): number => {
  let y = 0;
  for (let layer = 0; layer < 4; layer++) {
    let el = document.elementFromPoint(window.innerWidth / 2, y + 1) as HTMLElement | null;
    let bottom = y;
    while (el && el !== document.body) {
      const position = getComputedStyle(el).position;
      if (position === "sticky" || position === "fixed") {
        bottom = Math.max(bottom, el.getBoundingClientRect().bottom);
        break;
      }
      el = el.parentElement;
    }
    if (bottom <= y) break;
    y = bottom;
  }
  return y;
};

/** The story an older #hash link into a day's digest meant: by its anchor, or by position in the "item-3-..." form. */
const storySlugFromHash = (post: PublicDigestDetail, hash: string): string | null => {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  if (!id) return null;
  const legacy = /^item-(\d+)-/.exec(id);
  const index = legacy ? Number(legacy[1]) - 1 : currentAffairsMeta.itemAnchors(post.items.map((item) => item.headline)).indexOf(id);
  return post.items[index]?.slug ?? null;
};

const RelatedCard: React.FC<{ article: PublicRelatedArticle }> = ({ article }) => {
  const [failed, setFailed] = useState(false);
  return (
    <li>
      <Link to={article.href} className={styles.relatedCard}>
        <span className={styles.relatedMedia}>
          {article.imageUrl && !failed ? (
            <img src={article.imageUrl} alt="" className={styles.relatedImage} loading="lazy" onError={() => setFailed(true)} />
          ) : (
            <Newspaper size={24} aria-hidden="true" />
          )}
        </span>
        <span className={styles.relatedBody}>
          {article.dateLabel && <span className={styles.relatedDate}>{article.dateLabel}</span>}
          <span className={styles.relatedCardTitle}>{article.title}</span>
        </span>
      </Link>
    </li>
  );
};

/**
 * Any Current Affairs article page: a daily story, a weekly or monthly roundup, or a day's digest
 * (which lists its stories as links), all rendered with the article layout the admin preview uses.
 * When it was reached on an older URL (a slug, a retired slug, a period), the reader is moved to the
 * current path.
 */
export const CurrentAffairsDigestView: React.FC<{ input: DetailsInput; className?: string }> = ({ input, className }) => {
  const location = useLocation();
  const { data, isFetching, isError, error, refetch } = useCurrentAffairsDetails(input);
  const post = data?.post;

  // Section links (#parliament-moves-into-its-new-building) and #quiz open on their section: aligned below
  // the sticky header, held there while images load unless the reader scrolls, and briefly highlighted.
  // Keyed on location.key so following the same link again repeats it.
  useEffect(() => {
    if (!post || !location.hash) return;
    let target: HTMLElement | null = null;
    let holding = true;
    const align = () => {
      if (!holding) return;
      if (!target?.isConnected) target = findSection(location.hash);
      if (!target) return;
      const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - coveredTop() - HEADING_GAP);
      if (Math.abs(window.scrollY - top) > 2) window.scrollTo({ top, behavior: "auto" });
    };
    const release = () => {
      holding = false;
    };
    // A bar that only sticks once the page has scrolled (the mobile contents toggle) changes the
    // covered height, so align once more after the first jump.
    let second = 0;
    const frame = requestAnimationFrame(() => {
      align();
      target?.setAttribute("data-ca-highlight", "");
      second = requestAnimationFrame(align);
    });
    const unhighlight = setTimeout(() => target?.removeAttribute("data-ca-highlight"), HIGHLIGHT_MS);
    const observer = new ResizeObserver(align);
    observer.observe(document.body);
    const settle = setTimeout(() => {
      release();
      observer.disconnect();
    }, SETTLE_MS);
    const stopEvents = ["wheel", "touchstart", "keydown", "mousedown"] as const;
    stopEvents.forEach((name) => window.addEventListener(name, release, { passive: true }));
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(second);
      clearTimeout(unhighlight);
      clearTimeout(settle);
      observer.disconnect();
      stopEvents.forEach((name) => window.removeEventListener(name, release));
      target?.removeAttribute("data-ca-highlight");
    };
  }, [post, location.hash, location.key]);

  if (data && data.canonicalPath !== location.pathname) {
    return <Navigate to={`${data.canonicalPath}${location.hash}`} replace />;
  }

  // Stories used to be sections of the day's digest; old shared links now open the story's own page.
  const isDayDigest = post?.contentType === "daily_digest";
  const movedStory = isDayDigest ? storySlugFromHash(post, location.hash) : null;
  if (movedStory) return <Navigate to={currentAffairsMeta.storyPath(movedStory)} replace />;

  const notFound = isError && /not found/i.test(String(error));
  const archive = data?.archive ?? null;
  const archiveLabel = archive ? currentAffairsMeta.contentTypeShort(currentAffairsMeta.ARCHIVE_CONTENT_TYPE[archive]) : "";
  const canonical = `${SITE_ORIGIN}${data?.canonicalPath ?? location.pathname}`;

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
                description: post.seoDescription || post.summary || undefined,
                image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
                datePublished: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
                dateModified: new Date(post.updatedAt).toISOString(),
                author: post.authorName ? { "@type": "Person", name: post.authorName } : undefined,
                publisher: { "@type": "Organization", name: "Testkart", url: SITE_ORIGIN },
                mainEntityOfPage: canonical,
                inLanguage: post.language,
                articleSection: post.tags.find((tag) => tag.kind === "topic")?.name,
                keywords: post.tags.length ? post.tags.map((tag) => tag.name).join(", ") : undefined,
              })}
            </script>
            <script type="application/ld+json">
              {JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
                  { "@type": "ListItem", position: 2, name: "Current Affairs", item: `${SITE_ORIGIN}${currentAffairsMeta.HUB_PATH}` },
                  ...(archive
                    ? [
                        {
                          "@type": "ListItem",
                          position: 3,
                          name: `${archiveLabel} Current Affairs`,
                          item: `${SITE_ORIGIN}${currentAffairsMeta.archivePath(archive)}`,
                        },
                      ]
                    : []),
                  { "@type": "ListItem", position: archive ? 4 : 3, name: post.title, item: canonical },
                ],
              })}
            </script>
          </Helmet>
        </>
      ) : (
        <SEOHead title="Current Affairs" description="Current affairs digests on Testkart." url={canonical} noIndex={notFound} />
      )}

      <div className={`${styles.page} ${className ?? ""}`}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <ChevronRight size={14} aria-hidden="true" />
          <Link to={currentAffairsMeta.HUB_PATH}>Current Affairs</Link>
          {post && archive && (
            <>
              <ChevronRight size={14} aria-hidden="true" />
              <Link to={currentAffairsMeta.archivePath(archive)}>{archiveLabel}</Link>
            </>
          )}
          {post && (
            <>
              <ChevronRight size={14} aria-hidden="true" />
              <span className={styles.breadcrumbCurrent} aria-current="page">
                {post.title}
              </span>
            </>
          )}
        </nav>

        {post ? (
          <>
            <div className={styles.sheet}>
              <CurrentAffairsPreview
                post={post}
                authorName={post.authorName}
                publishedAt={post.publishedAt}
                updatedAt={post.updatedAt}
                related={post.related.map((r) => ({ id: r.id, title: r.title, href: r.path }))}
                publicView
                linkStories={isDayDigest}
              />
            </div>

            {data?.digest && (
              <div className={styles.digestNote}>
                <p className={styles.digestText}>
                  Part of <Link to={data.digest.path}>{data.digest.title}</Link>
                </p>
                <div className={styles.digestLinks}>
                  <Link to={data.digest.path}>
                    All {data.digest.storyCount} stories <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                  {data.digest.hasQuiz && (
                    <Link to={`${data.digest.path}#quiz`}>
                      Take the quiz <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>
            )}

            {!!data?.relatedArticles.length && (
              <section className={styles.related} aria-labelledby="ca-related-title">
                <h2 id="ca-related-title" className={styles.relatedTitle}>
                  Related articles
                </h2>
                <ul className={styles.relatedGrid}>
                  {data.relatedArticles.map((article) => (
                    <RelatedCard key={article.id} article={article} />
                  ))}
                </ul>
              </section>
            )}
          </>
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
            <h1 className={styles.stateTitle}>{notFound ? "This article is not available" : "This article could not be loaded"}</h1>
            <p className={styles.stateText}>
              {notFound ? "It may have been moved or is not published yet." : "Check your connection and try again."}
            </p>
            <div className={styles.stateActions}>
              {!notFound && (
                <Button variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
              )}
              <Button asChild>
                <Link to={currentAffairsMeta.HUB_PATH}>
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