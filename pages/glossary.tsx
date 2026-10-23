import React, { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowRight, ChevronDown } from "lucide-react";
import { glossaryMeta } from "../helpers/glossaryMeta";
import { MORE_RESOURCES } from "../helpers/moreResources";
import { useGlossaryTerms } from "../helpers/useGlossaryPublic";
import type { GlossaryCategory } from "../helpers/schema";
import type { PublicGlossaryCard } from "../endpoints/glossary/list_GET.schema";
import { Button } from "../components/Button";
import { GlossaryCtaBand } from "../components/GlossaryCtaBand";
import { GlossarySearch } from "../components/GlossarySearch";
import { GlossaryTermEntry } from "../components/GlossaryTermEntry";
import { SEOHead } from "../components/SEOHead";
import { Skeleton } from "../components/Skeleton";
import styles from "./glossary.module.css";

const TITLE = "Exam & Assessment Glossary";
const INTRO =
  "Understand important exam, testing and assessment terminology with simple explanations. Explore concepts, learn new terms and build your knowledge.";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const OTHER = "#";
/* Long enough for a smooth scroll to finish, so sections passed on the way do not take the highlight. */
const SCROLL_LOCK_MS = 1000;
const RESOURCES = MORE_RESOURCES.filter((resource) => resource.href !== glossaryMeta.HUB_PATH);

const anchorOf = (letter: string) => (letter === OTHER ? "letter-other" : `letter-${letter.toLowerCase()}`);

const scrollToLetter = (letter: string, behavior: ScrollBehavior) =>
  document.getElementById(anchorOf(letter))?.scrollIntoView({ behavior, block: "start" });

interface CategoryFiltersProps {
  terms: PublicGlossaryCard[];
  selected: GlossaryCategory | undefined;
  onSelect: (category: GlossaryCategory | undefined) => void;
}

const CategoryFilters: React.FC<CategoryFiltersProps> = ({ terms, selected, onSelect }) => {
  const options = [
    { value: undefined, label: "All terms", count: terms.length },
    ...glossaryMeta.CATEGORIES.map(({ value }) => ({
      value,
      label: glossaryMeta.publicCategoryLabel(value),
      count: terms.filter((term) => term.category === value).length,
    })),
  ];

  return (
    <ul className={styles.filters}>
      {options.map(({ value, label, count }) => (
        <li key={label}>
          <button
            type="button"
            className={`${styles.filter} ${styles[value ?? "all"]} ${selected === value ? styles.filterSelected : ""}`}
            aria-pressed={selected === value}
            disabled={count === 0}
            onClick={() => onSelect(value)}
          >
            {label}
            <span className={styles.filterCount}>{count}</span>
          </button>
        </li>
      ))}
    </ul>
  );
};

