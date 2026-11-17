import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Play, Quote } from "lucide-react";
import { TESTIMONIALS } from "./SellPageTestimonials";
import { VerifiedBadge } from "./VerifiedBadge";
import { SellLandingHeading } from "./SellLandingHeading";
import styles from "./SellLandingTestimonials.module.css";

const TONES = [styles.lavender, styles.mint, styles.peach, styles.blue];

type SellLandingTestimonialsProps = {
  eyebrow?: string;
  title?: React.ReactNode;
  lead?: React.ReactNode;
  className?: string;
};

export const SellLandingTestimonials = ({
  eyebrow = "From our educators",
  title = "Made for People Who Love Teaching.",
  lead = "In their own words, from the teacher videos on the Testkart YouTube channel.",
  className,
}: SellLandingTestimonialsProps = {}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);

  return (
    <section
      className={`${styles.section} ${className ?? ""}`}
      aria-labelledby="sell-testimonials-title"
    >
      <div className={styles.container}>
        <SellLandingHeading
          id="sell-testimonials-title"
          eyebrow={eyebrow}
          title={title}
          lead={lead}
        />

        <ul className={styles.grid}>
          {TESTIMONIALS.map((testimonial, index) => {
            const isPlaying = playingId === testimonial.id;

            return (
              <li
                key={testimonial.id}
                className={`${styles.card} ${TONES[index % TONES.length]}`}
              >
                <div className={styles.film}>
                  {isPlaying ? (
                    <iframe
                      className={styles.video}
                      src={`https://www.youtube-nocookie.com/embed/${testimonial.videoId}?autoplay=1&rel=0&playsinline=1&modestbranding=1`}
                      title={`${testimonial.academyName} on Testkart`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <button
                      type="button"
                      className={styles.poster}
                      onClick={() => setPlayingId(testimonial.id)}
                      aria-label={`Play the video from ${testimonial.academyName}`}
                    >
                      <img
                        src={testimonial.posterUrl}
                        alt=""
                        width={540}
                        height={960}
                        loading="lazy"
                      />
                      <span className={styles.play}>
                        <Play size={18} fill="currentColor" aria-hidden="true" />
                      </span>
                    </button>
                  )}
                </div>

                <div className={styles.words}>
                  <span className={styles.quoteMark} aria-hidden="true">
                    <Quote size={18} />
                  </span>
                  <blockquote className={styles.quote}>
                    {`"${testimonial.quote}"`}
                  </blockquote>

                  <Link to={testimonial.profilePath} className={styles.who}>
                    <span className={styles.whoName}>
                      {testimonial.academyName}
                      <VerifiedBadge
                        isVerified
                        size="sm"
                        color="var(--sl-ink)"
                      />
                    </span>
                    <span className={styles.whoMeta}>{testimonial.meta}</span>
                    <span className={styles.whoLink}>
                      View profile <ArrowUpRight size={14} aria-hidden="true" />
                    </span>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};
