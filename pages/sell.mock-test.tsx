import React, { useRef, useEffect } from "react";
import { Helmet } from "react-helmet";
import { SEOHead } from "../components/SEOHead";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "../components/Button";
import { MockTestFeaturesSection } from "../components/MockTestFeaturesSection";
import { MockTestFAQSection } from "../components/MockTestFAQSection";
import { SellPageTestimonials } from "../components/SellPageTestimonials";
import { WhatsAppBubble } from "../components/WhatsAppBubble";
import { BookDemoButton } from "../components/BookDemoButton";
import styles from "./sell.mock-test.module.css";

const MockTestPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay with sound failed, fallback to muted autoplay
          video.muted = true;
          video.play().catch(console.error);
        });
      }
    }
  }, []);

  return (
    <>
      <SEOHead
        title="Create and Sell Mock Tests Online"
        description="Join Testkart to create and sell mock tests for UPSC, NEET, JEE, SSC, and Banking exams. Features AI question generation, advanced analytics, and zero investment."
        url="https://testkart.in/sell/mock-test"
        image="https://assets.floot.app/0a7f01ed-7b95-4c38-9275-16e713383937/54922abf-b666-4d9f-9732-aec0c03c9254.png"
      />
      <Helmet>
        {/* Structured Data (JSON-LD) */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "name": "Create and Sell Mock Tests Online | Testkart",
                "description": "Create and sell mock test series online with AI-powered question generation. Support for UPSC, NEET, JEE, SSC, Banking and 200+ exams.",
                "url": "https://testkart.in/sell/mock-test"
              },
              {
                "@type": "Service",
                "serviceType": "Online Test Creation Platform",
                "provider": {
                  "@type": "Organization",
                  "name": "Testkart",
                  "url": "https://testkart.in"
                },
                "description": "Platform for creating and selling mock test series online. Includes advanced testing interface, 6 question formats, and detailed student analytics.",
                "offers": {
                  "@type": "Offer",
                  "price": "0",
                  "priceCurrency": "INR",
                  "description": "Zero investment required to start creating and selling tests."
                }
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
                    "name": "Sell Mock Tests",
                    "item": "https://testkart.in/sell/mock-test"
                  }
                ]
              },
              {
                "@type": "FAQPage",
                "mainEntity": [
                  {
                    "@type": "Question",
                    "name": "How do I create a mock test on Testkart?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Creating a mock test is incredibly simple. Sign up for a free teacher account, go to your dashboard, and click 'Create Mock Test'. You can build tests manually, bulk upload them using our Excel template, or use our AI Question Generator."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "What question types are supported?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "We support Single Correct MCQ, Multiple Correct MCQ, Numerical Value, Assertion & Reason, Comprehension/Passage-based questions, and Match the Following."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "How does the AI question generator work?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Specify a topic, difficulty level, and exam type. The AI automatically generates relevant questions, correct options, distractors, and step-by-step explanations."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "How much does it cost to sell mock tests?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "It is completely free to create and publish mock tests. We operate on a revenue-share model, meaning we only make money when you make a sale."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "How and when do I get paid?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "You receive payouts every week directly to your verified bank account. We handle all payment gateway charges and invoicing."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "Can I offer detailed analytics to my students?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Yes! Students get access to score, section-wise performance, time spent per question, accuracy breakdown, and their rank/percentile."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "Can I bulk upload questions?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Yes, you can download our Excel template, paste your questions, options, and explanations, and bulk upload them in clicks."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "Can I bundle tests together?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Yes, you can group multiple mock tests into a 'Test Series' bundle and sell it at a discounted price."
                    }
                  }
                ]
              }
            ]
          })}
        </script>
      </Helmet>

      <div className={styles.pageWrapper}>
        {/* Hero Section */}
        <section className={styles.heroSection}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroHeadline}>Create and Sell Mock Tests for All Competitive Exams</h1>
            <p className={styles.heroSubtitle}>
              With Testkart, you can create and sell mock tests for a wide range of competitive examinations, including UPSC, NEET, JEE, SSC, Banking, and more. Transform your expertise into a thriving online academy.
            </p>
            <video
              ref={videoRef}
              className={styles.heroVideo}
              src="https://cdn.testkart.in/marketing-assets/testkart%20final%204.mp4"
              autoPlay
              playsInline
              controls
            />
            <div className={styles.heroCtas}>
              <Button asChild size="lg">
                <Link to="/teacher/signup">
                  Start Creating Free <ArrowRight size={20} />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#how-it-works">
                  See How It Works
                </a>
              </Button>
            </div>
            <div className={styles.heroTrust}>
              <span>Join 50,000+ educators</span>
              <span>&middot;</span>
              <span>Zero Investment</span>
              <span>&middot;</span>
              <span>AI-Powered</span>
            </div>
          </div>
        </section>

        {/* Teacher Testimonials */}
        <SellPageTestimonials />

        {/* Categories Section */}
        <section className={styles.categoriesSection}>
          <div className={styles.categoriesHeader}>
            <h2>Mock Tests for Every Major Competitive Exam</h2>
          </div>
          <div className={styles.pillsGrid}>
            <div className={styles.pill}>Government (UPSC, SSC, PSC)</div>
            <div className={styles.pill}>Engineering (JEE, GATE)</div>
            <div className={styles.pill}>Medical (NEET)</div>
            <div className={styles.pill}>Management (CAT, XAT)</div>
            <div className={styles.pill}>Banking (IBPS, SBI, RBI)</div>
            <div className={styles.pill}>Law (CLAT)</div>
            <div className={styles.pill}>Teaching (CTET)</div>
            <div className={styles.pill}>Finance (CA, CS)</div>
            <div className={styles.pill}>Defence (NDA, CDS)</div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className={styles.howItWorksSection} id="how-it-works">
          <div className={styles.sectionHeader}>
            <h2>Build your Mock Test in Simple Steps</h2>
            <p>Creating and launching mock tests or test series with Testkart is quick and simple.</p>
          </div>
          <div className={styles.stepsGrid}>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>1</div>
              <h3>Sign Up Free</h3>
              <p>Create your academy profile in under 2 minutes. No credit card required, zero platform fees.</p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>2</div>
              <h3>Create Tests</h3>
              <p>Use our AI question generator, upload via Excel, or add questions manually. Build your test structure seamlessly.</p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>3</div>
              <h3>Publish & Earn</h3>
              <p>Set your pricing, publish your test series, and reach millions of students. Get paid weekly for your sales.</p>
            </div>
          </div>
        </section>

        {/* Comprehensive Features Section */}
        <MockTestFeaturesSection />

        {/* Stats Section */}
        <section className={styles.statsSection}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h4>₹15 Cr+</h4>
              <p>Paid to Teachers</p>
            </div>
            <div className={styles.statCard}>
              <h4>50,000+</h4>
              <p>Active Educators</p>
            </div>
            <div className={styles.statCard}>
              <h4>5M+</h4>
              <p>Student Enrollments</p>
            </div>
            <div className={styles.statCard}>
              <h4>2L+</h4>
              <p>Test Series Created</p>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <MockTestFAQSection />

        {/* Final CTA Section */}
        <section className={styles.finalCtaSection}>
          <div className={styles.finalCtaContent}>
            <h2>Ready to Create and Sell Mock Tests?</h2>
            <div className={styles.finalCtaActions}>
              <BookDemoButton size="lg" variant="outline" />
              <Button asChild size="lg" variant="primary">
                <Link to="/teacher/signup">
                  Get Started Now — It's Free <ArrowRight size={20} />
                </Link>
              </Button>
            </div>
            <div className={styles.finalCtaBadges}>
              <span>Zero Upfront Cost &middot; AI-Powered Tools &middot; Weekly Payouts</span>
            </div>
          </div>
        </section>
        <WhatsAppBubble />
      </div>
    </>
  );
};

export default MockTestPage;