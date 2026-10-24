import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Search as SearchIcon, ArrowRight, PackageOpen, BookOpen, Layers, Star, User, Users, Library, FileText, Building2, Newspaper, GraduationCap } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { ExamNewsListItem } from '../components/ExamNewsListItem';
import { useHomepageSearch } from '../helpers/useHomepageSearch';
import { useDebounce } from '../helpers/useDebounce';
import { SearchTeacherItem, SearchOrganizationItem } from '../endpoints/homepage/search_GET.schema';
import { TeacherProductCard } from '../components/HomepageContentSection';
import { Placeholder } from '../helpers/placeholderImages';
import { bundlePriceProps, formatItemPrice, itemPriceProps } from '../helpers/homepageItemUtils';
import { getOrganizationProfilePath } from '../helpers/organizationRoutes';
import styles from './search.module.css';

const ORG_TYPE_LABELS: Record<string, string> = {
  coaching: 'Coaching institute',
  school: 'School',
  college: 'College',
  university: 'University',
  other: 'Organisation',
};

/* Every category shows at most this many results; View All links lead to the full listings. */
const RESULTS_PER_CATEGORY = 4;

const plural = (count: number, one: string, many: string) =>
  `${count.toLocaleString('en-IN')} ${count === 1 ? one : many}`;

const TestRating = ({ rating, reviewsCount }: { rating: number; reviewsCount: number }) => (
  <span className={styles.testRating} aria-label={`Rated ${rating.toFixed(1)} out of 5 from ${plural(reviewsCount, 'review', 'reviews')}`}>
    <Star className={styles.testRatingStar} fill="currentColor" aria-hidden="true" />
    <span className={styles.testRatingValue}>{rating.toFixed(1)}</span>
    <span>({plural(reviewsCount, 'review', 'reviews')})</span>
  </span>
);

const OrganizationResultCard = ({ organization }: { organization: SearchOrganizationItem }) => {
  return (
    <Link
      to={getOrganizationProfilePath(organization.orgType, organization.slug)}
      className={styles.teacherCard}
    >
      <div className={styles.teacherAvatarWrapper}>
        {organization.logoUrl ? (
          <img src={organization.logoUrl} alt={organization.name} className={styles.teacherAvatar} />
        ) : (
          <div className={styles.teacherAvatarPlaceholder}>
            <Building2 size={24} className={styles.placeholderIcon} />
          </div>
        )}
      </div>
      <div className={styles.teacherInfo}>
        <div className={styles.teacherDisplayNameWrapper}>
          <h3 className={styles.teacherDisplayName}>{organization.name}</h3>
        </div>
        <p className={styles.teacherStats}>
          {ORG_TYPE_LABELS[organization.orgType] ?? 'Organisation'}
          {organization.location ? ` • ${organization.location}` : ''} • {organization.teacherCount}{' '}
          {organization.teacherCount === 1 ? 'teacher' : 'teachers'}
        </p>
      </div>
    </Link>
  );
};

const TeacherResultCard = ({ teacher }: { teacher: SearchTeacherItem }) => {
  return (
    <Link to={`/expert/${teacher.slug}`} className={styles.teacherCard}>
      <div className={styles.teacherAvatarWrapper}>
        {teacher.avatarUrl ? (
          <img src={teacher.avatarUrl} alt={teacher.displayName} className={styles.teacherAvatar} />
        ) : (
          <div className={styles.teacherAvatarPlaceholder}>
            <User size={24} className={styles.placeholderIcon} />
          </div>
        )}
      </div>
      <div className={styles.teacherInfo}>
        <div className={styles.teacherDisplayNameWrapper}>
          <h3 className={styles.teacherDisplayName}>{teacher.displayName}</h3>
          <VerifiedBadge isVerified={teacher.isVerified} size="sm" />
        </div>
        <p className={styles.teacherCardStats}>
          <span className={styles.teacherStat}>
            <Library size={14} aria-hidden="true" />
            {plural(teacher.resourceCount, 'Resource', 'Resources')}
          </span>
          <span className={styles.teacherStat}>
            <Users size={14} aria-hidden="true" />
            {plural(teacher.followerCount, 'Follower', 'Followers')}
          </span>
        </p>
      </div>
    </Link>
  );
};

const skeletonKeys = Array.from({ length: RESULTS_PER_CATEGORY }, (_, i) => i);

const ProductSkeletons = () => (
  <>
    {skeletonKeys.map((i) => (
      <div key={i} className={styles.skeletonCard}>
        <Skeleton className={styles.skeletonThumb} />
        <div className={styles.skeletonContent}>
          <Skeleton className={styles.skeletonTitle} />
          <Skeleton className={styles.skeletonText} />
        </div>
      </div>
    ))}
  </>
);

