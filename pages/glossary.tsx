import React, { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { AlertCircle, BookA } from "lucide-react";
import { glossaryMeta } from "../helpers/glossaryMeta";
import { useGlossaryTerms } from "../helpers/useGlossaryPublic";
import type { PublicGlossaryCard } from "../endpoints/glossary/list_GET.schema";
import { Button } from "../components/Button";
import { GlossaryCtaBand } from "../components/GlossaryCtaBand";
import { GlossaryTermCard } from "../components/GlossaryTermCard";
import { SEOHead } from "../components/SEOHead";
import { Skeleton } from "../components/Skeleton";
import styles from "./glossary.module.css";

const TITLE = "Exam & Assessment Glossary";
const INTRO =
  "Explore simple explanations of important exam, testing and assessment terms. Learn the concepts, understand the terminology and prepare smarter.";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const OTHER = "#";
/* Long enough for a smooth scroll to finish, so sections passed on the way do not take the highlight. */
const SCROLL_LOCK_MS = 1000;

const anchorOf = (letter: string) => (letter === OTHER ? "letter-other" : `letter-${letter.toLowerCase()}`);

const scrollToLetter = (letter: string, behavior: ScrollBehavior) =>
  document.getElementById(anchorOf(letter))?.scrollIntoView({ behavior, block: "start" });

/** /glossary: an A to Z bar built from the terms, so it never links to an empty section. */
const GlossaryHubPage: React.FC = () => {
  const { data, isLoading, isError, refetch } = useGlossaryTerms();
  const terms = data?.terms;

  const groups = useMemo(() => {
    const byLetter = new Map<string, PublicGlossaryCard[]>();
    for (const term of terms ?? []) {
      const letter = glossaryMeta.letterOf(term.term);
      byLetter.set(letter, [...(byLetter.get(letter) ?? []), term]);
    }
    return byLetter;
  }, [terms]);

  const sections = useMemo(() => [...LETTERS, OTHER].filter((letter) => groups.has(letter)), [groups]);
  const bar = groups.has(OTHER) ? [...LETTERS, OTHER] : LETTERS;

  const [selected, setSelected] = useState<string | null>(null);
  const barRef = useRef<HTMLElement>(null);
  const lockedUntil = useRef(0);
  const openedFromLink = useRef(false);

  // A link to /glossary#letter-m opens on that letter once the terms are on the page.
  useEffect(() => {
    if (openedFromLink.current || sections.length === 0) return;
    openedFromLink.current = true;
    const letter = sections.find((item) => `#${anchorOf(item)}` === window.location.hash);
    if (!letter) return;
    setSelected(letter);
    scrollToLetter(letter, "auto");
  }, [sections]);

  // The highlight follows the section just under the sticky bar. root: document keeps rootMargin working in the preview iframe.
  useEffect(() => {
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < lockedUntil.current) return;
        const current = entries.filter((entry) => entry.isIntersecting).at(-1);
        const letter = current?.target.getAttribute("data-letter");
        if (letter) setSelected(letter);
      },
      { root: document, rootMargin: "-25% 0px -70% 0px" }
    );
    for (const letter of sections) {
      const section = document.getElementById(anchorOf(letter));
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [sections]);

  // On phones the bar scrolls sideways, so keep the selected letter in view.
  useEffect(() => {
    const node = barRef.current;
    const chip = node?.querySelector<HTMLElement>('[aria-current="true"]');
    if (node && chip) node.scrollLeft = chip.offsetLeft - (node.clientWidth - chip.offsetWidth) / 2;
  }, [selected]);

  const selectLetter = (event: React.MouseEvent, letter: string) => {
    event.preventDefault();
    lockedUntil.current = Date.now() + SCROLL_LOCK_MS;
    setSelected(letter);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollToLetter(letter, calm ? "auto" : "smooth");
    window.history.replaceState(window.history.state, "", `#${anchorOf(letter)}`);
  };

  return (
    <>
      <SEOHead title={TITLE} description={INTRO} url={glossaryMeta.HUB_PATH} noIndex={terms?.length === 0} />
      <Helmet>
        <script type="application/ld+json">
          {glossaryMeta.breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Glossary", path: glossaryMeta.HUB_PATH },
          ])}
        </script>
      </Helmet>

      <div className={styles.page}>
        <div className={styles.inner}>
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <ol>
              <li>
                <Link to="/">Home</Link>
              </li>
              <li aria-current="page">Glossary</li>
            </ol>
          </nav>

          <header className={styles.hero}>
            <span className={styles.shapes} aria-hidden="true">
              <span className={styles.shapeMint} />
              <span className={styles.shapeLavender} />
              <span className={styles.shapePeach} />
              <span className={styles.shapeButter} />
            </span>
            <div className={styles.heroText}>
              <h1 className={styles.title}>{TITLE}</h1>
              <p className={styles.intro}>{INTRO}</p>
            </div>
          </header>

          <nav ref={barRef} className={styles.letters} aria-label="Jump to a letter">
            <ul>
              {bar.map((letter) => (
                <li key={letter}>
                  {groups.has(letter) ? (
                    <a
                      href={`#${anchorOf(letter)}`}
                      className={`${styles.letter} ${selected === letter ? styles.letterSelected : ""}`}
                      aria-current={selected === letter ? "true" : undefined}
                      onClick={(event) => selectLetter(event, letter)}
                    >
                      {letter}
                    </a>
                  ) : (
                    <span className={`${styles.letter} ${styles.letterEmpty}`} aria-disabled="true">
                      {letter}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {isLoading && !data ? (
            <div className={styles.grid} aria-busy="true">
              {[0, 1, 2].map((n) => (
                <Skeleton key={n} style={{ height: "11.5rem", borderRadius: "var(--radius-lg)" }} />
              ))}
            </div>
          ) : isError && !data ? (
            <div className={styles.state} role="alert">
              <span className={`${styles.stateIcon} ${styles.stateIconError}`} aria-hidden="true">
                <AlertCircle size={22} />
              </span>
              <h2 className={styles.stateTitle}>We could not load the glossary</h2>
              <p className={styles.stateText}>Check your connection and try again.</p>
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : sections.length === 0 ? (
            <div className={styles.state}>
              <span className={styles.stateIcon} aria-hidden="true">
                <BookA size={22} />
              </span>
              <h2 className={styles.stateTitle}>Definitions are on their way</h2>
              <p className={styles.stateText}>We are writing the first terms now. Check back soon.</p>
            </div>
          ) : (
            sections.map((letter) => (
              <section
                key={letter}
                id={anchorOf(letter)}
                data-letter={letter}
                className={styles.group}
                aria-labelledby={`${anchorOf(letter)}-title`}
              >
                <h2 id={`${anchorOf(letter)}-title`} className={styles.groupTitle}>
                  {letter}
                </h2>
                <div className={styles.grid}>
                  {groups.get(letter)!.map((term) => (
                    <GlossaryTermCard key={term.slug} term={term} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      <GlossaryCtaBand title="See it in practice" text="Ready to create and sell your own mock tests on Testkart?" />
    </>
  );
};

export default GlossaryHubPage;
