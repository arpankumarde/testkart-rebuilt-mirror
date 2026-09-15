import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  PlayCircle,
  BookOpen,
  PenTool,
  Bot,
  Image as ImageIcon,
  FileEdit,
  MonitorPlay,
  Activity,
  CheckCircle2,
  Navigation,
  FastForward,
  Award,
  DollarSign,
  Package,
  Tag,
  HeartHandshake,
  LineChart,
  CreditCard,
  TrendingUp,
  Users
} from "lucide-react";

import { SEOHead } from '../components/SEOHead';
import { Button } from '../components/Button';
import { WhatsAppBubble } from '../components/WhatsAppBubble';
import { BookDemoButton } from '../components/BookDemoButton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/Tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '../components/Accordion';
import { SellPageTestimonials } from "../components/SellPageTestimonials";
import styles from "./sell.courses.module.css";

const SellCoursesFAQ: React.FC = () => {
  const faqs = [
    {
      question: "How much can I earn by selling courses on Testkart?",
      answer:
        "Your earning potential is unlimited. Top educators on Testkart earn over ₹10 lakh annually. You set your own course prices and keep up to 85% of every sale. We provide the tools and the audience; you bring the expertise."
    },
    {
      question: "Does Testkart host my video content?",
      answer:
        "Yes! We provide unlimited, secure video hosting for all your course content powered by Cloudflare R2. You can upload your videos directly to our platform, and we handle the storage, encoding, and delivery to students on any device, ensuring a smooth playback experience."
    },
    {
      question: "How do students access the courses they purchase?",
      answer:
        "Students can access their purchased courses anytime, anywhere through their Testkart student dashboard. Our mobile-friendly course player is designed for a seamless learning experience on desktops, tablets, and smartphones, with features like progress tracking and section navigation."
    },
    {
      question: "Can I update my course after it has been published?",
      answer:
        "Absolutely. You have full control over your content. You can add new lessons, update existing videos, or modify course materials at any time. Our Draft/Publish workflow makes it easy to stage changes before making them live to students."
    },
    {
      question: "How and when do I get paid?",
      answer:
        "We process payouts every week directly to your registered bank account. Your teacher dashboard provides a transparent, real-time view of your sales, revenue, and upcoming payouts so you're always in the loop."
    },
    {
      question: "Can I offer discounts or promo codes on my courses?",
      answer:
        "Yes, you have full flexibility over your pricing strategy. You can create custom promo codes and discounts to run marketing campaigns, offer special deals to loyal students, or bundle courses together for a higher overall value."
    }
  ];

  return (
    <section className={styles.faqSection}>
      <div className={styles.sectionHeader}>
        <h2>Frequently Asked Questions</h2>
        <p>
          Everything you need to know about creating and selling courses with
          Testkart.
        </p>
      </div>
      <Accordion type="single" collapsible className={styles.accordionRoot}>
        {faqs.map((faq, index) => (
          <AccordionItem value={`item-${index}`} key={index}>
            <AccordionTrigger>
              <div className={styles.faqTriggerContent}>
                <span>{faq.question}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
};

const SellOnlineCoursesPage: React.FC = () => {
  return (
    <>
      <SEOHead
        title="Create and Sell Online Video Courses | Testkart"
        description="Join India's leading marketplace to create and sell online video courses. Get unlimited hosting, AI tools, and reach millions of students. Zero investment required."
        url="https://testkart.in/sell/courses"
        image="https://assets.floot.app/0a7f01ed-7b95-4c38-9275-16e713383937/54922abf-b666-4d9f-9732-aec0c03c9254.png"
      />

      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "name": "Create and Sell Online Video Courses | Testkart",
                "description": "Create and sell online video courses with Testkart's all-in-one platform. Reach millions of students, use AI-powered tools, and build a sustainable teaching business with zero upfront investment.",
                "url": "https://testkart.in/sell/courses"
              },
              {
                "@type": "Service",
                "serviceType": "Online Course Creation Platform",
                "provider": {
                  "@type": "Organization",
                  "name": "Testkart"
                },
                "description": "An all-in-one platform for educators to create, market, and sell online courses. Features include unlimited video hosting, AI content assistance, integrated payment gateways, and access to a large student community.",
                "offers": {
                  "@type": "Offer",
                  "price": "0",
                  "priceCurrency": "INR",
                  "description": "Start for free with zero platform fees. We only make money when you do."
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
                    "name": "For Teachers",
                    "item": "https://testkart.in/teachers"
                  },
                  {
                    "@type": "ListItem",
                    "position": 3,
                    "name": "Sell Online Courses",
                    "item": "https://testkart.in/sell/courses"
                  }
                ]
              },
              {
                "@type": "FAQPage",
                "mainEntity": [
                  {
                    "@type": "Question",
                    "name": "How much can I earn by selling courses on Testkart?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Your earning potential is unlimited. Top educators on Testkart earn over ₹10 lakh annually. You set your own course prices and keep up to 85% of every sale."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "Does Testkart host my video content?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Yes! We provide unlimited, secure video hosting for all your course content. You can upload your videos directly to our platform, and we handle the storage, encoding, and delivery."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "How do I get paid?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "We process payouts every week directly to your registered bank account. Your teacher dashboard provides a transparent, real-time view of your sales and revenue."
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
        <header className={styles.heroSection}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              Create and Sell Online Video Courses
            </h1>
            <p className={styles.heroSubtitle}>
              Share your expertise, build a thriving education business, and
              earn a recurring income with Testkart's all-in-one platform tailored for educators.
            </p>
            <div className={styles.heroActions}>
              <Button asChild size="lg" variant="primary">
                <Link to="/teacher/signup">
                  Start Creating Free <ArrowRight size={18} />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#how-it-works">See How It Works</a>
              </Button>
            </div>
            <div className={styles.heroBadges}>
              <span>Join 50,000+ educators</span>
              <span>&middot;</span>
              <span>Zero Investment</span>
              <span>&middot;</span>
              <span>Unlimited Hosting</span>
            </div>
          </div>
        </header>

        {/* 1.5 Teacher Testimonials */}
        <SellPageTestimonials />

        {/* 2. Features (Tabbed Interface) */}
        <section className={styles.contentSection}>
          <div className={styles.sectionHeader}>
            <h2>Everything You Need to Succeed</h2>
            <p>
              Powerful, intuitive tools designed specifically for educators to bring their curriculum online without technical hurdles.
            </p>
          </div>

          <Tabs defaultValue="builder" className={styles.tabsRoot}>
            <div className={styles.tabsListWrapper}>
              <TabsList>
                <TabsTrigger value="builder">Course Builder</TabsTrigger>
                <TabsTrigger value="student">Student Experience</TabsTrigger>
                <TabsTrigger value="monetization">Monetization</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="builder">
              <div className={styles.grid3Col}>
                <div className={styles.featureCard}>
                  <div className={styles.iconWrapper}><PlayCircle /></div>
                  <h3>Video Upload & Hosting</h3>
                  <p>
                    Unlimited, secure video hosting powered by Cloudflare. Upload your lessons and let us handle encoding and smooth delivery to any device.
                  </p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.iconWrapper}><BookOpen /></div>
                  <h3>Structured Curriculum Builder</h3>
                  <p>
                    Organize your knowledge easily. Create sections, add lessons, and rearrange your curriculum with a simple drag-and-drop interface.
                  </p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.iconWrapper}><PenTool /></div>
                  <h3>Rich Text & Math Editor</h3>
                  <p>
                    Format your text lessons beautifully. Full LaTeX and math equation support ensures your STEM content is perfectly readable.
                  </p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.iconWrapper}><Bot /></div>
                  <h3>AI Content Assistance</h3>
                  <p>
                    Overcome writer's block. Use our integrated AI tools to generate course outlines, lesson summaries, and even quiz questions instantly.
                  </p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.iconWrapper}><ImageIcon /></div>
                  <h3>Course Thumbnail & Preview</h3>
                  <p>
                    Make a great first impression. Upload eye-catching course thumbnails and select free preview lessons to hook potential students.
                  </p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.iconWrapper}><FileEdit /></div>
                  <h3>Draft & Publish Workflow</h3>
                  <p>
                    Work at your own pace. Save your curriculum as a draft, preview it as a student would see it, and publish only when you're 100% ready.
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="student">
              <div className={styles.grid3Col}>
                <div className={styles.featureCard}>
                  <div className={styles.iconWrapper}><MonitorPlay /></div>
                  <h3>Mobile-Friendly Player</h3>
                  <p>A responsive, distraction-free viewing experience that works flawlessly across desktops, tablets, and smartphones.</p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.iconWrapper}><Activity /></div>
                  <h3>Lesson Progress Tracking</h3>
                  <p>Students can visually track their overall course progress with intuitive completion bars and status indicators.</p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.iconWrapper}><CheckCircle2 /></div>
                  <h3>Mark Complete/Incomplete</h3>
                  <p>Empower students to manage their own learning pace by explicitly marking lessons as finished or revisiting them later.</p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.iconWrapper}><Navigation /></div>
                  <h3>Section-Wise Navigation</h3>
                  <p>An easy-to-use sidebar allows students to quickly jump between sections, lessons, and review previously watched materials.</p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.iconWrapper}><FastForward /></div>
                  <h3>Optimized Video Streaming</h3>
                  <p>Adaptive bitrate streaming ensures that videos play smoothly without buffering, regardless of the student's internet connection.</p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.iconWrapper}><Award /></div>
                  <h3>Completion Celebration</h3>
                  <p>Keep motivation high with rewarding visual celebrations when a student successfully finishes your entire course.</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="monetization">
              <div className={styles.grid3Col}>
                <div className={styles.featureCard}>
                  <div className={styles.iconWrapper}><DollarSign /></div>
                  <h3>Flexible Pricing</h3>
                  <p>Offer your courses for free as lead magnets, or set competitive paid tiers to monetize your premium content.</p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.iconWrapper}><Package /></div>
                  <h3>Course Bundles</h3>
                  <p>Group related courses together into attractive bundles, increasing your average order value and providing more value.</p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.iconWrapper}><Tag /></div>
                  <h3>Promo Codes & Discounts</h3>
                  <p>Run holiday sales, early-bird specials, or reward loyal followers with customizable percentage or flat-rate discount codes.</p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.iconWrapper}><HeartHandshake /></div>
                  <h3>Student Sponsorship</h3>
                  <p>Allow organizations or individuals to bulk-purchase your courses to sponsor learning for groups of students.</p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.iconWrapper}><LineChart /></div>
                  <h3>Earnings Dashboard</h3>
                  <p>Track your sales, refunds, and net revenue in real-time with a transparent, easy-to-understand financial dashboard.</p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.iconWrapper}><CreditCard /></div>
                  <h3>Weekly Payouts</h3>
                  <p>No waiting around for your money. Receive your earnings reliably every week, directly deposited into your bank account.</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </section>

        {/* 3. How It Works */}
        <section className={styles.howItWorksSection} id="how-it-works">
          <div className={styles.sectionHeader}>
            <h2>Launch Your Course in 3 Simple Steps</h2>
            <p>Go from idea to passive income faster than you thought possible.</p>
          </div>
          <div className={styles.stepsGrid}>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>1</div>
              <h3>Sign Up</h3>
              <p>
                Create your teacher account in under 2 minutes. No credit card required. Instantly access your creator dashboard.
              </p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>2</div>
              <h3>Build Your Course</h3>
              <p>
                Use our intuitive builder to structure sections, upload videos, and write rich-text lessons with our AI tools.
              </p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNumber}>3</div>
              <h3>Publish & Earn</h3>
              <p>
                Set your price, hit publish, and tap into our massive student network. Get paid weekly for every enrollment.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Analytics */}
        <section className={styles.alternateSection}>
          <div className={styles.sectionHeader}>
            <h2>Deep Analytics & Insights</h2>
            <p>Stop guessing. Make data-driven decisions to improve your courses and boost your marketing efforts.</p>
          </div>
          <div className={styles.grid2Col}>
            <div className={styles.analyticsCard}>
              <div className={styles.iconWrapper}><TrendingUp /></div>
              <h3>Course Analytics</h3>
              <p>See exactly which lessons are most popular, where students drop off, and how engaging your video content truly is.</p>
            </div>
            <div className={styles.analyticsCard}>
              <div className={styles.iconWrapper}><Users /></div>
              <h3>Enrollment Tracking</h3>
              <p>Monitor your daily, weekly, and monthly new student enrollments to measure the success of your promotional campaigns.</p>
            </div>
            <div className={styles.analyticsCard}>
              <div className={styles.iconWrapper}><DollarSign /></div>
              <h3>Revenue Insights</h3>
              <p>Break down your earnings by individual courses or bundles to identify your most profitable content and scale accordingly.</p>
            </div>
            <div className={styles.analyticsCard}>
              <div className={styles.iconWrapper}><Activity /></div>
              <h3>Student Progress Monitoring</h3>
              <p>Identify which students are flying through the material and who might need extra help, allowing for targeted communication.</p>
            </div>
          </div>
        </section>

        {/* 5. Stats Section */}
        <section className={styles.statsSection}>
          <div className={styles.statsContainer}>
            <div className={styles.statCard}>
              <h4>50,000+</h4>
              <p>Courses Created</p>
            </div>
            <div className={styles.statCard}>
              <h4>₹15 Cr+</h4>
              <p>Paid to Teachers</p>
            </div>
            <div className={styles.statCard}>
              <h4>5M+</h4>
              <p>Active Students</p>
            </div>
            <div className={styles.statCard}>
              <h4>₹75,000+</h4>
              <p>Avg. Monthly Earnings</p>
            </div>
          </div>
        </section>

        {/* 6. FAQ Section */}
        <SellCoursesFAQ />

        {/* 7. Final CTA Section */}
        <section className={styles.finalCtaSection}>
          <div className={styles.finalCtaContent}>
            <h2>Ready to Share Your Knowledge?</h2>
            <p>
              Turn your expertise into a thriving online business with Testkart today. Join thousands of successful educators.
            </p>
            <div className={styles.finalCtaActions}>
              <BookDemoButton size="lg" variant="outline" className={styles.ctaButton} />
              <Button asChild size="lg" variant="primary" className={styles.ctaButton}>
                <Link to="/teacher/signup">
                  Start Creating Free &mdash; No Credit Card Required <ArrowRight size={18} />
                </Link>
              </Button>
            </div>
            <div className={styles.finalCtaHighlights}>
              <span>Zero Investment</span>
              <span>&middot;</span>
              <span>Weekly Payouts</span>
              <span>&middot;</span>
              <span>AI-Powered Tools</span>
            </div>
          </div>
        </section>
        <WhatsAppBubble />
      </div>
    </>
  );
};

export default SellOnlineCoursesPage;