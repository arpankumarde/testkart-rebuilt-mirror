import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { sanitizeHtml } from '../helpers/sanitizeHtml';
import { z } from 'zod';
import { ChevronRight, Clock, Calendar, ThumbsUp, ThumbsDown, List, Home, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

import { useBlogPostQuery, useBlogPostsQuery, useBlogCommentsQuery, useCreateBlogCommentMutation } from '../helpers/useBlogQuery';
import { useBlogReactions, useBlogReactMutation } from '../helpers/useBlogReactions';
import { useAuth } from '../helpers/useAuth';
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
import { Form, FormItem, FormControl, FormMessage, useForm } from '../components/Form';
import { Textarea } from '../components/Textarea';
import { PublicCommentItem } from '../endpoints/blog/comments/list_GET.schema';
import type { PublicPostListItem } from '../endpoints/blog/list_GET.schema';
import { getSessionId } from '../helpers/getSessionId';
import { NotFoundState } from '../components/NotFoundState';
import { isNotFoundError } from '../helpers/isNotFoundError';
import styles from './blog.$blogSlug.module.css';

const formatDate = (date: string | Date) => {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(date));
};

type CommentNode = PublicCommentItem & { children: CommentNode[] };

const buildCommentTree = (comments: PublicCommentItem[]) => {
  const map = new Map<number, CommentNode>();
  const roots: CommentNode[] = [];
  
  comments.forEach(c => map.set(c.id, { ...c, children: [] }));
  
  comments.forEach(c => {
    if (c.parentId) {
      map.get(c.parentId)?.children.push(map.get(c.id)!);
    } else {
      roots.push(map.get(c.id)!);
    }
  });
  
  return roots;
};

