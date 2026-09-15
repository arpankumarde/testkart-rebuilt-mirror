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
import styles from "./compare.learnyst-vs-testkart.module.css";

const FAQs = [
  {
    question: "Is Testkart really free?",
    answer: "Yes, 100% free to sign up and create content. Unlike Learnyst's per-student model, we only charge a small platform fee when you make a sale. There are no monthly subscriptions."
  },
  {
    question: "How is Testkart different from Learnyst?",
    answer: "Learnyst is a white-label platform charging per-student monthly fees starting at ₹49/user, plus hidden costs for bandwidth. Testkart is a free marketplace where you publish to an existing student audience with AI tools and zero hidden costs."
  },
  {
    question: "Can I migrate from Learnyst to Testkart?",
    answer: "Yes, you can easily recreate your tests and courses on Testkart. Our AI tools and bulk upload features make it incredibly fast to transition your content."
  },
  {
    question: "Does Testkart provide branded apps like Learnyst?",
    answer: "Testkart uses a marketplace model instead of a white-label app builder. The massive advantage is you get access to millions of students without spending on marketing or app development."
  },
  {
    question: "Which is better for mock tests?",
    answer: "Testkart is purpose-built for mock tests. We offer 6 advanced question types (including numerical and assertion-reason), AI generation, detailed analytics, live competitive tests, and leaderboards."
  },
  {
    question: "What about Learnyst's hidden costs?",
    answer: "With Testkart, what you see is what you get. We don't charge any extra fees for bandwidth, watermarking, or OTP verifications like Learnyst does."
  }
];

