import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
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
  type LucideIcon,
} from "lucide-react";
import { ExamCategoryCard, type ExamCategory } from "./ExamCategoryCard";
import { TOP_EXAMS, type TopExamSlug } from "../helpers/homepageTopExams";
import styles from "./HomepageTopExams.module.css";

// The exams themselves live in helpers/homepageTopExams; the icons stay here
// because that list is shared with the server.
const EXAM_ICONS: Record<TopExamSlug, LucideIcon> = {
  "neet-ug": Stethoscope,
  "ugc-net": GraduationCap,
  "jee-main": Calculator,
  "upsc-cse": Landmark,
  "ssc-cgl": BriefcaseBusiness,
  "jee-advanced": Atom,
  ctet: Presentation,
  "ssc-gd": ShieldCheck,
  "ssc-chsl": Laptop,
  cuet: University,
  "neet-pg": Hospital,
  gate: Cog,
};

const EXAM_CARDS: (ExamCategory & { slug: TopExamSlug })[] = TOP_EXAMS.map((exam) => ({
  name: exam.name,
  slug: exam.slug,
  route: `/exams/${exam.slug}`,
  icon: EXAM_ICONS[exam.slug],
  accentColor: exam.accentColor,
}));

// How much of the next card shows at the window's edge, in px: between
// MIN_PEEK and PEEK at full card size, otherwise exactly PEEK (see fitCards).
const PEEK = 60;
const MIN_PEEK = 32;
// Matches the CSS breakpoint where the carousel stops being held to the column.
const DESKTOP_QUERY = "(min-width: 1024px)";
// The full card width (.item flex-basis from tablet up).
const CARD_REM = 16;

/**
 * The card width that makes whole cards plus a peek of the next one end
 * exactly at the window's edge, so the next card is always clipped by the
 * edge and never stops short of it in open space. Returns null (keep the CSS
 * size) when full-size cards already leave MIN_PEEK..PEEK there; otherwise
 * picks whichever of one card fewer (slightly wider) or one more (slightly
 * narrower) stays closest to the full size, with exactly PEEK showing.
 */
function fitCards(available: number, baseWidth: number, gap: number): number | null {
  const step = baseWidth + gap;
  const fullCards = Math.max(1, Math.floor((available - MIN_PEEK) / step));
  if (available - fullCards * step <= PEEK) return null;
  const widthFor = (cards: number) => (available - PEEK - cards * gap) / cards;
  const wider = widthFor(fullCards);
  const narrower = widthFor(fullCards + 1);
  return Math.abs(wider - baseWidth) <= Math.abs(narrower - baseWidth) ? wider : narrower;
}

/**
 * "Explore Top Exams": a snap-scrolling row of ExamCategoryCards.
 *
 * From tablet up the visible window shows whole cards plus a peek of the
 * next one, clipped at the window's edge (see fitCards). On desktop that edge
 * is past the homepage column towards the viewport edge (never beyond it) the
 * way the reference does; on tablets it is the column edge. Arrows sit over
 * the row and fade in only while the pointer is over it. Phones get a static
 * two-column grid (CSS only).
 *
 * `productCounts` (exam slug -> products on sale) comes from homepage/data;
 * a card without a count just shows its name.
 */
export function HomepageTopExams({ productCounts }: { productCounts?: Record<string, number> }) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [visibleWidth, setVisibleWidth] = useState<number | null>(null);
  // Card width from fitCards; null keeps the CSS size.
  const [cardWidth, setCardWidth] = useState<number | null>(null);

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
      setCardWidth(null);
      return;
    }
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;

    const baseWidth = CARD_REM * parseFloat(getComputedStyle(document.documentElement).fontSize);
    // Desktop: the window may run past the homepage column towards the
    // viewport edge. Tablets: it is the section itself, so the next card is
    // clipped at the column edge, in line with the rest of the page.
    const available = window.matchMedia(DESKTOP_QUERY).matches
      ? document.documentElement.clientWidth - section.getBoundingClientRect().left
      : section.clientWidth;
    setCardWidth(fitCards(available, baseWidth, gap));
    setVisibleWidth(Math.floor(available));
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
          style={
            cardWidth != null
              ? ({ "--fit-card-width": `${cardWidth}px` } as CSSProperties)
              : undefined
          }
          onScroll={updateArrows}
          aria-label="Top exams"
        >
          {EXAM_CARDS.map((exam) => (
            <li key={exam.route} className={styles.item}>
              <ExamCategoryCard exam={exam} productCount={productCounts?.[exam.slug]} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
