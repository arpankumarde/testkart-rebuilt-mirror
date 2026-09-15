import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Search as SearchIcon, ArrowRight, PackageOpen, BookOpen, ShoppingBag, Layers, User, FileText } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { useHomepageSearch } from '../helpers/useHomepageSearch';
import { useDebounce } from '../helpers/useDebounce';
import { SearchResultItem, SearchTeacherItem } from '../endpoints/homepage/search_GET.schema';
import { TeacherProductCard } from '../components/HomepageContentSection';
import { Placeholder } from '../helpers/placeholderImages';
import { formatItemPrice } from '../helpers/homepageItemUtils';
import styles from './search.module.css';

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
        <p className={styles.teacherStats}>
          {teacher.testCount} Tests • {teacher.courseCount} Courses • {teacher.studentCount} Students
        </p>
      </div>
    </Link>
  );
};



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

  const { data, isFetching } = useHomepageSearch(debouncedQuery, 10);

  const displayTeachers = data?.teachers || [];
  const displayTests = data?.tests || [];
  const displayCourses = data?.courses || [];
  const displayBundles = data?.bundles || [];
  const displayProducts = data?.products || [];

  const hasResults = data && data.totalResults > 0;
  const isLoading = isFetching;

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
            
            {/* Teachers Section */}
            {(isLoading || displayTeachers.length > 0) && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleWrapper}>
                    <User className={styles.sectionIcon} size={24} />
                    <h2>Teachers <span className={styles.count}>({displayTeachers.length})</span></h2>
                  </div>
                </div>

                <div className={styles.grid}>
                  {isLoading ? (
                    Array(4).fill(0).map((_, i) => (
                      <div key={i} className={styles.skeletonTeacherCard}>
                        <Skeleton className={styles.skeletonAvatar} />
                        <div className={styles.skeletonTeacherInfo}>
                          <Skeleton className={styles.skeletonTitle} />
                          <Skeleton className={styles.skeletonText} />
                        </div>
                      </div>
                    ))
                  ) : (
                    displayTeachers.map(teacher => (
                      <TeacherResultCard key={`teacher-${teacher.id}`} teacher={teacher} />
                    ))
                  )}
                </div>
              </section>
            )}

            {/* Mock Tests Section */}
            {(isLoading || displayTests.length > 0) && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleWrapper}>
                    <BookOpen className={styles.sectionIcon} size={24} />
                    <h2>Mock Tests <span className={styles.count}>({displayTests.length})</span></h2>
                  </div>
                  {displayTests.length > 0 && (
                    <Link to={`/mock-test?search=${encodeURIComponent(query)}`} className={styles.viewAllLink}>
                      View All <ArrowRight size={16} />
                    </Link>
                  )}
                </div>
                
                <div className={styles.grid}>
                  {isLoading ? (
                    Array(4).fill(0).map((_, i) => (
                      <div key={i} className={styles.skeletonCard}>
                        <Skeleton className={styles.skeletonThumb} />
                        <div className={styles.skeletonContent}>
                          <Skeleton className={styles.skeletonTitle} />
                          <Skeleton className={styles.skeletonText} />
                        </div>
                      </div>
                    ))
                  ) : (
                    displayTests.map(test => (
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
                        stats={`${test.views.toLocaleString('en-IN')} views`}
                        priceLabel={formatItemPrice(test.price, test.discountPrice)}
                        isFree={(test.discountPrice ?? test.price) === 0}
                        thumbnailUrl={test.thumbnailUrl}
                        placeholderUrl={Placeholder.TEST}
                      />
                    ))
                  )}
                </div>
              </section>
            )}

            {/* Courses Section */}
            {(isLoading || displayCourses.length > 0) && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleWrapper}>
                    <BookOpen className={styles.sectionIcon} size={24} />
                    <h2>Courses <span className={styles.count}>({displayCourses.length})</span></h2>
                  </div>
                  {displayCourses.length > 0 && (
                    <Link to="/course" className={styles.viewAllLink}>
                      View All <ArrowRight size={16} />
                    </Link>
                  )}
                </div>

                <div className={styles.grid}>
                  {isLoading ? (
                    Array(4).fill(0).map((_, i) => (
                      <div key={i} className={styles.skeletonCard}>
                        <Skeleton className={styles.skeletonThumb} />
                        <div className={styles.skeletonContent}>
                          <Skeleton className={styles.skeletonTitle} />
                          <Skeleton className={styles.skeletonText} />
                        </div>
                      </div>
                    ))
                  ) : (
                    displayCourses.map(course => (
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
                        stats={`${course.views.toLocaleString('en-IN')} views`}
                        priceLabel={formatItemPrice(course.price)}
                        isFree={course.price === 0}
                        thumbnailUrl={course.thumbnailUrl}
                        placeholderUrl={Placeholder.COURSE}
                      />
                    ))
                  )}
                </div>
              </section>
            )}

            {/* Bundles Section */}
            {(isLoading || displayBundles.length > 0) && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleWrapper}>
                    <Layers className={styles.sectionIcon} size={24} />
                    <h2>Bundles <span className={styles.count}>({displayBundles.length})</span></h2>
                  </div>
                  {displayBundles.length > 0 && (
                    <Link to="/bundles" className={styles.viewAllLink}>
                      View All <ArrowRight size={16} />
                    </Link>
                  )}
                </div>

                <div className={styles.grid}>
                  {isLoading ? (
                    Array(4).fill(0).map((_, i) => (
                      <div key={i} className={styles.skeletonCard}>
                        <Skeleton className={styles.skeletonThumb} />
                        <div className={styles.skeletonContent}>
                          <Skeleton className={styles.skeletonTitle} />
                          <Skeleton className={styles.skeletonText} />
                        </div>
                      </div>
                    ))
                  ) : (
                    displayBundles.map(bundle => (
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
                        priceLabel={formatItemPrice(bundle.price, bundle.originalPrice)}
                        isFree={(bundle.originalPrice ?? bundle.price) === 0}
                        thumbnailUrl={bundle.thumbnailUrl}
                        placeholderUrl={Placeholder.TEST}
                      />
                    ))
                  )}
                </div>
              </section>
            )}

            {/* Digital Products Section */}
            {(isLoading || displayProducts.length > 0) && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleWrapper}>
                    <ShoppingBag className={styles.sectionIcon} size={24} />
                    <h2>Digital Products <span className={styles.count}>({displayProducts.length})</span></h2>
                  </div>
                  {displayProducts.length > 0 && (
                    <Link to={`/shop?search=${encodeURIComponent(query)}`} className={styles.viewAllLink}>
                      View All <ArrowRight size={16} />
                    </Link>
                  )}
                </div>

                <div className={styles.grid}>
                  {isLoading ? (
                    Array(4).fill(0).map((_, i) => (
                      <div key={i} className={styles.skeletonCard}>
                        <Skeleton className={styles.skeletonThumb} />
                        <div className={styles.skeletonContent}>
                          <Skeleton className={styles.skeletonTitle} />
                          <Skeleton className={styles.skeletonText} />
                        </div>
                      </div>
                    ))
                  ) : (
                    displayProducts.map(product => (
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
                        stats={`${product.views.toLocaleString('en-IN')} views`}
                        priceLabel={formatItemPrice(product.price)}
                        isFree={product.price === 0}
                      />
                    ))
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}