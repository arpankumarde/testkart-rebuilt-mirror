import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeIndianRupee,
  BookOpen,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Layers,
  MousePointerClick,
  PackagePlus,
  PlayCircle,
  Rocket,
  ShoppingBag,
  Sparkles,
  Tag,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SEOHead } from "../components/SEOHead";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/Accordion";
import { PlayfulButton } from "../components/PlayfulButton";
import { WhatsAppBubble } from "../components/WhatsAppBubble";
import { useAuth } from "../helpers/useAuth";
import { BRAND_LOGO_LIGHT } from "../helpers/brandAssets";
import styles from "./sell.bundles.module.css";

const PAGE_URL = "https://testkart.in/sell/bundles";
const PAGE_TITLE = "Course Bundles: Sell Tests, Notes & Courses";
const PAGE_DESCRIPTION =
  "Combine mock tests, study notes PDFs and video courses into one bundle on Testkart. Raise order value and give students a complete exam prep package.";
const OG_IMAGE =
  "https://testkart.in/_cdn/static/8ded6fa6-9ef5-44c5-b053-a08ada39df22-og-sell-bundles.png";
const CTA_ART = "/_cdn/static/2cf981d9-6988-4a17-a95d-64869aa32a53-sell-bundles-art.webp";

type Tone = "lavender" | "powder" | "mint" | "peach" | "butter";

const OFFERINGS: {
  tone: Tone;
  label: string;
  title: string;
  body: string;
  icon: LucideIcon;
  link: { to: string; label: string };
}[] = [
  {
    tone: "lavender",
    label: "Tests",
    title: "Mock Test Series",
    body: "Combine several test series into one package so students practise every paper from one place.",
    icon: ClipboardCheck,
    link: { to: "/sell/mock-test", label: "Sell mock tests" },
  },
  {
    tone: "powder",
    label: "Notes",
    title: "Study Notes & PDFs",
    body: "Package notes, previous-year papers and study material you already sell as PDFs.",
    icon: FileText,
    link: { to: "/sell/study-notes-pdfs", label: "Sell study material online" },
  },
  {
    tone: "mint",
    label: "Courses",
    title: "Video Courses",
    body: "Add recorded courses, so the lessons and the practice arrive in the same purchase.",
    icon: PlayCircle,
    link: { to: "/sell/courses", label: "Sell video courses" },
  },
  {
    tone: "peach",
    label: "Sold separately",
    title: "Pair with Live Tests",
    body: "Live tests run on a fixed date and are sold on their own, not inside a bundle. Promote one next to your bundle for exam-day practice.",
    icon: CalendarClock,
    link: { to: "/sell/host-live-exam", label: "Host a live mock test" },
  },
];

const EXAMPLE_ITEMS: { tone: Tone; kind: string; title: string; icon: LucideIcon }[] = [
  { tone: "lavender", kind: "Test series", title: "UPSC Prelims Mock Test Series", icon: ClipboardCheck },
  { tone: "powder", kind: "Study notes", title: "Current Affairs Notes", icon: FileText },
  { tone: "butter", kind: "Study notes", title: "Polity & History PDFs", icon: BookOpen },
  { tone: "mint", kind: "Video course", title: "Recorded GS Foundation Course", icon: PlayCircle },
];

const BENEFITS: { tone: Tone; title: string; body: string; icon: LucideIcon }[] = [
  {
    tone: "peach",
    title: "Higher order value",
    body: "Students pick up several of your products in one purchase instead of one at a time.",
    icon: TrendingUp,
  },
  {
    tone: "mint",
    title: "Better learning experience",
    body: "Practice, notes and lessons for one exam sit together, so students follow one complete plan.",
    icon: Sparkles,
  },
  {
    tone: "lavender",
    title: "Flexible pricing",
    body: "Set one bundle price below the items' combined price. Students see the original total and their saving.",
    icon: BadgeIndianRupee,
  },
  {
    tone: "powder",
    title: "Simpler selling",
    body: "One listing, one link and one checkout for several products, managed from your dashboard.",
    icon: ShoppingBag,
  },
];

