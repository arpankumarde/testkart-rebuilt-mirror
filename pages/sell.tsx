import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { SEOHead } from "../components/SEOHead";
import { Button } from "../components/Button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/Accordion";
import { SellPageHero } from "../components/SellPageHero";
import { SellPageProducts } from "../components/SellPageProducts";
import { SellPageStatsBar } from "../components/SellPageStatsBar";
import { TeacherAvatarsScroll } from "../components/TeacherAvatarsScroll";
import { SellPageProblem } from "../components/SellPageProblem";
import { SellPageSolution } from "../components/SellPageSolution";
import { SellPageComparison } from "../components/SellPageComparison";
import { SellPageSteps } from "../components/SellPageSteps";
import { SellPageCalculator } from "../components/SellPageCalculator";
import { SellPageTestimonials } from "../components/SellPageTestimonials";
import { SellPageTrust } from "../components/SellPageTrust";
import { SellPageFinalCTA } from "../components/SellPageFinalCTA";
import { WhatsAppBubble } from "../components/WhatsAppBubble";
import styles from "./sell.module.css";

const SellPage: React.FC = () => {
  return (
    <>
      <SEOHead
        title="Testkart - India's #1 Online Marketplace for Teachers | Sell Mock Tests & Courses"
        description="Join India's leading marketplace for teachers. Create & sell mock tests, courses, and digital products online with AI-powered tools. Zero investment, instant setup, weekly payouts."
        url="https://testkart.in/sell"
      />

      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "@id": "https://testkart.in/sell",
                "url": "https://testkart.in/sell",
                "name": "Testkart - India's #1 Online Marketplace for Teachers | Sell Mock Tests & Courses",
                "description": "Join India's leading marketplace for teachers. Create & sell mock tests, courses, and digital products online with AI-powered tools. Zero investment, instant setup, weekly payouts."
              },
              {
                "@type": "Service",
                "@id": "https://testkart.in/sell#service",
                "name": "Testkart Teacher Platform",
                "provider": {
                  "@type": "Organization",
                  "name": "Testkart",
                  "url": "https://testkart.in"
                },
                "description": "Platform for teachers to create & sell mock tests, courses, and digital products online."
              },
              {
                "@type": "BreadcrumbList",
                "itemListElement": [
                  {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Home",
                    "item": "https://testkart.in"
                  },
                  {
                    "@type": "ListItem",
                    "position": 2,
                    "name": "Sell",
                    "item": "https://testkart.in/sell"
                  }
                ]
              },
              {
                "@type": "FAQPage",
                "mainEntity": [
                  {
                    "@type": "Question",
                    "name": "Is it really free to join?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Yes! It is 100% free to sign up and create tests. We only charge a small platform fee when you make a sale. If you don't earn, we don't earn."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "How do I get paid?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "We process payouts weekly directly to your bank account. You can track all your earnings in real-time from your dashboard."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "Do I need technical skills?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Not at all. Our platform is designed to be as simple as using email. Plus, our AI tools handle the complex parts of test creation for you."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "Who owns the content?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "You maintain 100% ownership of your content. You can edit, remove, or update your tests at any time."
                    }
                  }
                ]
              }
            ]
          })}
        </script>
      </Helmet>

      <div className={styles.pageWrapper}>
        {/* 1. Hero Section */}
        <SellPageHero />

        {/* 1.2 Teacher Testimonials */}
        <SellPageTestimonials />

                {/* 1.5 Product Grid Section */}
        <SellPageProducts />

        {/* Teacher Avatars Scroll */}
        <TeacherAvatarsScroll />

        {/* 2. Social Proof Bar */}
        <SellPageStatsBar />

        {/* 3. Problem/Agitation Section */}
        <SellPageProblem />

        {/* 4. Solution Section */}
        <SellPageSolution />

        {/* 5. Comparison Table */}
        <SellPageComparison />

        {/* 6. How It Works */}
        <SellPageSteps />

        {/* 7. Earnings Calculator */}
        <SellPageCalculator />

        {/* 9. Trust & Security */}
        <SellPageTrust />

        {/* 10. FAQ Section */}
        <section className={styles.faqSection}>
          <div className={styles.sectionContainer}>
            <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
            <div className={styles.faqWrapper}>
              <Accordion type="single" collapsible>
                <AccordionItem value="item-1" className={styles.faqItem}>
                  <AccordionTrigger>
                    Is it really free to join?
                  </AccordionTrigger>
                  <AccordionContent>
                    Yes! It is 100% free to sign up and create tests. We only
                    charge a small platform fee when you make a sale. If you
                    don't earn, we don't earn.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2" className={styles.faqItem}>
                  <AccordionTrigger>How do I get paid?</AccordionTrigger>
                  <AccordionContent>
                    We process payouts weekly directly to your bank account. You
                    can track all your earnings in real-time from your
                    dashboard.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3" className={styles.faqItem}>
                  <AccordionTrigger>
                    Do I need technical skills?
                  </AccordionTrigger>
                  <AccordionContent>
                    Not at all. Our platform is designed to be as simple as
                    using email. Plus, our AI tools handle the complex parts of
                    test creation for you.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-4" className={styles.faqItem}>
                  <AccordionTrigger>Who owns the content?</AccordionTrigger>
                  <AccordionContent>
                    You maintain 100% ownership of your content. You can edit,
                    remove, or update your tests at any time.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </section>

        {/* 11. Final CTA Section */}
        <SellPageFinalCTA />

        {/* 12. Sticky Mobile CTA Bar */}
        <div className={styles.mobileStickyBar}>
          <div className={styles.mobileBarContent}>
            <div className={styles.mobileBarText}>
              <span>Start Earning</span>
              <small>Zero Investment</small>
            </div>
            <Button asChild size="md" className={styles.mobileBarBtn}>
              <Link to="/teacher/signup">Sign Up Free</Link>
            </Button>
          </div>
        </div>
        <WhatsAppBubble />
      </div>
    </>
  );
};

export default SellPage;