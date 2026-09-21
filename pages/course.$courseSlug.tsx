import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { usePublicCourseDetailsQuery } from '../helpers/useStudentCoursesQuery';
import { SEOHead } from '../components/SEOHead';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { CourseHero } from '../components/CourseHero';
import { CourseSidebar } from '../components/CourseSidebar';
import { CourseCurriculum } from '../components/CourseCurriculum';
import { TeacherProfileCard } from '../components/TeacherProfileCard';
import { TeacherCtaBanner } from '../components/TeacherCtaBanner';
import { MobileStickyPurchaseBar } from '../components/MobileStickyPurchaseBar';
import { AlertCircle, BookOpen, CheckCircle, Star } from "lucide-react";
import { ReviewDialog } from '../components/ReviewDialog';
import { useAuth } from '../helpers/useAuth';
import { wrapContentTables } from '../helpers/contentTables';
import { sanitizeHtml } from '../helpers/sanitizeHtml';
import { Avatar, AvatarImage, AvatarFallback } from '../components/Avatar';
import { useTrackStorefrontView } from '../helpers/trackStorefrontEvent';
import styles from "./course.$courseSlug.module.css";

const CourseDetailsSkeleton: React.FC = () => (
  <div>
    <div className={styles.heroSkeleton}>
      <div className={styles.heroContent}>
        <Skeleton style={{ height: "1rem", width: "200px", marginBottom: "var(--spacing-3)" }} />
        <Skeleton style={{ height: "3rem", width: "80%", marginBottom: "var(--spacing-2)" }} />
        <Skeleton style={{ height: "1.5rem", width: "60%", marginBottom: "var(--spacing-4)" }} />
        <div style={{ display: "flex", gap: "var(--spacing-4)" }}>
          <Skeleton style={{ height: "1rem", width: "150px" }} />
          <Skeleton style={{ height: "1rem", width: "120px" }} />
        </div>
      </div>
    </div>
    <div className={styles.contentWrapper}>
      <div className={styles.mainColumn}>
        <Skeleton style={{ height: "200px", width: "100%", marginBottom: "var(--spacing-8)" }} />
        <Skeleton style={{ height: "400px", width: "100%" }} />
      </div>
      <div className={styles.sidebarColumn}>
        <Skeleton style={{ height: "600px", width: "100%" }} />
      </div>
    </div>
  </div>
);

