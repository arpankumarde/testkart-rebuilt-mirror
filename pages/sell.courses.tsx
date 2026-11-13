import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import {
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
  Users,
  IndianRupee,
  MessageCircleQuestion,
  Check,
  type LucideIcon,
} from "lucide-react";

import { SEOHead } from '../components/SEOHead';
import { WhatsAppBubble } from '../components/WhatsAppBubble';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/Tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '../components/Accordion';
import { SellLandingTestimonials } from "../components/SellLandingTestimonials";
import { SellLandingTrust, type SellTrustStat } from "../components/SellLandingTrust";
import { SellLandingHeading } from "../components/SellLandingHeading";
import { sellLandingThemeClass } from "../components/SellLandingTheme";
import { SellDemoButton, SellSecondaryAnchor, SellStartLink } from "../components/SellLandingCta";
import { SellCoursesHeroArt } from "../components/SellCoursesHeroArt";
import styles from "./sell.courses.module.css";

type Tone = "lavender" | "blue" | "peach" | "mint" | "butter";
type Feature = { icon: LucideIcon; title: string; text: string };

const TONE_CYCLE: Tone[] = ["lavender", "blue", "mint", "peach", "butter"];

const FEATURE_TABS: { value: string; label: string; tone: Tone; features: Feature[] }[] = [
  {
    value: "builder",
    label: "Course Builder",
    tone: "lavender",
    features: [
      {
        icon: PlayCircle,
        title: "Video Upload & Hosting",
        text: "Unlimited, secure video hosting powered by Cloudflare. Upload your lessons and let us handle encoding and smooth delivery to any device.",
      },
      {
        icon: BookOpen,
        title: "Structured Curriculum Builder",
        text: "Organize your knowledge easily. Create sections, add lessons, and rearrange your curriculum with a simple drag-and-drop interface.",
      },
      {
        icon: PenTool,
        title: "Rich Text & Math Editor",
        text: "Format your text lessons beautifully. Full LaTeX and math equation support ensures your STEM content is perfectly readable.",
      },
      {
        icon: Bot,
        title: "AI Content Assistance",
        text: "Overcome writer's block. Use our integrated AI tools to generate course outlines, lesson summaries, and even quiz questions instantly.",
      },
      {
        icon: ImageIcon,
        title: "Course Thumbnail & Preview",
        text: "Make a great first impression. Upload eye-catching course thumbnails and select free preview lessons to hook potential students.",
      },
      {
        icon: FileEdit,
        title: "Draft & Publish Workflow",
        text: "Work at your own pace. Save your curriculum as a draft, preview it as a student would see it, and publish only when you're 100% ready.",
      },
    ],
  },
  {
    value: "student",
    label: "Student Experience",
    tone: "blue",
    features: [
      {
        icon: MonitorPlay,
        title: "Mobile-Friendly Player",
        text: "A responsive, distraction-free viewing experience that works flawlessly across desktops, tablets, and smartphones.",
      },
      {
        icon: Activity,
        title: "Lesson Progress Tracking",
        text: "Students can visually track their overall course progress with intuitive completion bars and status indicators.",
      },
      {
        icon: CheckCircle2,
        title: "Mark Complete/Incomplete",
        text: "Empower students to manage their own learning pace by explicitly marking lessons as finished or revisiting them later.",
      },
      {
        icon: Navigation,
        title: "Section-Wise Navigation",
        text: "An easy-to-use sidebar allows students to quickly jump between sections, lessons, and review previously watched materials.",
      },
      {
        icon: FastForward,
        title: "Optimized Video Streaming",
        text: "Adaptive bitrate streaming ensures that videos play smoothly without buffering, regardless of the student's internet connection.",
      },
      {
        icon: Award,
        title: "Completion Celebration",
        text: "Keep motivation high with rewarding visual celebrations when a student successfully finishes your entire course.",
      },
    ],
  },
  {
    value: "monetization",
    label: "Monetization",
    tone: "mint",
    features: [
      {
        icon: DollarSign,
        title: "Flexible Pricing",
        text: "Offer your courses for free as lead magnets, or set competitive paid tiers to monetize your premium content.",
      },
      {
        icon: Package,
        title: "Course Bundles",
        text: "Group related courses together into attractive bundles, increasing your average order value and providing more value.",
      },
      {
        icon: Tag,
        title: "Promo Codes & Discounts",
        text: "Run holiday sales, early-bird specials, or reward loyal followers with customizable percentage or flat-rate discount codes.",
      },
      {
        icon: HeartHandshake,
        title: "Student Sponsorship",
        text: "Allow organizations or individuals to bulk-purchase your courses to sponsor learning for groups of students.",
      },
      {
        icon: LineChart,
        title: "Earnings Dashboard",
        text: "Track your sales, refunds, and net revenue in real-time with a transparent, easy-to-understand financial dashboard.",
      },
      {
        icon: CreditCard,
        title: "Weekly Payouts",
        text: "No waiting around for your money. Receive your earnings reliably every week, directly deposited into your bank account.",
      },
    ],
  },
];

