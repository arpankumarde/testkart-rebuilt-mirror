import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTestDetailsQuery } from "../helpers/useTestDetailsQuery";
import { SEOHead } from "../components/SEOHead";
import { Placeholder } from "../helpers/placeholderImages";
import { slugify } from "../helpers/slugify";
import { wrapContentTables } from "../helpers/contentTables";
import { sanitizeHtml } from "../helpers/sanitizeHtml";
import { CheckCircle, Star, FileText, Info, ListChecks, ClipboardList, Trophy, User, CalendarCheck } from "lucide-react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../components/Avatar";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { TestPackageHero } from "../components/TestPackageHero";
import { TestPackageSidebar } from "../components/TestPackageSidebar";
import { MobileStickyPurchaseBar } from "../components/MobileStickyPurchaseBar";
import { TestItemsList } from "../components/TestItemsList";
import { TestLeaderboard } from "../components/TestLeaderboard";
import { TestLeaderboardDialog } from "../components/TestLeaderboardDialog";
import { TestReviews } from "../components/TestReviews";
import { TeacherCtaBanner } from "../components/TeacherCtaBanner";
import { BundleSuggestions } from "../components/BundleSuggestions";
import { PublicCouponsCard } from "../components/PublicCouponsCard";
import { useTrackStorefrontView } from "../helpers/trackStorefrontEvent";
import { NotFoundState } from "../components/NotFoundState";
import { isNotFoundError } from "../helpers/isNotFoundError";
import styles from "./mock-test.$testSlug.module.css";

type SectionTone = "peach" | "mint" | "lavender" | "sky" | "butter";

/* Section title with a wobbly duotone icon blob, as on the course page. */
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

const TestDetailsSkeleton: React.FC = () => (
  <div className={styles.layout}>
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
  useTrackStorefrontView("mock_test", data?.package?.id);

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

  // Only before the first load; a refetch (e.g. after enrolling) keeps the page in place.
  if (isFetching && !data) {
    return <TestDetailsSkeleton />;
  }

  if (error && !isNotFoundError(error)) {
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
    return <NotFoundState kind="test" />;
  }

  const { package: testPackage, items } = data;
  const totalQuestions = items.reduce((sum, item) => sum + item.totalQuestions, 0);

  // Ensure whatYouLearn and requirements are arrays (may come as JSON strings from DB)
  const whatYouLearn = Array.isArray(testPackage.whatYouLearn)
    ? testPackage.whatYouLearn
    : (() => { try { const parsed = JSON.parse(testPackage.whatYouLearn as any); return Array.isArray(parsed) ? parsed : []; } catch { return []; } })();
  const requirements = Array.isArray(testPackage.requirements)
    ? testPackage.requirements
    : (() => { try { const parsed = JSON.parse(testPackage.requirements as any); return Array.isArray(parsed) ? parsed : []; } catch { return []; } })();

  // Closes the Description section, or the test list when there is no long description.
  const updatedLine = testPackage.updatedAt ? (
    <p className={styles.updatedLine}>
      <CalendarCheck size={15} aria-hidden="true" />
      Last updated {new Date(testPackage.updatedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
    </p>
  ) : null;

  const teacherInitials =
    testPackage.teacherName
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "T";

  return (
    <>
      <SEOHead
        title={testPackage.title}
        description={metaDescription}
        image={testPackage.thumbnailUrl || Placeholder.TEST}
        url={canonicalUrl}
        noIndex={!testPackage.seo.indexable}
      />
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}

      <div className={styles.layout}>
      <TestPackageHero 
        testPackage={testPackage} 
      />

      <div className={styles.contentWrapper}>
        <main className={styles.mainColumn}>
          {!testPackage.isEnrolled && testPackage.price > 0 && (
            <PublicCouponsCard itemType="test" itemId={testPackage.id} className={styles.couponsCard} />
          )}

          <section className={styles.section}>
            <SectionHeading tone="peach" icon={<ClipboardList />}>Tests in this series</SectionHeading>
            <TestItemsList items={items} isEnrolled={testPackage.isEnrolled} packageId={testPackage.id} />
            {!testPackage.longDescription && updatedLine}
          </section>

          {whatYouLearn.length > 0 && (
            <section className={styles.section}>
              <SectionHeading tone="mint" icon={<ListChecks />}>What you'll master</SectionHeading>
              <div className={styles.benefitsGrid}>
                {whatYouLearn.map((item, index) => (
                  <div key={index} className={styles.benefitItem}>
                    <CheckCircle size={18} className={styles.checkIcon} aria-hidden="true" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {requirements.length > 0 && (
            <section className={styles.section}>
              <SectionHeading tone="sky" icon={<Info />}>Requirements</SectionHeading>
              <ul className={styles.requirementsList}>
                {requirements.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {testPackage.longDescription && (
            <section className={styles.section}>
              <SectionHeading tone="lavender" icon={<FileText />}>Description</SectionHeading>
              <div className={styles.description} dangerouslySetInnerHTML={{ __html: wrapContentTables(sanitizeHtml(testPackage.longDescription)) }} />
              {updatedLine}
            </section>
          )}

          <section className={styles.section}>
            <SectionHeading tone="butter" icon={<Trophy />}>Top performers</SectionHeading>
            <TestLeaderboard 
              testItems={items.map(item => ({ id: item.id, title: item.title }))}
              onViewFull={() => setIsLeaderboardDialogOpen(true)}
            />
          </section>

          <section id="teacher-profile" className={styles.section}>
            <SectionHeading tone="sky" icon={<User />}>Meet your instructor</SectionHeading>
            <Link
              to={`/expert/${testPackage.teacherSlug || slugify(testPackage.teacherName)}`}
              className={styles.instructorRow}
              aria-label={`${testPackage.teacherName} - view instructor profile`}
            >
              <Avatar className={styles.instructorAvatar}>
                <AvatarImage src={testPackage.teacherAvatarUrl || undefined} alt="" />
                <AvatarFallback>{teacherInitials}</AvatarFallback>
              </Avatar>
              <span className={styles.instructorNameRow}>
                <span className={styles.instructorName}>{testPackage.teacherName}</span>
                <VerifiedBadge isVerified={testPackage.teacherIsVerified} size="sm" className={styles.instructorVerified} />
              </span>
            </Link>
          </section>

          <section id="reviews" className={styles.section}>
            <SectionHeading tone="butter" icon={<Star />}>Student reviews</SectionHeading>
            <TestReviews
              mockTestId={testPackage.id}
              rating={testPackage.rating}
              reviewsCount={testPackage.reviewsCount}
            />
          </section>

          {testPackage.disclaimer && (
            <div className={styles.disclaimerSection}>
              <Info size={18} className={styles.disclaimerIcon} aria-hidden="true" />
              <div className={styles.disclaimerText}>{testPackage.disclaimer}</div>
            </div>
          )}

          <BundleSuggestions
            teacherId={testPackage.teacherId}
            variant="test"
          />

          <TeacherCtaBanner />
        </main>

        <div ref={sidebarRef} className={styles.sidebarColumn}>
          <TestPackageSidebar
            testPackage={testPackage}
            totalQuestions={totalQuestions}
          />
        </div>
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