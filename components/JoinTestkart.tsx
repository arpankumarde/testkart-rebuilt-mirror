import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, Lightbulb, CheckCircle2, Sparkles, GraduationCap, Users, Presentation } from "lucide-react";
import styles from "./JoinTestkart.module.css";

/**
 * Join Testkart CTA section - community-focused enrollment call-to-action
 * with decorative learning-themed elements around a centered message.
 */
export function JoinTestkart() {
  return (
    <section className={styles.section} aria-labelledby="join-testkart-title">
      <div className={styles.container}>
        {/* Decorative floating elements */}
        <div className={styles.decorativeElements}>
          {/* Top left corner elements */}
          <div className={styles.element} style={{ top: "5%", left: "3%", animationDelay: "0s" }}>
            <div className={styles.blob} style={{ backgroundColor: "hsl(173 80% 40% / 0.15)" }} />
          </div>

          {/* Small icon - exam papers */}
          <div className={styles.element} style={{ top: "8%", left: "8%", animationDelay: "0.3s" }}>
            <div className={styles.iconWrapper} style={{ color: "hsl(142 71% 45%)" }}>
              <BookOpen size={24} strokeWidth={1.5} />
            </div>
          </div>

          {/* Small icon - lightbulb (ideas) */}
          <div className={styles.element} style={{ top: "15%", right: "6%", animationDelay: "0.6s" }}>
            <div className={styles.iconWrapper} style={{ color: "hsl(38 92% 50%)" }}>
              <Lightbulb size={20} strokeWidth={1.5} />
            </div>
          </div>

          {/* Circle accent - top right */}
          <div className={styles.element} style={{ top: "10%", right: "3%", animationDelay: "0.4s" }}>
            <div className={styles.circle} style={{ backgroundColor: "hsl(204 92% 50% / 0.12)" }} />
          </div>

          {/* Small icon - checkmark (success) */}
          <div className={styles.element} style={{ bottom: "12%", left: "4%", animationDelay: "0.5s" }}>
            <div className={styles.iconWrapper} style={{ color: "hsl(142 71% 45%)" }}>
              <CheckCircle2 size={22} strokeWidth={1.5} />
            </div>
          </div>

          {/* Blob - bottom left */}
          <div className={styles.element} style={{ bottom: "8%", left: "2%", animationDelay: "0.2s" }}>
            <div className={styles.blob} style={{ backgroundColor: "hsl(260 75% 65% / 0.1)" }} />
          </div>

          {/* Small icon - sparkles */}
          <div className={styles.element} style={{ bottom: "18%", right: "5%", animationDelay: "0.7s" }}>
            <div className={styles.iconWrapper} style={{ color: "hsl(38 92% 50%)" }}>
              <Sparkles size={18} strokeWidth={1.5} />
            </div>
          </div>

          {/* Circle accent - bottom right */}
          <div className={styles.element} style={{ bottom: "6%", right: "3%", animationDelay: "0.3s" }}>
            <div className={styles.circle} style={{ backgroundColor: "hsl(173 80% 40% / 0.08)" }} />
          </div>

          {/* Medium icon - graduation (achievement) */}
          <div className={styles.element} style={{ top: "35%", right: "2%", animationDelay: "0.4s" }}>
            <div className={styles.iconWrapper} style={{ color: "hsl(260 75% 65%)" }}>
              <GraduationCap size={26} strokeWidth={1.5} />
            </div>
          </div>

          {/* Small icon - people (community) */}
          <div className={styles.element} style={{ top: "50%", left: "1.5%", animationDelay: "0.6s" }}>
            <div className={styles.iconWrapper} style={{ color: "hsl(204 92% 50%)" }}>
              <Users size={20} strokeWidth={1.5} />
            </div>
          </div>
        </div>

        {/* Main content card */}
        <div className={styles.card}>
          <div className={styles.content}>
            <h2 id="join-testkart-title" className={styles.headline}>
              Join Testkart
            </h2>

            <p className={styles.description}>
              Prepare smarter, practice better, and connect with a growing community of learners. Explore tests,
              improve your skills, and take your preparation to the next level.
            </p>

            <div className={styles.ctaWrapper}>
              <Link to="/signup" className={styles.cta}>
                <GraduationCap size={18} strokeWidth={2} aria-hidden="true" />
                I’m a Student
              </Link>
              <Link to="/teacher/signup" className={`${styles.cta} ${styles.ctaTeacher}`}>
                <Presentation size={18} strokeWidth={2} aria-hidden="true" />
                I’m a Teacher
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
