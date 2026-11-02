import React from "react";
import { SEOHead } from "../components/SEOHead";
import { AppPhoneMockup } from "../components/AppPhoneMockup";
import { ArtBlob, Doodle } from "../components/AppLandingArt";
import { PlayStoreBadge } from "../components/PlayStoreBadge";
import { AppStoreBadgeSoon } from "../components/AppStoreBadgeSoon";
import { APP_FEATURES, CLOSING_SCREENS, HERO_SCREENS, PLAY_STORE_URL } from "../helpers/appLandingContent";
import styles from "./app.module.css";

/**
 * /app - the Testkart Android app's landing page. Reached by typing the URL
 * only: nothing in the site's navigation links here.
 */
const SectionBreak = () => (
  <div className={styles.sectionBreak} aria-hidden="true">
    <span className={styles.breakLine} />
    <Doodle kind="sparkle" className={styles.breakMark} />
    <span className={styles.breakLine} />
  </div>
);

export default function AppLandingPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "MobileApplication",
    name: "Testkart",
    operatingSystem: "Android",
    applicationCategory: "EducationalApplication",
    installUrl: PLAY_STORE_URL,
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  };

  return (
    <>
      <SEOHead
        title="Get the Testkart App"
        description="Take mock tests, watch courses, read study notes and join live competitions from the Testkart app for Android."
        url="https://testkart.in/app"
      />
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>

      <div className={styles.page}>
        <section className={`${styles.inner} ${styles.hero}`} aria-labelledby="app-hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              <Doodle kind="sparkle" className={styles.eyebrowMark} />
              Learn anywhere, anytime
            </p>
            <h1 id="app-hero-title" className={styles.heroTitle}>
              Your learning journey, now{" "}
              <span className={styles.marked}>
                in your pocket.
                <Doodle kind="swoosh" className={styles.markSwoosh} />
              </span>
            </h1>
            <p className={styles.heroLead}>
              Take mock tests, watch course lessons, read study notes and join live
              competitions straight from the Testkart app. Your whole exam
              preparation, a tap away on the phone already in your hand.
            </p>
            <div className={styles.downloadRow}>
              <PlayStoreBadge className={styles.badgeLarge} />
              <AppStoreBadgeSoon className={styles.badgeLarge} />
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
                <Doodle
                  kind={index % 2 === 0 ? "asterisk" : "sparkle"}
                  className={styles.featureMark}
                />
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
              </div>
            </section>
          );
        })}

        <SectionBreak />

        <section className={styles.closing} aria-labelledby="app-closing-title">
          <div className={`${styles.inner} ${styles.closingCopy}`}>
            <h2 id="app-closing-title" className={styles.closingTitle}>
              Make every moment count.{" "}
              <span className={styles.marked}>
                Get Testkart.
                <Doodle kind="swoosh" className={styles.markSwoosh} />
              </span>
            </h2>
            <p className={styles.closingText}>
              Bring your learning resources, practice tests and exam preparation
              tools together in one place.
            </p>
            <div className={`${styles.downloadRow} ${styles.downloadRowCentered}`}>
              <PlayStoreBadge className={styles.badgeLarge} />
              <AppStoreBadgeSoon className={styles.badgeLarge} />
            </div>
          </div>

          <div className={styles.stage}>
            <ArtBlob tone="lavender" shape={5} className={styles.stageBlobLeft} />
            <ArtBlob tone="mint" shape={3} className={styles.stageBlobRight} />
            <AppPhoneMockup screen={CLOSING_SCREENS.left} className={styles.stagePhoneLeft} />
            <AppPhoneMockup screen={CLOSING_SCREENS.right} className={styles.stagePhoneRight} />
            <AppPhoneMockup screen={CLOSING_SCREENS.center} className={styles.stagePhoneCenter} />
            <Doodle kind="sparkle" className={styles.stageSparkle} />
            <Doodle kind="burst" className={styles.stageBurst} />
          </div>
        </section>
      </div>
    </>
  );
}
