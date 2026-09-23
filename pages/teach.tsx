import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ImageIcon, PlayCircle } from "lucide-react";
import { SEOHead } from "../components/SEOHead";
import { Button } from "../components/Button";
import { BookDemoButton } from "../components/BookDemoButton";
import { TeacherCtaBanner } from "../components/TeacherCtaBanner";
import { TeacherVideoFrame } from "../components/TeacherVideoFrame";
import { useAuth } from "../helpers/useAuth";
import { useInView } from "../helpers/useInView";
import {
  TEACHER_STORY_VIDEO,
  TEACHER_TESTIMONIAL_SHORTS,
  findTeacherVideo,
} from "../helpers/teacherVideos";
import styles from "./teach.module.css";

/**
 * Artwork for each graphic slot. null renders a labelled placeholder at the
 * final size, so dropping in a URL here is the whole swap.
 */
const ART: Record<string, string | null> = {
  hero: null,
  tests: null,
  live: null,
  notes: null,
  courses: null,
  bundles: null,
};

const ArtSlot = ({ slot, label, className }: { slot: string; label: string; className?: string }) => {
  const src = ART[slot];
  return (
    <figure className={`${styles.art} ${className ?? ""}`.trim()}>
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" className={styles.artImage} />
      ) : (
        <figcaption className={styles.artPlaceholder}>
          <ImageIcon size={28} aria-hidden="true" />
          <span>{label}</span>
        </figcaption>
      )}
    </figure>
  );
};

const PRODUCTS = [
  {
    key: "tests",
    title: "Mock tests and test series",
    body: "Build timed tests section by section, or draft questions with AI and edit them. Students see their score and the answers as soon as they submit.",
    art: "Screenshot: the test series builder",
    videoId: "Jdz4LRGt2bQ",
  },
  {
    key: "live",
    title: "Live tests",
    body: "Hold a test at a fixed date and time. Everyone sits it together and lands on a live leaderboard.",
    art: "Screenshot: a live test leaderboard",
    videoId: "Q4rLMYnTQAc",
  },
  {
    key: "notes",
    title: "Notes and PDFs",
    body: "Upload the notes, PDFs and eBooks you already have. Students buy them and read them on Testkart.",
    art: "Screenshot: a notes listing",
    videoId: "aQg3lFftXi8",
  },
  {
    key: "courses",
    title: "Video courses",
    body: "Arrange lessons into sections, attach PDFs alongside, and sell the whole course as one item.",
    art: "Screenshot: a course curriculum",
    videoId: "guide-course-sections",
  },
  {
    key: "bundles",
    title: "Bundles",
    body: "Put tests, notes and courses together in one pack at one price.",
    art: "Screenshot: a bundle page",
    videoId: null,
  },
] as const;

const STEPS = [
  {
    title: "Create your free account",
    body: "Sign up with your mobile number and email, then fill in your teaching profile.",
  },
  {
    title: "Add what you teach",
    body: "Build a test series, upload notes or put together a course. The videos show each screen.",
  },
  {
    title: "We check it",
    body: "Our team reviews each new item before it goes on sale, so the store stays worth trusting.",
  },
  {
    title: "Students buy, you get paid",
    body: "You set the price. Earnings collect in your Testkart wallet and you withdraw them to your bank.",
  },
];

const Steps = () => {
  const [ref, inView] = useInView<HTMLOListElement>({ threshold: 0.4 });
  return (
    <ol ref={ref} className={`${styles.steps} ${inView ? styles.stepsMarked : ""}`.trim()}>
      {STEPS.map((step, index) => (
        <li key={step.title} className={styles.step} style={{ "--step": index } as React.CSSProperties}>
          <span className={styles.bubble} aria-hidden="true">
            {index + 1}
          </span>
          <h3 className={styles.stepTitle}>
            <span className={styles.srOnly}>Step {index + 1}: </span>
            {step.title}
          </h3>
          <p className={styles.stepBody}>{step.body}</p>
        </li>
      ))}
    </ol>
  );
};

export default function TeachPage() {
  const { authState } = useAuth();
  const isTeacher = authState.type === "authenticated" && authState.user.role === "teacher";

  return (
    <div className={styles.page}>
      <SEOHead
        title="Teach on Testkart"
        description="Sell your mock tests, live tests, notes, PDFs and courses to students across India. Set your own price and get paid on every sale. Free to start."
      />

      <section className={styles.hero}>
        <div className={styles.heroText}>
          <h1 className={styles.title}>Sell the tests and notes you already make</h1>
          <p className={styles.lead}>
            Put your mock tests, notes and courses in front of students preparing for exams across India. You set the
            price and earn on every sale. It is free to start.
          </p>
          <div className={styles.actions}>
            {isTeacher ? (
              <Button asChild size="lg">
                <Link to="/teacher/dashboard">
                  Go to your dashboard <ArrowRight size={18} />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link to="/teacher/signup">
                  Join as a teacher <ArrowRight size={18} />
                </Link>
              </Button>
            )}
            <BookDemoButton />
          </div>
          <Link to="/demo" className={styles.textLink}>
            <PlayCircle size={18} aria-hidden="true" />
            Watch how it works
          </Link>
        </div>
        <ArtSlot slot="hero" label="Hero graphic: a teacher's test on a student's phone" className={styles.heroArt} />
      </section>

      <section className={styles.section} aria-labelledby="sell-heading">
        <h2 id="sell-heading" className={styles.sectionTitle}>
          What you can sell
        </h2>
        <div className={styles.products}>
          {PRODUCTS.map((product) => {
            const video = product.videoId ? findTeacherVideo(product.videoId) : undefined;
            return (
              <article key={product.key} className={styles.product}>
                <ArtSlot slot={product.key} label={product.art} />
                <h3 className={styles.productTitle}>{product.title}</h3>
                <p className={styles.productBody}>{product.body}</p>
                {video && (
                  <Link to={`/demo?v=${video.id}`} className={styles.textLink}>
                    <PlayCircle size={18} aria-hidden="true" />
                    Watch: {video.title}
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.stepsBlock} aria-labelledby="steps-heading">
        <div className={styles.stepsInner}>
          <h2 id="steps-heading" className={styles.stepsHeading}>
            From sign-up to your first sale
          </h2>
          <Steps />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="stories-heading">
        <h2 id="stories-heading" className={styles.sectionTitle}>
          Hear it from teachers
        </h2>
        <div className={styles.stories}>
          <figure className={styles.story}>
            <TeacherVideoFrame video={TEACHER_STORY_VIDEO} />
            <figcaption className={styles.caption} lang="hi-Latn">
              {TEACHER_STORY_VIDEO.title} (Hindi)
            </figcaption>
          </figure>
          {TEACHER_TESTIMONIAL_SHORTS.map((video) => (
            <figure key={video.id} className={styles.short}>
              <TeacherVideoFrame video={video} shape="tall" />
              <figcaption className={styles.caption}>{video.title}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <TeacherCtaBanner className={styles.cta} />
    </div>
  );
}