/** /glossary: a dictionary-style listing, with an A to Z bar built from the terms on show. */
const GlossaryHubPage: React.FC = () => {
  const { data, isLoading, isError, refetch } = useGlossaryTerms();
  const terms = useMemo(() => data?.terms ?? [], [data]);

  const [params, setParams] = useSearchParams();
  const categoryParam = params.get("category");
  const category = glossaryMeta.isCategory(categoryParam) ? categoryParam : undefined;

  const groups = useMemo(() => {
    const byLetter = new Map<string, PublicGlossaryCard[]>();
    for (const term of terms) {
      if (category && term.category !== category) continue;
      const letter = glossaryMeta.letterOf(term.term);
      byLetter.set(letter, [...(byLetter.get(letter) ?? []), term]);
    }
    return byLetter;
  }, [terms, category]);

  const sections = useMemo(() => [...LETTERS, OTHER].filter((letter) => groups.has(letter)), [groups]);
  const bar = groups.has(OTHER) ? [...LETTERS, OTHER] : LETTERS;
  const shown = sections.reduce((total, letter) => total + groups.get(letter)!.length, 0);

  const [selected, setSelected] = useState<string | null>(null);
  const barRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDetailsElement>(null);
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
    window.history.replaceState(window.history.state, "", `${window.location.search}#${anchorOf(letter)}`);
  };

  const selectCategory = (next: GlossaryCategory | undefined) => {
    setSelected(null);
    setParams(next ? { category: next } : {}, { replace: true });
    if (filtersRef.current) filtersRef.current.open = false;
    // The list gets shorter, so bring its top back into view when the reader has scrolled past it.
    const list = listRef.current;
    if (list && list.getBoundingClientRect().top < 0) list.scrollIntoView({ block: "start" });
  };

  const renderListing = () => {
    if (isLoading && !data) {
      return (
        <div className={styles.loading} aria-busy="true">
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} style={{ height: "6.5rem", borderRadius: "var(--radius)" }} />
          ))}
        </div>
      );
    }
    if (isError && !data) {
      return (
        <div className={styles.state} role="alert">
          <AlertCircle size={24} className={styles.stateIcon} aria-hidden="true" />
          <h2 className={styles.stateTitle}>We could not load the glossary</h2>
          <p className={styles.stateText}>Check your connection and try again.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      );
    }
    if (terms.length === 0) {
      return (
        <div className={styles.state}>
          <h2 className={styles.stateTitle}>Definitions are on their way</h2>
          <p className={styles.stateText}>We are writing the first terms now. Check back soon.</p>
        </div>
      );
    }
    return sections.map((letter) => (
      <section key={letter} id={anchorOf(letter)} data-letter={letter} className={styles.group} aria-labelledby={`${anchorOf(letter)}-title`}>
        <h2 id={`${anchorOf(letter)}-title`} className={styles.groupLetter}>
          {letter}
        </h2>
        <div className={styles.entries}>
          {groups.get(letter)!.map((term) => (
            <GlossaryTermEntry key={term.slug} term={term} />
          ))}
        </div>
      </section>
    ));
  };

  return (
    <>
      <SEOHead title={TITLE} description={INTRO} url={glossaryMeta.HUB_PATH} noIndex={data?.terms.length === 0} />
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
          <header className={styles.hero}>
            <span className={styles.glyph} aria-hidden="true">
              Aa
            </span>
            <nav className={styles.crumbs} aria-label="Breadcrumb">
              <ol>
                <li>
                  <Link to="/">Home</Link>
                </li>
                <li aria-current="page">Glossary</li>
              </ol>
            </nav>
            <h1 className={styles.title}>{TITLE}</h1>
            <p className={styles.intro}>{INTRO}</p>
            <GlossarySearch terms={terms} className={styles.search} />
          </header>

          <details ref={filtersRef} className={styles.mobileFilters}>
            <summary className={styles.mobileSummary}>
              {category ? glossaryMeta.publicCategoryLabel(category) : "Browse categories"}
              <ChevronDown size={18} className={styles.mobileChevron} aria-hidden="true" />
            </summary>
            <CategoryFilters terms={terms} selected={category} onSelect={selectCategory} />
          </details>

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

          <div className={styles.layout}>
            <div ref={listRef} className={styles.listing}>
              {category && (
                <p className={styles.filterNote}>
                  {shown} {shown === 1 ? "term" : "terms"} in {glossaryMeta.publicCategoryLabel(category)}
                  <button type="button" className={styles.filterClear} onClick={() => selectCategory(undefined)}>
                    Show all
                  </button>
                </p>
              )}
              {renderListing()}
            </div>

            <aside className={styles.aside}>
              <section className={styles.browse} aria-labelledby="glossary-browse-title">
                <h2 id="glossary-browse-title" className={styles.asideTitle}>
                  Browse Categories
                </h2>
                <CategoryFilters terms={terms} selected={category} onSelect={selectCategory} />
              </section>

              <section className={styles.help} aria-labelledby="glossary-help-title">
                <h2 id="glossary-help-title" className={styles.asideTitle}>
                  Can't find a term?
                </h2>
                <p className={styles.helpText}>Explore our learning resources on Testkart.</p>
                <ul className={styles.helpLinks}>
                  {RESOURCES.map(({ href, label }) => (
                    <li key={href}>
                      <Link to={href} className={styles.helpLink}>
                        {label} <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
        </div>
      </div>

      <GlossaryCtaBand title="See it in practice" text="Ready to create and sell your own mock tests on Testkart?" />
    </>
  );
};

export default GlossaryHubPage;
