import React from "react";
import { SEOHead } from "../components/SEOHead";
import {
  SwmgBrandAction,
  SwmgClosingCta,
  SwmgFaq,
  SwmgPageBody,
  SwmgPageNav,
  SwmgPromoHero,
  SwmgRatings,
  SwmgSection,
  SwmgVideoCard,
  SwmgVideoGrid,
  swmgBreadcrumbJsonLd,
  swmgFaqJsonLd,
  swmgPersonJsonLd,
  swmgVideoJsonLd,
} from "../components/SwmgPromo";
import { swmgPromoContent as content } from "../helpers/swmgPromoContent";
import styles from "./ugc-net-swmg-success-with-mukesh-goyal.reviews.module.css";

const PAGE_TITLE = "Dr. Mukesh Goyal Reviews and Student Results";
const PAGE_DESCRIPTION =
  "Interviews and feedback from students of Dr. Mukesh Goyal (SWMG), including UGC NET JRF and All India Rank holders, plus ratings of his Testkart courses.";

const RANK_HOLDERS = [content.videos.jrfStrategy, content.videos.firstScholarship, content.videos.airRankInterview];

const FEEDBACK = [content.videos.feedbackOne, content.videos.feedbackTwo, content.videos.teachersDay];

const CHECKS = [
  {
    title: "Watch a complete class, not a clip",
    text: "A full lesson shows whether the explanations work for you. Both of Dr. Goyal's channels have complete classes you can sit through before paying.",
  },
  {
    title: "Check that every unit is covered",
    text: "Match the course against all ten units of the paper, not just the popular ones.",
  },
  {
    title: "Look at how PYQs and tests are used",
    text: "Previous-year questions and mocks should come back to the concepts you got wrong, not sit in a separate folder.",
  },
  {
    title: "Confirm what you are paying for",
    text: "Read the course page for its lessons, tests, notes and validity before you buy.",
  },
];

export default function SwmgReviewsPage() {
  const url = `${content.siteUrl}${content.paths.reviews}`;
  const allVideos = [content.videos.firstAttempt, ...RANK_HOLDERS, ...FEEDBACK, content.videos.resultAnalysis];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      swmgPersonJsonLd(),
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        url,
        name: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        about: { "@id": `${content.siteUrl}${content.paths.overview}#person` },
        primaryImageOfPage: content.portrait.src900,
        isPartOf: { "@type": "WebSite", name: "Testkart", url: content.siteUrl },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: allVideos.length,
          itemListElement: allVideos.map((video, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: swmgVideoJsonLd(video),
          })),
        },
      },
      swmgBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: content.name, path: content.paths.overview },
        { name: "Student results and reviews", path: content.paths.reviews },
      ]),
      swmgFaqJsonLd(content.reviewFaqs),
    ],
  };

  return (
    <>
      <SEOHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} image={content.shareImage} url={url} />
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>

      <SwmgPromoHero
        compact
        breadcrumbs={[
          { label: "Home", to: "/" },
          { label: content.name, to: content.paths.overview },
          { label: "Student results and reviews" },
        ]}
        chip="Student results"
        title="Dr. Mukesh Goyal reviews and student results"
        subtitle="What his UGC NET students say, in their own words"
        lede="Interviews with students who qualified NET and JRF, including All India Rank holders and a first-attempt Environmental Science qualifier, and feedback videos from over the years. Every video was published on Dr. Goyal's own YouTube channels."
        actions={
          <>
            <SwmgBrandAction href="#latest">Watch the latest interview</SwmgBrandAction>
            <SwmgBrandAction to={`${content.paths.overview}#courses`} variant="outline">
              See his courses
            </SwmgBrandAction>
          </>
        }
      />
      <SwmgPageNav active="reviews" />

      <SwmgPageBody>
        <SwmgSection
          id="latest"
          title="The latest result: June 2026"
          intro="A student who qualified UGC NET Environmental Science on the first attempt talks through how they prepared."
        >
          <SwmgVideoCard video={content.videos.firstAttempt} featured />
        </SwmgSection>

        <SwmgSection
          id="jrf"
          title="JRF and All India Rank holders"
          intro="Conversations with students who qualified JRF or secured an All India Rank. They describe individual experiences, and your own result depends on your preparation."
        >
          <SwmgVideoGrid>
            {RANK_HOLDERS.map((video) => (
              <SwmgVideoCard key={video.id} video={video} />
            ))}
          </SwmgVideoGrid>
        </SwmgSection>

        <SwmgSection
          id="feedback"
          title="Feedback from his students"
          intro="Short messages students recorded for Dr. Goyal after their results and on Teacher's Day."
        >
          <SwmgVideoGrid>
            {FEEDBACK.map((video) => (
              <SwmgVideoCard key={video.id} video={video} />
            ))}
          </SwmgVideoGrid>
        </SwmgSection>

        <SwmgSection
          id="ratings"
          title="Ratings on Testkart"
          intro="Star ratings from students who enrolled in his courses and tests on Testkart."
        >
          <SwmgRatings />
        </SwmgSection>

        <SwmgSection
          id="competition"
          title="How hard it is to qualify"
          intro="Results only mean something against the numbers. Dr. Goyal breaks down how many Environmental Science candidates registered, appeared and qualified for JRF, NET and Ph.D. admission in June 2026."
        >
          <SwmgVideoCard video={content.videos.resultAnalysis} featured />
        </SwmgSection>

        <SwmgSection
          id="before-you-choose"
          title="Before you choose any UGC NET teacher"
          intro="Reviews help, but they are someone else's experience. These four checks tell you whether a course fits yours."
        >
          <ul className={styles.checks}>
            {CHECKS.map((check) => (
              <li key={check.title} className={styles.check}>
                <h3 className={styles.checkTitle}>{check.title}</h3>
                <p className={styles.checkText}>{check.text}</p>
              </li>
            ))}
          </ul>
        </SwmgSection>

        <SwmgSection id="faq" title="Questions about these reviews">
          <SwmgFaq items={content.reviewFaqs} />
        </SwmgSection>

        <SwmgClosingCta
          title={<>Start your own preparation with Dr.&nbsp;Goyal</>}
          text="The method his students describe here, for UGC NET Environmental Science and Paper 1: learn the concept, practise PYQs, test yourself and revise the gaps."
          actions={
            <>
              <SwmgBrandAction to={`${content.paths.overview}#courses`}>See his courses</SwmgBrandAction>
              <SwmgBrandAction to={content.paths.evs} variant="outline">
                Environmental Science syllabus
              </SwmgBrandAction>
            </>
          }
        />
      </SwmgPageBody>
    </>
  );
}