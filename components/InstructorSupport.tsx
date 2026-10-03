import { Link } from "react-router-dom";
import styles from "./InstructorSupport.module.css";

const ART_LEFT = "/_cdn/static/44694329-307d-4136-a467-03c08fa0ed6d.png";
const ART_RIGHT = "/_cdn/static/b6909452-80c0-463e-a71b-075e81260ba7.png";

/** /teach: centred support message between two illustrations that run to the page edges. */
export const InstructorSupport = () => (
  <section className={styles.section} aria-labelledby="teach-support-title">
    <img src={ART_LEFT} alt="Testkart instructor support team helping a teacher" width={768} height={1024} loading="lazy" decoding="async" className={`${styles.art} ${styles.artLeft}`} />
    <div className={styles.copy}>
      <h2 id="teach-support-title" className={styles.title}>
        You won’t have to do it alone
      </h2>
      <p className={styles.text}>
        Our{" "}
        <Link to="/contact" className={styles.inlineLink}>
          instructor support team
        </Link>{" "}
        is here to help you create better learning experiences. Access{" "}
        <Link to="/help" className={styles.inlineLink}>
          helpful resources
        </Link>
        ,{" "}
        <Link to="/demo" className={styles.inlineLink}>
          video tutorials
        </Link>
        , and a growing community of educators along the way.
      </p>
      <Link to="/help" className={styles.more}>
        Need more details before you start? Learn more.
      </Link>
    </div>
    <img src={ART_RIGHT} alt="" width={768} height={1024} loading="lazy" decoding="async" className={`${styles.art} ${styles.artRight}`} />
  </section>
);