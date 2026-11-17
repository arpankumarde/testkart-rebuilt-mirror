import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  FileText,
  Globe,
  GraduationCap,
  IndianRupee,
  Megaphone,
  ArrowUpRight,
  MessageCircleQuestion,
  Play,
  Settings2,
  Share2,
  Sparkles,
  Target,
  Trophy,
  UserCheck,
  Users,
  Wallet,
  Youtube,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { SEOHead } from "../components/SEOHead";
import { WhatsAppBubble } from "../components/WhatsAppBubble";
import { SellLandingHeading } from "../components/SellLandingHeading";
import { TESTIMONIALS } from "../components/SellPageTestimonials";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { sellLandingThemeClass } from "../components/SellLandingTheme";
import { SellDemoButton, SellStartLink, TEACHER_SIGNUP_PATH } from "../components/SellLandingCta";
import { useAuth } from "../helpers/useAuth";
import { LiveContestHeroArt } from "../components/LiveContestHeroArt";
import styles from "./sell.host-live-exam.module.css";

type Tone = "sage" | "blue" | "butter" | "lavender" | "mint";

const SITE = "https://testkart.in";
const PAGE_URL = `${SITE}/sell/host-live-exam`;
const PAGE_TITLE = "Host Live Mock Test Contests Online | Testkart for Teachers";
const PAGE_DESCRIPTION =
  "Host live mock test contests online. Set entry fees and prizes, run live leaderboards, and get automated prize payouts. Start free on Testkart.";
const SOCIAL_TITLE = "Host Live Mock Test Contests Online | Testkart";
const SOCIAL_DESCRIPTION =
  "Turn your mock tests into live competitive events with leaderboards, prize pools and automated prize payouts.";

const toneClass = (tone: Tone) => styles[`tone_${tone}`];

const HERO_FACTS = ["Free to create", "Live leaderboard", "Automated prize payouts"];
const CLOSING_FACTS = ["Free to create", "Secure payouts", "Automated leaderboards"];

const PILLARS: { title: string; text: string }[] = [
  {
    title: "Time-bound event",
    text: "Your test starts at a fixed date and time, which creates urgency and pushes students to register early.",
  },
  {
    title: "Real-time competition",
    text: "Students attempt the same paper together and compete for top ranks, just like the real exam.",
  },
  {
    title: "Live leaderboard",
    text: "Ranks update as students submit, so everyone can check where they stand while the contest runs.",
  },
  {
    title: "Prize pools",
    text: "Offer cash prizes or rewards to toppers. Testkart calculates and distributes them automatically.",
  },
];

const CONTEST_DAY: { time: string; label: string }[] = [
  { time: "9:45 AM", label: "Registration closes" },
  { time: "10:00 AM", label: "Paper opens for all" },
  { time: "11:05 AM", label: "Results and solutions" },
];

const REASONS: { icon: LucideIcon; label: string; title: string; text: string; points: string[] }[] = [
  {
    icon: IndianRupee,
    label: "Revenue",
    title: "Earn more from every test",
    text: "Live contests feel more valuable than a regular test, so you can set a premium entry fee and earn more from a single event.",
    points: ["Set your own entry fee", "Run free or paid contests", "Track earnings on one dashboard"],
  },
  {
    icon: Megaphone,
    label: "Growth",
    title: "Grow your student base",
    text: "Each contest gets a public page that students can share. New learners discover you, and many go on to buy your test series or courses.",
    points: ["Public contest page", "One-tap WhatsApp and social sharing", "All registrations in one place"],
  },
  {
    icon: Settings2,
    label: "Automation",
    title: "No manual work",
    text: "Ranking, tie-breaks, prize calculation, prize payouts and result emails are automated, so you can focus on teaching.",
    points: ["Instant rank calculation", "Automated prize distribution", "Withdraw earnings to your bank"],
  },
];

