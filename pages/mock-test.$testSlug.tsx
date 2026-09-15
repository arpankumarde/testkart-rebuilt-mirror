import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTestDetailsQuery } from "../helpers/useTestDetailsQuery";
import { SEOHead } from "../components/SEOHead";
import { slugify } from "../helpers/slugify";
import { wrapContentTables } from "../helpers/contentTables";
import DOMPurify from "dompurify";
import { CheckCircle, Star, Users, BookOpen } from "lucide-react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../components/Avatar";
import { TestPackageHero } from "../components/TestPackageHero";
import { TestPackageSidebar } from "../components/TestPackageSidebar";
import { MobileStickyPurchaseBar } from "../components/MobileStickyPurchaseBar";
import { TestItemsList } from "../components/TestItemsList";
import { TestLeaderboard } from "../components/TestLeaderboard";
import { TestLeaderboardDialog } from "../components/TestLeaderboardDialog";
import { TestReviews } from "../components/TestReviews";
import { TeacherProfileCard } from "../components/TeacherProfileCard";
import { TeacherCtaBanner } from "../components/TeacherCtaBanner";
import { BundleSuggestions } from "../components/BundleSuggestions";
import styles from "./mock-test.$testSlug.module.css";

const TestDetailsSkeleton: React.FC = () => (
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

const TestDetailsPage: React.FC = () => {
  const { testSlug } = useParams();
  const navigate = useNavigate();

  const { data, isFetching, error } = useTestDetailsQuery(testSlug);

  const [isStickyBarVisible, setIsStickyBarVisible] = useState(false);
  const [isLeaderboardDialogOpen, setIsLeaderboardDialogOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Construct canonical URL and other SEO data
  const canonicalUrl = useMemo(() => {
    if (!data?.package || !testSlug) return "";
    return `https://testkart.in/mock-test/${testSlug}`;
  }, [data?.package, testSlug]);

  const structuredData = useMemo(() => {
    if (!data?.package) return null;
    
    const testPackage = data.package;
    const baseUrl = "https://testkart.in";
    
    // Create breadcrumb list
    const breadcrumbList = {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": baseUrl
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": testPackage.examName || "Mock Tests",
          "item": `${baseUrl}/mock-test`
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": testPackage.title,
          "item": canonicalUrl
        }
      ]
    };

    // Create product schema
    const productSchema: any = {
      "@type": "Product",
      "name": testPackage.title,
      "description": testPackage.description || `Comprehensive mock test series for ${testPackage.examName || 'exam preparation'}`,
      ...(testPackage.thumbnailUrl && { "image": testPackage.thumbnailUrl || testPackage.thumbnailUrl }),
      "brand": {
        "@type": "Organization",
        "name": "Testkart"
      },
      "offers": {
        "@type": "Offer",
        "price": testPackage.price === 0 ? "0" : testPackage.price.toString(),
        "priceCurrency": "INR",
        "availability": "https://schema.org/InStock",
        "url": canonicalUrl
      },
      "sku": `TEST-${testPackage.id}`,
      "identifier": testPackage.id.toString()
    };

    // Add category if available
    if (testPackage.examName || testPackage.subject) {
      productSchema.category = testPackage.examName || testPackage.subject;
    }

    // Add aggregate rating if available
    if (testPackage.rating && testPackage.reviewsCount > 0) {
      productSchema.aggregateRating = {
        "@type": "AggregateRating",
        "ratingValue": testPackage.rating,
        "reviewCount": testPackage.reviewsCount,
        "bestRating": 5,
        "worstRating": 1
      };
    }

    // Create webpage schema
    const webPageSchema = {
      "@type": "WebPage",
      "name": `${testPackage.title} | Testkart`,
      "description": testPackage.description || `Master your ${testPackage.examName || 'exam'} preparation with this comprehensive test series`,
      "url": canonicalUrl,
      "breadcrumb": breadcrumbList
    };

    // Create teacher/author schema
    const teacherSchema: any = {
      "@type": "Person",
      "name": testPackage.teacherName || "Testkart Educator"
    };

    if (testPackage.teacherAvatarUrl) {
      teacherSchema.image = testPackage.teacherAvatarUrl || testPackage.teacherAvatarUrl;
    }

    if (testPackage.teacherBio) {
      teacherSchema.description = testPackage.teacherBio;
    }

    if (testPackage.teacherName) {
      const teacherSlug = testPackage.teacherSlug || slugify(testPackage.teacherName);
      teacherSchema.url = `${baseUrl}/expert/${teacherSlug}`;
    }

    // Combine all schemas
    return {
      "@context": "https://schema.org",
      "@graph": [
        productSchema,
        webPageSchema,
        breadcrumbList,
        teacherSchema
      ]
    };
  }, [data?.package, canonicalUrl]);

  const metaDescription = useMemo(() => {
    if (!data?.package) return "";
    const pkg = data.package;
    const priceText = pkg.price === 0 ? "Free" : `₹${pkg.price}`;
    return `${pkg.title} - ${pkg.totalTests} mock tests | ${priceText} | Created by ${pkg.teacherName || 'expert educators'} | Prepare for ${pkg.examName || 'your exam'} with Testkart`;
  }, [data?.package]);

  useEffect(() => {
    if (!sidebarRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show sticky bar when sidebar is NOT visible
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
  }, [data]);

  if (isFetching) {
    return <TestDetailsSkeleton />;
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h2>Something went wrong</h2>
        <p>{error.message}</p>
        <Button asChild>
          <Link to="/mock-test">Browse other tests</Link>
        </Button>
      </div>
    );
  }

  if (!data?.package) {
    return (
      <div className={styles.errorContainer}>
        <h2>Test not found</h2>
        <p>The test package you are looking for does not exist or is not available.</p>
        <Button asChild>
          <Link to="/mock-test">Browse other tests</Link>
        </Button>
      </div>
    );
  }

            const { package: testPackage, items } = data;
  const totalQuestions = items.reduce((sum, item) => sum + item.totalQuestions, 0);
  const totalDurationMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0);

  // Ensure whatYouLearn and requirements are arrays (may come as JSON strings from DB)
  const whatYouLearn = Array.isArray(testPackage.whatYouLearn)
    ? testPackage.whatYouLearn
    : (() => { try { const parsed = JSON.parse(testPackage.whatYouLearn as any); return Array.isArray(parsed) ? parsed : []; } catch { return []; } })();
  const requirements = Array.isArray(testPackage.requirements)
    ? testPackage.requirements
    : (() => { try { const parsed = JSON.parse(testPackage.requirements as any); return Array.isArray(parsed) ? parsed : []; } catch { return []; } })();

  const teacherFallback =
    testPackage.teacherName
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .substring(0, 2) || "T";

  return (
    <>
      <SEOHead
        title={testPackage.title}
        description={metaDescription}
        image={testPackage.thumbnailUrl || testPackage.thumbnailUrl || undefined}
        url={canonicalUrl}
        noIndex={!testPackage.seo.indexable}
      />
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}

      <TestPackageHero 
        testPackage={testPackage} 
        totalQuestions={totalQuestions}
        totalDurationMinutes={totalDurationMinutes}
      />

      {/* Key Stats Card */}
      <div className={styles.statsCard}>
        <div className={styles.statsContent}>
          <div className={styles.statsLeft}>
            <CheckCircle size={20} className={styles.statsIcon} />
            <div>
              <div className={styles.statsTitle}>Test Package</div>
              <div className={styles.statsSubtitle}>
                Access this test package with {testPackage.totalTests} full-length mock tests
                {testPackage.freeTestsCount > 0 && ` (${testPackage.freeTestsCount} free tests included)`}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Main Content */}
      <div className={styles.contentWrapper}>
        <main className={styles.mainColumn}>
          {/* Test Series Content */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Test series content</h2>
            <div className={styles.contentStats}>
              <span>{testPackage.totalTests} tests</span>
              <span>•</span>
              <span>{items.reduce((sum, item) => sum + item.totalQuestions, 0)} total questions</span>
              {testPackage.freeTestsCount > 0 && (
                <>
                  <span>•</span>
                  <span>{testPackage.freeTestsCount} free tests</span>
                </>
              )}
            </div>
            <TestItemsList items={items} isEnrolled={testPackage.isEnrolled} packageId={testPackage.id} />
          </section>

          {/* Top Performers */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Top performers</h2>
            <TestLeaderboard 
              testItems={items.map(item => ({ id: item.id, title: item.title }))}
              onViewFull={() => setIsLeaderboardDialogOpen(true)}
            />
          </section>

          {/* What You'll Learn */}
          {whatYouLearn.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>What you'll master</h2>
              <div className={styles.benefitsGrid}>
                {whatYouLearn.map((item, index) => (
                  <div key={index} className={styles.benefitItem}>
                    <CheckCircle size={20} className={styles.checkIcon} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Requirements */}
          {requirements.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Requirements</h2>
              <ul className={styles.requirementsList}>
                {requirements.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Description */}
          {testPackage.longDescription && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Description</h2>
                            <div className={styles.description} dangerouslySetInnerHTML={{ __html: wrapContentTables(DOMPurify.sanitize(testPackage.longDescription)) }} />
            </section>
          )}

          {testPackage.disclaimer && (
            <div className={styles.disclaimerSection} style={{ whiteSpace: 'pre-wrap' }}>
              {testPackage.disclaimer}
            </div>
          )}

          {/* About the Teacher */}
          <section id="teacher-profile" className={styles.section}>
            <h2 className={styles.sectionTitle}>Meet your instructor</h2>
            <TeacherProfileCard
              teacher={{
                id: testPackage.teacherId,
                slug: testPackage.teacherSlug,
                displayName: testPackage.teacherName,
                avatarUrl: testPackage.teacherAvatarUrl,
                bio: testPackage.teacherBio,
                websiteUrl: testPackage.teacherWebsiteUrl,
                publicEmail: testPackage.teacherPublicEmail,
                publicPhone: testPackage.teacherPublicPhone,
                isVerified: testPackage.teacherIsVerified,
                socialLinks: testPackage.teacherSocialLinks,
                awardsCertificates: testPackage.teacherAwardsCertificates,
              }}
              variant="inline"
            />
          </section>

          {/* Student Reviews */}
          <section id="reviews" className={styles.section}>
            <TestReviews mockTestId={testPackage.id} />
          </section>

          {/* Bundle Suggestions */}
          <BundleSuggestions
            teacherId={testPackage.teacherId}
            variant="test"
          />

          <TeacherCtaBanner />
        </main>

        <div ref={sidebarRef} className={styles.sidebarColumn}>
          <TestPackageSidebar testPackage={testPackage} />
        </div>
      </div>

      <MobileStickyPurchaseBar 
        product={{
          type: 'test',
          id: testPackage.id,
          price: testPackage.price,
          discountPrice: testPackage.discountPrice,
          isEnrolled: testPackage.isEnrolled,
        }} 
        isVisible={isStickyBarVisible} 
      />

      <TestLeaderboardDialog
        isOpen={isLeaderboardDialogOpen}
        onClose={() => setIsLeaderboardDialogOpen(false)}
        testItems={items.map(item => ({ id: item.id, title: item.title }))}
        packageTitle={testPackage.title}
      />
    </>
  );
};

export default TestDetailsPage;