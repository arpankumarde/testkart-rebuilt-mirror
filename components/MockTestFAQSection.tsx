import React from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./Accordion";
import styles from "./MockTestFAQSection.module.css";

export const MockTestFAQSection: React.FC = () => {
  return (
    <section className={styles.faqSection}>
      <div className={styles.header}>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about creating and selling mock tests on Testkart.</p>
      </div>
      <Accordion type="single" collapsible>
        <AccordionItem value="faq-1">
          <AccordionTrigger>How do I create a mock test on Testkart?</AccordionTrigger>
          <AccordionContent>
            Creating a mock test is incredibly simple. Sign up for a free teacher account, go to your dashboard, and click "Create Mock Test". You can build tests manually question-by-question, bulk upload them using our Excel template, or use our AI Question Generator to instantly create high-quality questions based on your syllabus.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="faq-2">
          <AccordionTrigger>What question types are supported?</AccordionTrigger>
          <AccordionContent>
            We support all major question formats needed for competitive exams in India. This includes Single Correct MCQ, Multiple Correct MCQ (like JEE Advanced), Numerical Value, Assertion & Reason, Comprehension/Passage-based questions, and Match the Following.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="faq-3">
          <AccordionTrigger>How does the AI question generator work?</AccordionTrigger>
          <AccordionContent>
            Our advanced AI tool allows you to specify a topic, difficulty level, and exam type. It will automatically generate relevant, unique questions along with correct options, distractors, and detailed step-by-step explanations. You can review and edit these questions before adding them to your test.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="faq-4">
          <AccordionTrigger>How much does it cost to sell mock tests?</AccordionTrigger>
          <AccordionContent>
            It is completely free to create and publish your mock tests on Testkart! There are zero upfront costs or monthly fees. We operate on a revenue-share model, meaning we only make money when you make a sale. You keep up to 85% of your sales revenue.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="faq-5">
          <AccordionTrigger>How and when do I get paid?</AccordionTrigger>
          <AccordionContent>
            Earnings are calculated transparently in your dashboard. You receive payouts every week directly to your verified bank account. We handle all payment gateway charges and invoicing.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="faq-6">
          <AccordionTrigger>Can I offer detailed analytics to my students?</AccordionTrigger>
          <AccordionContent>
            Yes! Students automatically get access to best-in-class analytics upon completing a test. This includes their score, section-wise performance, time spent per question, accuracy breakdown, and their rank/percentile compared to all other students who took the same test.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="faq-7">
          <AccordionTrigger>Can I bulk upload questions?</AccordionTrigger>
          <AccordionContent>
            Absolutely. If you already have question banks, you can download our standardized Excel template, paste your questions, options, and explanations into it, and upload hundreds of questions in just a few clicks.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="faq-8">
          <AccordionTrigger>Can I bundle tests together?</AccordionTrigger>
          <AccordionContent>
            Yes, you can group multiple mock tests into a "Test Series" bundle and sell it at a discounted price. This is a highly effective way to increase your average order value and provide comprehensive preparation packages to students.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
};