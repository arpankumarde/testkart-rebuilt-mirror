import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { MessageCircleQuestion } from "lucide-react";
import { SEOHead } from "../components/SEOHead";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/Accordion";
import { SellLandingHero } from "../components/SellLandingHero";
import { SellLandingTrust } from "../components/SellLandingTrust";
import { SellLandingProducts } from "../components/SellLandingProducts";
import { SellLandingBenefits } from "../components/SellLandingBenefits";
import { SellLandingSteps } from "../components/SellLandingSteps";
import { SellLandingEarnings } from "../components/SellLandingEarnings";
import { SellLandingShowcase } from "../components/SellLandingShowcase";
import { SellLandingTestimonials } from "../components/SellLandingTestimonials";
import { SellLandingFinalCta } from "../components/SellLandingFinalCta";
import { SellLandingHeading } from "../components/SellLandingHeading";
import { SellDemoButton, TEACHER_SIGNUP_PATH } from "../components/SellLandingCta";
import { WhatsAppBubble } from "../components/WhatsAppBubble";
import { DEFAULT_TEACHER_PLATFORM_FEE } from "../helpers/teacherPlatformFeeDefault";
import styles from "./sell.module.css";

const PAGE_TITLE =
  "Testkart - India's #1 Online Marketplace for Teachers | Sell Mock Tests & Courses";
const SELLER_SHARE = 100 - DEFAULT_TEACHER_PLATFORM_FEE;
const PAGE_DESCRIPTION = `Create and sell mock tests, courses, study notes and bundles on Testkart. Free to join, keep ${SELLER_SHARE}% of every sale on the Free plan, and withdraw your earnings to your bank.`;

/*
 * Answers follow the live product: review before publishing, the platform fee
 * from teacherPlatformFeeDefault, paid plan fees from subscription_plans
 * (19-11-2026), and the ₹100 / once-a-day withdrawal rules on teacher.earnings.
 */
const FAQS = [
  {
    q: "How can I start selling on Testkart?",
    a: "Create a free teacher account, set up your profile, and build your first product from the teacher dashboard. When it is ready, submit it for review. Our team checks it, and once it is approved it goes live in the Testkart store.",
  },
  {
    q: "What products can I sell?",
    a: "Mock tests and test series, live tests, video courses, study notes and PDFs such as previous-year papers, and bundles that combine your tests, courses and notes into one package.",
  },
  {
    q: "Is registration free?",
    a: `Yes. Signing up and publishing cost nothing. On the Free plan, Testkart keeps a ${DEFAULT_TEACHER_PLATFORM_FEE}% platform fee only when you make a sale, so you keep ${SELLER_SHARE}%. Optional paid plans lower the fee to 25%, 23% or 18%.`,
  },
  {
    q: "How do I receive payments?",
    a: "Students pay through Testkart's secure checkout, and your share of each sale is added to your earnings balance. A live test sale counts once the test ends. Add and verify your bank account, then withdraw any amount from ₹100, with one withdrawal request per day.",
  },
  {
    q: "Can I sell multiple types of products?",
    a: "Yes. Tests, courses, notes and bundles all live under one teacher account and one public profile, so students can find everything you offer in one place.",
  },
  {
    q: "How can I track my sales?",
    a: "Your dashboard shows your students, available balance and published products. The earnings page lists every transaction with its date and amount, and you can download it as a CSV file.",
  },
];

const SellPage: React.FC = () => {
  return (
    <>
      <SEOHead
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
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
                url: "https://testkart.in/sell",
                name: PAGE_TITLE,
                description: PAGE_DESCRIPTION,
              },
              {
                "@type": "Service",
                "@id": "https://testkart.in/sell#service",
                name: "Testkart Teacher Platform",
                provider: {
                  "@type": "Organization",
                  name: "Testkart",
                  url: "https://testkart.in",
                },
                description:
                  "Platform for teachers to create and sell mock tests, courses, study notes and bundles online.",
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "Home",
                    item: "https://testkart.in",
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Sell",
                    item: "https://testkart.in/sell",
                  },
                ],
              },
              {
                "@type": "FAQPage",
                mainEntity: FAQS.map(({ q, a }) => ({
                  "@type": "Question",
                  name: q,
                  acceptedAnswer: { "@type": "Answer", text: a },
                })),
              },
            ],
          })}
        </script>
      </Helmet>

      <div className={styles.page}>
        <SellLandingHero />
        <SellLandingTrust />
        <SellLandingProducts />
        <SellLandingBenefits />
        <SellLandingSteps />
        <SellLandingEarnings />
        <SellLandingShowcase />
        <SellLandingTestimonials />

        <section className={styles.faqSection} aria-labelledby="sell-faq-title">
          <div className={styles.faqLayout}>
            <div className={styles.faqIntro}>
              <SellLandingHeading
                id="sell-faq-title"
                align="start"
                eyebrow="FAQ"
                title="Questions Educators Ask Us."
                lead="Short answers on getting started, fees and payouts."
              />
              <div className={styles.helpCard}>
                <span className={styles.helpIcon} aria-hidden="true">
                  <MessageCircleQuestion size={20} />
                </span>
                <p className={styles.helpText}>
                  Still deciding? Walk through the dashboard with our team.
                </p>
                <SellDemoButton />
              </div>
            </div>

            <Accordion type="single" collapsible className={styles.faqList}>
              {FAQS.map(({ q, a }, index) => (
                <AccordionItem
                  key={q}
                  value={`faq-${index}`}
                  className={styles.faqItem}
                >
                  <AccordionTrigger className={styles.faqTrigger}>
                    {q}
                  </AccordionTrigger>
                  <AccordionContent className={styles.faqAnswer}>
                    {a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <SellLandingFinalCta />

        <div className={styles.mobileBar}>
          <span className={styles.mobileBarText}>
            <strong>Start selling</strong>
            <small>Free to join</small>
          </span>
          <Link to={TEACHER_SIGNUP_PATH} className={styles.mobileBarBtn}>
            Sign Up Free
          </Link>
        </div>
        <WhatsAppBubble />
      </div>
    </>
  );
};

export default SellPage;
