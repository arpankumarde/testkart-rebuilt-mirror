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
  TrendingUp,
  Check
} from "lucide-react";
import { SEOHead } from "../components/SEOHead";
import { Button } from "../components/Button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/Accordion";
import styles from "./compare.tagmango-vs-testkart.module.css";

const FAQs = [
  {
    question: "Is Testkart really free?",
    answer: "Yes, 100% free to sign up and create content. There are no tiered plans or hidden subscription fees. We only charge a small platform fee when you successfully make a sale."
  },
  {
    question: "How is Testkart different from TagMango?",
    answer: "TagMango is a generic creator platform with commission tiers (2.5%–10%) and subscription fees up to ₹3,60,000/year. Testkart is purpose-built for exam prep with advanced testing features, AI tools, and a built-in student marketplace, all for free."
  },
  {
    question: "Can I migrate my content from TagMango to Testkart?",
    answer: "Yes, you can easily migrate your courses and recreate your tests on Testkart. Our AI tools and bulk upload features make the process fast. Plus, you retain 100% ownership of your content."
  },
  {
    question: "Does TagMango offer better community features?",
    answer: "TagMango offers social feeds and groups tailored for general creators. Testkart focuses on what matters most for educators: advanced mock tests, structured video courses, per-question student analytics, and live competitive testing."
  },
  {
    question: "Which platform is better for selling mock tests?",
    answer: "Testkart is purpose-built for mock tests with 6 distinct question types, live tests with prizes, leaderboards, and detailed analytics. TagMango provides only basic quiz formats not suited for serious competitive exam preparation."
  },
  {
    question: "Why shouldn't I use TagMango's free plan?",
    answer: "TagMango's free plan takes a hefty 10% commission on every sale you make. Testkart's model is much more transparent with no tiered commission games—just a small, flat platform fee when you sell."
  }
];

