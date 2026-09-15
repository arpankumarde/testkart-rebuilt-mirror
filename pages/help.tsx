import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, FolderOpen, FileText } from 'lucide-react';
import { useBlogCategoriesQuery, useBlogPostsQuery } from '../helpers/useBlogQuery';
import { useDebounce } from '../helpers/useDebounce';
import { SEOHead } from '../components/SEOHead';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { BlogPostCard } from '../components/BlogPostCard';
import { Skeleton } from '../components/Skeleton';
import styles from './help.module.css';

export default function HelpPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category') || '';
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);

  const { data: categoriesData, isFetching: isCatsFetching } = useBlogCategoriesQuery({ type: "knowledge_base" });
  
  const { data: postsData, isFetching: isPostsFetching } = useBlogPostsQuery({
    type: "knowledge_base",
    limit: 100,
    page: 1,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(categoryFilter ? { categorySlug: categoryFilter } : {})
  });

  const canonicalUrl = "https://testkart.in/help";
  const isFiltered = !!categoryFilter || !!debouncedSearch;

  const groupedByCategory = useMemo(() => {
    if (!postsData || !categoriesData || isFiltered) return {};
    const groups: Record<string, typeof postsData.posts> = {};
    categoriesData.categories.forEach(cat => {
      groups[cat.slug] = [];
    });
    postsData.posts.forEach(post => {
      if (post.categorySlug && groups[post.categorySlug] !== undefined) {
        groups[post.categorySlug].push(post);
      }
    });
    return groups;
  }, [postsData, categoriesData, isFiltered]);

  return (
    <>
      <SEOHead 
        title="Knowledge Base"
        description="Find answers, guides, and tutorials to help you get the most out of Testkart."
        url={canonicalUrl}
      />
      <div className={styles.pageWrapper}>
        <div className={styles.topBar}>
          <div className={styles.topBarInner}>
            <div className={styles.breadcrumb}>
              <Link to="/">Home</Link>
              <span className={styles.breadcrumbSeparator}>&gt;</span>
              <span className={styles.breadcrumbCurrent}>Knowledge Base</span>
            </div>
            <div className={styles.searchContainer}>
              <Search className={styles.searchIcon} size={16} />
              <Input 
                placeholder="Find articles here..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>
        </div>

        <div className={styles.container}>
          {isFiltered ? (
            <div className={styles.resultsSection}>
              <div className={styles.resultsHeader}>
                <h2>
                  {debouncedSearch 
                    ? `Search Results for "${debouncedSearch}"` 
                    : `Articles in ${categoriesData?.categories.find(c => c.slug === categoryFilter)?.name || 'Category'}`}
                </h2>
                <Button variant="ghost" onClick={() => { setSearch(""); setSearchParams({}); }}>Clear</Button>
              </div>

              {isPostsFetching && !postsData ? (
                <div className={styles.skeletonGrid}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className={styles.skeletonCard}><Skeleton style={{ height: '200px' }} /></div>
                  ))}
                </div>
              ) : postsData?.posts.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No articles found matching your criteria.</p>
                </div>
              ) : (
                <div className={styles.postsGrid}>
                  {postsData?.posts.map(post => (
                    <BlogPostCard key={post.id} post={post} prefix="/help" />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.kbGrid}>
              {isCatsFetching || isPostsFetching || !categoriesData ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={styles.kbCategory}>
                    <div className={styles.kbCategoryHeader}>
                      <Skeleton style={{ width: '200px', height: '1.5rem' }} />
                    </div>
                    <div className={styles.kbArticleList}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <Skeleton key={j} style={{ width: '100%', height: '1.25rem', marginBottom: '8px' }} />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                categoriesData.categories.map(cat => {
                  const catPosts = groupedByCategory[cat.slug] || [];
                  if (catPosts.length === 0) return null;
                  return (
                    <div key={cat.id} className={styles.kbCategory}>
                      <div className={styles.kbCategoryHeader}>
                        <FolderOpen size={20} />
                        <h2>{cat.name} ({cat.postCount})</h2>
                      </div>
                      <div className={styles.kbArticleList}>
                        {catPosts.slice(0, 5).map(post => (
                          <Link key={post.id} to={`/help/${post.slug}`} className={styles.kbArticleLink}>
                            <FileText size={16} className={styles.kbArticleIcon} />
                            <span>{post.title}</span>
                          </Link>
                        ))}
                      </div>
                      {cat.postCount > 5 && (
                        <Link to={`/help?category=${cat.slug}`} className={styles.viewAllLink}>
                          View all {cat.postCount}
                        </Link>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}