import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { CalendarCheck, Search, Sparkles } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./Accordion";
import {
  BOOKING_MIN_NOTICE_MINUTES,
  FREE_CANCELLATION_CUTOFF_HOURS,
  FULL_SESSION_MINUTES,
  JOIN_WINDOW_MINUTES_BEFORE,
  MENTORSHIP_MIN_CLASS_PRICE,
  MENTORSHIP_TRIAL_DISCOUNT_PERCENT,
  PACKAGE_MAX_CLASSES_PER_WEEK,
  PACKAGE_WEEKS,
  SHORT_SESSION_MINUTES,
} from "../helpers/liveLessonConfig";
import type { ExpertSubject } from "../endpoints/experts/subjects_GET.schema";
import styles from "./ExpertDirectoryContent.module.css";

/*
 * Every fact below comes from helpers/liveLessonConfig (price floors, trial discount,
 * cancellation cutoff, booking notice, join window, plan size), so the copy follows the product
 * when those rules change. The verification answer reflects the live-teaching approval that
 * gates the directory (helpers/bookableTutorCondition).
 */
const FAQS: { question: string; answer: string }[] = [
  {
    question: "How does the trial session work?",
    answer: `Your first class with each tutor is a trial. Choose a short session (${SHORT_SESSION_MINUTES} min) or a full session (${FULL_SESSION_MINUTES} min) and pick a time from the tutor's open slots. The trial is a paid class, but tutors can offer it at a discount: ${MENTORSHIP_TRIAL_DISCOUNT_PERCENT[SHORT_SESSION_MINUTES]}% off the short session or ${MENTORSHIP_TRIAL_DISCOUNT_PERCENT[FULL_SESSION_MINUTES]}% off the full session. After the trial you can continue with the same tutor on a plan.`,
  },
  {
    question: "How much do 1:1 sessions cost?",
    answer: `Each tutor sets their own price for a short session and a full session, starting from ₹${MENTORSHIP_MIN_CLASS_PRICE[SHORT_SESSION_MINUTES]} and ₹${MENTORSHIP_MIN_CLASS_PRICE[FULL_SESSION_MINUTES]}. Each tutor card shows the lowest trial price. After the trial, plans run for ${PACKAGE_WEEKS} weeks with 1 to ${PACKAGE_MAX_CLASSES_PER_WEEK} classes a week.`,
  },
  {
    question: "How are tutors verified?",
    answer:
      "Every tutor listed here applied to teach live classes and was approved by the Testkart team before they could take bookings. Tutors with the Verified badge have also been verified by Testkart. Tick Verified tutors only to see just them.",
  },
  {
    question: "Can I reschedule a session?",
    answer: `Yes. You can reschedule or cancel a class up to ${FREE_CANCELLATION_CUTOFF_HOURS} hours before it starts with no penalty. The new time must be at least ${BOOKING_MIN_NOTICE_MINUTES} minutes away. A class cancelled later than that, or missed, is charged in full.`,
  },
  {
    question: "What do I need to attend a session?",
    answer: `A phone or computer with a camera, a microphone and a steady internet connection. Classes run in the Testkart online classroom in your web browser, with video, chat and a shared whiteboard. You can join from your classes page ${JOIN_WINDOW_MINUTES_BEFORE} minutes before the start time.`,
  },
];

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

const STEPS = [
  { icon: Search, tone: "lavender", title: "Browse and filter", text: "Compare tutors by subject, price and ratings." },
  { icon: CalendarCheck, tone: "mint", title: "Book a trial session", text: "Pick a time that suits you with your preferred tutor." },
  { icon: Sparkles, tone: "blue", title: "Keep learning", text: "Continue your classes with the tutor you choose." },
];

const joinList = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

const subjectSearchPath = (label: string) => `/expert?search=${encodeURIComponent(label)}`;

/**
 * The crawlable copy under the tutor listing on /expert: intro, how it works, subject links built
 * from what bookable tutors actually list, and the FAQ with its FAQPage data.
 */
export const ExpertDirectoryContent: React.FC<{ subjects: ExpertSubject[] }> = ({ subjects }) => {
  const featured = subjects.slice(0, 4).map((s) => s.label);

  return (
    <div className={styles.root}>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(FAQ_JSON_LD)}</script>
      </Helmet>

      <section className={`${styles.section} ${styles.split}`} aria-labelledby="expert-intro-title">
        <h2 id="expert-intro-title" className={styles.title}>
          Online 1:1 tutoring on Testkart
        </h2>
        <p className={styles.intro}>
          Testkart tutors teach live, private video classes for school subjects and competitive exam preparation.
          {featured.length > 0 && ` Subjects on offer right now include ${joinList(featured)}.`} Every tutor card
          shows the tutor's subjects, languages, ratings and starting price, so you can compare tutors before you
          book. Choose a short session ({SHORT_SESSION_MINUTES} min) or a full session ({FULL_SESSION_MINUTES} min),
          and pick a time from the tutor's open slots. Your first
          class with each tutor is a trial, and some tutors offer it at a discount. If the tutor suits you,
          continue with a {PACKAGE_WEEKS}-week plan of 1 to {PACKAGE_MAX_CLASSES_PER_WEEK} classes a week, all
          held in the Testkart online classroom.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="expert-steps-title">
        <h2 id="expert-steps-title" className={styles.title}>
          How it works
        </h2>
        <ol className={styles.steps}>
          {STEPS.map(({ icon: Icon, tone, title, text }, index) => (
            <li key={title} className={styles.step}>
              <span className={`${styles.stepIcon} ${styles[`tone_${tone}`]}`} aria-hidden="true">
                <Icon size={20} />
              </span>
              <div>
                <span className={styles.stepNumber}>Step {index + 1}</span>
                <h3 className={styles.stepTitle}>{title}</h3>
                <p className={styles.stepText}>{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {subjects.length > 0 && (
        <section className={styles.section} aria-labelledby="expert-subjects-title">
          <h2 id="expert-subjects-title" className={styles.title}>
            Browse tutors by exam or subject
          </h2>
          <ul className={styles.subjects}>
            {subjects.map((subject) => (
              <li key={subject.label}>
                <Link
                  to={subjectSearchPath(subject.label)}
                  className={styles.subjectLink}
                  aria-label={`${subject.label} tutors: ${subject.count} ${subject.count === 1 ? "tutor" : "tutors"}`}
                >
                  {subject.label} tutors
                  <span className={styles.subjectCount} aria-hidden="true">
                    {subject.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${styles.section} ${styles.split}`} aria-labelledby="expert-faq-title">
        <h2 id="expert-faq-title" className={styles.title}>
          Frequently asked questions
        </h2>
        <Accordion type="single" collapsible className={styles.faqList}>
          {FAQS.map((faq, index) => (
            <AccordionItem key={faq.question} value={`faq-${index + 1}`} className={styles.faqItem}>
              <AccordionTrigger className={styles.faqQuestion}>{faq.question}</AccordionTrigger>
              <AccordionContent forceMount className={styles.faqAnswerWrap}>
                <p className={styles.faqAnswer}>{faq.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
};
