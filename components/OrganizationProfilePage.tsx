import React from "react";
import { AlertTriangle } from "lucide-react";
import { SEOHead } from "./SEOHead";
import { BRAND_APP_ICON } from "../helpers/brandAssets";
import { useOrganizationProfileQuery } from "../helpers/useOrganizationProfile";
import {
  getOrganizationTabPath,
  isOrganizationTabValue,
  ORGANIZATION_TAB_LABELS,
  type OrganizationTabValue,
} from "../helpers/organizationRoutes";
import { OrganizationProfileView } from "./OrganizationProfileView";
import { Skeleton } from "./Skeleton";
import styles from "./OrganizationProfilePage.module.css";

const SITE_URL = "https://testkart.in";

const SCHEMA_ORG_TYPE: Record<string, string> = {
  school: "School",
  college: "CollegeOrUniversity",
  university: "CollegeOrUniversity",
  coaching: "EducationalOrganization",
  other: "EducationalOrganization",
};

const OrganizationProfilePageSkeleton = () => (
  <div className={styles.page} aria-busy="true">
    <div className={styles.heroSkeleton}>
      <Skeleton className={styles.avatarSkeleton} />
      <div className={styles.heroTextSkeleton}>
        <Skeleton style={{ width: "min(22rem, 80%)", height: "2rem" }} />
        <Skeleton style={{ width: "min(30rem, 90%)", height: "1.25rem" }} />
      </div>
    </div>
    <div className={styles.gridSkeleton}>
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} style={{ height: "14rem", borderRadius: "1.25rem" }} />
      ))}
    </div>
  </div>
);

interface OrganizationProfilePageProps {
  orgSlug: string;
  // Raw :tab param straight from the route. Undefined (the bare
  // /school/:slug route) and any unrecognized value both fall back to
  // "about" - the sub-nav and SEO just treat it as the default/home tab.
  tab?: string;
}

/**
 * Shared body for every organisation public route - /school/:slug,
 * /college/:slug, /coaching/:slug, /university/:slug and
 * /organisation/:slug (for "other"), plus their /:tab variants. It is
 * rendered by OrganizationProfileLayout, the persistent page layout those
 * routes share, so the loading/error states, SEO and canonical URL logic
 * live in exactly one place and survive section switches.
 *
 * This page's job is to be found and read, not to sell: people reach it
 * from organic search looking for facts about an institute, so the meta
 * description and structured data lead with who/where/what-they-teach
 * rather than a sales pitch, and OrganizationProfileView mirrors that by
 * putting informational sections first and the sellable catalogue last.
 */
export const OrganizationProfilePage: React.FC<OrganizationProfilePageProps> = ({ orgSlug, tab }) => {
  const { data, isLoading, isError, error } = useOrganizationProfileQuery(orgSlug);
  const activeTab: OrganizationTabValue = isOrganizationTabValue(tab) ? tab : "about";

  if (isLoading) {
    return (
      <>
        <SEOHead title="Loading organisation..." description="Loading organisation profile" image={null} />
        <OrganizationProfilePageSkeleton />
      </>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.page}>
        <SEOHead title="Organisation not found" description="Organisation profile not found" image={null} />
        <div className={styles.errorState} role="alert">
          <span className={styles.errorIcon} aria-hidden="true">
            <AlertTriangle size={26} />
          </span>
          <h1 className={styles.errorTitle}>Organisation not found</h1>
          <p className={styles.errorText}>
            {error instanceof Error ? error.message : "We couldn't find this organisation page."}
          </p>
        </div>
      </div>
    );
  }

  const org = data.organization;
  const canonicalUrl = `${SITE_URL}${getOrganizationTabPath(org.orgType, orgSlug, activeTab)}`;

  const typeLabel =
    org.orgType === "coaching"
      ? "coaching institute"
      : org.orgType === "school"
        ? "school"
        : org.orgType === "college"
          ? "college"
          : org.orgType === "university"
            ? "university"
            : "organisation";

  const locationSuffix = org.location ? ` in ${org.location}` : "";

  const tabTitleSuffix = activeTab === "about" ? "" : ` - ${ORGANIZATION_TAB_LABELS[activeTab]}`;

  const pageTitle = `${org.name}${tabTitleSuffix} - ${typeLabel.charAt(0).toUpperCase()}${typeLabel.slice(1)}${
    org.location ? ` in ${org.location}` : ""
  } | Testkart`;

  // org.description is rich HTML from the About editor - strip tags for the
  // plain-text meta/JSON-LD description rather than leaking markup into
  // search snippets.
  const plainDescription = org.description
    ? org.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    : "";

  const metaDescription =
    plainDescription ||
    `${org.name} is a ${typeLabel}${locationSuffix}${
      data.teachers.length > 0
        ? ` with ${data.teachers.length} associated teacher${data.teachers.length === 1 ? "" : "s"} on Testkart`
        : " on Testkart"
    }. See teachers, courses, test series and student reviews.`;

  // Split "City, State" into locality/region for the postal address, best
  // effort - falls back to just a locality (or nothing) when the stored
  // text doesn't split cleanly.
  const locationParts = (org.location ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  const addressLocality = locationParts[0];
  const addressRegion = locationParts.length > 1 ? locationParts[locationParts.length - 1] : undefined;

  const sameAs = [
    org.websiteUrl,
    org.socialLinks?.facebook,
    org.socialLinks?.twitter,
    org.socialLinks?.linkedin,
    org.socialLinks?.instagram,
    org.socialLinks?.youtube,
  ].filter((v): v is string => !!v);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": SCHEMA_ORG_TYPE[org.orgType] ?? "EducationalOrganization",
    "@id": `${canonicalUrl}#organization`,
    name: org.name,
    url: canonicalUrl,
    description: plainDescription || metaDescription,
    ...(org.logoUrl && { logo: org.logoUrl, image: org.logoUrl }),
    ...(org.foundedYear && { foundingDate: String(org.foundedYear) }),
    ...(org.phoneNumber && { telephone: org.phoneNumber }),
    ...(org.websiteUrl && { sameAs: sameAs.length > 0 ? sameAs : undefined }),
    ...(addressLocality && {
      address: {
        "@type": "PostalAddress",
        addressLocality,
        ...(addressRegion && { addressRegion }),
        addressCountry: "IN",
      },
    }),
    ...(data.reviewCount > 0 &&
      data.averageRating !== null && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: data.averageRating.toFixed(1),
          reviewCount: data.reviewCount,
        },
      }),
  };

  return (
    <>
      <SEOHead
        title={pageTitle}
        description={metaDescription}
        image={org.logoUrl || BRAND_APP_ICON}
        twitterCard="summary"
        url={canonicalUrl}
        type="website"
      />
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      <OrganizationProfileView data={data} orgSlug={orgSlug} tab={activeTab} />
    </>
  );
};
