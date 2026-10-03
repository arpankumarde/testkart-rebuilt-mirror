import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./InstructorTestimonial.module.css";

/*
 * Real teachers, real words: the quotes, names and profile slugs are the ones
 * SellPageTestimonials transcribed from the teachers' testimonial shorts, so
 * keep the two in step. Photos are stills from those videos, cropped above the
 * burnt-in captions and shown in black and white.
 */
const TESTIMONIALS = [
  {
    id: "deeps-physics-classes",
    quote:
      "I can seamlessly upload all my test series, create live tests and put up every study material, so no student faces any difficulty. Each and every doubt of mine has been solved in a very short span of time.",
    name: "Deep’s Physics Classes",
    subjects: "IIT JAM and JEST",
    profilePath: "/expert/deepsphysicsclasses",
    alt: "Deep’s Physics Classes, an IIT JAM and JEST teacher on Testkart",
    photo: "/_cdn/static/fca7a37a-bf6d-4076-a55f-443be39afa86-testimonial-deeps-physics-classes.jpg",
    focus: "50% 52%",
  },
  {
    id: "nata-ace-tutorial",
    quote:
      "With the support of Testkart we are able to conduct free online mock tests for NATA with a real exam experience. The platform helps students practise regularly and improve their confidence.",
    name: "NATA ACE Tutorial",
    subjects: "NATA, Architecture",
    profilePath: "/expert/nata-ace-tutorial",
    alt: "NATA ACE Tutorial, a NATA and architecture teacher on Testkart",
    photo: "/_cdn/static/da6b434b-7c59-47c7-9a97-5480c255a681-testimonial-nata-ace-tutorial.jpg",
    focus: "50% 30%",
  },
];

/** /teach: one teacher at a time, photo left and pull quote right, with round arrows to step through. */
export const InstructorTestimonial = () => {
  const [index, setIndex] = useState(0);
  const count = TESTIMONIALS.length;
  const current = TESTIMONIALS[index];
  const step = (delta: number) => setIndex((i) => (i + delta + count) % count);

  return (
    <section className={styles.section} aria-roledescription="carousel" aria-labelledby="teach-testimonial-title">
      <h2 id="teach-testimonial-title" className={styles.title}>
        What teachers say about Testkart
      </h2>
      <div className={styles.band}>
        <div className={styles.inner}>
          <figure
            key={current.id}
            className={styles.slide}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${count}`}
            aria-live="polite"
          >
            <div className={styles.photoFrame}>
              <img
                src={current.photo}
                alt={current.alt}
                width={540}
                height={960}
                loading="lazy"
                decoding="async"
                className={styles.photo}
                style={{ objectPosition: current.focus }}
              />
            </div>
            <div className={styles.words}>
              <blockquote className={styles.quote}>
                <p>{`“${current.quote}”`}</p>
              </blockquote>
              <figcaption className={styles.caption}>
                <Link to={current.profilePath} className={styles.name}>
                  {current.name}
                </Link>
                <span className={styles.subjects}>{current.subjects}</span>
              </figcaption>
            </div>
          </figure>

          {count > 1 && (
            <div className={styles.nav}>
              <button type="button" className={`${styles.arrow} ${styles.prev}`} onClick={() => step(-1)} aria-label="Previous teacher">
                <ChevronLeft size={22} aria-hidden="true" />
              </button>
              <button type="button" className={`${styles.arrow} ${styles.next}`} onClick={() => step(1)} aria-label="Next teacher">
                <ChevronRight size={22} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};