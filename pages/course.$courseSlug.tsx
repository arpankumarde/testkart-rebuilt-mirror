import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { usePublicCourseDetailsQuery, useRelatedCoursesQuery } from '../helpers/useStudentCoursesQuery';
import { SEOHead } from '../components/SEOHead';
import { Placeholder } from '../helpers/placeholderImages';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { CourseHero } from '../components/CourseHero';
import { CourseSidebar } from '../components/CourseSidebar';
import { CourseCurriculum } from '../components/CourseCurriculum';
import { TeacherProfileCard } from '../components/TeacherProfileCard';
import { TeacherCtaBanner } from '../components/TeacherCtaBanner';
import { MobileStickyPurchaseBar } from '../components/MobileStickyPurchaseBar';
import { PublicCouponsCard } from '../components/PublicCouponsCard';
import { BundleSuggestions } from '../components/BundleSuggestions';
import { CourseCard } from '../components/CourseCard';
import { AlertCircle, BookOpen, FileText, Info, Sparkles, Star, User } from "lucide-react";
import { ReviewDialog } from '../components/ReviewDialog';
import { useAuth } from '../helpers/useAuth';
import { wrapContentTables } from '../helpers/contentTables';
import { sanitizeHtml } from '../helpers/sanitizeHtml';
import { htmlToPlainText } from '../helpers/courseDraft';
import { Avatar, AvatarImage, AvatarFallback } from '../components/Avatar';
import { useTrackStorefrontView } from '../helpers/trackStorefrontEvent';
import styles from "./course.$courseSlug.module.css";

type SectionTone = 'peach' | 'mint' | 'lavender' | 'sky' | 'butter';

/* Section title with a wobbly duotone icon blob, as on the exam pages. */
const SectionHeading: React.FC<{ icon: React.ReactNode; tone: SectionTone; children: React.ReactNode }> = ({
  icon,
  tone,
  children,
}) => (
  <div className={styles.sectionHeading}>
    <span className={styles.sectionIcon} data-tone={tone} aria-hidden="true">
      <span className={styles.sectionBlob} />
      {icon}
    </span>
    <h2 className={styles.sectionTitle}>{children}</h2>
  </div>
);

