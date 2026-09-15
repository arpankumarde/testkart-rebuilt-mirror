import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { sanitizeHtml } from '../helpers/sanitizeHtml';
import { ChevronRight, Clock, Calendar, ThumbsUp, ThumbsDown } from 'lucide-react';

import { useBlogPostQuery, useBlogPostsQuery } from '../helpers/useBlogQuery';
import { useBlogReactions, useBlogReactMutation } from '../helpers/useBlogReactions';
import { getSessionId } from '../helpers/getSessionId';
import { ShareButton } from '../components/ShareButton';
import { PUBLIC_PAGE_SHARE_CAMPAIGN } from '../helpers/shareLinks';
import { extractHeadingsWithIds } from '../helpers/extractHeadingsWithIds';
import { wrapContentTables } from '../helpers/contentTables';
import { SEOHead } from '../components/SEOHead';
import { BRAND_APP_ICON } from '../helpers/brandAssets';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/Avatar';
import { Skeleton } from '../components/Skeleton';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../components/Accordion';
import { BlogPostCard } from '../components/BlogPostCard';
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

  const [activeHeadingId, setActiveHeadingId] = useState<string>('');

  const sessionId = useMemo(() => getSessionId(), []);
  const { data: reactionsData } = useBlogReactions(post?.id || 0, sessionId);
  const reactMutation = useBlogReactMutation();

  const handleReact = (reaction: 'like' | 'dislike') => {
    if (!post) return;
    reactMutation.mutate({ postId: post.id, sessionId, reaction });
  };

  // Sanitize once, then bake stable ids into the h2/h3 tags as part of the
  // same string — see extractHeadingsWithIds for why this replaced the old
  // "mutate el.id in a useEffect" approach (those ids never survived).
  const { html: articleHtml, headings } = useMemo(() => {
    if (!post?.content) return { html: '', headings: [] as { id: string, text: string, level: number }[] };
    const sanitized = sanitizeHtml(post.content);
    return extractHeadingsWithIds(sanitized);
  }, [post?.content]);

  useEffect(() => {
    if (!headings.length) return;
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveHeadingId(entry.target.id);
        }
      });
    }, { rootMargin: "-100px 0px -70% 0px" });

    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [headings]);

  const scrollToHeading = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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
        <div className={styles.container}>
          <Skeleton style={{ width: '100%', height: '400px', borderRadius: 'var(--radius-lg)', marginBottom: '2rem' }} />
          <Skeleton style={{ width: '60%', height: '40px', marginBottom: '1rem' }} />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.container}>
          <div className={styles.stateContainer}>
            <h2>Article Not Found</h2>
            <p>The knowledge base article you are looking for does not exist.</p>
            <Button asChild><Link to="/help">Back to Knowledge Base</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  const canonicalUrl = `https://testkart.in/help/${post.slug}`;

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
        <div className={styles.container}>
          <nav className={styles.breadcrumb}>
            <Link to="/">Home</Link>
            <ChevronRight size={16} />
            <Link to="/help">Knowledge Base</Link>
            {post.categoryName && (
              <>
                <ChevronRight size={16} />
                <Link to={`/help?category=${post.categorySlug}`}>{post.categoryName}</Link>
              </>
            )}
            <ChevronRight size={16} />
            <span className={styles.current}>{post.title}</span>
          </nav>

          <header className={styles.articleHeader}>
            <h1 className={styles.title}>{post.title}</h1>
            
            <div className={styles.headerMeta}>
              <div className={styles.authorInfo}>
                <Avatar className={styles.authorAvatar}>
                  <AvatarImage src={post.authorAvatar || undefined} />
                  <AvatarFallback>{post.authorName?.[0] || 'T'}</AvatarFallback>
                </Avatar>
                <div className={styles.authorDetails}>
                  <span className={styles.authorName}>{post.authorName || 'Testkart Team'}</span>
                  <div className={styles.postStats}>
                    {post.publishedAt && <span><Calendar size={14} /> Updated on {formatDate(post.publishedAt)}</span>}
                    <span><Clock size={14} /> {post.readingTimeMinutes} min read</span>
                  </div>
                </div>
              </div>
              
              <ShareButton
                kind="help-article"
                handle={post.slug}
                title={post.title}
                campaign={PUBLIC_PAGE_SHARE_CAMPAIGN}
              />
            </div>
          </header>

          <div className={styles.layoutGrid}>
            
            <main className={styles.mainContent}>
              <article 
                className={styles.articleContent}
                itemScope 
                itemType="https://schema.org/Article"
                dangerouslySetInnerHTML={{ __html: wrapContentTables(articleHtml) }}
              />

              <div className={styles.feedbackSection}>
                <h3>Was this article helpful?</h3>
                <div className={styles.feedbackButtons}>
                  <Button 
                    variant={reactionsData?.userReaction === 'like' ? 'primary' : 'outline'} 
                    onClick={() => handleReact('like')} 
                    className={styles.feedbackBtn}
                    disabled={reactMutation.isPending}
                  >
                    <ThumbsUp size={16} /> {reactionsData?.likes || 0} Yes
                  </Button>
                  <Button 
                    variant={reactionsData?.userReaction === 'dislike' ? 'primary' : 'outline'} 
                    onClick={() => handleReact('dislike')} 
                    className={styles.feedbackBtn}
                    disabled={reactMutation.isPending}
                  >
                    <ThumbsDown size={16} /> {reactionsData?.dislikes || 0} No
                  </Button>
                </div>
              </div>
            </main>

            <aside className={styles.sidebar}>
              {headings.length > 0 && (
                <>
                  <div className={styles.desktopToc}>
                    <div className={styles.tocSticky}>
                      <h4>In this article</h4>
                      <ul className={styles.tocList}>
                        {headings.map(h => (
                          <li 
                            key={h.id} 
                            className={`${styles.tocItem} ${activeHeadingId === h.id ? styles.tocItemActive : ''}`} 
                            data-level={h.level}
                          >
                            <a href={`#${h.id}`} onClick={e => scrollToHeading(e, h.id)}>{h.text}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className={styles.mobileToc}>
                    <Accordion type="single" collapsible>
                      <AccordionItem value="toc">
                        <AccordionTrigger>In this article</AccordionTrigger>
                        <AccordionContent>
                          <ul className={styles.tocList}>
                            {headings.map(h => (
                              <li 
                                key={h.id} 
                                className={`${styles.tocItem} ${activeHeadingId === h.id ? styles.tocItemActive : ''}`} 
                                data-level={h.level}
                              >
                                <a href={`#${h.id}`} onClick={e => scrollToHeading(e, h.id)}>{h.text}</a>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </>
              )}
            </aside>
            
          </div>

          {relatedPosts.length > 0 && (
            <section className={styles.relatedSection}>
              <h2>Related Articles</h2>
              <div className={styles.relatedGrid}>
                {relatedPosts.map(rp => (
                  <BlogPostCard key={rp.id} post={rp} prefix="/help" />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}