const STEPS: { title: string; tag: string; text: string }[] = [
  {
    title: "Set up your contest",
    tag: "Your dashboard",
    text: "Add your questions or import them from your question bank, then set the date, time, duration, entry fee and prize pool. The dashboard guides you through each step.",
  },
  {
    title: "Promote your event",
    tag: "Shareable link",
    text: "Once approved, your contest is listed on Testkart with its own shareable link. Share it with your students and on WhatsApp or social media to drive registrations.",
  },
  {
    title: "Go live and earn",
    tag: "Contest day",
    text: "On contest day, watch the leaderboard fill up. Afterwards, Testkart releases results, pays prizes into winners' wallets, and your earnings are ready to withdraw to your bank account.",
  },
];

const FEATURES: { icon: LucideIcon; tone: Tone; title: string; text: string }[] = [
  { icon: Zap, tone: "sage", title: "Live leaderboard", text: "Ranks update as students submit." },
  { icon: Trophy, tone: "butter", title: "Automated prize calculation", text: "Prizes are computed and distributed for you." },
  { icon: Clock, tone: "blue", title: "Live countdown timers", text: "Build anticipation before the start." },
  { icon: UserCheck, tone: "lavender", title: "Registration management", text: "Seat limits, deadlines and reminder emails." },
  { icon: BarChart3, tone: "sage", title: "Performance analytics", text: "Registrations, completions, average score and toppers." },
  { icon: Target, tone: "butter", title: "Winner announcements", text: "Winners are emailed their rank and prize." },
  { icon: Globe, tone: "blue", title: "Public contest page", text: "A shareable page that explains your contest." },
  { icon: Sparkles, tone: "lavender", title: "AI question generation", text: "Draft questions faster for new contests." },
  { icon: CreditCard, tone: "sage", title: "Entry fee collection", text: "Secure payments with no manual tracking." },
  { icon: FileText, tone: "butter", title: "Result publishing", text: "Results and solutions release when the contest closes." },
  { icon: Share2, tone: "blue", title: "WhatsApp and social sharing", text: "Share in one tap to grow registrations." },
  { icon: Wallet, tone: "lavender", title: "Student wallet integration", text: "Prize money lands in winners' Testkart wallets." },
];

const CONTEST_TYPES: { icon: LucideIcon; tone: Tone; title: string; fee: string; text: string; bestFor: string }[] = [
  {
    icon: Users,
    tone: "sage",
    title: "Free contest",
    fee: "No entry fee",
    text: "No entry fee, open to all students.",
    bestFor: "Building audience and trust",
  },
  {
    icon: IndianRupee,
    tone: "blue",
    title: "Paid contest",
    fee: "You set the fee",
    text: "Students pay an entry fee and you keep the revenue after the platform fee.",
    bestFor: "Monetising an engaged audience",
  },
  {
    icon: Trophy,
    tone: "butter",
    title: "Prize contest",
    fee: "Prize pool",
    text: "Entry fees fund a prize pool for the toppers.",
    bestFor: "Driving participation and sharing",
  },
];

const AUDIENCE: { icon: LucideIcon; text: string }[] = [
  { icon: Youtube, text: "Independent teachers and YouTube educators" },
  { icon: Building2, text: "Coaching institutes and tutorial centres" },
  { icon: Target, text: "Exam-prep creators for JEE, NEET, UPSC, SSC, banking, NATA, IIT JAM and more" },
  { icon: GraduationCap, text: "School and college faculty running practice contests" },
];

const RELATED_LINKS: { to: string; label: string }[] = [
  { to: "/sell/mock-test", label: "Create and sell mock tests" },
  { to: "/sell/courses", label: "Create and sell online courses" },
  { to: "/sell/study-notes-pdfs", label: "Sell digital study material" },
  { to: "/exams", label: "Exam-wise test series" },
  { to: "/teach", label: "Teach on Testkart" },
  { to: "/compare/classplus-vs-testkart", label: "Compare Testkart and Classplus" },
];

/*
 * The live-test figure was counted from the live database on 23-11-2026 (128
 * published live tests) and rounded down; the other three are the /sell
 * figures in SellLandingTrust. Update by hand as they grow.
 */