const STEPS: { title: string; body: string; icon: LucideIcon }[] = [
  {
    title: "Choose your products",
    body: "Pick two or more published test series, study notes or courses.",
    icon: MousePointerClick,
  },
  {
    title: "Create your bundle",
    body: "Give the package a name, description and cover, then set one price for it.",
    icon: PackagePlus,
  },
  {
    title: "Publish and sell",
    body: "The bundle goes live as soon as you publish it. Share its link with your students.",
    icon: Rocket,
  },
];

const EXAM_IDEAS: { tone: Tone; title: string; body: string; to: string; linkLabel: string }[] = [
  {
    tone: "lavender",
    title: "UPSC Test Series Bundle",
    body: "Prelims test series, current affairs notes and a GS course.",
    to: "/exams/upsc-cse",
    linkLabel: "UPSC CSE exam hub",
  },
  {
    tone: "mint",
    title: "NEET Preparation Bundle",
    body: "Chapter-wise tests with Biology, Physics and Chemistry notes.",
    to: "/exams/neet-ug",
    linkLabel: "NEET UG exam hub",
  },
  {
    tone: "powder",
    title: "JEE Course and Test Bundle",
    body: "A recorded concepts course with full-length JEE Main mocks.",
    to: "/exams/jee-main",
    linkLabel: "JEE Main exam hub",
  },
  {
    tone: "butter",
    title: "SSC & Banking Bundle",
    body: "Quant, reasoning and English tests with shortcut notes.",
    to: "/exams/ssc-cgl",
    linkLabel: "SSC CGL exam hub",
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I create a course bundle on Testkart?",
    a: "Sign in to your teacher dashboard, open Bundles and choose Create bundle. Add a title, description and cover, pick the test series, study notes and courses to include, set a price, then publish it.",
  },
  {
    q: "Can I combine mock tests and study notes?",
    a: "Yes. A bundle can mix test series, study notes and PDFs, and video courses. It needs at least two items, and every item must be published before the bundle can go live. Live tests are sold separately and cannot be added to a bundle.",
  },
  {
    q: "Can I set custom bundle pricing?",
    a: "Yes. You choose the bundle price in INR. It must be lower than the combined price of the items inside, and students see the original total and the saving next to your price.",
  },
  {
    q: "Can I sell multiple courses together?",
    a: "Yes. A bundle can hold several video courses, on their own or together with test series and study notes.",
  },
  {
    q: "How do bundles help educators?",
    a: "A bundle lets students buy everything they need for one exam in a single checkout, which raises the value of each order. You manage one listing and one link instead of several.",
  },
  {
    q: "Can I update my bundle after publishing?",
    a: "Yes. You can edit the title, description, cover and price of a published bundle at any time, and its link stays the same. To add or remove items, unpublish the bundle, make the change, then publish it again.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": PAGE_URL,
      url: PAGE_URL,
      name: `${PAGE_TITLE} | Testkart`,
      description: PAGE_DESCRIPTION,
      inLanguage: "en-IN",
      primaryImageOfPage: OG_IMAGE,
      isPartOf: { "@type": "WebSite", name: "Testkart", url: "https://testkart.in" },
      publisher: { "@id": "https://testkart.in/#organization" },
    },
    {
      "@type": "Organization",
      "@id": "https://testkart.in/#organization",
      name: "Testkart",
      url: "https://testkart.in",
      logo: BRAND_LOGO_LIGHT,
      sameAs: [
        "https://www.instagram.com/testkart",
        "https://www.linkedin.com/company/testkart",
        "https://t.me/testkart_in",
        "https://x.com/testkart_in",
        "https://www.facebook.com/groups/testkart/",
      ],
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://testkart.in" },
        { "@type": "ListItem", position: 2, name: "Course Bundles", item: PAGE_URL },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    },
  ],
};

const toneClass = (tone: Tone) => styles[`tone_${tone}`];