export default function CourseDetailsPage() {
  const { courseSlug } = useParams<{courseSlug: string;}>();
  
  const { authState } = useAuth();
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isStickyBarVisible, setIsStickyBarVisible] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const { data: course, isFetching, error } = usePublicCourseDetailsQuery(courseSlug || null);
  useTrackStorefrontView("course", course?.id);

  // Intersection observer for mobile sticky bar
  useEffect(() => {
    if (!sidebarRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsStickyBarVisible(!entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0,
        rootMargin: '0px',
      }
    );

    observer.observe(sidebarRef.current);

    return () => {
      observer.disconnect();
    };
  }, [course]);

  const reviews = (course as any)?.reviews || [];
  const hasReviewed = authState.type === "authenticated" && reviews.some((r: any) => r.userId === authState.user.id);
  const canReview = authState.type === "authenticated" && !!course?.isEnrolled && !hasReviewed;

  const ratingCounts = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r: any) => {
      if (r.rating >= 1 && r.rating <= 5) {
        counts[Math.floor(r.rating) as keyof typeof counts]++;
      }
    });
    return counts;
  }, [reviews]);

  // Falls back to a content-derived description when the teacher-entered
  // one is missing or too short/generic (e.g. the "Draft test package"
  // default), instead of letting a thin or duplicate string reach the
  // <meta name="description"> tag.
  const metaDescription = useMemo(() => {
    if (!course) return "";
    const desc = course.description?.trim();
    if (desc && desc.length >= 50) return desc;
    const lessonCount = course.sections.reduce((sum, section) => sum + section.lessons.length, 0);
    const lessonsText = lessonCount > 0 ? `${lessonCount} lesson${lessonCount > 1 ? "s" : ""}` : "a structured curriculum";
    const priceText = course.price === 0 ? "Free" : `₹${course.price}`;
    const examText = course.examName ? `Prepare for ${course.examName} with` : "Learn with";
    return `${course.title} - ${lessonsText} by ${course.teacher?.displayName || "expert educators"} | ${priceText} | ${examText} this course on Testkart`;
  }, [course]);

  // Course detail pages had no structured data at all (unlike the mock-test
  // and study-notes detail pages, which already emit Product/Breadcrumb
  // JSON-LD) - this brings them in line using schema.org's Course type.
  const structuredData = useMemo(() => {
    if (!course || !courseSlug) return null;
    const baseUrl = "https://testkart.in";
    const canonicalUrl = `${baseUrl}/course/${courseSlug}`;
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
      : null;

    const courseSchema: any = {
      "@type": "Course",
      "name": course.title,
      "description": metaDescription,
      "provider": {
        "@type": "Organization",
        "name": "Testkart",
        "sameAs": baseUrl,
      },
      "url": canonicalUrl,
      "offers": {
        "@type": "Offer",
        "price": course.price === 0 ? "0" : course.price.toString(),
        "priceCurrency": "INR",
        "availability": "https://schema.org/InStock",
        "url": canonicalUrl,
      },
      "hasCourseInstance": {
        "@type": "CourseInstance",
        "courseMode": "online",
        ...(course.language && { "inLanguage": course.language }),
      },
    };

    if (course.teacher?.displayName) {
      courseSchema.instructor = {
        "@type": "Person",
        "name": course.teacher.displayName,
      };
    }

    if (avgRating !== null && reviews.length > 0) {
      courseSchema.aggregateRating = {
        "@type": "AggregateRating",
        "ratingValue": avgRating,
        "reviewCount": reviews.length,
        "bestRating": 5,
        "worstRating": 1,
      };
    }

    const breadcrumbList = {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": baseUrl },
        { "@type": "ListItem", "position": 2, "name": "Courses", "item": `${baseUrl}/course` },
        { "@type": "ListItem", "position": 3, "name": course.title, "item": canonicalUrl },
      ],
    };

    return {
      "@context": "https://schema.org",
      "@graph": [courseSchema, breadcrumbList],
    };
  }, [course, courseSlug, reviews, metaDescription]);

  if (!courseSlug) {
    return (
      <div className={styles.errorContainer}>
        <AlertCircle size={48} className={styles.errorIcon} />
        <h2>Invalid Course</h2>
        <p>The course URL is not valid.</p>
        <Button asChild>
          <Link to="/course">Browse Courses</Link>
        </Button>
      </div>
    );
  }

  if (isFetching) {
    return <CourseDetailsSkeleton />;
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <AlertCircle size={48} className={styles.errorIcon} />
        <h2>Error Loading Course</h2>
        <p>{error.message}</p>
        <Button asChild>
          <Link to="/course">Browse Courses</Link>
        </Button>
      </div>
    );
  }

  if (!course) {
    return (
      <div className={styles.errorContainer}>
        <BookOpen size={48} />
        <h2>Course Not Found</h2>
        <p>The course you are looking for does not exist or is not available.</p>
        <Button asChild>
          <Link to="/course">Browse Courses</Link>
        </Button>
      </div>
    );
  }

  const totalLessons = course.sections.reduce((sum, section) => sum + section.lessons.length, 0);
  const isFree = course.price === 0;

  return (
    <>
      <SEOHead
        title={course.title}
        description={metaDescription}
        image={course.thumbnailUrl || course.thumbnailUrl || undefined}
        url={`https://testkart.in/course/${courseSlug}`}
        type="website"
        noIndex={!course.seo.indexable}
      />
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}

      <CourseHero course={course} />

      

      {/* Main Content */}
      <div className={styles.contentWrapper}>
        <main className={styles.mainColumn}>
          


                              {/* Course Curriculum */}
          <section className={styles.section}>
            <CourseCurriculum sections={course.sections} />
          </section>

          


          {/* Description */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Description</h2>
            <div 
              className={styles.description}
              dangerouslySetInnerHTML={{ __html: wrapContentTables(sanitizeHtml(course.description)) }}
            />
          </section>

          {/* About the Instructor */}
          <section id="instructor-profile" className={styles.section}>
            <h2 className={styles.sectionTitle}>Course Hosted by</h2>
            <TeacherProfileCard
              teacher={{
                id: course.teacher.id,
                displayName: course.teacher.displayName,
                avatarUrl: course.teacher.profilePicture,
                slug: course.teacher.slug,
                bio: null,
                websiteUrl: null,
                publicEmail: null,
                publicPhone: null,
                socialLinks: null,
                awardsCertificates: null,
                isVerified: course.teacher.isVerified,
              }}
              variant="inline"
            />
          </section>

          {/* Reviews Section */}
          <section id="reviews" className={styles.section}>
            <div className={styles.reviewsHeader}>
              <h2 className={styles.sectionTitle}>Student reviews</h2>
            </div>
            
            <div className={styles.reviewsContainer}>
               <div className={styles.ratingSummary}>
                  <div className={styles.averageRating}>
                     <span className={styles.bigRating}>{course.rating ? Number(course.rating).toFixed(1) : "0"}</span>
                     <div className={styles.averageStars}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star 
                            key={i} 
                            size={20} 
                            fill={course.rating && i < Math.round(Number(course.rating)) ? "currentColor" : "none"} 
                            className={course.rating && i < Math.round(Number(course.rating)) ? styles.starIcon : styles.starEmpty} 
                          />
                        ))}
                     </div>
                     <span className={styles.totalReviews}>{course.reviewsCount} reviews</span>
                     {canReview && (
                        <Button
                          size="sm"
                          onClick={() => setIsReviewDialogOpen(true)}
                          className={styles.writeReviewButton}
                        >
                          Write a Review
                        </Button>
                      )}
                  </div>
                  <div className={styles.ratingBars}>
                     {[5, 4, 3, 2, 1].map(stars => {
                        const count = ratingCounts[stars as keyof typeof ratingCounts];
                        const percentage = reviews.length ? (count / reviews.length) * 100 : 0;
                        return (
                          <div key={stars} className={styles.ratingBarRow}>
                             <span className={styles.starLabel}>{stars} <Star size={12} fill="currentColor" className={styles.starIcon} /></span>
                             <div className={styles.barContainer}>
                                <div className={styles.barFill} style={{ width: `${percentage}%` }}></div>
                             </div>
                             <span className={styles.barCount}>{count}</span>
                          </div>
                        );
                     })}
                  </div>
               </div>

              {reviews.length > 0 ? (
                <div className={styles.reviewsList}>
                  {reviews.map((review: any) => (
                    <div key={review.id} className={styles.reviewCard}>
                      <div className={styles.reviewHeader}>
                        <Avatar className={styles.reviewerAvatar}>
                          {review.reviewerAvatarUrl && <AvatarImage src={review.reviewerAvatarUrl || undefined} />}
                          <AvatarFallback>{review.reviewerName.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className={styles.reviewerInfo}>
                          <span className={styles.reviewerName}>{review.reviewerName}</span>
                          <span className={styles.reviewDate}>
                            {review.createdAt && new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className={styles.reviewRating}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star 
                              key={i} 
                              size={14} 
                              fill={i < review.rating ? "currentColor" : "none"} 
                              className={i < review.rating ? styles.starIcon : styles.starEmpty} 
                            />
                          ))}
                        </div>
                      </div>
                      {review.reviewText && <p className={styles.reviewText}>{review.reviewText}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.noReviews}>No reviews yet.</p>
              )}
            </div>
          </section>

          {course.disclaimer && (
            <div className={styles.disclaimerSection} style={{ whiteSpace: 'pre-wrap' }}>
              {course.disclaimer}
            </div>
          )}

          <TeacherCtaBanner />
        </main>

        <div ref={sidebarRef} className={styles.sidebarColumn}>
          <CourseSidebar
            course={course}
            slug={courseSlug}
          />
        </div>
      </div>

      {canReview && (
        <ReviewDialog
          isOpen={isReviewDialogOpen}
          onClose={() => setIsReviewDialogOpen(false)}
          courseId={course.id}
          testPackageTitle={course.title}
        />
      )}

      <MobileStickyPurchaseBar
        product={{
          type: 'course',
          id: course.id,
          price: course.price,
          isEnrolled: course.isEnrolled,
        }}
        isVisible={isStickyBarVisible}
      />
    </>
  );
}