const CommentForm = ({ postId, parentId, onCancel }: { postId: number, parentId?: number, onCancel?: () => void }) => {
  const form = useForm({
    defaultValues: { content: "" },
    schema: z.object({ content: z.string().min(1, "Comment cannot be empty") })
  });
  const mutation = useCreateBlogCommentMutation();

  const onSubmit = (values: { content: string }) => {
    mutation.mutate({ postId, parentId: parentId || null, content: values.content }, {
      onSuccess: () => {
        form.setValues({ content: "" });
        if (onCancel) onCancel();
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.commentForm}>
        <FormItem name="content">
          <FormControl>
            <Textarea 
              placeholder={parentId ? "Write a reply..." : "Share your thoughts..."} 
              value={form.values.content}
              onChange={e => form.setValues({ content: e.target.value })}
              rows={3}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
        <div className={styles.commentFormActions}>
          {onCancel && <Button type="button" variant="ghost" className={styles.ghostPill} onClick={onCancel}>Cancel</Button>}
          <Button type="submit" className={styles.ctaPill} disabled={mutation.isPending}>
            {mutation.isPending ? "Posting..." : "Post Comment"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

const CommentItem = ({ comment, allComments, isRoot = true }: { comment: CommentNode, allComments: PublicCommentItem[], isRoot?: boolean }) => {
  const [isReplying, setIsReplying] = useState(false);
  const { authState } = useAuth();
  const location = useLocation();
  
  return (
    <div className={`${styles.commentItem} ${!isRoot ? styles.nestedCommentItem : ''}`}>
      <div className={styles.commentHeader}>
        <Avatar className={styles.commentAvatar}>
          <AvatarImage src={comment.authorAvatar || undefined} />
          <AvatarFallback>{comment.authorName[0]}</AvatarFallback>
        </Avatar>
        <div className={styles.commentMeta}>
          <span className={styles.commentAuthor}>{comment.authorName}</span>
          <span className={styles.commentDate}>{formatDate(comment.createdAt)}</span>
        </div>
      </div>
      <div className={styles.commentBody}>
        <p>{comment.content}</p>
        <div className={styles.commentActions}>
          {authState.type === "authenticated" ? (
            <Button variant="ghost" size="sm" onClick={() => setIsReplying(!isReplying)} className={styles.replyButton}>
              Reply
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className={styles.replyButton}>
              <Link to={`/login?redirectTo=${encodeURIComponent(location.pathname)}`}>Login to Reply</Link>
            </Button>
          )}
        </div>
      </div>
      {isReplying && (
        <div className={styles.replyFormContainer}>
          <CommentForm postId={comment.postId} parentId={comment.id} onCancel={() => setIsReplying(false)} />
        </div>
      )}
      {comment.children && comment.children.length > 0 && (
        <div className={styles.nestedComments}>
          {comment.children.map(child => (
            <CommentItem key={child.id} comment={child} allComments={allComments} isRoot={false} />
          ))}
        </div>
      )}
    </div>
  );
};

const formatShortDate = (date: string | Date) => {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(date));
};

const RelatedArticleCard = ({ post }: { post: PublicPostListItem }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!post.featuredImage && !imageFailed;

  return (
    <Link to={`/blog/${post.slug}`} className={styles.relatedCard}>
      <div className={styles.relatedThumb}>
        {showImage && (
          <img
            src={post.featuredImage || undefined}
            alt=""
            width={1200}
            height={675}
            loading="lazy"
            className={styles.relatedThumbImg}
            onError={() => setImageFailed(true)}
          />
        )}
      </div>
      <div className={styles.relatedBody}>
        {post.categoryName && <Badge className={styles.relatedBadge}>{post.categoryName}</Badge>}
        <h3 className={styles.relatedTitle}>{post.title}</h3>
        <p className={styles.relatedExcerpt}>{post.excerpt || 'Read more about this topic...'}</p>
        <div className={styles.relatedFooter}>
          <div className={styles.relatedAuthor}>
            <Avatar className={styles.relatedAvatar}>
              <AvatarImage src={post.authorAvatar || undefined} />
              <AvatarFallback>{post.authorName?.[0] || 'T'}</AvatarFallback>
            </Avatar>
            <span className={styles.relatedAuthorName}>{post.authorName || 'Testkart Team'}</span>
          </div>
          <div className={styles.relatedMeta}>
            <span className={styles.relatedMetaItem}><Clock size={14} aria-hidden="true" /> {post.readingTimeMinutes} min</span>
            {post.publishedAt && (
              <span className={styles.relatedMetaItem}><Calendar size={14} aria-hidden="true" /> {formatShortDate(post.publishedAt)}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default function BlogPostDetail() {
  const { blogSlug } = useParams<{ blogSlug: string }>();
  const { data, isFetching, error } = useBlogPostQuery(blogSlug);
  const post = data?.post;

  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const tocScrollRef = useRef<HTMLDivElement>(null);
  const pinnedHeadingRef = useRef<string | null>(null);

  // Sanitize once, then bake stable ids into the h2/h3 tags as part of the
  // same string — see extractHeadingsWithIds for why this replaced the old
  // "mutate el.id in a useEffect" approach (those ids never survived).
  const { html: articleHtml, headings } = useMemo(() => {
    if (!post?.content) return { html: '', headings: [] as { id: string, text: string, level: number }[] };
    const sanitized = sanitizeHtml(post.content);
    return extractHeadingsWithIds(sanitized);
  }, [post?.content]);

  // Stable object so a re-render (e.g. the active TOC entry changing) does not
  // rewrite the article and swap out the heading nodes the observer watches.
  const articleMarkup = useMemo(() => ({ __html: wrapContentTables(articleHtml) }), [articleHtml]);

  // The active heading is the last one whose top has reached the reading line
  // (the heading's own scroll-margin, i.e. where a TOC click lands it). The
  // observed region is everything above that line, so any crossing fires,
  // including long jumps; the answer is recomputed from positions, so
  // scrolling up reverts correctly. root: document keeps rootMargin working
  // inside iframes. A TOC click pins its target until the reader scrolls by
  // hand, so the smooth scroll (and a last section too short to reach the
  // line) cannot flip the state.
  useEffect(() => {
    const els = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;

    const line = (parseFloat(getComputedStyle(els[0]).scrollMarginTop) || 100) + 8;

    const syncActive = () => {
      if (pinnedHeadingRef.current) return;
      let current = '';
      for (const el of els) {
        if (el.getBoundingClientRect().top <= line) current = el.id;
        else break;
      }
      setActiveHeadingId(current);
    };

    const unpin = () => {
      pinnedHeadingRef.current = null;
    };

    let observer: IntersectionObserver | null = null;
    const observe = () => {
      observer?.disconnect();
      observer = new IntersectionObserver(syncActive, {
        root: document,
        rootMargin: `1000000px 0px ${line - window.innerHeight}px 0px`,
      });
      els.forEach((el) => observer!.observe(el));
    };
    observe();

    const userScrollEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    userScrollEvents.forEach((name) => window.addEventListener(name, unpin, { passive: true }));
    window.addEventListener('resize', observe);
    syncActive();

    return () => {
      observer?.disconnect();
      userScrollEvents.forEach((name) => window.removeEventListener(name, unpin));
      window.removeEventListener('resize', observe);
    };
  }, [headings]);

  // A subsection keeps its parent entry marked so the reader can see which section they are in.
  const activeParentId = useMemo(() => {
    const index = headings.findIndex((h) => h.id === activeHeadingId);
    if (index < 0 || headings[index].level !== 3) return '';
    for (let i = index - 1; i >= 0; i--) {
      if (headings[i].level === 2) return headings[i].id;
    }
    return '';
  }, [headings, activeHeadingId]);

  // Keeps the active entry in view when the desktop contents list is taller than its card.
  useEffect(() => {
    const box = tocScrollRef.current;
    if (!box || !activeHeadingId) return;
    const link = box.querySelector<HTMLElement>(`a[href="#${CSS.escape(activeHeadingId)}"]`);
    if (!link) return;
    const boxRect = box.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    if (linkRect.top < boxRect.top || linkRect.bottom > boxRect.bottom) {
      box.scrollTo({ top: box.scrollTop + linkRect.top - boxRect.top - box.clientHeight / 3, behavior: 'smooth' });
    }
  }, [activeHeadingId]);

  const scrollToHeading = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      pinnedHeadingRef.current = id;
      setActiveHeadingId(id);
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const { data: relatedData } = useBlogPostsQuery({ 
    type: "blog", 
    categorySlug: post?.categorySlug || undefined, 
    limit: 4 
  });
  
  const relatedPosts = useMemo(() => {
    return relatedData?.posts.filter(p => p.id !== post?.id).slice(0, 3) || [];
  }, [relatedData, post?.id]);

  const { data: commentsData } = useBlogCommentsQuery({ postId: post?.id || 0 });
  const commentRoots = useMemo(() => {
    if (!commentsData?.comments) return [];
    return buildCommentTree(commentsData.comments);
  }, [commentsData?.comments]);

  const { authState } = useAuth();
  const location = useLocation();

  const [sessionId, setSessionId] = useState<string | null>(null);
  
  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  const { data: reactionsData } = useBlogReactions(post?.id || 0, sessionId);
  const reactMutation = useBlogReactMutation();

  const handleReact = (reaction: 'like' | 'dislike') => {
    if (!post || !sessionId) return;
    reactMutation.mutate({ postId: post.id, sessionId, reaction });
  };

  if (isFetching && !post) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.container}>
          <Skeleton style={{ width: '9rem', height: '28px', borderRadius: 'var(--radius-full)', marginBottom: '1.25rem' }} />
          <Skeleton style={{ width: '80%', height: '44px', marginBottom: '0.75rem' }} />
          <Skeleton style={{ width: '55%', height: '44px', marginBottom: '1.75rem' }} />
          <Skeleton style={{ width: '40%', height: '20px', marginBottom: '2rem' }} />
          <Skeleton style={{ width: '100%', maxWidth: '820px', aspectRatio: '1200 / 630', borderRadius: '1.5rem', marginBottom: '2rem' }} />
          <Skeleton style={{ width: '100%', height: '20px', marginBottom: '0.5rem' }} />
          <Skeleton style={{ width: '100%', height: '20px', marginBottom: '0.5rem' }} />
          <Skeleton style={{ width: '80%', height: '20px' }} />
        </div>
      </div>
    );
  }

  if (error && !isNotFoundError(error)) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.container}>
          <div className={styles.stateContainer}>
            <h2>Could not load this article</h2>
            <p>Something went wrong on our side. Please try again in a moment.</p>
            <Button asChild className={styles.ctaPill}><Link to="/blog">Back to Blog</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return <NotFoundState kind="blog" />;
  }

  const canonicalUrl = `https://testkart.in/blog/${post.slug}`;
  // ogImage first, as in SEOHead and the list endpoint: the editor only uploads the social image.
  const thumbnailUrl = post.ogImage || post.featuredImage;

  const wordCount = Math.ceil((post.content?.replace(/<[^>]+>/g, '') || '').split(/\s+/).length);
  const commentCount = commentsData?.comments?.length || 0;

  const breadcrumbList = [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://testkart.in" },
    { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://testkart.in/blog" },
  ];
  if (post.categoryName) {
    breadcrumbList.push({ "@type": "ListItem", "position": 3, "name": post.categoryName, "item": `https://testkart.in/blog?category=${post.categorySlug}` });
    breadcrumbList.push({ "@type": "ListItem", "position": 4, "name": post.title, "item": canonicalUrl });
  } else {
    breadcrumbList.push({ "@type": "ListItem", "position": 3, "name": post.title, "item": canonicalUrl });
  }

  const tocList = (
    <ul className={styles.tocList}>
      {headings.map(h => (
        <li
          key={h.id}
          className={styles.tocItem}
          data-level={h.level}
          data-active-parent={h.id === activeParentId ? 'true' : undefined}
        >
          <a
            href={`#${h.id}`}
            onClick={e => scrollToHeading(e, h.id)}
            aria-current={h.id === activeHeadingId ? 'location' : undefined}
          >
            {h.text}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <SEOHead 
        title={post.seoTitle || post.title}
        description={post.seoDescription || post.excerpt || ''}
        image={post.ogImage || post.featuredImage || undefined}
        url={canonicalUrl}
        type="article"
      />
      <Helmet>
        <link rel="canonical" href={canonicalUrl} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": post.title,
            "description": post.seoDescription || post.excerpt || '',
            "image": post.ogImage || post.featuredImage ? [post.ogImage || post.featuredImage] : undefined,
            "datePublished": post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
            "dateModified": post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
            "author": [{
              "@type": "Person",
              "name": post.authorName || "Testkart Team"
            }],
            "publisher": {
              "@type": "Organization",
              "name": "Testkart",
              "logo": {
                "@type": "ImageObject",
                "url": BRAND_APP_ICON
              }
            },
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": canonicalUrl
            },
            "wordCount": wordCount,
            "commentCount": commentCount
          })}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": breadcrumbList
          })}
        </script>
      </Helmet>

      <div className={styles.pageWrapper}>
        <div className={styles.container}>
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link to="/" className={styles.crumbHome}><Home size={14} aria-hidden="true" />Home</Link>
            <ChevronRight size={14} aria-hidden="true" />
            <Link to="/blog">Blog</Link>
            {post.categoryName && (
              <>
                <ChevronRight size={14} aria-hidden="true" />
                <Link to={`/blog?category=${post.categorySlug}`}>{post.categoryName}</Link>
              </>
            )}
            <ChevronRight size={14} aria-hidden="true" />
            <span className={styles.current} aria-current="page">{post.title}</span>
          </nav>

          <header className={styles.articleHeader}>
            {post.categoryName && <Badge className={styles.categoryBadge}>{post.categoryName}</Badge>}
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
                    {post.publishedAt && <span className={styles.statDate}><Calendar size={14} /> {formatDate(post.publishedAt)}</span>}
                    <span className={styles.statRead}><Clock size={14} /> {post.readingTimeMinutes} min read</span>
                  </div>
                </div>
              </div>
              
              <ShareButton
                kind="blog-post"
                handle={post.slug}
                title={post.title}
                campaign={PUBLIC_PAGE_SHARE_CAMPAIGN}
                className={styles.shareButton}
              />
            </div>
          </header>

          <div className={`${styles.layoutGrid} ${headings.length === 0 ? styles.noToc : ''}`}>
            <main className={styles.mainContent}>
              {thumbnailUrl && !thumbnailFailed && (
                <figure className={styles.featuredMedia}>
                  <img
                    src={thumbnailUrl}
                    alt={post.title}
                    width={1200}
                    height={630}
                    className={styles.featuredImage}
                    onError={() => setThumbnailFailed(true)}
                  />
                </figure>
              )}

              {headings.length > 0 && (
                <div className={styles.mobileToc}>
                  <Accordion type="single" collapsible>
                    <AccordionItem value="toc" className={styles.mobileTocItem}>
                      <AccordionTrigger className={styles.mobileTocTrigger}>
                        <span className={styles.tocHeading}>
                          <span className={styles.tocIcon}><List size={16} /></span>
                          Table of Contents
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>{tocList}</AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}

              <article 
                className={styles.articleContent}
                dangerouslySetInnerHTML={articleMarkup}
              />

              <div className={styles.reactionSection}>
                <h3>Was this article helpful?</h3>
                <div className={styles.reactionButtons}>
                  <Button 
                    variant={reactionsData?.userReaction === 'like' ? 'primary' : 'outline'}
                    className={styles.reactionBtn}
                    data-selected={reactionsData?.userReaction === 'like'}
                    aria-pressed={reactionsData?.userReaction === 'like'}
                    onClick={() => handleReact('like')}
                    disabled={reactMutation.isPending}
                  >
                    <ThumbsUp size={18} />
                    <span className={styles.reactionCount}>{reactionsData?.likes || 0}</span>
                  </Button>
                  <Button 
                    variant={reactionsData?.userReaction === 'dislike' ? 'primary' : 'outline'}
                    className={styles.reactionBtn}
                    data-selected={reactionsData?.userReaction === 'dislike'}
                    aria-pressed={reactionsData?.userReaction === 'dislike'}
                    onClick={() => handleReact('dislike')}
                    disabled={reactMutation.isPending}
                  >
                    <ThumbsDown size={18} />
                    <span className={styles.reactionCount}>{reactionsData?.dislikes || 0}</span>
                  </Button>
                </div>
              </div>

              <hr className={styles.divider} />

              <section className={styles.commentsSection}>
                <h3 className={styles.sectionHeading}>
                  <span className={styles.headingIcon} data-tone="sage"><MessageCircle size={16} /></span>
                  Comments ({commentsData?.comments?.length || 0})
                </h3>
                
                {authState.type === "authenticated" ? (
                  <div className={styles.mainCommentForm}>
                    <CommentForm postId={post.id} />
                  </div>
                ) : (
                  <div className={styles.loginPrompt}>
                    <p>Please log in to join the discussion.</p>
                    <Button asChild className={styles.ctaPill}>
                      <Link to={`/login?redirectTo=${encodeURIComponent(location.pathname)}`}>Log In to Comment</Link>
                    </Button>
                  </div>
                )}

                <div className={styles.commentsList}>
                  {commentRoots.length > 0 ? (
                    commentRoots.map(root => <CommentItem key={root.id} comment={root} allComments={commentsData!.comments} />)
                  ) : (
                    <p className={styles.noComments}>No comments yet. Be the first to share your thoughts!</p>
                  )}
                </div>
              </section>
            </main>

            <aside className={styles.sidebar}>
              {headings.length > 0 && (
                <nav className={styles.desktopToc} aria-label="Table of contents">
                  <div className={styles.tocCard}>
                    <h4 className={styles.tocHeading}>
                      <span className={styles.tocIcon}><List size={16} /></span>
                      Table of Contents
                    </h4>
                    <div ref={tocScrollRef} className={styles.tocScroll}>{tocList}</div>
                  </div>
                </nav>
              )}
            </aside>
          </div>

          {relatedPosts.length > 0 && (
            <section className={styles.relatedSection}>
              <h2 className={styles.sectionHeading}>Related Articles</h2>
              <div className={styles.relatedGrid}>
                {relatedPosts.map(rp => (
                  <RelatedArticleCard key={rp.id} post={rp} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}