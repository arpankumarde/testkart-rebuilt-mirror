import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Zap, 
  Users, 
  Target, 
  Video,
  Check
} from "lucide-react";
import { SEOHead } from "../components/SEOHead";
import { Button } from "../components/Button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/Accordion";
import styles from "./compare.graphy-vs-testkart.module.css";

const FAQs = [
  {
    question: "Is Testkart really free?",
    answer: "Yes, 100% free to sign up and create content. We only charge a small platform fee when you make a sale. Unlike Graphy's ₹19,999 onboarding fee, there are no upfront costs to launch your courses or tests."
  },
  {
    question: "How is Testkart different from Graphy?",
    answer: "Graphy charges steep onboarding fees plus a 10% revenue share on Indian sales. You also have to find your own students. Testkart is a free marketplace where you publish to an existing student audience with powerful AI tools specifically built for educators."
  },
  {
    question: "Can I migrate from Graphy to Testkart?",
    answer: "Yes, you can easily recreate your tests and courses on Testkart. Our AI tools and bulk upload features make migration fast. Enjoy your content with zero ongoing subscription costs."
  },
  {
    question: "Does Testkart offer video hosting like Graphy?",
    answer: "Actually, it's better — Graphy doesn't host videos natively (you need a third-party like YouTube or Vimeo). Testkart provides unlimited built-in video hosting at no extra cost, making course creation seamless."
  },
  {
    question: "Which is better for competitive exam content?",
    answer: "Testkart was purpose-built for competitive exams with 6 advanced question types, AI-powered question generation, detailed analytics, live competitive tests with prizes, and leaderboards. Graphy offers basic assessment tools."
  },
  {
    question: "What about Graphy's marketing tools?",
    answer: "Graphy offers affiliate marketing and email tools for those who already have an audience. Testkart gives you built-in marketplace exposure to millions of students, which is far more valuable if you are looking to grow your reach."
  }
];

