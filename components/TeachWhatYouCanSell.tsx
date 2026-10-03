import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import styles from "./TeachWhatYouCanSell.module.css";

/*
 * Each card leads with a generated ink-and-peach doodle (1024x1024 on white),
 * drawn to match the illustrations in TeachingReasons. Decorative: the H3 next
 * to it already names the product, so alt is empty.
 */
const PRODUCTS = [
  {
    art: "/_cdn/static/2ddb5b75-35d5-4f72-9bce-041fdfec4b9c.png",
    title: "Mock tests and test series",
    body: "Build timed tests section by section. Students see their score and the correct answers as soon as they submit. This works well for exam-focused series where aspirants want a lot of practice papers.",
    linkLabel: "Create and sell mock tests",
    href: "/sell/mock-test",
  },
  {
    art: "/_cdn/static/a3615c14-948a-4eb5-9a4a-575e6a771d95.png",
    title: "Live tests",
    body: "Pick a date and time and let every student sit the test together. Results appear on a live leaderboard, so students get a feel for real exam pressure and a rank to work towards.",
    linkLabel: "Host a live mock test",
    href: "/sell/host-live-exam",
  },
  {
    art: "/_cdn/static/317b32f0-735c-44a1-a5bf-af67a6fb434e.png",
    title: "Notes, PDFs and eBooks",
    body: "Upload the notes, PDFs and eBooks you already have. Students buy them and read them inside Testkart.",
    linkLabel: "Sell study notes and PDFs",
    href: "/sell/study-notes-pdfs",
  },
  {
    art: "/_cdn/static/0a182304-95c9-4f27-9cd1-4db5d8732b42.png",
    title: "Video courses",
    body: "Arrange lessons into sections, attach PDFs next to each lesson, and sell the whole course as one item.",
    linkLabel: "Create and sell online courses",
    href: "/sell/courses",
  },
  {
    art: "/_cdn/static/9d574d8b-0924-4c37-b0a3-5b8a6f8b00ce.png",
    title: "Bundles",
    body: "Put tests, notes and a course together in one pack at one price. Bundles suit students who want everything for one exam in a single purchase.",
    linkLabel: "Course bundles",
    href: "/bundles",
  },
];

/** /teach: the five things a teacher can sell, each card linking to its product page. */
export const TeachWhatYouCanSell = () => (
  <section className={styles.section} aria-labelledby="what-you-can-sell">
    <h2 id="what-you-can-sell" className={styles.title}>
      What you can sell on Testkart
    </h2>
    <ul className={styles.grid}>
      {PRODUCTS.map((product) => (
        <li key={product.href} className={styles.card}>
          <img
            src={product.art}
            alt=""
            width={1024}
            height={1024}
            loading="lazy"
            decoding="async"
            className={styles.art}
          />
          <h3 className={styles.cardTitle}>{product.title}</h3>
          <p className={styles.cardBody}>{product.body}</p>
          <Link to={product.href} className={styles.cardLink}>
            {product.linkLabel}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  </section>
);
