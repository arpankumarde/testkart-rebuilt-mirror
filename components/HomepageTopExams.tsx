import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Atom,
  BriefcaseBusiness,
  Calculator,
  Cog,
  GraduationCap,
  Hospital,
  Landmark,
  Laptop,
  Presentation,
  ShieldCheck,
  Stethoscope,
  University,
} from "lucide-react";
import { ExamCategoryCard, type ExamCategory } from "./ExamCategoryCard";
import styles from "./HomepageTopExams.module.css";

// One entry per card; add an exam here and it joins the carousel.
const TOP_EXAMS: ExamCategory[] = [
  { name: "NEET UG", route: "/exams/neet-ug", icon: Stethoscope, accentColor: "#F9B99A" },
  { name: "UGC NET", route: "/exams/ugc-net", icon: GraduationCap, accentColor: "#C8B6F2" },
  { name: "JEE Main", route: "/exams/jee-main", icon: Calculator, accentColor: "#A9DCC8" },
  { name: "UPSC CSE", route: "/exams/upsc-cse", icon: Landmark, accentColor: "#A9DCEB" },
  { name: "SSC CGL", route: "/exams/ssc-cgl", icon: BriefcaseBusiness, accentColor: "#F4DFA3" },
  { name: "JEE Advanced", route: "/exams/jee-advanced", icon: Atom, accentColor: "#E8B7C8" },
  { name: "CTET", route: "/exams/ctet", icon: Presentation, accentColor: "#BFD8C2" },
  { name: "SSC GD", route: "/exams/ssc-gd", icon: ShieldCheck, accentColor: "#B8CDE8" },
  { name: "SSC CHSL", route: "/exams/ssc-chsl", icon: Laptop, accentColor: "#F2B5A0" },
  { name: "CUET", route: "/exams/cuet", icon: University, accentColor: "#D4C3E8" },
  { name: "NEET PG", route: "/exams/neet-pg", icon: Hospital, accentColor: "#F3E2A3" },
  { name: "GATE", route: "/exams/gate", icon: Cog, accentColor: "#B8D8C0" },
];

// How much of the next card shows at the right edge, in px. The window fits
// as many whole cards as leave at least MIN_PEEK before the viewport edge,
// then shows PEEK of the next one (less when the viewport edge comes first).
const PEEK = 60;
const MIN_PEEK = 32;

/**
 * "Explore Top Exams": a snap-scrolling row of ExamCategoryCards.
 *
 * From tablet up the visible window is sized to whole cards plus a PEEK of
 * the next one, running past the homepage column towards the viewport edge
 * (never beyond it) the way the reference does. Arrows sit over the row and
 * fade in only while the pointer is over it. Phones keep the CSS layout: a
 * swipeable row with the next card clipped at the screen edge.
 */
export function HomepageTopExams() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [visibleWidth, setVisibleWidth] = useState<number | null>(null);

  const updateArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanPrev(track.scrollLeft > 4);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
  }, []);

  const updateWindow = useCallback(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    const card = track?.querySelector("li");
    if (!section || !track || !card || !window.matchMedia("(min-width: 768px)").matches) {
      setVisibleWidth(null);
      return;
    }
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = card.getBoundingClientRect().width + gap;
    const available = document.documentElement.clientWidth - section.getBoundingClientRect().left;
    const fullCards = Math.max(1, Math.floor((available - MIN_PEEK) / step));
    setVisibleWidth(Math.floor(Math.min(available, fullCards * step + PEEK)));
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;
    const update = () => {
      updateWindow();
      updateArrows();
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(section);
    observer.observe(track);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [updateArrows, updateWindow]);

  const scrollByCard = (direction: 1 | -1) => {
    const track = trackRef.current;
    const card = track?.querySelector("li");
    if (!track || !card) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({
      left: direction * (card.getBoundingClientRect().width + gap) * 2,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  const showArrows = canPrev || canNext;

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="top-exams-title">
      <div className={styles.header}>
        <h2 id="top-exams-title" className={styles.title}>
          Explore Top Exams
        </h2>
      </div>

      <div
        className={styles.carousel}
        data-windowed={visibleWidth != null ? "" : undefined}
        style={visibleWidth != null ? { width: visibleWidth } : undefined}
      >
        {showArrows && (
          <>
            <button
              type="button"
              className={`${styles.navButton} ${styles.navPrev}`}
              onClick={() => scrollByCard(-1)}
              disabled={!canPrev}
              aria-label="Previous exams"
              aria-controls="top-exams-track"
            >
              <ArrowLeft size={24} strokeWidth={1.75} aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.navButton} ${styles.navNext}`}
              onClick={() => scrollByCard(1)}
              disabled={!canNext}
              aria-label="Next exams"
              aria-controls="top-exams-track"
            >
              <ArrowRight size={24} strokeWidth={1.75} aria-hidden />
            </button>
          </>
        )}

        <ul
          id="top-exams-track"
          ref={trackRef}
          className={styles.track}
          onScroll={updateArrows}
          aria-label="Top exams"
        >
          {TOP_EXAMS.map((exam) => (
            <li key={exam.route} className={styles.item}>
              <ExamCategoryCard exam={exam} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