const CompareTagMangoPage: React.FC = () => {
  return (
    <>
      <SEOHead
        title="TagMango vs Testkart - Best Free Alternative (2025 Comparison)"
        description="Looking for an alternative to TagMango? Discover why educators are switching to Testkart's 100% free platform with a built-in marketplace and AI tools."
        url="https://testkart.in/compare/tagmango-vs-testkart"
      />

      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "name": "TagMango vs Testkart - Best Free Alternative (2025 Comparison)",
                "description": "Compare TagMango and Testkart. Discover why Testkart is the smarter, free alternative for educators wanting to sell courses and mock tests online.",
                "url": "https://testkart.in/compare/tagmango-vs-testkart"
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
                    "name": "Compare TagMango vs Testkart",
                    "item": "https://testkart.in/compare/tagmango-vs-testkart"
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
              Testkart vs TagMango: The Free Alternative for Educators in India
            </h1>
            <p className={styles.heroSubtitle}>
              Stop paying up to ₹3,60,000/year and 10% commission. Join Testkart free and access a built-in student marketplace with AI-powered tools.
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
              <strong>TagMango</strong> charges ₹0–₹3,60,000/year subscription PLUS 2.5%–10% commission on every sale. Even their free plan takes 10% of your revenue. <br /><br />
              <strong>Testkart</strong> is 100% free to start with a built-in marketplace. Small platform fee only on sales — no tiered pricing games.
            </p>
          </div>
        </section>

        {/* 3. Detailed Comparison Table */}
        <section className={styles.contentSection}>
          <div className={styles.sectionHeader}>
            <h2>Feature-by-Feature Comparison</h2>
            <p>See exactly how Testkart stacks up against TagMango.</p>
          </div>
          
          <div className={styles.comparisonTableWrapper}>
            <table className={styles.comparisonTable}>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>TagMango</th>
                  <th>Testkart</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Upfront Cost</strong></td>
                  <td>₹0–₹3,60,000/year (tiered plans)</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> <strong>₹0 (Free to start)</strong></span></td>
                </tr>
                <tr>
                  <td><strong>Commission on Sales</strong></td>
                  <td>2.5%–10% depending on plan</td>
                  <td>Small platform fee on sales only</td>
                </tr>
                <tr>
                  <td><strong>Free Plan Commission</strong></td>
                  <td><span className={styles.iconText}><XCircle size={18} color="var(--error)" /> 10% of all revenue</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> No tiered commission traps</span></td>
                </tr>
                <tr>
                  <td><strong>Built-in Student Audience</strong></td>
                  <td><span className={styles.iconText}><XCircle size={18} color="var(--error)" /> Bring your own audience</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Access millions of students</span></td>
                </tr>
                <tr>
                  <td><strong>Community Features</strong></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Social feed, groups, badges</span></td>
                  <td>Student dashboard & reviews</td>
                </tr>
                <tr>
                  <td><strong>AI Question Generation</strong></td>
                  <td><span className={styles.iconText}><XCircle size={18} color="var(--error)" /> Not available</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> AI-powered question & content creation</span></td>
                </tr>
                <tr>
                  <td><strong>Mock Test Question Types</strong></td>
                  <td>Basic quiz format</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> 6 types: MCQ, Multi-correct, Numerical, Assertion-Reason, Comprehension, Match</span></td>
                </tr>
                <tr>
                  <td><strong>Live Competitive Tests</strong></td>
                  <td>Basic webinars</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Real-time live tests with prizes & leaderboards</span></td>
                </tr>
                <tr>
                  <td><strong>Digital Products (PDFs)</strong></td>
                  <td>Supported</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Full PDF store with preview pages</span></td>
                </tr>
                <tr>
                  <td><strong>Video Courses</strong></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> DRM-protected courses</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Unlimited hosting, structured builder</span></td>
                </tr>
                <tr>
                  <td><strong>1:1 Consultations</strong></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Built-in</span></td>
                  <td>Not available</td>
                </tr>
                <tr>
                  <td><strong>Promo Codes & Discounts</strong></td>
                  <td>Available</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Full promo code system</span></td>
                </tr>
                <tr>
                  <td><strong>Student Analytics</strong></td>
                  <td>Basic analytics</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Per-question analytics, time tracking, leaderboards</span></td>
                </tr>
                <tr>
                  <td><strong>Payment Options</strong></td>
                  <td>UPI, NetBanking</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> PayU gateway (UPI, Cards, NetBanking)</span></td>
                </tr>
                <tr>
                  <td><strong>Payouts</strong></td>
                  <td>Varies by plan</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Weekly bank transfers</span></td>
                </tr>
                <tr>
                  <td><strong>Student Sponsorship</strong></td>
                  <td><span className={styles.iconText}><XCircle size={18} color="var(--error)" /> Not available</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Sponsor students feature</span></td>
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
              <h3>No Commission Traps</h3>
              <p>TagMango's free plan takes 10% of your revenue. Testkart has no tiered commission games—just a small platform fee when you successfully sell.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Users size={28} /></div>
              <h3>Built-in Marketplace</h3>
              <p>TagMango requires you to bring your own audience. Testkart gives you access to millions of students actively looking to learn and practice.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Target size={28} /></div>
              <h3>Purpose-Built for Exams</h3>
              <p>Testkart is built for competitive exam prep with 6 question types, live tests, and leaderboards. TagMango is a generic creator platform.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><TrendingUp size={28} /></div>
              <h3>AI-Powered Tools</h3>
              <p>Generate questions, options, and detailed explanations with AI—saving you hundreds of hours. This is completely unavailable on TagMango.</p>
            </div>
          </div>
        </section>

        {/* 5. Who Should Choose Section */}
        <section className={styles.audienceSection}>
          <div className={styles.sectionHeader}>
            <h2>Who Should Choose Testkart?</h2>
            <p>Testkart is perfectly tailored for educators who want growth without high commissions.</p>
          </div>
          <ul className={styles.audienceList}>
            <li><Check size={24} /> Teachers tired of losing 10% of their revenue to generic free plans</li>
            <li><Check size={24} /> Educators focused on serious exam prep rather than just generic creator content</li>
            <li><Check size={24} /> Individual tutors wanting a built-in audience to scale their student base</li>
            <li><Check size={24} /> Content creators who want to leverage AI to drastically reduce test creation time</li>
            <li><Check size={24} /> Instructors seeking a transparent, entirely free platform to sell courses and mock tests</li>
          </ul>
        </section>

        {/* 6. FAQ Section */}
        <section className={styles.faqSection}>
          <div className={styles.sectionHeader}>
            <h2>Frequently Asked Questions</h2>
            <p>Common questions about choosing Testkart over TagMango.</p>
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
            <h2>Ready to Try the Free Alternative to TagMango?</h2>
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

export default CompareTagMangoPage;