const SellBundlesPage: React.FC = () => {
  const { authState } = useAuth();
  const isTeacher =
    authState.type === "authenticated" &&
    (authState.user.role === "teacher" || authState.user.role === "admin");
  const createTo = isTeacher ? "/teacher/bundles/create" : "/teacher/signup";

  return (
    <>
      <SEOHead
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        url={PAGE_URL}
        image={OG_IMAGE}
        imageAlt="Testkart bundle combining a test series, study notes and a video course"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className={styles.page}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <ol>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li aria-current="page">Course Bundles</li>
          </ol>
        </nav>

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>
              <Boxes size={14} aria-hidden="true" />
              For educators
            </span>
            <h1 className={styles.heroTitle}>
              Bundle Tests, Notes &amp; Courses in <span className={styles.heroMark}>One Offer</span>
            </h1>
            <p className={styles.heroLead}>
              Bring your learning resources together, create complete exam-preparation packages
              and offer more value to your students with Testkart.
            </p>
            <div className={styles.heroActions}>
              <PlayfulButton asChild tone="primary" size="lg">
                <Link to={createTo}>
                  Create Your First Bundle <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </PlayfulButton>
              <PlayfulButton asChild tone="soft" size="lg">
                <a href="#how-it-works">Explore How It Works</a>
              </PlayfulButton>
            </div>
            <ul className={styles.heroFacts}>
              <li>
                <CheckCircle2 size={16} aria-hidden="true" /> Free to start
              </li>
              <li>
                <CheckCircle2 size={16} aria-hidden="true" /> Your price, in INR
              </li>
              <li>
                <CheckCircle2 size={16} aria-hidden="true" /> Mix 2 or more products
              </li>
            </ul>
          </div>

          <div
            className={styles.heroArt}
            role="img"
            aria-label="Testkart bundle combining a mock test series, study notes and a video course into one offer"
          >
            <div className={styles.artBundle} aria-hidden="true">
              <div className={styles.artBundleHead}>
                <span className={styles.artBundleIcon}>
                  <Layers size={18} />
                </span>
                <div>
                  <p className={styles.artBundleTitle}>Your exam prep bundle</p>
                  <p className={styles.artBundleMeta}>3 products, 1 checkout</p>
                </div>
              </div>
              <ul className={styles.artBundleList}>
                <li className={toneClass("lavender")}>
                  <ClipboardCheck size={15} /> Test series
                </li>
                <li className={toneClass("powder")}>
                  <FileText size={15} /> Study notes
                </li>
                <li className={toneClass("mint")}>
                  <PlayCircle size={15} /> Video course
                </li>
              </ul>
              <div className={styles.artBundlePrice}>
                <Tag size={14} /> One bundle price
              </div>
            </div>
            <div className={`${styles.floatCard} ${styles.floatA} ${toneClass("lavender")}`} aria-hidden="true">
              <ClipboardCheck size={16} /> Mock Tests
            </div>
            <div className={`${styles.floatCard} ${styles.floatB} ${toneClass("powder")}`} aria-hidden="true">
              <FileText size={16} /> Study Notes
            </div>
            <div className={`${styles.floatCard} ${styles.floatC} ${toneClass("mint")}`} aria-hidden="true">
              <PlayCircle size={16} /> Video Courses
            </div>
            <span className={`${styles.dot} ${styles.dotA}`} aria-hidden="true" />
            <span className={`${styles.dot} ${styles.dotB}`} aria-hidden="true" />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="offerings-title">
          <header className={styles.sectionHead}>
            <h2 id="offerings-title">Everything Your Students Need, Together</h2>
            <p>
              Sell mock tests and notes together, add a video course, and price the whole pack as one
              exam prep bundle.
            </p>
          </header>
          <ul className={styles.offerGrid}>
            {OFFERINGS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className={`${styles.offerCard} ${toneClass(item.tone)}`}>
                  <div className={styles.offerTop}>
                    <span className={styles.offerIcon}>
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <span className={styles.offerLabel}>{item.label}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <Link to={item.link.to} className={styles.inlineLink}>
                    {item.link.label} <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="example-title">
          <header className={styles.sectionHead}>
            <h2 id="example-title">See What You Can Create</h2>
            <p>One test series bundle for UPSC, built from products you already sell.</p>
          </header>
          <div className={styles.showcase}>
            <div className={styles.showcaseMain}>
              <span className={styles.sampleTag}>Illustrative example, not a live Testkart offer</span>
              <h3 className={styles.showcaseTitle}>Complete UPSC Preparation Bundle</h3>
              <p className={styles.showcaseMeta}>4 products &middot; 1 listing &middot; 1 checkout</p>
              <ol className={styles.showcaseItems}>
                {EXAMPLE_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.title} className={`${styles.showcaseItem} ${toneClass(item.tone)}`}>
                      <span className={styles.showcaseItemIcon}>
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <span className={styles.showcaseItemText}>
                        <span className={styles.showcaseItemKind}>{item.kind}</span>
                        <span className={styles.showcaseItemTitle}>{item.title}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
            <aside className={styles.pricingNote} aria-label="How bundle pricing works">
              <h3>How the price works</h3>
              <ol>
                <li>
                  <span>1</span>Testkart adds up the current prices of the items inside.
                </li>
                <li>
                  <span>2</span>You set one bundle price lower than that total.
                </li>
                <li>
                  <span>3</span>Students see the original total and the saving at checkout.
                </li>
              </ol>
            </aside>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="benefits-title">
          <header className={styles.sectionHead}>
            <h2 id="benefits-title">Why Educators Choose Course Bundles</h2>
            <p>An online course bundle platform built for Indian exam educators.</p>
          </header>
          <ul className={styles.benefitGrid}>
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <li key={b.title} className={styles.benefit}>
                  <span className={`${styles.benefitIcon} ${toneClass(b.tone)}`}>
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{b.title}</h3>
                    <p>{b.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={styles.section} id="how-it-works" aria-labelledby="steps-title">
          <header className={styles.sectionHead}>
            <h2 id="steps-title">Create and Sell Your First Bundle</h2>
            <p>Three steps from your dashboard to a live bundle.</p>
          </header>
          <ol className={styles.stepper}>
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className={styles.step}>
                  <div className={styles.stepMarker}>
                    <span className={styles.stepNumber}>{i + 1}</span>
                  </div>
                  <div className={styles.stepBody}>
                    <span className={styles.stepIcon}>
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="exams-title">
          <header className={styles.sectionHead}>
            <h2 id="exams-title">Test Series Bundles for UPSC, NEET and JEE</h2>
            <p>Bundle ideas for the exams students prepare for most. Open an exam hub to see what they look for.</p>
          </header>
          <ul className={styles.examGrid}>
            {EXAM_IDEAS.map((idea) => (
              <li key={idea.title}>
                <Link to={idea.to} className={`${styles.examCard} ${toneClass(idea.tone)}`}>
                  <span className={styles.examTitle}>{idea.title}</span>
                  <span className={styles.examBody}>{idea.body}</span>
                  <span className={styles.examLink}>
                    {idea.linkLabel} <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className={styles.relatedLinks}>
            More to explore: <Link to="/exams">all exams</Link>, <Link to="/exams/ibps-po">IBPS PO</Link>,{" "}
            <Link to="/glossary">exam glossary</Link>, <Link to="/help">help docs</Link>, and how Testkart
            compares with <Link to="/compare/classplus-vs-testkart">Classplus</Link>,{" "}
            <Link to="/compare/learnyst-vs-testkart">Learnyst</Link>,{" "}
            <Link to="/compare/tagmango-vs-testkart">TagMango</Link> and{" "}
            <Link to="/compare/graphy-vs-testkart">Graphy</Link>.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="faq-title">
          <header className={styles.sectionHead}>
            <h2 id="faq-title">Frequently Asked Questions</h2>
          </header>
          <div className={styles.faq}>
            <Accordion type="single" collapsible>
              {FAQS.map((faq, i) => (
                <AccordionItem key={faq.q} value={`faq-${i}`}>
                  <AccordionTrigger>{faq.q}</AccordionTrigger>
                  <AccordionContent>{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className={styles.finalCta} aria-labelledby="final-cta-title">
          <div className={styles.finalCopy}>
            <h2 id="final-cta-title">Ready to Build Your First Bundle?</h2>
            <p>
              Bring your educational products together and create a complete learning experience for
              your students.
            </p>
            <PlayfulButton asChild tone="primary" size="lg">
              <Link to={createTo}>
                Start Creating Bundles <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </PlayfulButton>
          </div>
          <div className={styles.finalArt}>
            <img
              src={CTA_ART}
              alt="Testkart bundle combining test series, notes and a video course in one box"
              width={480}
              height={507}
              loading="lazy"
              decoding="async"
            />
          </div>
        </section>

        <WhatsAppBubble />
      </div>
    </>
  );
};

export default SellBundlesPage;