const STEPS = [
  {
    title: "Sign Up",
    text: "Create your teacher account in under 2 minutes. No credit card required. Instantly access your creator dashboard.",
  },
  {
    title: "Build Your Course",
    text: "Use our intuitive builder to structure sections, upload videos, and write rich-text lessons with our AI tools.",
  },
  {
    title: "Publish & Earn",
    text: "Set your price, hit publish, and tap into our massive student network. Get paid weekly for every enrollment.",
  },
];

const ANALYTICS: (Feature & { tone: Tone })[] = [
  {
    icon: TrendingUp,
    tone: "peach",
    title: "Course Analytics",
    text: "See exactly which lessons are most popular, where students drop off, and how engaging your video content truly is.",
  },
  {
    icon: Users,
    tone: "mint",
    title: "Enrollment Tracking",
    text: "Monitor your daily, weekly, and monthly new student enrollments to measure the success of your promotional campaigns.",
  },
  {
    icon: DollarSign,
    tone: "lavender",
    title: "Revenue Insights",
    text: "Break down your earnings by individual courses or bundles to identify your most profitable content and scale accordingly.",
  },
  {
    icon: Activity,
    tone: "blue",
    title: "Student Progress Monitoring",
    text: "Identify which students are flying through the material and who might need extra help, allowing for targeted communication.",
  },
];

/*
 * Counted from the live database on 13-10-2026 and rounded down. Update by hand
 * as they grow. The 11,000+ Educators figure sits beside the educator marquee
 * in SellLandingTrust; these are the other three.
 */
const COURSE_STATS: SellTrustStat[] = [
  { icon: BookOpen, tone: "peach", value: "500+", label: "Courses Created" },
  { icon: IndianRupee, tone: "mint", value: "₹72,000+", label: "Paid to Teachers" },
  { icon: Users, tone: "blue", value: "6,800+", label: "Students" },
];

const HERO_BADGES = ["Join 11,000+ educators", "Zero Investment", "Unlimited Hosting"];
const CTA_HIGHLIGHTS = ["Zero Investment", "Weekly Payouts", "AI-Powered Tools"];

const toneClass = (tone: Tone) => styles[`tone_${tone}`];