const LIVE_STATS: { value: string; label: string }[] = [
  { value: "11,000+", label: "Educators on Testkart" },
  { value: "100+", label: "Live tests hosted" },
  { value: "₹72,000+", label: "Paid to teachers" },
  { value: "6,800+", label: "Students" },
];

const FAQS: { question: string; answer: string }[] = [
  {
    question: "How do prizes and entry fees work?",
    answer:
      "You choose whether your contest is free or paid and set the entry fee and prize pool when you create it, with a fixed prize for each rank or rank range. Students pay the entry fee at registration. On a paid contest, prizes come from the entry fees after the platform fee; on a free contest, you fund them from your Testkart balance. After the contest, Testkart ranks the students and pays prizes into the winners' wallets automatically, and your earnings become available to withdraw to your bank account once the contest ends.",
  },
  {
    question: "Can I host free live contests?",
    answer:
      "Yes. Free contests are a good way to build trust and grow your audience. You still get the live leaderboard, analytics and registration tracking.",
  },
  {
    question: "What happens if a student's internet disconnects?",
    answer:
      "Answers are saved automatically as students go. On the website, a student who drops out can rejoin while the contest is still running and continue from where they left off. The timer does not pause, so time lost to a disconnect is not added back, and an attempt that is never submitted is scored from its last saved answers.",
  },
  {
    question: "How is ranking decided if scores are tied?",
    answer:
      "Ranks are decided by score first, with negative marking already counted in the score. If scores are tied, the student who took less time ranks higher, and if that is also tied, the student who submitted first ranks higher.",
  },
  {
    question: "Do I need to create new questions for every contest?",
    answer:
      "No. You can import questions from your question bank, duplicate a past live contest onto a new date with all its questions, or draft new questions faster with AI question generation.",
  },
  {
    question: "How quickly can I start?",
    answer:
      "Most teachers can set up a contest in under an hour once their questions are ready. Sign up, add your questions, set the schedule and prizes, and submit it. Our team reviews new contests before they go live, then you share the link.",
  },
  {
    question: "How do students join my contest?",
    answer:
      "Students register on your public contest page or through your shared link, pay the entry fee if there is one, and join at the scheduled time on the website or the Testkart app.",
  },
  {
    question: "Is it free to create a contest?",
    answer:
      "Yes. Creating and publishing a contest on Testkart is free. On paid contests, Testkart keeps a platform fee of 28% of entry fees, and the rest is yours.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${PAGE_URL}#webpage`,
      url: PAGE_URL,
      name: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      inLanguage: "en-IN",
      isPartOf: { "@id": `${SITE}/#website` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Teach on Testkart", item: `${SITE}/teach` },
        { "@type": "ListItem", position: 3, name: "Host Live Exam", item: PAGE_URL },
      ],
    },
    {
      "@type": "Service",
      name: "Host Live Mock Test Contests",
      serviceType: "Live mock test contest hosting",
      areaServed: "IN",
      provider: { "@type": "Organization", name: "Testkart", url: `${SITE}/` },
      description: SOCIAL_DESCRIPTION,
      url: PAGE_URL,
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR", description: "Free to create a live contest." },
    },
    {
      "@type": "FAQPage",
      "@id": `${PAGE_URL}#faq`,
      mainEntity: FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
  ],
};

/*
 * Social proof in the page's editorial style: split header, a row of figures,
 * then the teacher quotes from the Testkart YouTube shorts (TESTIMONIALS), each
 * beside its video, which plays in place.
 */
