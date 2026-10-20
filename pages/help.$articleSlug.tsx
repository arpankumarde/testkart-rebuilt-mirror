import React, { useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { sanitizeHtml } from '../helpers/sanitizeHtml';
import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight, Clock, LifeBuoy, ThumbsDown, ThumbsUp } from 'lucide-react';

import { useBlogPostQuery, useBlogPostsQuery } from '../helpers/useBlogQuery';
import { useBlogReactions, useBlogReactMutation } from '../helpers/useBlogReactions';
import { getSessionId } from '../helpers/getSessionId';
import { ShareButton } from '../components/ShareButton';
import { PUBLIC_PAGE_SHARE_CAMPAIGN } from '../helpers/shareLinks';
import { extractHeadingsWithIds, type ExtractedHeading } from '../helpers/extractHeadingsWithIds';
import { wrapContentTables } from '../helpers/contentTables';
import { tagCallouts } from '../helpers/tagCallouts';
import { wrapZoomableImages } from '../helpers/zoomableImages';
import { useHeadingScrollSpy } from '../helpers/useHeadingScrollSpy';
import { SEOHead } from '../components/SEOHead';
import { BRAND_APP_ICON } from '../helpers/brandAssets';
import { Button } from '../components/Button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/Avatar';
import { Skeleton } from '../components/Skeleton';
import { HelpArticleCard } from '../components/HelpArticleCard';
import { HelpArticleToc } from '../components/HelpArticleToc';
import { ImageLightbox, useImageLightbox } from '../components/ImageLightbox';
import { NotFoundState } from '../components/NotFoundState';
import { isNotFoundError } from '../helpers/isNotFoundError';
import styles from './help.$articleSlug.module.css';

const formatDate = (date: string | Date) => {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(date));
};

