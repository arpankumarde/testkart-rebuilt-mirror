import React from "react";
import { useHomepageData } from "../helpers/useHomepageData";
import { SEOHead } from "../components/SEOHead";
import { HomepageSearchHero } from "../components/HomepageSearchHero";
import { HomepageCategoryCards } from "../components/HomepageCategoryCards";
import { HomepageLiveSpotlight } from "../components/HomepageLiveSpotlight";
import { HomepageContentSection, TeacherProductCard } from "../components/HomepageContentSection";
import type { HomepageTestItem, HomepageCourseItem, HomepageNoteItem } from "../endpoints/homepage/data_GET.schema";
import { formatItemPrice } from "../helpers/homepageItemUtils";
import { Placeholder } from "../helpers/placeholderImages";
import styles from "./_index.module.css";

const HomePage: React.FC = () => {
  const { data, isFetching } = useHomepageData();

  // Structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://testkart.in/#website",
        name: "Testkart",
        url: "https://testkart.in",
        description: "India's online marketplace where teachers sell and students buy mock tests, courses, and study materials for exam preparation. Join thousands of educators and learners on Testkart.",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: "https://testkart.in/mock-test?search={search_term_string}",
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "EducationalOrganization",
        "@id": "https://testkart.in/#organization",
        name: "Testkart",
        url: "https://testkart.in",
        description: "India's online marketplace where teachers sell and students buy mock tests, courses, and study materials for exam preparation. Join thousands of educators and learners on Testkart.",
      },
      {
        "@type": "WebPage",
        "@id": "https://testkart.in/#webpage",
        url: "https://testkart.in/",
        name: "Testkart | India's Marketplace for Mock Tests, Courses & Study Notes",
        description: "India's online marketplace where teachers sell and students buy mock tests, courses, and study materials for exam preparation. Join thousands of educators and learners on Testkart.",
        isPartOf: {
          "@id": "https://testkart.in/#website",
        },
        about: {
          "@id": "https://testkart.in/#organization",
        },
      },
    ],
  };

  return (
    <>
      <SEOHead
        title="India's Marketplace for Mock Tests, Courses & Study Notes"
        description="India's online marketplace where teachers sell and students buy mock tests, courses, and study materials for exam preparation. Join thousands of educators and learners on Testkart."
        url="https://testkart.in/"
        image="https://assets.floot.app/0a7f01ed-7b95-4c38-9275-16e713383937/54922abf-b666-4d9f-9732-aec0c03c9254.png"
      />
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      <div className={styles.pageContainer}>
        <HomepageSearchHero />

        <div className={styles.contentWrapper}>
          <HomepageCategoryCards />
         <HomepageLiveSpotlight spotlights={data?.liveTestSpotlight ?? []} />

          <HomepageContentSection
            title="Top mock tests this week"
            viewAllLink="/mock-test"
            items={(data?.topMockTests ?? []).slice(0, 4)}
            isLoading={isFetching}
            renderCard={(item: HomepageTestItem) => {
              const statsParts = [`${item.views.toLocaleString("en-IN")} views`];
              if (item.rating != null) {
                statsParts.push(`⭐ ${item.rating}`);
              }

              return (
                <TeacherProductCard
                  link={`/mock-test/${item.slug}`}
                  teacherName={item.teacherName}
                  teacherAvatarUrl={item.teacherAvatarUrl}
                  teacherTagline={item.teacherTagline}
                  teacherYearsOfExperience={item.teacherYearsOfExperience}
                  teacherSlug={item.teacherSlug}
                  teacherIsVerified={item.teacherIsVerified}
                  productTitle={item.title}
                  examName={item.examName}
                  stats={statsParts.join(" · ")}
                  priceLabel={formatItemPrice(item.price, item.discountPrice)}
                  isFree={(item.discountPrice ?? item.price) === 0}
                  thumbnailUrl={item.thumbnailUrl}
                  placeholderUrl={Placeholder.TEST}
                />
              );
            }}
          />

          <HomepageContentSection
            title="Popular courses"
            viewAllLink="/course"
            items={(data?.popularCourses ?? []).slice(0, 4)}
            isLoading={isFetching}
            renderCard={(item: HomepageCourseItem) => (
              <TeacherProductCard
                link={`/course/${item.slug}`}
                teacherName={item.teacherName}
                teacherAvatarUrl={item.teacherAvatarUrl}
                teacherTagline={item.teacherTagline}
                teacherYearsOfExperience={item.teacherYearsOfExperience}
                teacherSlug={item.teacherSlug}
                teacherIsVerified={item.teacherIsVerified}
                productTitle={item.title}
                stats={`${item.views.toLocaleString("en-IN")} views · ${item.totalLessons} lessons`}
                priceLabel={formatItemPrice(item.price)}
                isFree={item.price === 0}
                thumbnailUrl={item.thumbnailUrl}
                placeholderUrl={Placeholder.COURSE}
              />
            )}
          />

          <HomepageContentSection
            title="Popular study notes"
            viewAllLink="/study-notes"
            items={(data?.popularNotes ?? []).slice(0, 4)}
            isLoading={isFetching}
            renderCard={(item: HomepageNoteItem) => (
              <TeacherProductCard
                link={`/study-notes/${item.slug}`}
                teacherName={item.teacherName}
                teacherAvatarUrl={item.teacherAvatarUrl}
                teacherTagline={item.teacherTagline}
                teacherYearsOfExperience={item.teacherYearsOfExperience}
                teacherSlug={item.teacherSlug}
                teacherIsVerified={item.teacherIsVerified}
                                productTitle={item.title}
                examName={item.examName}
                stats={[
                  `${item.views.toLocaleString("en-IN")} views`,
                  item.pageCount ? `${item.pageCount} pages` : null,
                ].filter(Boolean).join(" · ")}
                priceLabel={formatItemPrice(item.price)}
                isFree={item.price === 0}
              />
            )}
          />
        </div>
      </div>
    </>
  );
};

export default HomePage;