import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "./Button";
import { BookDemoButton } from "./BookDemoButton";
import { useAuth } from "../helpers/useAuth";
import { R2_PUBLIC_URL } from "../helpers/_publicConfigs";
import styles from "./TeacherCtaBanner.module.css";

/**
 * Same artwork the Book-a-demo card uses. Reusing it is the point: this banner
 * and that card make the same ask, so they should read as one campaign rather
 * than two unrelated components. Host comes from the shared R2 config so it
 * follows the CDN, not this file.
 */
const ART_URL = `https://${R2_PUBLIC_URL}/marketing-assets/home-demo-cta-popup.png`;
/** Intrinsic size of the asset — set on the <img> so the banner reserves space. */
const ART_WIDTH = 400;
const ART_HEIGHT = 300;

interface TeacherCtaBannerProps {
  /** Applied to the outer wrapper — use it for page-level margins only. */
  className?: string;
  /**
   * Render for signed-out visitors only. The default already drops the banner
   * for signed-in teachers; this also drops it for signed-in students and
   * admins. Set on /expert/<slug>, where the ask sits inside someone else's
   * profile and is only worth making to a visitor with no account at all.
   */
  guestsOnly?: boolean;
}

/**
 * The teacher-acquisition CTA that closes the asset detail pages: courses,
 * mock tests, live tests, study notes and bundles. It replaced EarnBanner,
 * which carried a single "Start Teaching" link and none of the brand block.
 *
 * Two actions, deliberately unequal: booking a demo is the low-commitment ask
 * and gets the solid button; signing up is the bigger one and sits in outline.
 * The demo button opens the single shared dialog mounted by BookDemoPopup, so
 * there is never a second copy of that form in the tree.
 *
 * Nothing renders for a signed-in teacher: both actions ask them to become
 * something they already are, and "Join as a teacher" only bounced them back
 * to their own dashboard. Same call TestCard and CourseCard make when they drop
 * the purchase controls for a teacher. Admins still see it, so previewing a
 * product page shows what a visitor sees — unless the caller passes guestsOnly,
 * which narrows the audience to signed-out visitors.
 */
export const TeacherCtaBanner = ({
  className,
  guestsOnly = false,
}: TeacherCtaBannerProps) => {
  const { authState } = useAuth();

  if (
    authState.type === "authenticated" &&
    (guestsOnly || authState.user.role === "teacher")
  ) {
    return null;
  }

  return (
    <aside
      className={`${styles.banner} ${className ?? ""}`.trim()}
      aria-label="Teach on Testkart"
    >
      <div className={styles.card}>
        <div className={styles.content}>
          <span className={styles.chip}>For teachers</span>

          <h2 className={styles.title}>Earn from what you teach</h2>

          <p className={styles.description}>
            Publish your mock tests, study notes and courses on Testkart, set
            your own price, and earn on every sale. Free to start.
          </p>

          <div className={styles.actions}>
            <BookDemoButton
              size="lg"
              variant="primary"
              className={styles.primaryCta}
            >
              Book a demo
            </BookDemoButton>

            <Button
              asChild
              size="lg"
              variant="outline"
              className={styles.secondaryCta}
            >
              <Link to="/teacher/signup">
                Join as a teacher <ArrowRight size={18} />
              </Link>
            </Button>
          </div>
        </div>

        {/* Decorative: the headline already carries the message, so an empty
            alt keeps screen readers from announcing a filename. */}
        <img
          src={ART_URL}
          alt=""
          width={ART_WIDTH}
          height={ART_HEIGHT}
          loading="lazy"
          decoding="async"
          className={styles.art}
        />
      </div>
    </aside>
  );
};
