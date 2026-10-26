import React from "react";
import { Plus } from "lucide-react";
import { GEC_FAQS } from "../helpers/govtExamsCalendarData";
import styles from "./GovtExamsFaq.module.css";

/**
 * Native <details> rather than the kit Accordion: Radix unmounts closed panels, and every
 * answer has to stay in the HTML so it is indexable. The first two open by default.
 */
export const GovtExamsFaq: React.FC = () => (
  <section id="faqs" data-gec-section className={styles.section} aria-labelledby="faqs-title">
    <h2 id="faqs-title" className={styles.title}>
      Frequently asked questions
    </h2>
    <div className={styles.list}>
      {GEC_FAQS.map(({ question, answer }, index) => (
        <details key={question} className={styles.item} open={index < 2}>
          <summary className={styles.question}>
            <h3 className={styles.questionText}>{question}</h3>
            <span className={styles.icon} aria-hidden="true">
              <Plus size={18} strokeWidth={2.5} />
            </span>
          </summary>
          <p className={styles.answer}>{answer}</p>
        </details>
      ))}
    </div>
  </section>
);
