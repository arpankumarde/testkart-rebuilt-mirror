import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronRight, FileText, Flame, LayoutGrid, LifeBuoy, Search, SearchX, X } from 'lucide-react';
import { useBlogCategoriesQuery, useBlogPostsQuery } from '../helpers/useBlogQuery';
import { useDebounce } from '../helpers/useDebounce';
import { SEOHead } from '../components/SEOHead';
import { Skeleton } from '../components/Skeleton';
import { HelpArticleCard } from '../components/HelpArticleCard';
import { HELP_CARD_TONES, HelpCategoryCard, helpCardVariant, helpCategoryIcon } from '../components/HelpCategoryCard';
import type { PublicPostListItem } from '../endpoints/blog/list_GET.schema';
import styles from './help.module.css';

const POPULAR_LIMIT = 4;
const SHORTCUT_LIMIT = 6;

const articleCount = (n: number) => `${n} article${n === 1 ? '' : 's'}`;

export default function HelpPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category') || '';
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 300);
  const isFiltered = !!categoryFilter || !!debouncedSearch;

  const { data: categoriesData } = useBlogCategoriesQuery({ type: "knowledge_base" });

  // The unfiltered list, seeded by help.prefetch.ts. It feeds the topic cards,
  // shortcuts and popular guides, so it stays loaded while a filter is on.
  const { data: allPostsData } = useBlogPostsQuery({ type: "knowledge_base", limit: 100, page: 1 });

  const { data: filteredData, isFetching: isFilterFetching } = useBlogPostsQuery(
    {
      type: "knowledge_base",
      limit: 100,
      page: 1,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(categoryFilter ? { categorySlug: categoryFilter } : {}),
    },
    { enabled: isFiltered, keepPrevious: true },
  );

  const canonicalUrl = "https://testkart.in/help";
  const categories = useMemo(() => categoriesData?.categories ?? [], [categoriesData]);
  const allPosts = useMemo(() => allPostsData?.posts ?? [], [allPostsData]);
  const activeCategory = categories.find(c => c.slug === categoryFilter);

  // Articles whose category is missing or not a help category still get a card
  // of their own, so every published article is reachable from this page.
  const { topics, uncategorised } = useMemo(() => {
    const bySlug = new Map<string, PublicPostListItem[]>();
    const loose: PublicPostListItem[] = [];
    const known = new Set(categories.map(c => c.slug));
    allPosts.forEach(post => {
      if (post.categorySlug && known.has(post.categorySlug)) {
        bySlug.set(post.categorySlug, [...(bySlug.get(post.categorySlug) ?? []), post]);
      } else {
        loose.push(post);
      }
    });
    return {
      topics: categories
        .filter(c => bySlug.has(c.slug))
        .map(c => ({ category: c, posts: bySlug.get(c.slug)! })),
      uncategorised: loose,
    };
  }, [categories, allPosts]);

  // Biggest topics first, so the tiers read featured, medium, compact. The
  // sort is stable, so topics of equal size keep the categories endpoint's
  // order. Tones are dealt after sorting, keeping neighbours different.
  const cards = useMemo(() => {
    const entries = [
      ...topics.map(({ category, posts }) => ({
        key: `cat-${category.id}`,
        name: category.name,
        slug: category.slug as string | null,
        description: category.description,
        articleCount: category.postCount,
        posts,
      })),
      ...(uncategorised.length > 0
        ? [{ key: 'uncategorised', name: 'More guides', slug: null, description: null, articleCount: uncategorised.length, posts: uncategorised }]
        : []),
    ];
    return entries
      .sort((a, b) => b.articleCount - a.articleCount)
      .map((entry, i) => ({
        ...entry,
        variant: helpCardVariant(entry.articleCount),
        tone: HELP_CARD_TONES[i % HELP_CARD_TONES.length],
      }));
  }, [topics, uncategorised]);

  const popular = useMemo(
    () => allPosts.length > POPULAR_LIMIT
      ? [...allPosts].sort((a, b) => b.viewCount - a.viewCount).slice(0, POPULAR_LIMIT)
      : [],
    [allPosts],
  );

  const shortcuts = useMemo(() => {
    const top = [...topics]
      .sort((a, b) => b.category.postCount - a.category.postCount)
      .slice(0, SHORTCUT_LIMIT)
      .map(t => t.category);
    if (activeCategory && !top.some(c => c.slug === activeCategory.slug)) top.push(activeCategory);
    return top;
  }, [topics, activeCategory]);

  const clearAll = () => {
    setSearch("");
    setSearchParams({});
  };

  const results = filteredData?.posts ?? [];
  const resultsTitle = debouncedSearch
    ? `Results for "${debouncedSearch}"${activeCategory ? ` in ${activeCategory.name}` : ''}`
    : activeCategory?.name ?? 'Topic not found';
  const isLoadingHome = !categoriesData || !allPostsData;

  return (
    <>
      <SEOHead
        title="Knowledge Base"
        description="Find answers, guides, and tutorials to help you get the most out of Testkart."
        url={canonicalUrl}
      />
      <div className={styles.pageWrapper}>
        <section className={styles.hero} aria-labelledby="help-title">
          <span className={`${styles.shape} ${styles.shapeMint}`} aria-hidden="true" />
          <span className={`${styles.shape} ${styles.shapeRing}`} aria-hidden="true" />
          <span className={`${styles.shape} ${styles.shapeBlue}`} aria-hidden="true" />
          <span className={`${styles.shape} ${styles.shapePeach}`} aria-hidden="true" />
          <span className={`${styles.shape} ${styles.shapeButter}`} aria-hidden="true" />

          <div className={styles.heroInner}>
            <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
              <Link to="/">Home</Link>
              <ChevronRight size={14} aria-hidden="true" />
              <span aria-current="page">Knowledge Base</span>
            </nav>

            <h1 id="help-title" className={styles.heroTitle}>
              How can we{' '}
              <span className={styles.highlight}><span className={styles.highlightText}>help</span></span>{' '}
              you?
            </h1>
            <p className={styles.heroText}>
              Find answers, explore guides, and get the most out of Testkart.
            </p>

            <form role="search" className={styles.searchForm} onSubmit={e => e.preventDefault()}>
              <label htmlFor="help-search" className={styles.srOnly}>Search help articles</label>
              <Search className={styles.searchIcon} size={20} aria-hidden="true" />
              <input
                id="help-search"
                type="search"
                autoComplete="off"
                placeholder="Search articles, guides, and tutorials..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') setSearch(""); }}
                className={styles.searchInput}
              />
              {search && (
                <button type="button" className={styles.clearButton} onClick={() => setSearch("")} aria-label="Clear search">
                  <X size={18} aria-hidden="true" />
                </button>
              )}
            </form>

            {shortcuts.length > 0 && (
              <nav aria-label="Help topics" className={styles.chips}>
                <Link
                  to="/help"
                  onClick={() => setSearch("")}
                  className={styles.chip}
                  aria-current={!isFiltered ? 'page' : undefined}
                >
                  <LayoutGrid size={15} aria-hidden="true" />
                  All topics
                </Link>
                {shortcuts.map(cat => {
                  const Icon = helpCategoryIcon(cat.slug);
                  return (
                    <Link
                      key={cat.id}
                      to={`/help?category=${cat.slug}`}
                      className={styles.chip}
                      aria-current={cat.slug === categoryFilter ? 'page' : undefined}
                    >
                      <Icon size={15} aria-hidden="true" />
                      {cat.name}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
        </section>

        <div className={styles.container}>
          {isFiltered ? (
            <section className={styles.section} aria-labelledby="help-results-title" aria-busy={isFilterFetching}>
              <div className={styles.resultsHeader}>
                <Link to="/help" onClick={() => setSearch("")} className={styles.backLink}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  All topics
                </Link>
                <h2 id="help-results-title" className={styles.sectionTitle}>{resultsTitle}</h2>
                {!debouncedSearch && activeCategory?.description && (
                  <p className={styles.topicDescription}>{activeCategory.description}</p>
                )}
                <p className={styles.resultsCount} aria-live="polite">
                  {isFilterFetching ? 'Searching...' : filteredData ? articleCount(results.length) : ''}
                </p>
              </div>

              {!filteredData ? (
                <div className={styles.resultsGrid}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className={styles.skeletonRow} />
                  ))}
                </div>
              ) : results.length === 0 && !isFilterFetching ? (
                <div className={styles.empty}>
                  <span className={styles.emptyIcon} aria-hidden="true"><SearchX size={28} /></span>
                  <h3 className={styles.emptyTitle}>
                    {debouncedSearch ? `No articles match "${debouncedSearch}"` : 'No articles in this topic yet'}
                  </h3>
                  <p className={styles.emptyText}>
                    {debouncedSearch
                      ? 'Try a shorter keyword or check the spelling, or start with one of the guides below.'
                      : 'Pick another topic, or start with one of the guides below.'}
                  </p>
                  <div className={styles.emptyActions}>
                    {debouncedSearch && (
                      <button type="button" className={styles.pillPrimary} onClick={() => setSearch("")}>
                        Clear search
                      </button>
                    )}
                    <Link to="/help" onClick={() => setSearch("")} className={styles.pillSecondary}>
                      Browse all topics
                    </Link>
                  </div>
                  {popular.length > 0 && (
                    <>
                      <p className={styles.suggestionsLabel}>Popular guides</p>
                      <ul className={styles.suggestions}>
                        {popular.slice(0, 3).map(post => (
                          <li key={post.id}>
                            <Link to={`/help/${post.slug}`}>
                              <FileText size={16} aria-hidden="true" />
                              <span>{post.title.trim()}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ) : (
                <div className={styles.resultsGrid}>
                  {results.map(post => (
                    <HelpArticleCard key={post.id} post={post} layout="row" showExcerpt />
                  ))}
                </div>
              )}
            </section>
          ) : (
            <>
              {popular.length > 0 && (
                <section className={styles.section} aria-labelledby="help-popular-title">
                  <div className={styles.sectionHead}>
                    <span className={styles.sectionIcon} aria-hidden="true"><Flame size={18} /></span>
                    <h2 id="help-popular-title" className={styles.sectionTitle}>Popular guides</h2>
                    <span className={styles.sectionHint}>Most read</span>
                  </div>
                  <div className={styles.popularGrid}>
                    {popular.map(post => (
                      <HelpArticleCard key={post.id} post={post} layout="feature" />
                    ))}
                  </div>
                </section>
              )}

              <section id="topics" className={styles.section} aria-labelledby="help-topics-title">
                <div className={styles.sectionHead}>
                  <span className={`${styles.sectionIcon} ${styles.sectionIconLavender}`} aria-hidden="true">
                    <LayoutGrid size={18} />
                  </span>
                  <h2 id="help-topics-title" className={styles.sectionTitle}>Browse by topic</h2>
                </div>

                {isLoadingHome ? (
                  <div className={styles.topicGrid}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className={styles.skeletonCard} />
                    ))}
                  </div>
                ) : topics.length === 0 && uncategorised.length === 0 ? (
                  <div className={styles.empty}>
                    <span className={styles.emptyIcon} aria-hidden="true"><FileText size={28} /></span>
                    <h3 className={styles.emptyTitle}>No help articles yet</h3>
                    <p className={styles.emptyText}>Guides will appear here as soon as they are published.</p>
                  </div>
                ) : (
                  <div className={styles.topicStack}>
                    {(['featured', 'medium', 'compact'] as const).map(variant => {
                      const tier = cards.filter(c => c.variant === variant);
                      if (tier.length === 0) return null;
                      return (
                        <div key={variant} className={styles[`${variant}Tier`]}>
                          {tier.map(({ key, ...card }) => (
                            <HelpCategoryCard key={key} {...card} />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          <aside className={styles.support} aria-label="Contact support">
            <span className={styles.supportIcon} aria-hidden="true"><LifeBuoy size={22} /></span>
            <div className={styles.supportText}>
              <p className={styles.supportTitle}>Still need a hand?</p>
              <p className={styles.supportBody}>Our team is happy to help with anything these guides do not cover.</p>
            </div>
            <Link to="/contact" className={styles.supportLink}>
              Contact support
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </div>
    </>
  );
}
