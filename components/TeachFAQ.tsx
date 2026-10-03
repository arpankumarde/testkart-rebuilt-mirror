import type { ReactNode } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./Accordion";
import styles from "./TeachFAQ.module.css";

/*
 * `text` is the plain answer used in the FAQPage schema; `answer` is the same
 * words with links for the page. Keep the two identical word for word.
 */
const FAQS: { question: string; text: string; answer?: ReactNode }[] = [
  {
    question: "Is it free to start selling on Testkart?",
    text: "Yes. Creating an account and listing your first items costs nothing.",
  },
  {
    question: "What can I sell on Testkart?",
    text: "Mock tests and test series, live tests, notes, PDFs, eBooks, video courses, and bundles that combine them.",
  },
  {
    question: "How do I get paid?",
    text: "Sales collect in your Testkart wallet. You then withdraw the balance to your bank account.",
  },
  {
    question: "Who decides the price?",
    text: "You do. Each test series, note set, course or bundle can have its own price.",
  },
  {
    question: "Do I need my own website or app?",
    text: "No. Your products are listed in the Testkart store, and students buy and study there.",
  },
  {
    question: "Can I use AI tools to help me create tests?",
    text: "Yes. You can connect ChatGPT, Claude or Perplexity to Testkart, and the video tutorials show how. Always check every question for accuracy yourself before it goes live.",
    answer: (
      <>
        Yes. You can connect ChatGPT, Claude or Perplexity to Testkart, and the{" "}
        <Link to="/demo">video tutorials</Link> show how. Always check every question for accuracy yourself
        before it goes live.
      </>
    ),
  },
  {
    question: "Where can I learn how to use the teacher dashboard?",
    text: "Watch the short video tutorials on the Testkart demo page, or read the written guides in the Help Doc.",
    answer: (
      <>
        Watch the short <Link to="/demo">video tutorials</Link> on the Testkart demo page, or read the written
        guides in the <Link to="/help">Help Doc</Link>.
      </>
    ),
  },
];

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.text },
  })),
};

const COMPARE_LINKS = [
  { name: "Classplus", href: "/compare/classplus-vs-testkart" },
  { name: "Learnyst", href: "/compare/learnyst-vs-testkart" },
  { name: "TagMango", href: "/compare/tagmango-vs-testkart" },
  { name: "Graphy", href: "/compare/graphy-vs-testkart" },
];

/**
 * /teach FAQ. Each question is an H3 (the accordion header) and every answer
 * is force-mounted, so it is in the page HTML before anyone opens it.
 */
export const TeachFAQ = () => (
  <section className={styles.section} aria-labelledby="teach-faq-title">
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(FAQ_JSON_LD)}</script>
    </Helmet>
    <h2 id="teach-faq-title" className={styles.title}>
      Frequently asked questions
    </h2>
    <Accordion type="single" collapsible className={styles.list}>
      {FAQS.map((faq, index) => (
        <AccordionItem key={faq.question} value={`faq-${index + 1}`} className={styles.item}>
          <AccordionTrigger className={styles.question}>{faq.question}</AccordionTrigger>
          <AccordionContent forceMount className={styles.answerWrap}>
            <p className={styles.answer}>{faq.answer ?? faq.text}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
    <p className={styles.compare}>
      Comparing platforms? See how Testkart stacks up against{" "}
      {COMPARE_LINKS.map((link, index) => (
        <span key={link.href}>
          <Link to={link.href} className={styles.compareLink}>
            {link.name}
          </Link>
          {index < COMPARE_LINKS.length - 2 ? ", " : index === COMPARE_LINKS.length - 2 ? " and " : "."}
        </span>
      ))}
    </p>
  </section>
);
