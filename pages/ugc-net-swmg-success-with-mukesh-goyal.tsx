import React from "react";
import { SEOHead } from "../components/SEOHead";
import {
  SwmgBrandAction,
  SwmgCatalogSections,
  SwmgChannelCards,
  SwmgClosingCta,
  SwmgFaq,
  SwmgPageBody,
  SwmgPageNav,
  SwmgPromoHero,
  SwmgSection,
  SwmgTextLink,
  SwmgVideoCard,
  SwmgVideoGrid,
  swmgBreadcrumbJsonLd,
  swmgFaqJsonLd,
  swmgPersonJsonLd,
  swmgVideoJsonLd,
} from "../components/SwmgPromo";
import { swmgPromoContent as content } from "../helpers/swmgPromoContent";
import styles from "./ugc-net-swmg-success-with-mukesh-goyal.module.css";

const PAGE_TITLE = "Dr. Mukesh Goyal (SWMG) - UGC NET EVS and Paper 1";
const PAGE_DESCRIPTION =
  "Prepare for UGC NET Environmental Science and Paper 1 with Dr. Mukesh Goyal (JRF, Ph.D.), founder of SWMG. His courses, free classes and student results.";

const RESULT_PREVIEW = [content.videos.firstAttempt, content.videos.jrfStrategy, content.videos.airRankInterview];

export default function SwmgOverviewPage() {
  const url = `${content.siteUrl}${content.paths.overview}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      swmgPersonJsonLd(),
      {
        "@type": "ProfilePage",
        "@id": `${url}#page`,
        url,
        name: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        primaryImageOfPage: content.portrait.src900,
        mainEntity: { "@id": `${url}#person` },
        isPartOf: { "@type": "WebSite", name: "Testkart", url: content.siteUrl },
      },
      swmgBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: content.name, path: content.paths.overview },
      ]),
      swmgFaqJsonLd(content.overviewFaqs),
      swmgVideoJsonLd(content.videos.paperReview),
      ...RESULT_PREVIEW.map(swmgVideoJsonLd),
    ],
  };

  return (
    <>
      <SEOHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} image={content.shareImage} url={url} type="profile" />
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>

      <SwmgPromoHero
        breadcrumbs={[{ label: "Home", to: "/" }, { label: content.name }]}
        chip="Now teaching on Testkart"
        title={content.name}
        subtitle="UGC NET Environmental Science and Paper 1"
        lede="JRF qualified, Ph.D. in Environmental Science and the founder of SWMG, Success with Mukesh Goyal. For more than 10 years he has helped UGC NET aspirants turn concepts into marks, teaching in Hindi and English."
        actions={<SwmgBrandAction href="#courses">See his courses</SwmgBrandAction>}
        showCredentials
      />
      <SwmgPageNav active="overview" />

      <SwmgPageBody>
        <SwmgCatalogSections
          emptyTitle="His Testkart courses are on the way"
          emptyText="Dr. Goyal is publishing his UGC NET Environmental Science and Paper 1 courses on Testkart. They will be listed here the moment they go live. Until then, start with his free classes or follow his Testkart profile."
        />

        <SwmgSection
          id="free-classes"
          title="Start with a free class"
          intro="Judge the teaching before you pay for it. His two YouTube channels carry close to 1,900 free lessons. This one works through the June 2026 Environmental Science paper, question by question."
        >
          <SwmgVideoCard video={content.videos.paperReview} featured />
          <div className={styles.channels}>
            <SwmgChannelCards />
          </div>
        </SwmgSection>

        <SwmgSection
          id="results"
          title="Students who prepared with him"
          intro="Interviews and feedback from SWMG students, as published on Dr. Goyal's YouTube channels."
        >
          <SwmgVideoGrid>
            {RESULT_PREVIEW.map((video) => (
              <SwmgVideoCard key={video.id} video={video} />
            ))}
          </SwmgVideoGrid>
          <SwmgTextLink to={content.paths.reviews}>See every student result and review</SwmgTextLink>
        </SwmgSection>

        <SwmgSection id="faq" title="Questions about Dr. Mukesh Goyal">
          <SwmgFaq items={content.overviewFaqs} />
        </SwmgSection>

        <SwmgClosingCta
          title={<>Prepare for UGC NET with Dr.&nbsp;Mukesh&nbsp;Goyal</>}
          text="Concept classes, previous-year questions, tests and revision for Environmental Science and Paper 1, from a teacher who qualified JRF himself."
          actions={
            <>
              <SwmgBrandAction href="#courses">See his courses</SwmgBrandAction>
              <SwmgBrandAction to={`/expert/${content.teacherSlug}`} variant="outline">
                Open his Testkart profile
              </SwmgBrandAction>
            </>
          }
        />
      </SwmgPageBody>
    </>
  );
}