import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import DOMPurify from 'dompurify';
import { z } from 'zod';
import { ChevronRight, Clock, Calendar, ThumbsUp, ThumbsDown } from 'lucide-react';
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
import { BlogPostCard } from '../components/BlogPostCard';
import { PublicCommentItem } from '../endpoints/blog/comments/list_GET.schema';
import { getSessionId } from '../helpers/getSessionId';
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
          {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
          <Button type="submit" disabled={mutation.isPending}>
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

export default function BlogPostDetail() {
  const { blogSlug } = useParams<{ blogSlug: string }>();
  const { data, isFetching, error } = useBlogPostQuery(blogSlug);
  const post = data?.post;

  const [activeHeadingId, setActiveHeadingId] = useState<string>('');

  // Sanitize once, then bake stable ids into the h2/h3 tags as part of the
  // same string — see extractHeadingsWithIds for why this replaced the old
  // "mutate el.id in a useEffect" approach (those ids never survived).
  const { html: articleHtml, headings } = useMemo(() => {
    if (!post?.content) return { html: '', headings: [] as { id: string, text: string, level: number }[] };
    const sanitized = DOMPurify.sanitize(post.content, { ADD_TAGS: ["iframe"], ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "controls", "playsinline", "preload", "poster"] });
    return extractHeadingsWithIds(sanitized);
  }, [post?.content]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveHeadingId(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -70% 0px' }
    );

    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  const scrollToHeading = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
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
          <Skeleton style={{ width: '100%', height: '400px', borderRadius: 'var(--radius-lg)', marginBottom: '2rem' }} />
          <Skeleton style={{ width: '60%', height: '40px', marginBottom: '1rem' }} />
          <Skeleton style={{ width: '40%', height: '20px', marginBottom: '2rem' }} />
          <Skeleton style={{ width: '100%', height: '20px', marginBottom: '0.5rem' }} />
          <Skeleton style={{ width: '100%', height: '20px', marginBottom: '0.5rem' }} />
          <Skeleton style={{ width: '80%', height: '20px' }} />
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
            <p>The article you are looking for does not exist or has been removed.</p>
            <Button asChild><Link to="/blog">Back to Blog</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  const canonicalUrl = `https://testkart.in/blog/${post.slug}`;

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
            "datePublished": post.publishedAt?.toISOString(),
            "dateModified": post.updatedAt?.toISOString(),
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
          <nav className={styles.breadcrumb}>
            <Link to="/">Home</Link>
            <ChevronRight size={16} />
            <Link to="/blog">Blog</Link>
            {post.categoryName && (
              <>
                <ChevronRight size={16} />
                <Link to={`/blog?category=${post.categorySlug}`}>{post.categoryName}</Link>
              </>
            )}
            <ChevronRight size={16} />
            <span className={styles.current}>{post.title}</span>
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
                    {post.publishedAt && <span><Calendar size={14} /> {formatDate(post.publishedAt)}</span>}
                    <span><Clock size={14} /> {post.readingTimeMinutes} min read</span>
                  </div>
                </div>
              </div>
              
              <ShareButton
                kind="blog-post"
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
                dangerouslySetInnerHTML={{ __html: wrapContentTables(articleHtml) }}
              />

              <div className={styles.reactionSection}>
                <h3>Was this article helpful?</h3>
                <div className={styles.reactionButtons}>
                  <Button 
                    variant={reactionsData?.userReaction === 'like' ? 'primary' : 'outline'}
                    className={styles.reactionBtn}
                    onClick={() => handleReact('like')}
                    disabled={reactMutation.isPending}
                  >
                    <ThumbsUp size={18} />
                    <span className={styles.reactionCount}>{reactionsData?.likes || 0}</span>
                  </Button>
                  <Button 
                    variant={reactionsData?.userReaction === 'dislike' ? 'primary' : 'outline'}
                    className={styles.reactionBtn}
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
                <h3>Comments ({commentsData?.comments?.length || 0})</h3>
                
                {authState.type === "authenticated" ? (
                  <div className={styles.mainCommentForm}>
                    <CommentForm postId={post.id} />
                  </div>
                ) : (
                  <div className={styles.loginPrompt}>
                    <p>Please log in to join the discussion.</p>
                    <Button asChild>
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
                <>
                  <div className={styles.desktopToc}>
                    <div className={styles.tocSticky}>
                      <h4>Table of Contents</h4>
                      <ul className={styles.tocList}>
                        {headings.map(h => (
                          <li key={h.id} className={styles.tocItem} data-level={h.level}>
                            <a 
                              href={`#${h.id}`} 
                              onClick={e => scrollToHeading(e, h.id)}
                              style={h.id === activeHeadingId ? { color: 'var(--primary)', fontWeight: 500 } : undefined}
                            >
                              {h.text}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className={styles.mobileToc}>
                    <Accordion type="single" collapsible>
                      <AccordionItem value="toc">
                        <AccordionTrigger>Table of Contents</AccordionTrigger>
                        <AccordionContent>
                          <ul className={styles.tocList}>
                            {headings.map(h => (
                              <li key={h.id} className={styles.tocItem} data-level={h.level}>
                                <a 
                                  href={`#${h.id}`} 
                                  onClick={e => scrollToHeading(e, h.id)}
                                  style={h.id === activeHeadingId ? { color: 'var(--primary)', fontWeight: 500 } : undefined}
                                >
                                  {h.text}
                                </a>
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
                  <BlogPostCard key={rp.id} post={rp} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}