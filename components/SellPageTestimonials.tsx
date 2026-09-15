import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, ChevronLeft, ChevronRight, Play } from "lucide-react";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
} from "./Carousel";
import styles from "./SellPageTestimonials.module.css";

interface Testimonial {
  id: string;
  quote: string;
  academyName: string;
  meta: string;
  profilePath: string;
  videoId: string;
  posterUrl: string;
}

/*
 * Quotes are transcribed from the two teacher testimonial shorts on the Testkart
 * YouTube channel, then condensed to a pull quote - disfluencies removed, the
 * auto-caption's mis-hearing of "Testkart" corrected, and the weaker sentences
 * dropped. Nothing is paraphrased; what is left is what the teacher said, and
 * the full remarks are in the videos beside them.
 *
 * Names, taglines and slugs come from the teachers' own profile records, so
 * these cards and their /expert pages stay in step.
 */
const TESTIMONIALS: Testimonial[] = [
  {
    id: "nata-ace-tutorial",
    quote:
      "With the support of Testkart we are able to conduct free online mock tests for NATA with a real exam experience. The platform helps students practise regularly and improve their confidence.",
    academyName: "NATA ACE TUTORIAL",
    meta: "First step towards world of Architecture, Mumbai",
    profilePath: "/expert/nata-ace-tutorial",
    videoId: "C_rlxVEm1cY",
    posterUrl:
      "/_cdn/static/da6b434b-7c59-47c7-9a97-5480c255a681-testimonial-nata-ace-tutorial.jpg",
  },
  {
    id: "deeps-physics-classes",
    quote:
      "I can seamlessly upload all my test series, create live tests and put up every study material, so no student faces any difficulty. Each and every doubt of mine has been solved in a very short span of time.",
    academyName: "Deep’s Physics Classes",
    meta: "IIT JAM and JEST",
    profilePath: "/expert/deepsphysicsclasses",
    videoId: "1TtssJbN6mo",
    posterUrl:
      "/_cdn/static/fca7a37a-bf6d-4076-a55f-443be39afa86-testimonial-deeps-physics-classes.jpg",
  },
];

interface TestimonialCardProps {
  testimonial: Testimonial;
  isPlaying: boolean;
  onPlay: () => void;
}

const TestimonialCard: React.FC<TestimonialCardProps> = ({
  testimonial,
  isPlaying,
  onPlay,
}) => (
  <article className={styles.card}>
    <div className={styles.words}>
      <blockquote className={styles.quote}>
        {`“${testimonial.quote}”`}
      </blockquote>

      <div>
        <hr className={styles.rule} />
        <Link to={testimonial.profilePath} className={styles.who}>
          <span className={styles.whoName}>
            {testimonial.academyName}
            <BadgeCheck className={styles.verifiedIcon} aria-hidden="true" />
            <span className={styles.srOnly}>Verified teacher</span>
          </span>
          <span className={styles.whoMeta}>{testimonial.meta}</span>
        </Link>
      </div>
    </div>

    <div className={styles.film}>
      <div className={styles.frame}>
        {isPlaying ? (
          <iframe
            className={styles.videoEmbed}
            src={`https://www.youtube-nocookie.com/embed/${testimonial.videoId}?autoplay=1&rel=0&playsinline=1&modestbranding=1`}
            title={`${testimonial.academyName} on Testkart`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className={styles.shot}
            onClick={onPlay}
            aria-label={`Play the video from ${testimonial.academyName}`}
          >
            <img
              className={styles.posterImage}
              src={testimonial.posterUrl}
              alt=""
              width={540}
              height={960}
              loading="lazy"
            />
            <span className={styles.playButton}>
              <Play size={22} fill="currentColor" aria-hidden="true" />
            </span>
          </button>
        )}
      </div>
    </div>
  </article>
);

interface SellPageTestimonialsProps {
  className?: string;
}

export const SellPageTestimonials: React.FC<SellPageTestimonialsProps> = ({
  className,
}) => {
  const [api, setApi] = useState<CarouselApi | undefined>(undefined);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const shownIndexRef = useRef(0);

  useEffect(() => {
    if (!api) return;

    /*
     * Swiping away from a slide stops its video, so audio never carries over
     * from a card the visitor has left - but ONLY on a real change of slide.
     * Clearing on every embla event broke playback outright: mounting the
     * iframe resizes the slide, embla answers with reInit, and an unguarded
     * handler tore the iframe back down in the same tick, so a click produced
     * a flash and the poster returned.
     */
    const handleSelect = () => {
      const index = api.selectedScrollSnap();
      setSelectedIndex(index);

      if (index !== shownIndexRef.current) {
        shownIndexRef.current = index;
        setPlayingId(null);
      }
    };

    handleSelect();
    api.on("select", handleSelect);
    api.on("reInit", handleSelect);

    return () => {
      api.off("select", handleSelect);
      api.off("reInit", handleSelect);
    };
  }, [api]);

  const lastIndex = TESTIMONIALS.length - 1;

  return (
    <section className={`${styles.section} ${className || ""}`}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Teachers on the record</h2>

          <div className={styles.nav}>
            <button
              type="button"
              className={styles.navButton}
              onClick={() => api?.scrollPrev()}
              disabled={selectedIndex === 0}
              aria-label="Previous testimonial"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.navButton}
              onClick={() => api?.scrollNext()}
              disabled={selectedIndex === lastIndex}
              aria-label="Next testimonial"
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        <Carousel
          className={styles.carousel}
          opts={{ align: "start", containScroll: "trimSnaps" }}
          setApi={setApi}
        >
          <CarouselContent>
            {TESTIMONIALS.map((testimonial) => (
              <CarouselItem key={testimonial.id} className={styles.slide}>
                <TestimonialCard
                  testimonial={testimonial}
                  isPlaying={playingId === testimonial.id}
                  onPlay={() => setPlayingId(testimonial.id)}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className={styles.dots}>
          {TESTIMONIALS.map((testimonial, index) => (
            <button
              key={testimonial.id}
              type="button"
              className={`${styles.dot} ${
                index === selectedIndex ? styles.dotActive : ""
              }`}
              onClick={() => api?.scrollTo(index)}
              aria-label={`Show the testimonial from ${testimonial.academyName}`}
              aria-current={index === selectedIndex}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
