import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import { SEOHead } from "../components/SEOHead";
import { AppPhoneMockup } from "../components/AppPhoneMockup";
import { ArtBlob, Doodle } from "../components/AppLandingArt";
import { PlayStoreBadge } from "../components/PlayStoreBadge";
import { playfulButtonClass } from "../components/PlayfulButton";
import {
  ALL_SCREENS,
  APP_FAQS,
  APP_FEATURES,
  APP_STEPS,
  APP_STORE_NAME,
  HERO_SCREENS,
  PLAY_STORE_URL,
  type AppFaq,
} from "../helpers/appLandingContent";
import { TOP_EXAMS } from "../helpers/homepageTopExams";
import styles from "./app.module.css";

const SITE = "https://testkart.in";
const PAGE_URL = `${SITE}/app`;
const PAGE_TITLE = "Testkart App: Mock Tests, Courses & Study Notes | Download";
const PAGE_DESCRIPTION =
  "Download the Testkart app for Android. Practice mock tests, learn from expert-led courses, read study notes and join live competitions. Get it on Google Play.";

/**
 * /app - the Testkart Android app's landing page. Linked from the header's
 * More menu, the footer, the homepage and exam hub pages.
 */
const SectionBreak = () => (
  <div className={styles.sectionBreak} aria-hidden="true">
    <span className={styles.breakLine} />
    <Doodle kind="sparkle" className={styles.breakMark} />
    <span className={styles.breakLine} />
  </div>
);

const FaqAnswer = ({ faq }: { faq: AppFaq }) => {
  if (!faq.link) return <>{faq.answer}</>;
  const at = faq.answer.indexOf(faq.link.text);
  if (at < 0) return <>{faq.answer}</>;
  return (
    <>
      {faq.answer.slice(0, at)}
      <Link to={faq.link.href} className={styles.inlineLink}>
        {faq.link.text}
      </Link>
      {faq.answer.slice(at + faq.link.text.length)}
    </>
  );
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${PAGE_URL}#webpage`,
      url: PAGE_URL,
      name: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      isPartOf: { "@id": `${SITE}/#website` },
      about: { "@id": `${PAGE_URL}#app` },
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE },
          { "@type": "ListItem", position: 2, name: "Testkart App", item: PAGE_URL },
        ],
      },
    },
    {
      "@type": "MobileApplication",
      "@id": `${PAGE_URL}#app`,
      name: APP_STORE_NAME,
      alternateName: "Testkart App",
      description:
        "The Testkart app is an exam preparation app for Android. Take mock tests, watch courses from expert educators, read study notes and PDFs, and join live competitions, all in one place.",
      operatingSystem: "Android",
      applicationCategory: "EducationalApplication",
      url: PAGE_URL,
      installUrl: PLAY_STORE_URL,
      downloadUrl: PLAY_STORE_URL,
      screenshot: ALL_SCREENS.map((screen) => `${SITE}${screen.src}`),
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      publisher: {
        "@type": "Organization",
        name: "Digikind Education Private Limited",
        url: SITE,
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${PAGE_URL}#faq`,
      mainEntity: APP_FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
  ],
};

