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
import styles from "./compare.classplus-vs-testkart.module.css";

const FAQs = [
  {
    question: "Is Testkart really free to use?",
    answer: "Yes, 100% free to sign up and create content. We only charge a small platform fee when you make a sale. Unlike Classplus, there's no annual subscription."
  },
  {
    question: "How is Testkart different from Classplus?",
    answer: "Classplus is a white-label app builder that charges ₹12K–₹50K/year. Testkart is a free marketplace where you publish to an existing student audience with AI-powered tools and advanced testing features."
  },
  {
    question: "Can I migrate my content from Classplus to Testkart?",
    answer: "Yes, you can recreate your tests and courses on Testkart. Our AI tools and bulk upload features make it fast. Your content, your ownership."
  },
  {
    question: "Does Testkart provide a branded app like Classplus?",
    answer: "Testkart is a marketplace platform, not a white-label app builder. The advantage is you get access to millions of students without spending on marketing or app development."
  },
  {
    question: "Which platform is better for selling mock tests?",
    answer: "Testkart was purpose-built for mock tests with 6 question types, AI generation, detailed analytics, live competitive tests, and leaderboards. Classplus offers basic testing as one of many features."
  },
  {
    question: "What about Classplus's no-refund policy?",
    answer: "With Testkart, there's nothing to refund — it's free to join. You only pay when you earn, eliminating all financial risk."
  }
];

const CompareClassplusPage: React.FC = () => {
  return (
    <>
      <SEOHead
        title="Classplus vs Testkart - Best Free Alternative (2025 Comparison)"
        description="Looking for an alternative to Classplus? See why Indian educators are switching to Testkart's 100% free platform with AI tools and a built-in student marketplace."
        url="https://testkart.in/compare/classplus-vs-testkart"
      />

      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "name": "Classplus vs Testkart - Best Free Alternative (2025 Comparison)",
                "description": "Compare Classplus and Testkart. Discover why Testkart is the smarter, free alternative for educators wanting to sell courses and mock tests online.",
                "url": "https://testkart.in/compare/classplus-vs-testkart"
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
                    "name": "Compare Classplus vs Testkart",
                    "item": "https://testkart.in/compare/classplus-vs-testkart"
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
              Testkart vs Classplus: The Smarter, Free Alternative for Indian Educators
            </h1>
            <p className={styles.heroSubtitle}>
              Stop paying ₹30,000+/year for a white-label app. Join Testkart with zero upfront costs, get access to a massive student audience, and use powerful AI tools to scale your teaching business.
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
              <strong>Classplus</strong> charges you ₹12,000–₹50,000/year upfront plus transaction fees, and you still have to find your own students. <br /><br />
              <strong>Testkart</strong> is 100% free to start. We provide the platform, the AI tools, and a built-in student marketplace. We only charge a small platform fee when you successfully make a sale. You have zero financial risk.
            </p>
          </div>
        </section>

        {/* 3. Detailed Comparison Table */}
        <section className={styles.contentSection}>
          <div className={styles.sectionHeader}>
            <h2>Feature-by-Feature Comparison</h2>
            <p>See exactly how Testkart stacks up against Classplus.</p>
          </div>
          
          <div className={styles.comparisonTableWrapper}>
            <table className={styles.comparisonTable}>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Classplus</th>
                  <th>Testkart</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Upfront Cost</strong></td>
                  <td>₹12,000–₹50,000/year + GST</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> <strong>₹0 (Free to start)</strong></span></td>
                </tr>
                <tr>
                  <td><strong>Transaction Fee</strong></td>
                  <td>2.64% on all payments</td>
                  <td>Small platform fee on sales only</td>
                </tr>
                <tr>
                  <td><strong>Built-in Student Audience</strong></td>
                  <td><span className={styles.iconText}><XCircle size={18} color="var(--error)" /> Bring your own students</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Access millions of students</span></td>
                </tr>
                <tr>
                  <td><strong>Branded Mobile App</strong></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> White-labeled app</span></td>
                  <td>Marketplace model (shared platform)</td>
                </tr>
                <tr>
                  <td><strong>AI Question Generation</strong></td>
                  <td><span className={styles.iconText}><XCircle size={18} color="var(--error)" /> Not available</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> AI-powered question & content creation</span></td>
                </tr>
                <tr>
                  <td><strong>Mock Test Question Types</strong></td>
                  <td>Basic MCQ only</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> 6 types: MCQ, Multi-correct, Numerical, Assertion-Reason, Comprehension, Match</span></td>
                </tr>
                <tr>
                  <td><strong>Live Competitive Tests</strong></td>
                  <td><span className={styles.iconText}><XCircle size={18} color="var(--error)" /> Not available</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Real-time live tests with prizes</span></td>
                </tr>
                <tr>
                  <td><strong>Digital Products (PDFs)</strong></td>
                  <td>Limited support</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Full PDF store with preview pages</span></td>
                </tr>
                <tr>
                  <td><strong>Video Courses</strong></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Supported</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Unlimited hosting, structured builder</span></td>
                </tr>
                <tr>
                  <td><strong>Course Bundles</strong></td>
                  <td>Limited</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Bundle courses, tests & products</span></td>
                </tr>
                <tr>
                  <td><strong>Promo Codes & Discounts</strong></td>
                  <td>Basic</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Full promo code system</span></td>
                </tr>
                <tr>
                  <td><strong>Student Analytics</strong></td>
                  <td>Basic reporting</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Per-question analytics, time tracking, leaderboards</span></td>
                </tr>
                <tr>
                  <td><strong>Content Ownership</strong></td>
                  <td><span className={styles.iconText}><XCircle size={18} color="var(--error)" /> No source code ownership, locked in</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> 100% content ownership</span></td>
                </tr>
                <tr>
                  <td><strong>Refund Policy</strong></td>
                  <td>Strict no-refund policy</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> No subscription = zero risk</span></td>
                </tr>
                <tr>
                  <td><strong>Payouts</strong></td>
                  <td>Varies</td>
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
              <h3>Zero Investment Risk</h3>
              <p>No ₹30K upfront fees. Start for free and pay a small platform fee only when you earn from student enrollments.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Users size={28} /></div>
              <h3>Built-in Marketplace</h3>
              <p>Don't struggle to find students. Access our existing, massive audience of learners actively searching for courses and mock tests.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Target size={28} /></div>
              <h3>AI-Powered Creation</h3>
              <p>Save hundreds of hours. Generate questions, options, and full course content instantly with our integrated AI tools.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><TrendingUp size={28} /></div>
              <h3>Advanced Mock Tests</h3>
              <p>Go beyond basic MCQs. Offer 6 advanced question types, host live tests with prizes, and provide detailed student analytics.</p>
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
            <li><Check size={24} /> Individual teachers wanting to sell mock tests or courses online</li>
            <li><Check size={24} /> Coaching institute teachers looking for additional passive income</li>
            <li><Check size={24} /> Educators who don't want to commit to ₹30K+ annual subscriptions</li>
            <li><Check size={24} /> Content creators in the highly competitive exam preparation space</li>
            <li><Check size={24} /> Teachers who want a ready audience instead of doing all the marketing on their own</li>
          </ul>
        </section>

        {/* 6. FAQ Section */}
        <section className={styles.faqSection}>
          <div className={styles.sectionHeader}>
            <h2>Frequently Asked Questions</h2>
            <p>Common questions about choosing Testkart over Classplus.</p>
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
            <h2>Ready to Try the Free Alternative to Classplus?</h2>
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

export default CompareClassplusPage;