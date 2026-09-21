import React from "react";
import { useParams, useLocation, useSearchParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { SEOHead } from "../components/SEOHead";
import { useTeacherPublicProfileQuery } from "../helpers/useTeacherPublicProfile";
import { ExpertProfileView } from "../components/ExpertProfileView";
import { Skeleton } from "../components/Skeleton";
import { useTrackStorefrontView } from "../helpers/trackStorefrontEvent";
import styles from "./expert.$teacherSlug.module.css";

const SITE_URL = "https://testkart.in";

// Legacy: the page used to run on tabs named courses/tests/live/products and
// took the opening one from router state. The landing page keeps the same
// names as catalogue filters, and also accepts them as ?tab= so a shared link
// can open on one.
const CATALOGUE_FILTERS = ["courses", "tests", "live", "products"] as const;
type CatalogueFilter = (typeof CATALOGUE_FILTERS)[number];

const asFilter = (value: string | null | undefined): CatalogueFilter | null =>
  CATALOGUE_FILTERS.includes(value as CatalogueFilter) ? (value as CatalogueFilter) : null;

const ExpertProfilePageSkeleton = () => (
  <div className={styles.page} aria-busy="true">
    <div className={styles.heroSkeleton}>
      <Skeleton className={styles.avatarSkeleton} />
      <div className={styles.heroTextSkeleton}>
        <Skeleton style={{ width: "9rem", height: "1.75rem", borderRadius: "var(--radius-full)" }} />
        <Skeleton style={{ width: "min(22rem, 80%)", height: "3rem" }} />
        <Skeleton style={{ width: "min(30rem, 90%)", height: "1.25rem" }} />
        <div className={styles.heroActionsSkeleton}>
          <Skeleton style={{ width: "11rem", height: "2.75rem" }} />
          <Skeleton style={{ width: "9rem", height: "2.75rem" }} />
        </div>
      </div>
    </div>

    <div className={styles.statsSkeleton}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} style={{ height: "3.5rem" }} />
      ))}
    </div>

    <div className={styles.gridSkeleton}>
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} style={{ height: "18rem", borderRadius: "var(--radius-md)" }} />
      ))}
    </div>
  </div>
);

