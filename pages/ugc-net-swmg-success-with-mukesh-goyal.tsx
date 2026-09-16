import React from "react";
import { Link } from "react-router-dom";
import { SEOHead } from "../components/SEOHead";
import {
  SwmgBrandAction,
  SwmgCatalog,
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

const FACTS = [
  { label: "Qualification", value: "UGC NET JRF" },
  { label: "Doctorate", value: "Ph.D. in Environmental Science" },
  { label: "Experience", value: "10+ years teaching" },
  { label: "Founder of", value: "SWMG - Success with Mukesh Goyal" },
  { label: "Teaches", value: "UGC NET Paper 1 and Environmental Science Paper 2" },
  { label: "Languages", value: "Hindi and English" },
  { label: "Based in", value: "Hisar, Haryana" },
];

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
        actions={
          <>
            <SwmgBrandAction href="#courses">See his courses</SwmgBrandAction>
            <SwmgBrandAction href="#free-classes" variant="outline">
              Watch a free class
            </SwmgBrandAction>
          </>
        }
        showCredentials
      />
      <SwmgPageNav active="overview" />

      <SwmgPageBody>
        <SwmgSection
          id="courses"
          title="Study with Dr. Goyal on Testkart"
          intro="His UGC NET courses, test series and notes on Testkart. Buy once and study on the web or in the Testkart app."
        >
          <SwmgCatalog
            emptyTitle="His Testkart courses are on the way"
            emptyText="Dr. Goyal is publishing his UGC NET Environmental Science and Paper 1 courses on Testkart. They will be listed here the moment they go live. Until then, start with his free classes or follow his Testkart profile."
          />
        </SwmgSection>

        <SwmgSection
          id="subjects"
          title="What Dr. Goyal teaches"
          intro="Every UGC NET candidate takes the common Paper 1 together with a subject Paper 2 in one sitting. Dr. Goyal teaches both papers for Environmental Science aspirants, unit by unit."
        >
          <div className={styles.tracks}>
            <article className={styles.track}>
              <p className={styles.trackMeta}>Paper 2, subject code 89</p>
              <h3 className={styles.trackTitle}>UGC NET Environmental Science</h3>
              <p className={styles.trackText}>
                His specialist subject. All ten units from the fundamentals to contemporary issues, with numericals,
                processes, Acts and conventions taught against previous-year questions.
              </p>
              <ol className={styles.unitList}>
                {content.evsUnits.map((unit) => (
                  <li key={unit.number}>{unit.name}</li>
                ))}
              </ol>
              <Link to={content.paths.evs} className={styles.trackLink}>
                See the full Environmental Science syllabus and study plan
              </Link>
            </article>

            <article className={styles.track}>
              <p className={styles.trackMeta}>Paper 1, common to every subject</p>
              <h3 className={styles.trackTitle}>UGC NET Paper 1</h3>
              <p className={styles.trackText}>
                The paper his largest channel is built on, with more than 1,500 free lessons. Teaching and research
                aptitude, reasoning, data interpretation, ICT and higher education, covered one unit at a time.
              </p>
              <ol className={styles.unitList}>
                {content.paper1Units.map((unit) => (
                  <li key={unit}>{unit}</li>
                ))}
              </ol>
              <a
                href={content.channels.paper1.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.trackLink}
              >
                Watch his Paper 1 lessons on YouTube
              </a>
            </article>
          </div>
        </SwmgSection>

        <SwmgSection id="about" title="About Dr. Mukesh Goyal">
          <div className={styles.about}>
            <div className={styles.aboutText}>
              <p>
                Dr. Mukesh Goyal is a JRF-qualified educator with a Ph.D. in Environmental Science and more than a
                decade of academic experience. An alumnus of Kurukshetra University, he founded SWMG, Success with
                Mukesh Goyal, to give UGC NET aspirants a structured way to prepare wherever they live.
              </p>
              <p>
                His classes begin with concept clarity and then move through previous-year questions, numericals,
                tests, mistake analysis and planned revision, so students practise the way the exam actually asks.
                First-time candidates, repeaters and JRF aspirants study with him, along with students preparing for
                SET, Assistant Professor and Ph.D. entrance exams.
              </p>
              <p>
                He teaches in Hindi and English from Hisar, Haryana. His two free YouTube channels have grown past
                140,000 subscribers and close to 1,900 lessons.
              </p>
            </div>
            <dl className={styles.facts}>
              {FACTS.map((fact) => (
                <div key={fact.label} className={styles.fact}>
                  <dt className={styles.factLabel}>{fact.label}</dt>
                  <dd className={styles.factValue}>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </SwmgSection>

        <SwmgSection
          id="method"
          title="How Dr. Goyal teaches"
          intro="The SWMG method treats a finished video as the start, not the goal. Every topic goes through the same four steps."
        >
          <ol className={styles.method}>
            {content.method.map((step, index) => (
              <li key={step.title} className={styles.methodStep}>
                <span className={styles.methodNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className={styles.methodTitle}>{step.title}</h3>
                <p className={styles.methodText}>{step.text}</p>
              </li>
            ))}
          </ol>
        </SwmgSection>

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