const ProfileSkeletons = () => (
  <>
    {skeletonKeys.map((i) => (
      <div key={i} className={styles.skeletonTeacherCard}>
        <Skeleton className={styles.skeletonAvatar} />
        <div className={styles.skeletonTeacherInfo}>
          <Skeleton className={styles.skeletonTitle} />
          <Skeleton className={styles.skeletonText} />
        </div>
      </div>
    ))}
  </>
);

interface ResultSectionProps {
  icon: React.ElementType;
  title: string;
  count: number;
  viewAllTo?: string;
  children: React.ReactNode;
}

const ResultSection = ({ icon: Icon, title, count, viewAllTo, children }: ResultSectionProps) => (
  <section className={styles.section}>
    <div className={styles.sectionHeader}>
      <div className={styles.sectionTitleWrapper}>
        <Icon className={styles.sectionIcon} size={24} />
        <h2>{title} <span className={styles.count}>({count.toLocaleString('en-IN')})</span></h2>
      </div>
      {viewAllTo && count > 0 && (
        <Link to={viewAllTo} className={styles.viewAllLink}>
          View All <ArrowRight size={16} />
        </Link>
      )}
    </div>
    {children}
  </section>
);

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(query);
  
  const debouncedQuery = useDebounce(query, 300);

  // Update input when URL param changes
  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  const { data, isFetching } = useHomepageSearch(debouncedQuery, RESULTS_PER_CATEGORY);
  const cap = <T,>(items: T[] | undefined) => (items ?? []).slice(0, RESULTS_PER_CATEGORY);

  const displayTests = cap(data?.tests);
  const displayCourses = cap(data?.courses);
  const displayProducts = cap(data?.products);
  const displayTeachers = cap(data?.teachers);
  const teacherTotal = data?.teacherTotal ?? 0;
  const displayOrganizations = cap(data?.organizations);
  const displayNews = cap(data?.news);
  const displayBundles = cap(data?.bundles);

  const hasResults = data && data.totalResults > 0;
  const isLoading = isFetching;
  const encodedQuery = encodeURIComponent(query);

  return (
    <div className={styles.container}>
      <SEOHead 
        title={query ? `Search results for "${query}"` : 'Search'} 
        description={`Search results for ${query} on Testkart`}
      />

      {/* Search Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.pageTitle}>
            {query ? `Results for "${query}"` : 'Search Testkart'}
          </h1>
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <div className={styles.searchWrapper}>
              <SearchIcon className={styles.searchIcon} size={20} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search for tests, courses, notes..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" className={styles.searchButton}>
              Search
            </Button>
          </form>
        </div>
      </div>

      <div className={styles.resultsContainer}>
        {!query ? (
          <div className={styles.emptyState}>
            <SearchIcon size={48} className={styles.emptyIcon} />
            <h2>Start your search</h2>
            <p>Type in the search bar above to find courses, mock tests, and study materials.</p>
          </div>
        ) : !hasResults && !isLoading ? (
          <div className={styles.emptyState}>
            <PackageOpen size={48} className={styles.emptyIcon} />
            <h2>No results found</h2>
            <p>We couldn't find anything matching "{query}". Try checking for typos or using different keywords.</p>
          </div>
        ) : (
          <div className={styles.sectionsWrapper}>

            {/* Fixed order: Mock Tests, Courses, Notes & PDFs, Bundles, Teachers, Organisations, News */}
            {(isLoading || displayTests.length > 0) && (
              <ResultSection icon={BookOpen} title="Mock Tests" count={displayTests.length} viewAllTo={`/mock-test?search=${encodedQuery}`}>
                <div className={styles.grid}>
                  {isLoading ? <ProductSkeletons /> : displayTests.map(test => (
                    <TeacherProductCard
                      key={`test-${test.id}`}
                      link={`/mock-test/${test.slug}`}
                      teacherName={test.teacherName}
                      teacherAvatarUrl={test.teacherAvatarUrl}
                      teacherTagline={test.teacherTagline}
                      teacherYearsOfExperience={test.teacherYearsOfExperience}
                      teacherSlug={test.teacherSlug}
                      teacherIsVerified={test.teacherIsVerified}
                      productTitle={test.title}
                      examName={test.examName}
                      stats={test.rating != null && test.reviewsCount ? (
                        <TestRating rating={test.rating} reviewsCount={test.reviewsCount} />
                      ) : undefined}
                      {...itemPriceProps(test.price, test.discountPrice)}
                      thumbnailUrl={test.thumbnailUrl}
                      placeholderUrl={Placeholder.TEST}
                    />
                  ))}
                </div>
              </ResultSection>
            )}

            {(isLoading || displayCourses.length > 0) && (
              <ResultSection icon={GraduationCap} title="Courses" count={displayCourses.length} viewAllTo={`/course?search=${encodedQuery}`}>
                <div className={styles.grid}>
                  {isLoading ? <ProductSkeletons /> : displayCourses.map(course => (
                    <TeacherProductCard
                      key={`course-${course.id}`}
                      link={`/course/${course.slug}`}
                      teacherName={course.teacherName}
                      teacherAvatarUrl={course.teacherAvatarUrl}
                      teacherTagline={course.teacherTagline}
                      teacherYearsOfExperience={course.teacherYearsOfExperience}
                      teacherSlug={course.teacherSlug}
                      teacherIsVerified={course.teacherIsVerified}
                      productTitle={course.title}
                      {...itemPriceProps(course.price, course.discountPrice)}
                      thumbnailUrl={course.thumbnailUrl}
                      placeholderUrl={Placeholder.COURSE}
                    />
                  ))}
                </div>
              </ResultSection>
            )}

            {(isLoading || displayProducts.length > 0) && (
              <ResultSection icon={FileText} title="Notes & PDFs" count={displayProducts.length} viewAllTo={`/study-notes?search=${encodedQuery}`}>
                <div className={styles.grid}>
                  {isLoading ? <ProductSkeletons /> : displayProducts.map(product => (
                    <TeacherProductCard
                      key={`product-${product.id}`}
                      link={`/study-notes/${product.slug}`}
                      teacherName={product.teacherName}
                      teacherAvatarUrl={product.teacherAvatarUrl}
                      teacherTagline={product.teacherTagline}
                      teacherYearsOfExperience={product.teacherYearsOfExperience}
                      teacherSlug={product.teacherSlug}
                      teacherIsVerified={product.teacherIsVerified}
                      productTitle={product.title}
                      examName={product.examName}
                      priceLabel={formatItemPrice(product.price)}
                      isFree={product.price === 0}
                    />
                  ))}
                </div>
              </ResultSection>
            )}

            {(isLoading || displayBundles.length > 0) && (
              <ResultSection icon={Layers} title="Bundles" count={displayBundles.length} viewAllTo={`/bundles?search=${encodedQuery}`}>
                <div className={styles.grid}>
                  {isLoading ? <ProductSkeletons /> : displayBundles.map(bundle => (
                    <TeacherProductCard
                      key={`bundle-${bundle.id}`}
                      link={`/bundles/${bundle.slug}`}
                      teacherName={bundle.teacherName}
                      teacherAvatarUrl={bundle.teacherAvatarUrl}
                      teacherTagline={bundle.teacherTagline}
                      teacherYearsOfExperience={bundle.teacherYearsOfExperience}
                      teacherSlug={bundle.teacherSlug}
                      teacherIsVerified={bundle.teacherIsVerified}
                      productTitle={bundle.title}
                      stats={`${bundle.itemCount} items`}
                      {...bundlePriceProps(bundle.price, bundle.originalPrice)}
                      thumbnailUrl={bundle.thumbnailUrl}
                      placeholderUrl={Placeholder.TEST}
                    />
                  ))}
                </div>
              </ResultSection>
            )}

            {(isLoading || displayTeachers.length > 0) && (
              <ResultSection icon={User} title="Teachers" count={teacherTotal}>
                <div className={styles.profileGrid}>
                  {isLoading ? <ProfileSkeletons /> : displayTeachers.map(teacher => (
                    <TeacherResultCard key={`teacher-${teacher.id}`} teacher={teacher} />
                  ))}
                </div>
              </ResultSection>
            )}

            {(isLoading || displayOrganizations.length > 0) && (
              <ResultSection icon={Building2} title="Organisations" count={displayOrganizations.length}>
                <div className={styles.profileGrid}>
                  {isLoading ? <ProfileSkeletons /> : displayOrganizations.map(organization => (
                    <OrganizationResultCard key={`organization-${organization.id}`} organization={organization} />
                  ))}
                </div>
              </ResultSection>
            )}

            {(isLoading || displayNews.length > 0) && (
              <ResultSection icon={Newspaper} title="News" count={displayNews.length} viewAllTo={`/exam-news?q=${encodedQuery}`}>
                <div className={styles.newsList}>
                  {isLoading ? skeletonKeys.map((i) => (
                    <div key={i} className={styles.skeletonNewsRow}>
                      <Skeleton className={styles.skeletonTitle} />
                      <Skeleton className={styles.skeletonText} />
                    </div>
                  )) : displayNews.map(item => (
                    <ExamNewsListItem key={`news-${item.id}`} item={item} headingLevel="h3" />
                  ))}
                </div>
              </ResultSection>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