const ExpertProfilePage = () => {
  const { teacherSlug } = useParams<{ teacherSlug: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { defaultTab } = (location.state as { defaultTab?: string }) || {};

  const { data, isLoading, isError, error } = useTeacherPublicProfileQuery(teacherSlug || "");
  useTrackStorefrontView("teacher_profile", data ? teacherSlug : null);

  if (isLoading) {
    return (
      <>
        <SEOHead title="Loading expert profile..." description="Loading expert profile information" />
        <ExpertProfilePageSkeleton />
      </>
    );
  }

  if (isError) {
    return (
      <div className={styles.page}>
        <SEOHead title="Expert not found" description="Expert profile not found" />
        <div className={styles.errorState} role="alert">
          <span className={styles.errorIcon} aria-hidden="true">
            <AlertTriangle size={26} />
          </span>
          <h1 className={styles.errorTitle}>Expert not found</h1>
          <p className={styles.errorText}>
            {error instanceof Error ? error.message : "We couldn't find a profile for this expert."}
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { teacher, courses, tests, liveTests, products } = data;
  const canonicalUrl = `${SITE_URL}/expert/${teacherSlug}`;

  const offerings: string[] = [];
  if (courses.length > 0) offerings.push(`${courses.length} course${courses.length > 1 ? "s" : ""}`);
  if (tests.length > 0) offerings.push(`${tests.length} mock test package${tests.length > 1 ? "s" : ""}`);
  if (liveTests.length > 0) offerings.push(`${liveTests.length} live test${liveTests.length > 1 ? "s" : ""}`);
  if (products.length > 0) offerings.push(`${products.length} study material${products.length > 1 ? "s" : ""}`);

  const offeringsText =
    offerings.length > 0
      ? offerings.join(", ").replace(/, ([^,]*)$/, " & $1")
      : "courses, mock tests & study materials";

  const bioSnippet = teacher.bio ? ` ${teacher.bio.substring(0, 100).trim()}` : "";
  const metaDescription = `Explore ${offeringsText} by ${teacher.displayName} on Testkart.${bioSnippet}`;
  const pageTitle = `${teacher.displayName} – Explore Courses, Mock Tests & Study Material | Testkart`;
  const totalContentCount = courses.length + tests.length + liveTests.length + products.length;
  const avatarUrl = teacher.avatarUrl ? teacher.avatarUrl : `${SITE_URL}/default-avatar.png`;

  const sameAsLinks: string[] = [];
  if (teacher.socialLinks) {
    if (teacher.socialLinks.facebook) sameAsLinks.push(teacher.socialLinks.facebook);
    if (teacher.socialLinks.twitter) sameAsLinks.push(teacher.socialLinks.twitter);
    if (teacher.socialLinks.linkedin) sameAsLinks.push(teacher.socialLinks.linkedin);
    if (teacher.socialLinks.instagram) sameAsLinks.push(teacher.socialLinks.instagram);
    if (teacher.socialLinks.youtube) sameAsLinks.push(teacher.socialLinks.youtube);
  }
  if (teacher.websiteUrl) sameAsLinks.push(teacher.websiteUrl);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${canonicalUrl}#person`,
        name: teacher.displayName,
        image: teacher.avatarUrl || avatarUrl,
        description: teacher.bio || `Educator and test creator on Testkart`,
        url: canonicalUrl,
        jobTitle: "Educator",
        worksFor: {
          "@type": "Organization",
          name: "Testkart",
          url: SITE_URL,
        },
        // No contactPoint: it carried the teacher's account phone number into
        // machine-readable markup, which is the first thing a scraper reads.
        // Their email and phone are not published on this page at all.
        ...(sameAsLinks.length > 0 && { sameAs: sameAsLinks }),
      },
      {
        "@type": "ProfilePage",
        "@id": `${canonicalUrl}#profilepage`,
        name: pageTitle,
        description: metaDescription,
        url: canonicalUrl,
        mainEntity: {
          "@id": `${canonicalUrl}#person`,
        },
      },
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        name: pageTitle,
        description: metaDescription,
        url: canonicalUrl,
        isPartOf: {
          "@type": "WebSite",
          name: "Testkart",
          url: SITE_URL,
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Experts",
            item: `${SITE_URL}/expert/all`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: teacher.displayName,
            item: canonicalUrl,
          },
        ],
      },
      ...(totalContentCount > 0
        ? [
            {
              "@type": "ItemList",
              "@id": `${canonicalUrl}#itemlist`,
              name: `Courses, Mock Tests and Products by ${teacher.displayName}`,
              description: `List of content created by ${teacher.displayName}`,
              numberOfItems: totalContentCount,
              itemListElement: [
                ...courses.map((course, index) => ({
                  "@type": "ListItem",
                  position: index + 1,
                  url: `${SITE_URL}/course/${course.slug}`,
                  name: course.title,
                })),
                ...tests.map((test, index) => ({
                  "@type": "ListItem",
                  position: courses.length + index + 1,
                  url: `${SITE_URL}/mock-test/${test.slug}`,
                  name: test.title,
                })),
                ...liveTests.map((test, index) => ({
                  "@type": "ListItem",
                  position: courses.length + tests.length + index + 1,
                  url: `${SITE_URL}/mock-test/live/${test.id}`,
                  name: test.title,
                })),
                ...products.map((product, index) => ({
                  "@type": "ListItem",
                  position: courses.length + tests.length + liveTests.length + index + 1,
                  url: `${SITE_URL}/study-notes/${product.slug}`,
                  name: product.title,
                })),
              ],
            },
          ]
        : []),
    ],
  };

  // Null lets the view open on whichever category the teacher actually has.
  const initialFilter = asFilter(searchParams.get("tab")) ?? asFilter(defaultTab);

  return (
    <>
      <SEOHead
        title={`${teacher.displayName} – Explore Courses, Mock Tests & Study Material`}
        description={metaDescription}
        image={teacher.avatarUrl || avatarUrl}
        url={canonicalUrl}
        type="profile"
      />
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>

      <ExpertProfileView data={data} initialFilter={initialFilter} />
    </>
  );
};

export default ExpertProfilePage;
