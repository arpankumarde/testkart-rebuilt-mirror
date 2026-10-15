import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { HomepageLiveTestSpotlight } from "../endpoints/homepage/data_GET.schema";
import { HomepageLiveSpotlightCard } from "./HomepageLiveSpotlightCard";
import styles from "./HomepageLiveSpotlight.module.css";

interface HomepageLiveSpotlightProps {
  spotlights: HomepageLiveTestSpotlight[];
}

/**
 * Snap-scrolling row of live test cards. Overlay arrows, as in Explore Top
 * Exams, fade in only while the pointer is over the row and only on devices
 * that can hover; touch devices scroll by swipe.
 */
export function HomepageLiveSpotlight({ spotlights }: HomepageLiveSpotlightProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanPrev(track.scrollLeft > 4);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateArrows();
    const observer = new ResizeObserver(updateArrows);
    observer.observe(track);
    return () => observer.disconnect();
  }, [updateArrows, spotlights]);

  if (!spotlights || spotlights.length === 0) return null;

  const scrollByCard = (direction: 1 | -1) => {
    const track = trackRef.current;
    const card = track?.firstElementChild;
    if (!track || !card) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({
      left: direction * (card.getBoundingClientRect().width + gap) * 2,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <div className={styles.sectionWrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>Live Competitive Mock Tests</h2>
        <Link to="/live-test" className={styles.viewAllLink}>
          View all →
        </Link>
      </div>
      <div className={styles.carousel}>
        {(canPrev || canNext) && (
          <>
            <button
              type="button"
              className={`${styles.navButton} ${styles.navPrev}`}
              onClick={() => scrollByCard(-1)}
              disabled={!canPrev}
              aria-label="Previous live tests"
              aria-controls="live-spotlight-track"
            >
              <ArrowLeft size={24} strokeWidth={1.75} aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.navButton} ${styles.navNext}`}
              onClick={() => scrollByCard(1)}
              disabled={!canNext}
              aria-label="Next live tests"
              aria-controls="live-spotlight-track"
            >
              <ArrowRight size={24} strokeWidth={1.75} aria-hidden />
            </button>
          </>
        )}
        <div
          id="live-spotlight-track"
          ref={trackRef}
          className={styles.cardsContainer}
          onScroll={updateArrows}
        >
          {spotlights.map((spotlight) => (
            <HomepageLiveSpotlightCard key={spotlight.id} spotlight={spotlight} />
          ))}
        </div>
      </div>
    </div>
  );
}