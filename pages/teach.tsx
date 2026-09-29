import { SEOHead } from "../components/SEOHead";
import { TeachHero } from "../components/TeachHero";
import { TeachingReasons } from "../components/TeachingReasons";
import { TeachStats } from "../components/TeachStats";
import { HowToBegin } from "../components/HowToBegin";
import { InstructorTestimonial } from "../components/InstructorTestimonial";
import { InstructorSupport } from "../components/InstructorSupport";
import { TeachFinalCTA } from "../components/TeachFinalCTA";
import styles from "./teach.module.css";

export default function TeachPage() {
  return (
    <div className={styles.page}>
      <SEOHead
        title="Teach on Testkart"
        description="Share what you know with students across India. Create mock tests, test series, notes and courses on Testkart, set your own price and earn on every sale."
      />
      <TeachHero />
      <TeachingReasons />
      <TeachStats />
      <HowToBegin />
      <InstructorTestimonial />
      <InstructorSupport />
      <TeachFinalCTA />
    </div>
  );
}