export default function KnowledgeBaseArticleDetail() {
  const { articleSlug } = useParams<{ articleSlug: string }>();
  const { data, isFetching, error } = useBlogPostQuery(articleSlug);
  const post = data?.post;
  const articleRef = useRef<HTMLDivElement>(null);

  const sessionId = useMemo(() => getSessionId(), []);
  const { data: reactionsData } = useBlogReactions(post?.id || 0, sessionId);
  const reactMutation = useBlogReactMutation();
  const userReaction = reactionsData?.userReaction;

  const handleReact = (reaction: 'like' | 'dislike') => {
    if (!post) return;
    reactMutation.mutate({ postId: post.id, sessionId, reaction });
  };

  // Sanitize once, then bake stable ids into the h2/h3 tags as part of the
  // same string - see extractHeadingsWithIds for why this replaced the old
  // "mutate el.id in a useEffect" approach (those ids never survived).
  // Callout tagging, zoomable images and table wrapping are string passes on
  // the same output.
  const { html: articleHtml, headings } = useMemo(() => {
    if (!post?.content) return { html: '', headings: [] as ExtractedHeading[] };
    const { html, headings } = extractHeadingsWithIds(sanitizeHtml(post.content));
    return { html: wrapContentTables(wrapZoomableImages(tagCallouts(html))), headings };
  }, [post?.content]);

  // One stable object: React re-applies innerHTML whenever this prop's
  // identity changes, even for the same string, which would rebuild the
  // article on every render and drop focus moved into it by the TOC or the
  // lightbox.
  const articleMarkup = useMemo(() => ({ __html: articleHtml }), [articleHtml]);

  const headingIds = useMemo(() => headings.map(h => h.id), [headings]);
  const { activeId, scrollTo } = useHeadingScrollSpy(articleRef, headingIds);
  const { image: lightboxImage, close: closeLightbox } = useImageLightbox(articleRef);

  const { data: relatedData } = useBlogPostsQuery({
    type: "knowledge_base",
    categorySlug: post?.categorySlug || undefined,
    limit: 4
  });

  const relatedPosts = useMemo(() => {
    return relatedData?.posts.filter(p => p.id !== post?.id).slice(0, 3) || [];
  }, [relatedData, post?.id]);

  if (isFetching && !post) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.header}>
          <div className={styles.headerInner}>
            <Skeleton style={{ width: '40%', height: '1rem', marginBottom: '1.5rem' }} />
            <Skeleton style={{ width: '75%', height: '2.5rem', marginBottom: '1.25rem' }} />
            <Skeleton style={{ width: '30%', height: '2.75rem' }} />
          </div>
        </div>
        <div className={styles.body}>
          <Skeleton style={{ width: '100%', height: '480px', borderRadius: '1.5rem' }} />
        </div>
      </div>
    );
  }

  if (error && !isNotFoundError(error)) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.body}>
          <div className={styles.stateContainer}>
            <h2>Could not load this article</h2>
            <p>Something went wrong on our side. Please try again in a moment.</p>
            <Button asChild><Link to="/help">Back to Knowledge Base</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return <NotFoundState kind="help" />;
  }

  const canonicalUrl = `https://testkart.in/help/${post.slug}`;
  const lastUpdated = post.updatedAt ?? post.publishedAt;
  const hasToc = headings.length > 0;

  const wordCount = Math.ceil((post.content?.replace(/<[^>]+>/g, '') || '').split(/\s+/).length);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.seoDescription || post.excerpt,
    "image": post.ogImage || post.featuredImage ? [post.ogImage || post.featuredImage] : undefined,
    "datePublished": post.publishedAt?.toISOString(),
    "dateModified": post.updatedAt ? new Date(post.updatedAt).toISOString() : post.publishedAt?.toISOString(),
    "author": { "@type": "Person", "name": post.authorName || "Testkart Team" },
    "publisher": {
      "@type": "Organization",
      "name": "Testkart",
      "logo": {
        "@type": "ImageObject",
        "url": BRAND_APP_ICON
      }
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": canonicalUrl },
    "wordCount": wordCount
  };

  const breadcrumbItems = [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://testkart.in" },
    { "@type": "ListItem", "position": 2, "name": "Knowledge Base", "item": "https://testkart.in/help" }
  ];

  if (post.categoryName) {
    breadcrumbItems.push({
      "@type": "ListItem",
      "position": 3,
      "name": post.categoryName,
      "item": `https://testkart.in/help?category=${post.categorySlug}`
    });
    breadcrumbItems.push({
      "@type": "ListItem",
      "position": 4,
      "name": post.title,
      "item": canonicalUrl
    });
  } else {
    breadcrumbItems.push({
      "@type": "ListItem",
      "position": 3,
      "name": post.title,
      "item": canonicalUrl
    });
  }

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbItems
  };

  const feedbackHint = userReaction === 'like'
    ? 'Thanks! Glad this guide helped.'
    : userReaction === 'dislike'
      ? 'Thanks for telling us. Our support team can help with anything this guide missed.'
      : 'Your answer helps us improve these guides.';

  return (
    <>
      <SEOHead
        title={`${post.title} | Knowledge Base`}
        description={post.seoDescription || post.excerpt || ''}
        image={post.ogImage || post.featuredImage || undefined}
        url={canonicalUrl}
        type="article"
      />
      <Helmet>
        <link rel="canonical" href={canonicalUrl} />
        <script type="application/ld+json">
          {JSON.stringify(articleSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      </Helmet>

      <div className={styles.pageWrapper}>
        <header className={styles.header}>
          <span className={styles.shapeRing} aria-hidden="true" />
          <span className={styles.shapeDot} aria-hidden="true" />
          <div className={styles.headerInner}>
            <nav aria-label="Breadcrumb">
              <ol className={styles.breadcrumb}>
                <li><Link to="/">Home</Link></li>
                <li><ChevronRight size={14} aria-hidden="true" /><Link to="/help">Knowledge Base</Link></li>
                {post.categoryName && (
                  <li>
                    <ChevronRight size={14} aria-hidden="true" />
                    <Link to={`/help?category=${post.categorySlug}`}>{post.categoryName}</Link>
                  </li>
                )}
                <li className={styles.crumbCurrent}>
                  <ChevronRight size={14} aria-hidden="true" />
                  <span aria-current="page">{post.title.trim()}</span>
                </li>
              </ol>
            </nav>

            <h1 className={styles.title}>{post.title.trim()}</h1>

            <div className={styles.meta}>
              <div className={styles.author}>
                <Avatar className={styles.authorAvatar}>
                  <AvatarImage src={post.authorAvatar || undefined} alt="" />
                  <AvatarFallback>{post.authorName?.[0] || 'T'}</AvatarFallback>
                </Avatar>
                <div className={styles.authorDetails}>
                  <span className={styles.authorName}>{post.authorName || 'Testkart Team'}</span>
                  <span className={styles.stats}>
                    {lastUpdated && (
                      <span className={styles.stat}>
                        <CalendarDays size={14} aria-hidden="true" />
                        Updated <time dateTime={new Date(lastUpdated).toISOString()}>{formatDate(lastUpdated)}</time>
                      </span>
                    )}
                    <span className={styles.stat}>
                      <Clock size={14} aria-hidden="true" />
                      {post.readingTimeMinutes} min read
                    </span>
                  </span>
                </div>
              </div>

              <ShareButton
                kind="help-article"
                handle={post.slug}
                title={post.title}
                campaign={PUBLIC_PAGE_SHARE_CAMPAIGN}
                variant="primary"
                size="sm"
                className={styles.share}
              />
            </div>
          </div>
        </header>

        <div className={styles.body}>
          {hasToc && (
            <div className={styles.mobileToc}>
              <HelpArticleToc variant="collapsible" headings={headings} activeId={activeId} onSelect={scrollTo} />
            </div>
          )}

          <div className={`${styles.layout} ${hasToc ? '' : styles.layoutSingle}`}>
            <main className={styles.main}>
              <article className={styles.articleCard} itemScope itemType="https://schema.org/Article">
                <div
                  ref={articleRef}
                  className={styles.articleContent}
                  dangerouslySetInnerHTML={articleMarkup}
                />
              </article>

              <section className={styles.feedback} aria-labelledby="help-feedback-title">
                <div className={styles.feedbackRow}>
                  <div className={styles.feedbackText}>
                    <h2 id="help-feedback-title" className={styles.feedbackTitle}>Was this article helpful?</h2>
                    <p className={styles.feedbackHint} aria-live="polite">{feedbackHint}</p>
                  </div>
                  <div className={styles.feedbackButtons}>
                    <button
                      type="button"
                      className={styles.feedbackBtn}
                      aria-pressed={userReaction === 'like'}
                      onClick={() => handleReact('like')}
                      disabled={reactMutation.isPending}
                    >
                      <ThumbsUp size={16} aria-hidden="true" /> Yes
                    </button>
                    <button
                      type="button"
                      className={styles.feedbackBtn}
                      aria-pressed={userReaction === 'dislike'}
                      onClick={() => handleReact('dislike')}
                      disabled={reactMutation.isPending}
                    >
                      <ThumbsDown size={16} aria-hidden="true" /> No
                    </button>
                  </div>
                </div>
                <div className={styles.feedbackLinks}>
                  <Link to="/contact" className={styles.feedbackLink}>
                    <LifeBuoy size={16} aria-hidden="true" /> Contact support
                  </Link>
                  <Link to="/help" className={styles.feedbackLink}>
                    <ArrowLeft size={16} aria-hidden="true" /> Back to Knowledge Base
                  </Link>
                </div>
              </section>
            </main>

            {hasToc && (
              <aside className={styles.sidebar}>
                <HelpArticleToc variant="sidebar" headings={headings} activeId={activeId} onSelect={scrollTo} />
              </aside>
            )}
          </div>

          {relatedPosts.length > 0 && (
            <section className={styles.related} aria-labelledby="help-related-title">
              <div className={styles.relatedHead}>
                <h2 id="help-related-title" className={styles.relatedTitle}>
                  {post.categoryName ? `More in ${post.categoryName}` : 'More guides'}
                </h2>
                {post.categorySlug && (
                  <Link to={`/help?category=${post.categorySlug}`} className={styles.relatedAll}>
                    View all <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                )}
              </div>
              <div className={styles.relatedGrid}>
                {relatedPosts.map(rp => (
                  <HelpArticleCard key={rp.id} post={rp} layout="feature" />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <ImageLightbox image={lightboxImage} onClose={closeLightbox} />
    </>
  );
}
