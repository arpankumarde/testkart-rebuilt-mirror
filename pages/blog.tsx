import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Search, Clock, Calendar } from 'lucide-react';
import { useBlogCategoriesQuery, useBlogPostsQuery } from '../helpers/useBlogQuery';
import { useDebounce } from '../helpers/useDebounce';
import { SEOHead } from '../components/SEOHead';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';
import { Skeleton } from '../components/Skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '../components/Avatar';
import { BlogPostCard } from '../components/BlogPostCard';
import { PublicPostListItem } from '../endpoints/blog/list_GET.schema';
import styles from './blog.module.css';

const formatDate = (date: string | Date) => {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(date));
};

const FeaturedPostCard = ({ post }: { post: PublicPostListItem }) => (
  <Link to={`/blog/${post.slug}`} className={styles.featuredCard}>
    <div className={styles.featuredContent}>
      {post.categoryName && (
        <Badge className={styles.featuredBadge}>{post.categoryName}</Badge>
      )}
      <h2 className={styles.featuredTitle}>{post.title}</h2>
      <p className={styles.featuredExcerpt}>{post.excerpt || 'Read the full story...'}</p>
      <div className={styles.featuredFooter}>
        <div className={styles.featuredAuthor}>
          <Avatar className={styles.featuredAvatar}>
            <AvatarImage src={post.authorAvatar || undefined} />
            <AvatarFallback>{post.authorName?.[0] || 'T'}</AvatarFallback>
          </Avatar>
          <span>{post.authorName || 'Testkart Team'}</span>
        </div>
        <div className={styles.featuredMeta}>
          <span className={styles.metaItem}><Clock size={16} /> {post.readingTimeMinutes} min</span>
          {post.publishedAt && (
            <span className={styles.metaItem}><Calendar size={16} /> {formatDate(post.publishedAt)}</span>
          )}
        </div>
      </div>
    </div>
  </Link>
);

export default function BlogListingPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [categorySlug, setCategorySlug] = useState("");

  const { data: categoriesData } = useBlogCategoriesQuery({ type: "blog" });

  const queryParams = useMemo(() => ({
    type: "blog" as const,
    page,
    limit: 12,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(categorySlug ? { categorySlug } : {})
  }), [page, debouncedSearch, categorySlug]);

  const { data: postsData, isFetching } = useBlogPostsQuery(queryParams);

  const handleCategoryChange = (slug: string) => {
    setCategorySlug(slug);
    setPage(1);
  };

  const canonicalUrl = "https://testkart.in/blog";

  const isInitialView = page === 1 && !debouncedSearch && !categorySlug;
  const posts = postsData?.posts || [];
  
  // Logic to determine featured post vs grid posts
  let featuredPost = null;
  let gridPosts = posts;

  if (isInitialView && posts.length > 0) {
    const featuredIndex = posts.findIndex(p => p.isFeatured);
    if (featuredIndex !== -1) {
      featuredPost = posts[featuredIndex];
      gridPosts = posts.filter((_, i) => i !== featuredIndex);
    } else {
      featuredPost = posts[0];
      gridPosts = posts.slice(1);
    }
  }

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
            <div className={styles.filterPills}>
              <Button 
                variant={!categorySlug ? "primary" : "outline"} 
                onClick={() => handleCategoryChange("")}
                className={styles.pill}
                size="sm"
              >
                All
              </Button>
              {categoriesData?.categories.map(cat => (
                <Button 
                  key={cat.id}
                  variant={categorySlug === cat.slug ? "primary" : "outline"}
                  onClick={() => handleCategoryChange(cat.slug)}
                  className={styles.pill}
                  size="sm"
                >
                  {cat.name}
                </Button>
              ))}
            </div>
            
            <div className={styles.searchBar}>
              <Search className={styles.searchIcon} size={18} />
              <Input 
                placeholder="Search articles..." 
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className={styles.searchInput}
              />
            </div>
          </div>

          {isFetching && !postsData ? (
            <div className={styles.skeletonGrid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={styles.skeletonCard}>
                  <Skeleton style={{ width: '100%', aspectRatio: '16/9' }} />
                  <div className={styles.skeletonContent}>
                    <Skeleton style={{ width: '60%', height: '24px', marginBottom: '16px' }} />
                    <Skeleton style={{ width: '100%', height: '16px', marginBottom: '8px' }} />
                    <Skeleton style={{ width: '80%', height: '16px', marginBottom: '24px' }} />
                    <div className={styles.skeletonFooter}>
                      <Skeleton style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                      <Skeleton style={{ width: '100px', height: '16px' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className={styles.emptyState}>
              <h2>No articles found</h2>
              <p>We couldn't find any articles matching your criteria.</p>
              <Button onClick={() => { setSearch(""); setCategorySlug(""); }}>Clear Filters</Button>
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
                  <BlogPostCard key={post.id} post={post} />
                ))}
              </div>

              {postsData && postsData.totalPages > 1 && (
                <div className={styles.pagination}>
                  <Button 
                    variant="outline" 
                    onClick={() => setPage(p => p - 1)} 
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className={styles.pageInfo}>Page {page} of {postsData.totalPages}</span>
                  <Button 
                    variant="outline" 
                    onClick={() => setPage(p => p + 1)} 
                    disabled={page >= postsData.totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}