const SellCoursesFAQ: React.FC = () => {
  const faqs = [
    {
      question: "How much can I earn by selling courses on Testkart?",
      answer:
        "Your earnings depend on your price and how many students enrol. You set your own course prices and keep 72% of every sale after the flat 28% platform fee. We provide the tools and the audience; you bring the expertise."
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
    <section className={styles.faqSection} aria-labelledby="courses-faq-title">
      <div className={styles.faqLayout}>
        <div className={styles.faqIntro}>
          <SellLandingHeading
            id="courses-faq-title"
            align="start"
            eyebrow="FAQ"
            title="Frequently Asked Questions"
            lead="Everything you need to know about creating and selling courses with Testkart."
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
          {faqs.map((faq, index) => (
            <AccordionItem value={`item-${index}`} key={index} className={styles.faqItem}>
              <AccordionTrigger className={styles.faqTrigger}>
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className={styles.faqAnswer}>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

const SellOnlineCoursesPage: React.FC = () => {
  return (
    <>
      <SEOHead
        title="Create and Sell Online Video Courses | Testkart"
        description="Join India's leading marketplace to create and sell online video courses. Get unlimited hosting, AI tools, and reach thousands of students. Zero investment required."
        url="https://testkart.in/sell/courses"
      />

      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "name": "Create and Sell Online Video Courses | Testkart",
                "description": "Create and sell online video courses with Testkart's all-in-one platform. Reach thousands of students, use AI-powered tools, and build a sustainable teaching business with zero upfront investment.",
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
                  "description": "Start for free with no upfront cost. We take a flat 28% platform fee only when you make a sale."
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
                      "text": "Your earnings depend on your price and how many students enrol. You set your own course prices and keep 72% of every sale after the flat 28% platform fee."
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

      <div className={`${sellLandingThemeClass} ${styles.page}`}>
        <div className={styles.shell}>
          <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
            <ol>
              <li>
                <Link to="/">Home</Link>
              </li>
              <li aria-current="page">Sell Online Courses</li>
            </ol>
          </nav>

          {/* 1. Hero */}
          <header className={styles.hero}>
            <div className={styles.heroCopy}>
              <h1 className={styles.heroTitle}>
                Create and Sell <span className={styles.heroMark}>Online Video Courses</span>
              </h1>
              <p className={styles.heroLead}>
                Share your expertise, build a thriving education business, and
                earn a recurring income with Testkart's all-in-one platform tailored for educators.
              </p>
              <div className={styles.heroActions}>
                <SellStartLink>Start Creating Free</SellStartLink>
                <SellSecondaryAnchor href="#how-it-works">See How It Works</SellSecondaryAnchor>
              </div>
              <ul className={styles.heroFacts}>
                {HERO_BADGES.map((badge) => (
                  <li key={badge}>
                    <span className={styles.heroFactIcon} aria-hidden="true">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {badge}
                  </li>
                ))}
              </ul>
            </div>

            <SellCoursesHeroArt />
          </header>
        </div>

        {/* 2. Teacher testimonials, the same section as /sell */}
        <SellLandingTestimonials />

        <div className={styles.shell}>
          {/* 3. Features */}
          <section className={styles.section} aria-labelledby="courses-features-title">
            <SellLandingHeading
              id="courses-features-title"
              title="Everything You Need to Succeed"
              lead="Powerful, intuitive tools designed specifically for educators to bring their curriculum online without technical hurdles."
            />

            <Tabs defaultValue="builder">
              <TabsList className={styles.tabsList}>
                {FEATURE_TABS.map(({ value, label }) => (
                  <TabsTrigger key={value} value={value} className={styles.tabsTrigger}>
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {FEATURE_TABS.map(({ value, label, features }) => (
                <TabsContent key={value} value={value} className={styles.tabsContent}>
                  <ul className={styles.featureGrid}>
                    {features.map(({ icon: Icon, title, text }, index) => (
                      <li
                        key={title}
                        className={`${styles.featureCard} ${toneClass(TONE_CYCLE[index % TONE_CYCLE.length])}`}
                      >
                        <div className={styles.featureTop}>
                          <span className={styles.featureIcon}>
                            <Icon size={22} aria-hidden="true" />
                          </span>
                          <span className={styles.featureLabel}>{label}</span>
                        </div>
                        <h3>{title}</h3>
                        <p>{text}</p>
                      </li>
                    ))}
                  </ul>
                </TabsContent>
              ))}
            </Tabs>
          </section>

          {/* 4. How it works */}
          <section className={styles.section} id="how-it-works" aria-labelledby="courses-steps-title">
            <SellLandingHeading
              id="courses-steps-title"
              title="Launch Your Course in 3 Simple Steps"
              lead="Go from idea to passive income faster than you thought possible."
            />
            <ol className={styles.stepper}>
              {STEPS.map((step, index) => (
                <li key={step.title} className={styles.step}>
                  <div className={styles.stepMarker}>
                    <span className={styles.stepNumber}>{index + 1}</span>
                  </div>
                  <div className={styles.stepBody}>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* 5. Analytics */}
          <section className={styles.section} aria-labelledby="courses-analytics-title">
            <SellLandingHeading
              id="courses-analytics-title"
              title="Deep Analytics & Insights"
              lead="Stop guessing. Make data-driven decisions to improve your courses and boost your marketing efforts."
            />
            <ul className={styles.benefitGrid}>
              {ANALYTICS.map(({ icon: Icon, tone, title, text }) => (
                <li key={title} className={styles.benefit}>
                  <span className={`${styles.benefitIcon} ${toneClass(tone)}`}>
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* 6. Stats, the same card as /sell */}
        <SellLandingTrust stats={COURSE_STATS} />

        {/* 7. FAQ */}
        <SellCoursesFAQ />

        {/* 8. Final CTA */}
        <div className={styles.shell}>
          <section className={styles.finalCta} aria-labelledby="courses-cta-title">
            <div className={styles.finalCopy}>
              <h2 id="courses-cta-title">Ready to Share Your Knowledge?</h2>
              <p>
                Turn your expertise into a thriving online business with Testkart today. Join 11,000+ educators on Testkart.
              </p>
              <div className={styles.finalActions}>
                <SellDemoButton>Book a demo</SellDemoButton>
                <SellStartLink>Start Creating Free - No Credit Card Required</SellStartLink>
              </div>
            </div>
            <ul className={styles.finalHighlights}>
              {CTA_HIGHLIGHTS.map((item) => (
                <li key={item}>
                  <CheckCircle2 size={18} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <WhatsAppBubble />
      </div>
    </>
  );
};

export default SellOnlineCoursesPage;
