import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, Clock, Calendar } from 'lucide-react';
import { useBlogCategoriesQuery, useBlogPostsInfiniteQuery } from '../helpers/useBlogQuery';
import { useDebounce } from '../helpers/useDebounce';
import { SEOHead } from '../components/SEOHead';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';
import { Skeleton } from '../components/Skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '../components/Avatar';
import { PublicPostListItem } from '../endpoints/blog/list_GET.schema';
import styles from './blog.module.css';

const formatDate = (date: string | Date, month: 'long' | 'short' = 'short') => {
  return new Intl.DateTimeFormat("en-IN", {
    month,
    day: "numeric",
    year: "numeric"
  }).format(new Date(date));
};

const PostThumb = ({ src, className }: { src: string | null; className: string }) => {
  const [failed, setFailed] = useState(false);
  return (
    <div className={className}>
      {src && !failed && (
        <img
          src={src}
          alt=""
          width={1200}
          height={675}
          loading="lazy"
          className={styles.thumbImg}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};

const PostMeta = ({ post, month }: { post: PublicPostListItem; month: 'long' | 'short' }) => (
  <div className={styles.cardFooter}>
    <div className={styles.author}>
      <Avatar className={styles.avatar}>
        <AvatarImage src={post.authorAvatar || undefined} />
        <AvatarFallback>{post.authorName?.[0] || 'T'}</AvatarFallback>
      </Avatar>
      <span className={styles.authorName}>{post.authorName || 'Testkart Team'}</span>
    </div>
    <div className={styles.meta}>
      <span className={styles.metaItem}><Clock size={14} aria-hidden="true" /> {post.readingTimeMinutes} min</span>
      {post.publishedAt && (
        <span className={styles.metaItem}><Calendar size={14} aria-hidden="true" /> {formatDate(post.publishedAt, month)}</span>
      )}
    </div>
  </div>
);

const FeaturedPostCard = ({ post }: { post: PublicPostListItem }) => (
  <Link to={`/blog/${post.slug}`} className={styles.featuredCard}>
    <PostThumb src={post.featuredImage} className={styles.featuredThumb} />
    <div className={styles.featuredBody}>
      <div className={styles.featuredTags}>
        <span className={styles.latestTag}>Latest</span>
        {post.categoryName && <Badge className={styles.categoryBadge}>{post.categoryName}</Badge>}
      </div>
      <h2 className={styles.featuredTitle}>{post.title}</h2>
      <p className={styles.featuredExcerpt}>{post.excerpt || 'Read the full story...'}</p>
      <PostMeta post={post} month="long" />
    </div>
  </Link>
);

const PostCard = ({ post }: { post: PublicPostListItem }) => (
  <Link to={`/blog/${post.slug}`} className={styles.postCard}>
    <PostThumb src={post.featuredImage} className={styles.postThumb} />
    <div className={styles.postBody}>
      {post.categoryName && <Badge className={styles.categoryBadge}>{post.categoryName}</Badge>}
      <h3 className={styles.postTitle}>{post.title}</h3>
      <p className={styles.postExcerpt}>{post.excerpt || 'Read more about this topic...'}</p>
      <PostMeta post={post} month="short" />
    </div>
  </Link>
);

const PostSkeleton = () => (
  <div className={styles.skeletonCard} aria-hidden="true">
    <Skeleton style={{ width: '100%', aspectRatio: '16/9', borderRadius: 0 }} />
    <div className={styles.skeletonContent}>
      <Skeleton style={{ width: '7rem', height: '22px', borderRadius: '999px', marginBottom: '14px' }} />
      <Skeleton style={{ width: '90%', height: '22px', marginBottom: '8px' }} />
      <Skeleton style={{ width: '70%', height: '22px', marginBottom: '16px' }} />
      <Skeleton style={{ width: '100%', height: '14px', marginBottom: '8px' }} />
      <Skeleton style={{ width: '80%', height: '14px', marginBottom: '20px' }} />
      <div className={styles.skeletonFooter}>
        <Skeleton style={{ width: '26px', height: '26px', borderRadius: '50%' }} />
        <Skeleton style={{ width: '100px', height: '14px' }} />
      </div>
    </div>
  </div>
);

export default function BlogListingPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [categorySlug, setCategorySlug] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: categoriesData } = useBlogCategoriesQuery({ type: "blog" });

  const queryParams = useMemo(() => ({
    type: "blog" as const,
    limit: 12,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(categorySlug ? { categorySlug } : {})
  }), [debouncedSearch, categorySlug]);

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useBlogPostsInfiniteQuery(queryParams);

  // Offset paging can repeat a post if one is published mid-scroll; keep the first copy.
  const posts = useMemo(() => {
    const seen = new Set<number>();
    return (data?.pages ?? []).flatMap((p) => p.posts).filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [data]);

  // Loads the next batch once the sentinel is within 400px of the viewport.
  // Re-created after each batch, so a sentinel still in range keeps loading;
  // removed while a request is in flight, after a failed batch (Retry takes
  // over) and when the list is exhausted. root: document keeps rootMargin
  // working inside iframes such as the editor preview.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage || isFetchNextPageError) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          fetchNextPage();
        }
      },
      { root: document, rootMargin: '0px 0px 400px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, posts.length]);

  const handleCategoryChange = (slug: string) => {
    setCategorySlug(slug);
  };

  const canonicalUrl = "https://testkart.in/blog";

  const isInitialView = !debouncedSearch && !categorySlug;
  const loadedPages = data?.pages.length ?? 0;
  
  // The newest post leads the first page as the large card; the grid continues in date order.
  let featuredPost = null;
  let gridPosts = posts;

  if (isInitialView && posts.length > 0) {
    featuredPost = posts[0];
    gridPosts = posts.slice(1);
  }

  const categories = [{ id: 0, slug: "", name: "All" }, ...(categoriesData?.categories ?? [])];

  return (
    <>
      <SEOHead 
        title="Blog - Testkart | Insights on Online Education & Mock Tests"
        description="Insights, tips, and guides on online education, mock test preparation, and teaching excellence."
        url={canonicalUrl}
      />
      <div className={styles.pageWrapper}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <h1>Testkart Blog – Exam Prep Tips, Strategies & Updates</h1>
            <p>Insights, tips, and guides on online education, mock test preparation, and teaching excellence.</p>
          </div>
        </section>

        <div className={styles.container}>
          <div className={styles.controlsBar}>
            <div className={styles.filterPills} role="group" aria-label="Filter by category">
              {categories.map(cat => {
                const selected = categorySlug === cat.slug;
                return (
                  <Button
                    key={cat.id}
                    variant="ghost"
                    onClick={() => handleCategoryChange(cat.slug)}
                    className={styles.pill}
                    data-selected={selected}
                    aria-pressed={selected}
                  >
                    {cat.name}
                  </Button>
                );
              })}
            </div>
            
            <div className={styles.searchBar}>
              <Search className={styles.searchIcon} size={18} aria-hidden="true" />
              <Input 
                type="search"
                placeholder="Search articles..." 
                aria-label="Search articles"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>

          {isPending ? (
            <div className={styles.postsGrid}>
              {Array.from({ length: 6 }).map((_, i) => <PostSkeleton key={i} />)}
            </div>
          ) : isError && posts.length === 0 ? (
            <div className={styles.loadError} role="alert">
              <p>We couldn't load the articles. Please check your connection and try again.</p>
              <Button variant="ghost" className={styles.retryButton} onClick={() => refetch()}>Retry</Button>
            </div>
          ) : posts.length === 0 ? (
            <div className={styles.emptyState}>
              <h2>No articles found</h2>
              <p>We couldn't find any articles matching your criteria.</p>
              <Button className={styles.ctaPill} onClick={() => { setSearch(""); setCategorySlug(""); }}>Clear Filters</Button>
            </div>
          ) : (
            <>
              {featuredPost && (
                <div className={styles.featuredSection}>
                  <FeaturedPostCard post={featuredPost} />
                </div>
              )}

              <div className={styles.postsGrid}>
                {gridPosts.map(post => (
                  <PostCard key={post.id} post={post} />
                ))}
                {isFetchingNextPage && Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={`more-${i}`} />)}
              </div>

              {hasNextPage && <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />}

              <div className={styles.listStatus} aria-live="polite">
                {isFetchingNextPage && <span className={styles.srOnly}>Loading more articles</span>}
                {isFetchNextPageError && (
                  <div className={styles.loadError} role="alert">
                    <p>We couldn't load more articles.</p>
                    <Button variant="ghost" className={styles.retryButton} onClick={() => fetchNextPage()}>Retry</Button>
                  </div>
                )}
                {!hasNextPage && loadedPages > 1 && (
                  <p className={styles.endMessage}>You've reached the end of the articles</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