const ProofSection = () => {
  const [playingId, setPlayingId] = useState<string | null>(null);

  return (
    <section className={styles.section} aria-labelledby="live-proof-title">
      <div className={styles.splitHead}>
        <div>
          <p className={styles.kicker}>Social proof</p>
          <h2 id="live-proof-title" className={styles.splitTitle}>
            Trusted by teachers who run live tests
          </h2>
        </div>
        <p className={styles.splitLead}>
          In their own words, from the teacher videos on the Testkart YouTube channel.
        </p>
      </div>

      <ul className={styles.proofStats} aria-label="Testkart in numbers">
        {LIVE_STATS.map((stat) => (
          <li key={stat.label} className={styles.proofStat}>
            <span className={styles.proofValue}>{stat.value}</span>
            <span className={styles.proofLabel}>{stat.label}</span>
          </li>
        ))}
      </ul>

      <ul className={styles.quotes}>
        {TESTIMONIALS.map((testimonial) => (
          <li key={testimonial.id} className={styles.quote}>
            <div className={styles.film}>
              {playingId === testimonial.id ? (
                <iframe
                  className={styles.filmVideo}
                  src={`https://www.youtube-nocookie.com/embed/${testimonial.videoId}?autoplay=1&rel=0&playsinline=1&modestbranding=1`}
                  title={`${testimonial.academyName} on Testkart`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <button
                  type="button"
                  className={styles.filmPoster}
                  onClick={() => setPlayingId(testimonial.id)}
                  aria-label={`Play the video from ${testimonial.academyName}`}
                >
                  <img src={testimonial.posterUrl} alt="" width={540} height={960} loading="lazy" />
                  <span className={styles.filmPlay}>
                    <Play size={16} fill="currentColor" aria-hidden="true" />
                  </span>
                </button>
              )}
            </div>

            <figure className={styles.quoteBody}>
              <blockquote className={styles.quoteText}>{`“${testimonial.quote}”`}</blockquote>
              <figcaption className={styles.quoteWho}>
                <span className={styles.quoteName}>
                  {testimonial.academyName}
                  <VerifiedBadge isVerified size="sm" color="var(--fc-sage-edge)" />
                </span>
                <span className={styles.quoteMeta}>{testimonial.meta}</span>
                <Link to={testimonial.profilePath} className={styles.quoteLink}>
                  View profile
                  <ArrowUpRight size={14} aria-hidden="true" />
                </Link>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
};

const CREATE_LIVE_TEST_PATH = "/teacher/create-live-test";

/*
 * Where "create a contest" goes. A signed-in teacher or admin opens the live
 * test builder directly; a signed-out visitor signs up and lands on the
 * builder through ?redirectTo. A signed-in student keeps the plain signup link,
 * as the builder would turn them away.
 */
const useContestStartPath = () => {
  const { authState } = useAuth();
  if (authState.type === "authenticated") {
    const { role } = authState.user;
    return role === "teacher" || role === "admin" ? CREATE_LIVE_TEST_PATH : TEACHER_SIGNUP_PATH;
  }
  return `${TEACHER_SIGNUP_PATH}?redirectTo=${encodeURIComponent(CREATE_LIVE_TEST_PATH)}`;
};

const ContestStartLink = ({ children }: { children: React.ReactNode }) => (
  <SellStartLink to={useContestStartPath()}>{children}</SellStartLink>
);

const Tick = () => (
  <span className={styles.tick} aria-hidden="true">
    <Check size={12} strokeWidth={3} />
  </span>
);

const HostLiveExamPage: React.FC = () => (
  <>
    <SEOHead
      title={PAGE_TITLE}
      appendSiteName={false}
      description={PAGE_DESCRIPTION}
      socialTitle={SOCIAL_TITLE}
      socialDescription={SOCIAL_DESCRIPTION}
      url={PAGE_URL}
      robotsExtra="max-image-preview:large"
      lang="en-IN"
    />
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
    </Helmet>

    <div className={`${sellLandingThemeClass} ${styles.page}`}>
      <div className={styles.shell}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <ol>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/teach">Teach on Testkart</Link>
            </li>
            <li aria-current="page">Host Live Exam</li>
          </ol>
        </nav>

        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>For teachers and coaching institutes</span>
            <h1 className={styles.heroTitle}>
              Host Live Mock Test Contests and{" "}
              <span className={styles.heroMark}>Earn From Every Event</span>
            </h1>
            <p className={styles.heroLead}>
              Turn your mock tests into live competitive events. Students compete in real time,
              rankings update as they submit, and Testkart handles prizes, results and payouts.
            </p>
            <div className={styles.heroActions}>
              <ContestStartLink>Create Your First Contest</ContestStartLink>
              <SellDemoButton>Book a Demo</SellDemoButton>
            </div>
            <a href="#how-it-works" className={styles.textLink}>
              See how it works
              <ArrowDown size={16} aria-hidden="true" />
            </a>
            <ul className={styles.heroFacts}>
              {HERO_FACTS.map((fact) => (
                <li key={fact}>
                  <Tick />
                  {fact}
                </li>
              ))}
            </ul>
          </div>

          <LiveContestHeroArt />
        </header>

        <section className={styles.section} aria-labelledby="live-what-title">
          <div className={styles.format}>
            <div className={styles.formatIntro}>
              <p className={styles.kicker}>The format</p>
              <h2 id="live-what-title" className={styles.formatTitle}>
                What is a live mock test contest?
              </h2>
              <p className={styles.formatLead}>
                A live mock test contest is a scheduled, competitive online exam where students
                attempt the same paper at the same time and see where they rank as the contest runs.
              </p>

              <figure className={styles.day}>
                <figcaption className={styles.dayLabel}>An example contest day</figcaption>
                <ol className={styles.dayTrack}>
                  {CONTEST_DAY.map((moment) => (
                    <li key={moment.time} className={styles.dayStop}>
                      <span className={styles.dayTime}>{moment.time}</span>
                      <span className={styles.dayText}>{moment.label}</span>
                    </li>
                  ))}
                </ol>
              </figure>
            </div>

            <ol className={styles.formatGrid}>
              {PILLARS.map(({ title, text }, index) => (
                <li key={title} className={styles.formatItem}>
                  <span className={styles.formatNum} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className={styles.formatItemTitle}>{title}</h3>
                  <p className={styles.formatItemText}>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="live-why-title">
          <div className={styles.splitHead}>
            <div>
              <p className={styles.kicker}>Why host</p>
              <h2 id="live-why-title" className={styles.splitTitle}>
                Why teachers host live contests on Testkart
              </h2>
            </div>
            <p className={styles.splitLead}>
              One contest earns from entry fees, brings new students to your profile and runs
              itself from the first registration to the final payout.
            </p>
          </div>

          <ul className={styles.reasonGrid}>
            {REASONS.map(({ icon: Icon, label, title, text, points }) => (
              <li key={title} className={styles.reason}>
                <div className={styles.reasonTop}>
                  <span className={styles.reasonIcon} aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <span className={styles.reasonLabel}>{label}</span>
                </div>
                <h3 className={styles.reasonTitle}>{title}</h3>
                <p className={styles.reasonText}>{text}</p>
                <ul className={styles.reasonList}>
                  {points.map((point) => (
                    <li key={point}>
                      <Check size={15} strokeWidth={3} aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
        <ProofSection />
      </div>

      <div className={styles.band}>
        <div className={styles.shell}>
          <section className={styles.section} id="how-it-works" aria-labelledby="live-steps-title">
            <SellLandingHeading
              id="live-steps-title"
              eyebrow="How it works"
              title="Go from idea to live event in under an hour"
            />
            <ol className={styles.stepper}>
              {STEPS.map((step, index) => (
                <li key={step.title} className={styles.step}>
                  <div className={styles.stepTop}>
                    <span className={styles.stepNumber} aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className={styles.stepTag}>{step.tag}</span>
                  </div>
                  <div>
                    <h3 className={styles.cardTitle}>
                      <span className={styles.srOnly}>Step {index + 1}: </span>
                      {step.title}
                    </h3>
                    <p className={styles.cardText}>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className={styles.sectionActions}>
              <ContestStartLink>Start Your First Contest</ContestStartLink>
              <SellDemoButton>Book a Demo</SellDemoButton>
            </div>
          </section>
        </div>
      </div>

      <div className={styles.shell}>
        <section className={styles.section} aria-labelledby="live-features-title">
          <SellLandingHeading
            id="live-features-title"
            eyebrow="Features"
            title="Everything you need to run a professional contest"
          />
          <ul className={styles.featureGrid}>
            {FEATURES.map(({ icon: Icon, tone, title, text }) => (
              <li key={title} className={`${styles.feature} ${toneClass(tone)}`}>
                <span className={styles.iconTile} aria-hidden="true">
                  <Icon size={20} />
                </span>
                <div>
                  <h3 className={styles.featureTitle}>{title}</h3>
                  <p className={styles.featureText}>{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="live-types-title">
          <SellLandingHeading
            id="live-types-title"
            eyebrow="Contest types"
            title="Choose the contest format that fits your goal"
          />
          <ul className={styles.typeGrid}>
            {CONTEST_TYPES.map(({ icon: Icon, tone, title, fee, text, bestFor }) => (
              <li key={title} className={`${styles.type} ${toneClass(tone)}`}>
                <div className={styles.typeHead}>
                  <span className={styles.iconTile} aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <span className={styles.typeFee}>{fee}</span>
                </div>
                <div>
                  <h3 className={styles.cardTitle}>{title}</h3>
                  <p className={styles.cardText}>{text}</p>
                </div>
                <div className={styles.bestFor}>
                  <span className={styles.bestForLabel}>Best for</span>
                  <span className={styles.bestForText}>{bestFor}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="live-audience-title">
          <div className={styles.audience}>
            <div className={styles.audienceCopy}>
              <h2 id="live-audience-title">Built for educators of every size</h2>
              <p>
                Whether you teach a handful of students or run a full coaching institute, a live
                contest gives your students a real exam experience and gives you a new way to earn.
              </p>
            </div>
            <ul className={styles.audienceList}>
              {AUDIENCE.map(({ icon: Icon, text }) => (
                <li key={text} className={`${styles.audienceItem} ${toneClass("sage")}`}>
                  <span className={styles.iconTile} aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.section} aria-label="More ways to earn on Testkart">
          <ul className={styles.related}>
            <li className={styles.relatedLabel} aria-hidden="true">
              More ways to earn on Testkart
            </li>
            {RELATED_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className={styles.relatedLink}>
                  {link.label}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={styles.faqSection} aria-labelledby="live-faq-title">
        <div className={styles.faqLayout}>
          <div className={styles.faqIntro}>
            <SellLandingHeading
              id="live-faq-title"
              align="start"
              eyebrow="FAQ"
              title="Live contest FAQs"
              lead="How to conduct a live mock test online on Testkart, from entry fees to rankings."
            />
            <div className={styles.helpCard}>
              <span className={styles.helpIcon} aria-hidden="true">
                <MessageCircleQuestion size={20} />
              </span>
              <p className={styles.helpText}>
                Planning your first contest? Walk through the dashboard with our team.
              </p>
              <SellDemoButton>Book a Demo</SellDemoButton>
            </div>
          </div>
          <div className={styles.faqList}>
            {FAQS.map((faq) => (
              <details key={faq.question} className={styles.faqItem}>
                <summary className={styles.faqQuestion}>
                  <h3 className={styles.faqQuestionText}>{faq.question}</h3>
                  <ChevronDown size={20} className={styles.faqChevron} aria-hidden="true" />
                </summary>
                <p className={styles.faqAnswer}>{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.shell}>
        <section className={styles.closing} aria-labelledby="live-cta-title">
          <div className={styles.closingCopy}>
            <h2 id="live-cta-title">Ready to launch your first live contest?</h2>
            <p>Join the educators turning practice into an exciting, competitive event.</p>
            <div className={styles.closingActions}>
              <ContestStartLink>Start Creating Free</ContestStartLink>
              <SellDemoButton>Book a Demo</SellDemoButton>
            </div>
          </div>
          <ul className={styles.closingFacts}>
            {CLOSING_FACTS.map((fact) => (
              <li key={fact}>
                <Tick />
                {fact}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <WhatsAppBubble />
    </div>
  </>
);

export default HostLiveExamPage;