const CourseDetailsSkeleton: React.FC = () => (
  <div className={styles.layout}>
    <div className={styles.heroSkeleton}>
      <div className={styles.heroContent}>
        <Skeleton style={{ height: "1.5rem", width: "84px", borderRadius: "var(--radius-full)", marginBottom: "var(--spacing-3)" }} />
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
  const { data: relatedData } = useRelatedCoursesQuery(course?.id ?? null, 4);
  const relatedCourses = relatedData?.courses ?? [];

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
  const myReview = authState.type === "authenticated"
    ? reviews.find((r: any) => r.userId === authState.user.id) ?? null
    : null;
  // Enrolment is the only gate: a student who bought the course can review it before finishing it.
  const canReview = authState.type === "authenticated" && !!course?.isEnrolled;

  const ratingCounts = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r: any) => {
      if (r.rating >= 1 && r.rating <= 5) {
        counts[Math.floor(r.rating) as keyof typeof counts]++;
      }
    });
    return counts;
  }, [reviews]);

  // The teacher's description is rich-text HTML, so it is flattened and cut to
  // about 160 characters. Falls back to a content-derived description when it
  // is missing or too short to describe the course.
  const metaDescription = useMemo(() => {
    if (!course) return "";
    const desc = htmlToPlainText(course.description);
    if (desc.length >= 50) {
      if (desc.length <= 160) return desc;
      const cut = desc.slice(0, 157);
      return `${cut.slice(0, cut.lastIndexOf(" ") > 100 ? cut.lastIndexOf(" ") : 157)}...`;
    }
    const lessonCount = course.sections.reduce((sum, section) => sum + section.lessons.length, 0);
    const lessonsText = lessonCount > 0 ? `${lessonCount} lesson${lessonCount > 1 ? "s" : ""}` : "a structured curriculum";
    const priceText = course.price === 0 ? "Free" : `₹${course.discountPrice ?? course.price}`;
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
      "image": course.thumbnailImageUrl || course.thumbnailUrl || Placeholder.COURSE,
      "offers": {
        "@type": "Offer",
        "price": course.price === 0 ? "0" : (course.discountPrice ?? course.price).toString(),
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

  // Only before the first load; a refetch (e.g. after a review) keeps the page in place.
  if (isFetching && !course) {
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
        image={course.thumbnailImageUrl || course.thumbnailUrl || Placeholder.COURSE}
        url={`https://testkart.in/course/${courseSlug}`}
        type="website"
        noIndex={!course.seo.indexable}
      />
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}

      <div className={styles.layout}>
      <CourseHero course={course} />

      {/* Main Content */}
      <div className={styles.contentWrapper}>
        <main className={styles.mainColumn}>
          {!course.isEnrolled && !isFree && (
            <PublicCouponsCard itemType="course" itemId={course.id} className={styles.couponsCard} />
          )}

          <section className={styles.section}>
            <CourseCurriculum courseId={course.id} sections={course.sections} />
          </section>

          <section className={styles.section}>
            <SectionHeading tone="lavender" icon={<FileText />}>Description</SectionHeading>
            <div 
              className={styles.description}
              dangerouslySetInnerHTML={{ __html: wrapContentTables(sanitizeHtml(course.description)) }}
            />
          </section>

          <section id="instructor-profile" className={styles.section}>
            <SectionHeading tone="sky" icon={<User />}>Course Hosted by</SectionHeading>
            <TeacherProfileCard
              teacher={{
                id: course.teacher.id,
                displayName: course.teacher.displayName,
                avatarUrl: course.teacher.profilePicture,
                slug: course.teacher.slug,
                bio: null,
                websiteUrl: null,
                socialLinks: null,
                awardsCertificates: null,
                isVerified: course.teacher.isVerified,
              }}
              variant="inline"
            />
          </section>

          <section id="reviews" className={styles.section}>
            <SectionHeading tone="butter" icon={<Star />}>Student reviews</SectionHeading>
            
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
                          variant={myReview ? "outline" : "primary"}
                          onClick={() => setIsReviewDialogOpen(true)}
                          className={styles.writeReviewButton}
                        >
                          {myReview ? "Edit your review" : "Write a review"}
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
            <div className={styles.disclaimerSection}>
              <Info size={18} className={styles.disclaimerIcon} aria-hidden="true" />
              <div className={styles.disclaimerText}>{course.disclaimer}</div>
            </div>
          )}

          {relatedCourses.length > 0 && (
            <section className={styles.plainSection}>
              <SectionHeading tone="peach" icon={<Sparkles />}>Related courses</SectionHeading>
              <div className={styles.relatedGrid}>
                {relatedCourses.map((relatedCourse) => (
                  <CourseCard key={relatedCourse.id} course={relatedCourse} />
                ))}
              </div>
            </section>
          )}

          <BundleSuggestions teacherId={course.teacher.id} variant="course" />

          <TeacherCtaBanner />
        </main>

        <div ref={sidebarRef} className={styles.sidebarColumn}>
          <CourseSidebar
            course={course}
            slug={courseSlug}
          />
        </div>
      </div>
      </div>

      {canReview && (
        <ReviewDialog
          isOpen={isReviewDialogOpen}
          onClose={() => setIsReviewDialogOpen(false)}
          courseId={course.id}
          testPackageTitle={course.title}
          initialRating={myReview?.rating ?? null}
          initialReviewText={myReview?.reviewText ?? null}
        />
      )}

      <MobileStickyPurchaseBar
        product={{
          type: 'course',
          id: course.id,
          price: course.price,
          discountPrice: course.discountPrice,
          isEnrolled: course.isEnrolled,
        }}
        isVisible={isStickyBarVisible}
      />
    </>
  );
}