const CompareGraphyPage: React.FC = () => {
  return (
    <>
      <SEOHead
        title="Graphy vs Testkart - Best Free Alternative (2025 Comparison)"
        description="Stop paying Graphy's ₹19,999 onboarding fee. Discover Testkart, the free alternative with a built-in student marketplace, unlimited video hosting, and AI tools."
        url="https://testkart.in/compare/graphy-vs-testkart"
      />

      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "name": "Graphy vs Testkart - Best Free Alternative (2025 Comparison)",
                "description": "Compare Graphy and Testkart. Discover why Testkart is the smarter, free alternative for educators wanting to sell courses and mock tests online without onboarding fees.",
                "url": "https://testkart.in/compare/graphy-vs-testkart"
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
                    "name": "Compare Graphy vs Testkart",
                    "item": "https://testkart.in/compare/graphy-vs-testkart"
                  }
                ]
              },
              {
                "@type": "FAQPage",
                "mainEntity": FAQs.map(faq => ({
                  "@type": "Question",
                  "name": faq.question,
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": faq.answer
                  }
                }))
              }
            ]
          })}
        </script>
      </Helmet>

      <div className={styles.pageWrapper}>
        {/* 1. Hero Section */}
        <header className={styles.heroSection}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              Testkart vs Graphy: The Free Alternative for Indian Educators
            </h1>
            <p className={styles.heroSubtitle}>
              Stop paying ₹19,999 onboarding fee + 10% revenue share on every sale. Join Testkart free and access a built-in student marketplace with AI-powered tools.
            </p>
            <div className={styles.heroActions}>
              <Button asChild size="lg" variant="primary">
                <Link to="/teacher/signup">
                  Start for Free Today <ArrowRight size={18} />
                </Link>
              </Button>
            </div>
          </div>
        </header>

        {/* 2. TL;DR Quick Summary */}
        <section className={styles.contentSection}>
          <div className={styles.tldrBox}>
            <h3>TL;DR: The Bottom Line</h3>
            <p>
              <strong>Graphy</strong> (formerly Spayee) charges a ₹19,999 one-time onboarding fee PLUS 10% revenue share (+GST) on every transaction. International plans start at $49/month with 5-10% transaction fees on top. <br /><br />
              <strong>Testkart</strong> is 100% free to start with a built-in marketplace. We only charge a small platform fee on successful sales — absolutely no onboarding fees or hidden subscription traps.
            </p>
          </div>
        </section>

        {/* 3. Detailed Comparison Table */}
        <section className={styles.contentSection}>
          <div className={styles.sectionHeader}>
            <h2>Feature-by-Feature Comparison</h2>
            <p>See exactly how Testkart stacks up against Graphy.</p>
          </div>
          
          <div className={styles.comparisonTableWrapper}>
            <table className={styles.comparisonTable}>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Graphy</th>
                  <th>Testkart</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Upfront/Onboarding Cost</strong></td>
                  <td>₹19,999 one-time + ongoing fees</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success)" /> <strong>₹0 (Free to start)</strong></span></td>
                </tr>
                <tr>
                  <td><strong>Transaction/Revenue Share</strong></td>
                  <td>10% per sale (+GST) for Indian creators</td>
                  <td>Small platform fee on sales only</td>
                </tr>
                <tr>
                  <td><strong>International Plans</strong></td>
                  <td>$49–$249/month + 5-10% per sale</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success)" /> Free for all</span></td>
                </tr>
                <tr>
                  <td><strong>Built-in Student Audience</strong></td>
                  <td><span className={styles.iconText}><XCircle size={18} color="var(--error)" /> Bring your own students</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success)" /> Access millions of students</span></td>
                </tr>
                <tr>
                  <td><strong>Branded Mobile App</strong></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success)" /> iOS & Android apps</span></td>
                  <td>Marketplace model (shared platform)</td>
                </tr>
                <tr>
                  <td><strong>AI Question Generation</strong></td>
                  <td><span className={styles.iconText}><XCircle size={18} color="var(--error)" /> Not available</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success)" /> AI-powered question & content creation</span></td>
                </tr>
                <tr>
                  <td><strong>Mock Test Question Types</strong></td>
                  <td>Basic quiz/assessment</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success)" /> 6 types: MCQ, Multi-correct, Numerical, Assertion-Reason, Comprehension, Match</span></td>
                </tr>
                <tr>
                  <td><strong>Live Competitive Tests</strong></td>
                  <td><span className={styles.iconText}><XCircle size={18} color="var(--error)" /> Not available</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success)" /> Real-time live tests with prizes</span></td>
                </tr>
                <tr>
                  <td><strong>Digital Products (PDFs)</strong></td>
                  <td>Supported</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success)" /> Full PDF store with preview pages</span></td>
                </tr>
                <tr>
                  <td><strong>Video Hosting</strong></td>
                  <td><span className={styles.iconText}><XCircle size={18} color="var(--error)" /> No built-in hosting (use YouTube/Vimeo)</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success)" /> Unlimited built-in video hosting</span></td>
                </tr>
                <tr>
                  <td><strong>Video Courses</strong></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success)" /> Course builder with drip content</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success)" /> Structured builder, unlimited hosting</span></td>
                </tr>
                <tr>
                  <td><strong>Content Security</strong></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success)" /> DRM + dynamic watermarking</span></td>
                  <td>Standard security included</td>
                </tr>
                <tr>
                  <td><strong>Community Features</strong></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success)" /> Discussion forums</span></td>
                  <td>Student reviews & ratings</td>
                </tr>
                <tr>
                  <td><strong>Marketing Tools</strong></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success)" /> Affiliate marketing, email tools</span></td>
                  <td>Promo codes, built-in marketplace exposure</td>
                </tr>
                <tr>
                  <td><strong>Payouts</strong></td>
                  <td>Standard processing</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success)" /> Weekly bank transfers</span></td>
                </tr>
                <tr>
                  <td><strong>Student Sponsorship</strong></td>
                  <td><span className={styles.iconText}><XCircle size={18} color="var(--error)" /> Not available</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success)" /> Sponsor students feature</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Why Teachers Are Switching Section */}
        <section className={styles.contentSection}>
          <div className={styles.sectionHeader}>
            <h2>Why Teachers Are Switching to Testkart</h2>
            <p>Discover the advantages that make Testkart the preferred platform for modern educators.</p>
          </div>
          <div className={styles.grid4Col}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Zap size={28} /></div>
              <h3>No Onboarding Fee</h3>
              <p>Graphy charges ₹19,999 just to get started. Testkart is completely free from day one.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Video size={28} /></div>
              <h3>Built-in Video Hosting</h3>
              <p>Graphy doesn't host videos — you need YouTube or Vimeo. Testkart includes unlimited video hosting at no extra cost.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Users size={28} /></div>
              <h3>Built-in Marketplace</h3>
              <p>Graphy requires you to build your own audience. Testkart gives you access to millions of students searching for content.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Target size={28} /></div>
              <h3>Purpose-Built for Exams</h3>
              <p>6 question types, live competitive tests, leaderboards — features Graphy simply doesn't have.</p>
            </div>
          </div>
        </section>

        {/* 5. Who Should Choose Section */}
        <section className={styles.audienceSection}>
          <div className={styles.sectionHeader}>
            <h2>Who Should Choose Testkart?</h2>
            <p>Testkart is perfectly tailored for educators who want growth without the risk.</p>
          </div>
          <ul className={styles.audienceList}>
            <li><Check size={24} /> Teachers who don't want to pay a ₹19,999 onboarding fee</li>
            <li><Check size={24} /> Educators who want built-in video hosting without relying on external providers</li>
            <li><Check size={24} /> Mock test creators who need advanced question types and live competitive tools</li>
            <li><Check size={24} /> Content creators who want a ready marketplace of students instead of struggling to build an audience</li>
            <li><Check size={24} /> Tutors looking for an easy, risk-free way to monetize their knowledge and test papers</li>
          </ul>
        </section>

        {/* 6. FAQ Section */}
        <section className={styles.faqSection}>
          <div className={styles.sectionHeader}>
            <h2>Frequently Asked Questions</h2>
            <p>Common questions about choosing Testkart over Graphy.</p>
          </div>
          <Accordion type="single" collapsible className={styles.accordionRoot}>
            {FAQs.map((faq, index) => (
              <AccordionItem value={`faq-${index}`} key={index}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* 7. Final CTA Section */}
        <section className={styles.finalCtaSection}>
          <div className={styles.finalCtaContent}>
            <h2>Ready to Try the Free Alternative to Graphy?</h2>
            <Button asChild size="lg" className={styles.ctaButton}>
              <Link to="/teacher/signup">
                Sign Up for Free Today
              </Link>
            </Button>
            <div className={styles.finalCtaHighlights}>
              <span><Check size={18} /> Zero Upfront Cost</span>
              <span><Check size={18} /> AI-Powered Tools</span>
              <span><Check size={18} /> Built-in Audience</span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default CompareGraphyPage;