export default function AppLandingPage() {
  return (
    <>
      <SEOHead title={PAGE_TITLE} appendSiteName={false} description={PAGE_DESCRIPTION} url={PAGE_URL} />
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>

      <div className={styles.page}>
        <section className={`${styles.inner} ${styles.hero}`} aria-labelledby="app-hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              <Doodle kind="sparkle" className={styles.eyebrowMark} />
              Exam preparation app for Android
            </p>
            <h1 id="app-hero-title" className={styles.heroTitle}>
              Testkart App: Mock Tests, Courses &amp; Study Notes{" "}
              <span className={styles.marked}>
                on Your Phone
                <Doodle kind="swoosh" className={styles.markSwoosh} />
              </span>
            </h1>
            <p className={styles.tagline}>Your learning journey, now in your pocket.</p>
            <p className={styles.heroLead}>
              The Testkart app is an exam preparation app for Android. Take mock tests, watch courses
              from expert educators, read study notes and PDFs, and join live competitions, all in one
              place.
            </p>
            <div className={styles.downloadRow}>
              <PlayStoreBadge className={styles.badgeLarge} />
            </div>
          </div>

          <div className={styles.heroArt}>
            <ArtBlob tone="peach" shape={0} className={styles.heroBlob} />
            <AppPhoneMockup screen={HERO_SCREENS.back} priority className={styles.heroPhoneBack} />
            <AppPhoneMockup screen={HERO_SCREENS.front} priority className={styles.heroPhoneFront} />
            <Doodle kind="burst" className={styles.heroBurst} />
            <Doodle kind="star" className={styles.heroStar} />
            <Doodle kind="squiggle" className={styles.heroSquiggle} />
          </div>
        </section>

        <SectionBreak />

        {APP_FEATURES.map((feature, index) => {
          const artFirst = index % 2 === 0;
          return (
            <section
              key={feature.id}
              className={`${styles.inner} ${styles.feature}`}
              data-art-first={artFirst ? "true" : "false"}
              data-tone={feature.tone}
              aria-labelledby={`app-feature-${feature.id}`}
            >
              <div className={styles.featureArt}>
                <ArtBlob tone={feature.tone} shape={feature.shape} className={styles.featureBlob} />
                <AppPhoneMockup screen={feature.screen} className={styles.featurePhone} />
                <Doodle kind={index % 2 === 0 ? "asterisk" : "sparkle"} className={styles.featureMark} />
              </div>

              <div className={styles.featureCopy}>
                <p className={styles.scribble}>{feature.label}</p>
                <h2 id={`app-feature-${feature.id}`} className={styles.featureTitle}>
                  {feature.title}
                </h2>
                <p className={styles.featureText}>{feature.description}</p>
                <p className={styles.annotation}>
                  <Doodle kind="arrow" className={styles.annotationArrow} />
                  <span>{feature.note}</span>
                </p>
                <Link to={feature.href} className={playfulButtonClass("primary", "md", styles.featureLink)}>
                  {feature.cta}
                  <ArrowRight size={18} strokeWidth={2.25} aria-hidden="true" />
                </Link>
              </div>
            </section>
          );
        })}

        <SectionBreak />

        <section className={`${styles.inner} ${styles.block}`} aria-labelledby="app-exams-title">
          <div className={styles.blockHead}>
            <p className={styles.scribble} data-tone="powder">
              your exam
            </p>
            <h2 id="app-exams-title" className={styles.blockTitle}>
              Exams You Can Prepare For
            </h2>
            <p className={styles.blockLead}>
              Testkart covers over 1,700 exams, from SSC, banking, railway and teaching recruitment to
              defence, state PSC, engineering and medical entrance. Each exam has its own page with mock
              tests, courses and study notes from educators.
            </p>
          </div>
          <ul className={styles.examGrid} aria-label="Popular exams on Testkart">
            {TOP_EXAMS.map((exam) => (
              <li key={exam.slug}>
                <Link
                  to={`/exams/${exam.slug}`}
                  className={styles.examChip}
                  style={{ "--exam-accent": exam.accentColor } as React.CSSProperties}
                >
                  <span className={styles.examDot} aria-hidden="true" />
                  {exam.name}
                </Link>
              </li>
            ))}
            <li className={styles.examAllItem}>
              <Link to="/exams" className={`${styles.examChip} ${styles.examChipAll}`}>
                Browse all exams
                <ArrowRight size={16} strokeWidth={2.25} aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </section>

        <section className={`${styles.inner} ${styles.block}`} aria-labelledby="app-steps-title">
          <div className={styles.blockHead}>
            <p className={styles.scribble} data-tone="mint">
              3 quick steps
            </p>
            <h2 id="app-steps-title" className={styles.blockTitle}>
              How to Get Started
            </h2>
          </div>
          <ol className={styles.steps}>
            {APP_STEPS.map((step, index) => (
              <li key={step.title} className={styles.step} data-tone={step.tone}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className={styles.stepTitle}>
                  <span className={styles.srOnly}>Step {index + 1}: </span>
                  {step.title}
                </h3>
                <p className={styles.stepText}>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={`${styles.inner} ${styles.block}`} aria-labelledby="app-faq-title">
          <div className={styles.blockHead}>
            <p className={styles.scribble} data-tone="lavender">
              good questions
            </p>
            <h2 id="app-faq-title" className={styles.blockTitle}>
              Frequently Asked Questions
            </h2>
          </div>
          <div className={styles.faqList}>
            {APP_FAQS.map((faq) => (
              <details key={faq.question} className={styles.faqItem}>
                <summary className={styles.faqQuestion}>
                  <h3 className={styles.faqQuestionText}>{faq.question}</h3>
                  <ChevronDown size={20} strokeWidth={2.25} className={styles.faqChevron} aria-hidden="true" />
                </summary>
                <p className={styles.faqAnswer}>
                  <FaqAnswer faq={faq} />
                </p>
              </details>
            ))}
          </div>
        </section>

        <SectionBreak />

        <section className={`${styles.inner} ${styles.closing}`} aria-labelledby="app-closing-title">
          <h2 id="app-closing-title" className={styles.closingTitle}>
            Make every moment count.{" "}
            <span className={styles.marked}>
              Get Testkart.
              <Doodle kind="swoosh" className={styles.markSwoosh} />
            </span>
          </h2>
          <p className={styles.closingText}>
            Download the Testkart app on Google Play and keep your mock tests, courses, study notes and
            live competitions together on your phone.
          </p>
          <PlayStoreBadge className={styles.badgeLarge} />
        </section>
      </div>
    </>
  );
}