const CompareLearnystPage: React.FC = () => {
  return (
    <>
      <SEOHead
        title="Learnyst vs Testkart - Best Free Alternative (2025 Comparison)"
        description="Looking for an alternative to Learnyst? See why Indian educators are switching to Testkart's 100% free platform with AI tools and a built-in student marketplace."
        url="https://testkart.in/compare/learnyst-vs-testkart"
      />

      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "name": "Learnyst vs Testkart - Best Free Alternative (2025 Comparison)",
                "description": "Compare Learnyst and Testkart. Discover why Testkart is the smarter, free alternative for educators wanting to sell courses and mock tests online.",
                "url": "https://testkart.in/compare/learnyst-vs-testkart"
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
                    "name": "Compare Learnyst vs Testkart",
                    "item": "https://testkart.in/compare/learnyst-vs-testkart"
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
              Testkart vs Learnyst: The Free Alternative for Educators in India
            </h1>
            <p className={styles.heroSubtitle}>
              Stop paying ₹49/student/month subscriptions + hidden bandwidth charges. Join Testkart free and access a built-in student marketplace.
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
              <strong>Learnyst</strong> charges per-student monthly fees (starting ₹49/user/month) plus hidden costs for bandwidth and watermarking. Teachers must bring their own students and handle all marketing. <br /><br />
              <strong>Testkart</strong> is 100% free to start with a built-in marketplace of millions of students. Small platform fee only on sales. You have zero financial risk and your costs don't grow when your student base does.
            </p>
          </div>
        </section>

        {/* 3. Detailed Comparison Table */}
        <section className={styles.contentSection}>
          <div className={styles.sectionHeader}>
            <h2>Feature-by-Feature Comparison</h2>
            <p>See exactly how Testkart stacks up against Learnyst.</p>
          </div>
          
          <div className={styles.comparisonTableWrapper}>
            <table className={styles.comparisonTable}>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Learnyst</th>
                  <th>Testkart</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Upfront Cost</strong></td>
                  <td>₹49/user/month (scales with students)</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> <strong>₹0 (Free to start)</strong></span></td>
                </tr>
                <tr>
                  <td><strong>Commission on Sales</strong></td>
                  <td>No commission (but per-student fees add up)</td>
                  <td>Small platform fee on sales only</td>
                </tr>
                <tr>
                  <td><strong>Built-in Student Audience</strong></td>
                  <td><span className={styles.iconText}><XCircle size={18} color="var(--error)" /> Bring your own students</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Access millions of students</span></td>
                </tr>
                <tr>
                  <td><strong>Branded Mobile App</strong></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> iOS & Android apps</span></td>
                  <td>Marketplace model (shared platform)</td>
                </tr>
                <tr>
                  <td><strong>AI Question Generation</strong></td>
                  <td><span className={styles.iconText}><XCircle size={18} color="var(--error)" /> Not available</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> AI-powered question & content creation</span></td>
                </tr>
                <tr>
                  <td><strong>Mock Test Question Types</strong></td>
                  <td>Basic MCQ format</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> 6 types: MCQ, Multi-correct, Numerical, Assertion-Reason, Comprehension, Match</span></td>
                </tr>
                <tr>
                  <td><strong>Live Competitive Tests</strong></td>
                  <td>Limited live test features</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Real-time live tests with prizes</span></td>
                </tr>
                <tr>
                  <td><strong>Digital Products (PDFs)</strong></td>
                  <td>Limited</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Full PDF store with preview pages</span></td>
                </tr>
                <tr>
                  <td><strong>Video Courses</strong></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Supported (extra bandwidth costs)</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Unlimited hosting, no extra charges</span></td>
                </tr>
                <tr>
                  <td><strong>Course Bundles</strong></td>
                  <td>Available</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Bundle courses, tests & products</span></td>
                </tr>
                <tr>
                  <td><strong>Content Security</strong></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> DRM protection (extra cost)</span></td>
                  <td>Standard security included</td>
                </tr>
                <tr>
                  <td><strong>Student Analytics</strong></td>
                  <td>Basic reporting</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Per-question analytics, time tracking, leaderboards</span></td>
                </tr>
                <tr>
                  <td><strong>Hidden Costs</strong></td>
                  <td>Bandwidth, OTP, watermarking charged extra</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> No hidden fees</span></td>
                </tr>
                <tr>
                  <td><strong>Customer Support</strong></td>
                  <td>Mixed reviews, ticket-focused</td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Responsive support</span></td>
                </tr>
                <tr>
                  <td><strong>Scalability Cost</strong></td>
                  <td><span className={styles.iconText}><XCircle size={18} color="var(--error)" /> Cost grows per student</span></td>
                  <td><span className={styles.iconText}><CheckCircle2 size={18} color="var(--success-text)" /> Cost stays flat regardless of students</span></td>
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
              <div className={styles.featureIcon}><TrendingUp size={28} /></div>
              <h3>No Per-Student Fees</h3>
              <p>Unlike Learnyst's ₹49/student model, Testkart doesn't charge per student. Your costs don't grow with your audience.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Users size={28} /></div>
              <h3>Built-in Marketplace</h3>
              <p>Don't struggle to find students. Access millions of active learners already on Testkart looking for quality content.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><Target size={28} /></div>
              <h3>AI-Powered Creation</h3>
              <p>Generate questions and content instantly with AI tools — something Learnyst doesn't offer. Build entire courses in minutes.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}><CheckCircle2 size={28} /></div>
              <h3>No Hidden Charges</h3>
              <p>No extra fees for bandwidth, watermarking, or OTP verification. Our transparent pricing ensures you keep what you earn.</p>
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
            <li><Check size={24} /> Individual teachers tired of paying per-student monthly fees</li>
            <li><Check size={24} /> Coaching institute teachers looking for additional passive income without upfront risk</li>
            <li><Check size={24} /> Educators who don't want to be penalized for growing their student base</li>
            <li><Check size={24} /> Content creators in the highly competitive exam preparation space wanting AI tools</li>
            <li><Check size={24} /> Teachers who want a ready audience instead of doing all the marketing on their own</li>
          </ul>
        </section>

        {/* 6. FAQ Section */}
        <section className={styles.faqSection}>
          <div className={styles.sectionHeader}>
            <h2>Frequently Asked Questions</h2>
            <p>Common questions about choosing Testkart over Learnyst.</p>
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
            <h2>Ready to Try the Free Alternative to Learnyst?</h2>
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

export default CompareLearnystPage;