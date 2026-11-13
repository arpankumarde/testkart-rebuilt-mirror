import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Frown,
  Star,
  BookOpen,
  Languages,
  Award,
  Sparkles,
  Building2,
  SlidersHorizontal,
  Video,
  CalendarCheck,
} from "lucide-react";
import { SEOHead } from "../components/SEOHead";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { Checkbox } from "../components/Checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../components/Sheet";
import { ExpertDirectoryContent } from "../components/ExpertDirectoryContent";
import { useDebounce } from "../helpers/useDebounce";
import { liveBookingPath } from "../helpers/liveBookingRoutes";
import { expertsDirectoryQuery } from "../helpers/expertsDirectoryQuery";
import { getExpertsList } from "../endpoints/experts/list_GET.schema";
import type { ExpertListItem, ExpertSortValue } from "../endpoints/experts/list_GET.schema";
import { getExpertSubjects } from "../endpoints/experts/subjects_GET.schema";
import styles from "./expert.module.css";

/* Cards and the price filter use the 60-minute class price. */
const SESSION_MINUTES = 60;
const SITE_ORIGIN = "https://testkart.in";
const BASE_PATH = "/expert";
const PAGE_TITLE = "Online 1:1 Tutors for Exam Prep in India";
const PAGE_DESCRIPTION =
  "Book live 1:1 sessions with verified tutors for exam prep. Compare prices and ratings; your first session with each tutor is a trial.";
/* Dedicated 1200x630 share card for this page, stored in Floot storage on the site's own domain. */
const SHARE_IMAGE = `${SITE_ORIGIN}/_cdn/static/expert-og-1200x630.png`;

const SORT_OPTIONS: { value: ExpertSortValue; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Highest rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

const PHOTO_TONES = ["lavender", "blue", "sage", "butter", "mint"] as const;
const PHOTO_SIZE = 152;

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatCount = (n: number) => n.toLocaleString("en-IN");

const TutorCard: React.FC<{ teacher: ExpertListItem; index: number }> = ({ teacher, index }) => {
  const profilePath = `/expert/${teacher.slug}`;
  const subjects = [...teacher.expertiseAreas, ...teacher.teachingCategories].filter(Boolean);
  const languages = teacher.languages.filter(Boolean);
  const tone = PHOTO_TONES[index % PHOTO_TONES.length];
  const headline = teacher.tagline?.trim();
  const bio = teacher.bio?.trim();
  const isFirst = index === 0;

  const stats = [
    teacher.rating != null
      ? { key: "rating", value: teacher.rating.toFixed(1), star: true, label: `${formatCount(teacher.reviewsCount)} reviews` }
      : null,
    teacher.studentsCount > 0 ? { key: "students", value: formatCount(teacher.studentsCount), star: false, label: "students" } : null,
    teacher.lessonsCount > 0 ? { key: "lessons", value: formatCount(teacher.lessonsCount), star: false, label: "lessons" } : null,
  ].filter((s): s is { key: string; value: string; star: boolean; label: string } => s !== null);

  return (
    <article className={styles.card}>
      <Link to={profilePath} className={`${styles.photoLink} ${styles[`tone_${tone}`]}`} tabIndex={-1} aria-hidden="true">
        {teacher.avatarUrl ? (
          <img
            src={teacher.avatarUrl}
            alt={teacher.displayName}
            className={styles.photo}
            width={PHOTO_SIZE}
            height={PHOTO_SIZE}
            loading={isFirst ? "eager" : "lazy"}
            fetchPriority={isFirst ? "high" : "auto"}
            decoding="async"
          />
        ) : (
          <span className={styles.photoFallback}>{getInitials(teacher.displayName)}</span>
        )}
      </Link>

      <div className={styles.info}>
        <div className={styles.nameRow}>
          <h3 className={styles.name}>
            <Link to={profilePath}>{teacher.displayName}</Link>
          </h3>
          <VerifiedBadge isVerified={teacher.isVerified} size="xs" />
        </div>

        {teacher.academyName && (
          <p className={styles.academy}>
            <Building2 size={15} aria-hidden="true" /> {teacher.academyName}
          </p>
        )}

        {subjects.length > 0 && (
          <div className={styles.subjectRow}>
            <BookOpen size={15} aria-hidden="true" className={styles.metaIcon} />
            <ul className={styles.subjectList} aria-label="Subjects">
              {subjects.slice(0, 3).map((subject) => (
                <li key={subject} className={styles.subjectChip}>
                  {subject}
                </li>
              ))}
            </ul>
          </div>
        )}
        {languages.length > 0 && (
          <p className={styles.metaLine}>
            <Languages size={15} aria-hidden="true" /> Speaks {languages.slice(0, 2).join(", ")}
            {languages.length > 2 && <span className={styles.more}> +{languages.length - 2}</span>}
          </p>
        )}

        <div className={styles.tagRow}>
          <span className={`${styles.tag} ${styles.tagLavender}`}>
            <Sparkles size={13} aria-hidden="true" /> First session is a trial
          </span>
          {teacher.yearsOfExperience != null && teacher.yearsOfExperience > 0 && (
            <span className={`${styles.tag} ${styles.tagMint}`}>
              <Award size={13} aria-hidden="true" /> Experienced tutor - {teacher.yearsOfExperience}{" "}
              {teacher.yearsOfExperience === 1 ? "year" : "years"} teaching
            </span>
          )}
        </div>

        {(headline || bio) && (
          <p className={styles.headline}>
            {headline && <strong>{headline}</strong>}
            {headline && bio && " - "}
            {bio}
          </p>
        )}
        <Link to={profilePath} className={styles.learnMore} aria-label={`Learn more about ${teacher.displayName}`}>
          Learn more
        </Link>
      </div>

      <div className={styles.side}>
        <div className={styles.sideTop}>
          {teacher.trialFrom != null ? (
            <div className={styles.price}>
              <span className={styles.priceUnit}>Trial from</span>
              <span className={styles.priceValue}>₹{formatCount(teacher.trialFrom)}</span>
            </div>
          ) : (
            teacher.price60 != null && (
              <div className={styles.price}>
                <span className={styles.priceValue}>₹{formatCount(teacher.price60)}</span>
                <span className={styles.priceUnit}>{SESSION_MINUTES}-min session</span>
              </div>
            )
          )}

          {stats.length > 0 ? (
            <dl className={styles.stats}>
              {stats.map((s) => (
                <div key={s.key} className={styles.stat}>
                  <dt className={styles.statValue}>
                    {s.value}
                    {s.star && <Star size={13} fill="currentColor" aria-label="stars" className={styles.star} />}
                  </dt>
                  <dd className={styles.statLabel}>{s.label}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <span className={styles.newTutor}>New tutor</span>
          )}
        </div>

        <div className={styles.actions}>
          <Button asChild className={styles.actionButton}>
            <Link to={liveBookingPath(teacher)} aria-label={`Book a trial session with ${teacher.displayName}`}>
              Book trial session
            </Link>
          </Button>
          <Button asChild variant="outline" className={styles.actionButton}>
            <Link to={profilePath} aria-label={`View ${teacher.displayName}'s profile`}>
              View profile
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
};

const ExpertsDirectoryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = expertsDirectoryQuery(searchParams);
  const { urlSearch, minPrice, maxPrice } = urlQuery;

  const [search, setSearch] = useState(urlSearch);
  const debouncedSearch = useDebounce(search, 300);
  const [priceMinDraft, setPriceMinDraft] = useState(minPrice);
  const [priceMaxDraft, setPriceMaxDraft] = useState(maxPrice);
  const debouncedMinPrice = useDebounce(priceMinDraft, 400);
  const debouncedMaxPrice = useDebounce(priceMaxDraft, 400);
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* The list query follows the debounced search box; everything else follows the URL. */
  const query = expertsDirectoryQuery(searchParams, debouncedSearch);
  const { page, sortBy, verifiedOnly, hasFilters, isFiltered } = query;

  const updateParams = (updates: Record<string, string | null>, resetPage = true) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (resetPage) next.delete("page");
        return next;
      },
      { replace: true }
    );
  };

  useEffect(() => {
    if (debouncedSearch === urlSearch) return;
    updateParams({ search: debouncedSearch || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  /* A subject link or Back navigation changes the URL's search: mirror it into the box. A change
     the box itself pushed already equals the debounced value, so typing is never overwritten. */
  useEffect(() => {
    if (urlSearch !== debouncedSearch) setSearch(urlSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch]);

  useEffect(() => {
    if (debouncedMinPrice === minPrice) return;
    updateParams({ minPrice: debouncedMinPrice || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedMinPrice]);

  useEffect(() => {
    if (debouncedMaxPrice === maxPrice) return;
    updateParams({ maxPrice: debouncedMaxPrice || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedMaxPrice]);

  const { data, isFetching, error } = useQuery({
    queryKey: query.queryKey,
    queryFn: () => getExpertsList(query.input),
    placeholderData: (previous) => previous,
  });

  const { data: subjectsData } = useQuery({
    queryKey: ["experts", "subjects"],
    queryFn: () => getExpertSubjects(),
  });

  const handleResetFilters = () => {
    setPriceMinDraft("");
    setPriceMaxDraft("");
    setSearch("");
    updateParams({ minPrice: null, maxPrice: null, verified: null, sort: null, search: null });
  };

  const pageHref = (target: number) => {
    const next = new URLSearchParams(searchParams);
    if (target <= 1) next.delete("page");
    else next.set("page", String(target));
    const qs = next.toString();
    return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
  };

  /* Search, filter and sort variants are noindex and point at the plain directory; plain
     paginated pages keep their own URL as canonical. */
  const canonicalUrl = !isFiltered && page > 1 ? `${SITE_ORIGIN}${BASE_PATH}?page=${page}` : `${SITE_ORIGIN}${BASE_PATH}`;
  const title = page > 1 && !isFiltered ? `${PAGE_TITLE} - Page ${page}` : PAGE_TITLE;
  const activeFilterCount = [minPrice || maxPrice, verifiedOnly].filter(Boolean).length;
  const teachers = data?.teachers ?? [];
  const totalCount = data?.totalCount ?? 0;
  /* A page number past the last page (the server answers it with a 404) stays out of the index. */
  const isPastLastPage = !!data && page > 1 && page > data.totalPages;

  const itemListJsonLd =
    !isFiltered && teachers.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Online 1:1 tutors on Testkart",
          itemListOrder: "https://schema.org/ItemListUnordered",
          numberOfItems: totalCount,
          itemListElement: teachers.map((teacher, index) => ({
            "@type": "ListItem",
            position: (page - 1) * query.input.limit + index + 1,
            url: `${SITE_ORIGIN}/expert/${teacher.slug}`,
            name: teacher.displayName,
          })),
        }
      : null;

  const renderContent = () => {
    if (isFetching && !data) {
      return Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className={styles.skeletonCard} />);
    }

    if (error && !data) {
      return (
        <div className={styles.stateContainer} role="alert">
          <Frown size={36} aria-hidden="true" />
          <h3>Could not load tutors</h3>
          <p>Please try again in a moment.</p>
        </div>
      );
    }

    if (teachers.length === 0) {
      if (isPastLastPage) {
        return (
          <div className={styles.stateContainer}>
            <Search size={36} aria-hidden="true" />
            <h3>No tutors on this page</h3>
            <p>This list has fewer pages now.</p>
            <Button asChild variant="outline">
              <Link to={pageHref(1)}>Back to the first page</Link>
            </Button>
          </div>
        );
      }
      return (
        <div className={styles.stateContainer}>
          <Search size={36} aria-hidden="true" />
          <h3>{hasFilters ? "No tutors match these filters" : "No tutors available yet"}</h3>
          <p>{hasFilters ? "Try a different search or widen your price range." : "Check back soon for 1:1 sessions."}</p>
          {hasFilters && (
            <Button variant="outline" onClick={handleResetFilters}>
              Clear filters
            </Button>
          )}
        </div>
      );
    }

    return teachers.map((teacher, index) => <TutorCard key={teacher.id} teacher={teacher} index={index} />);
  };

  const filterPanel = (
    <>
      <div className={styles.filterGroup} role="group" aria-labelledby="expert-price-label">
        <span id="expert-price-label" className={styles.filterLabel}>
          Price per {SESSION_MINUTES}-min session (₹)
        </span>
        <div className={styles.priceRow}>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={data ? String(data.priceBounds.min) : "Min"}
            className={styles.priceInput}
            value={priceMinDraft}
            onChange={(e) => setPriceMinDraft(e.target.value)}
            aria-label="Minimum price"
          />
          <span className={styles.priceSeparator}>to</span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={data ? String(data.priceBounds.max) : "Max"}
            className={styles.priceInput}
            value={priceMaxDraft}
            onChange={(e) => setPriceMaxDraft(e.target.value)}
            aria-label="Maximum price"
          />
        </div>
      </div>

      <div className={styles.filterGroup} role="group" aria-labelledby="expert-trust-label">
        <span id="expert-trust-label" className={styles.filterLabel}>
          Trust
        </span>
        <label className={styles.checkboxRow}>
          <Checkbox checked={verifiedOnly} onChange={(e) => updateParams({ verified: e.target.checked ? "1" : null })} />
          Verified tutors only
        </label>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" className={styles.resetButton} onClick={handleResetFilters}>
          Reset filters
        </Button>
      )}
    </>
  );

  return (
    <>
      <SEOHead
        title={title}
        description={PAGE_DESCRIPTION}
        url={canonicalUrl}
        noIndex={isFiltered || isPastLastPage}
        image={SHARE_IMAGE}
        imageAlt="Testkart - book online 1:1 tutors for exam prep in India"
      />
      {itemListJsonLd && (
        <Helmet>
          <script type="application/ld+json">{JSON.stringify(itemListJsonLd)}</script>
        </Helmet>
      )}
      <div className={`${styles.page} tk-flow`}>
        <div className={styles.pageContainer}>
          <header className={styles.pageHeader}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>
                <span className={styles.eyebrowDot} aria-hidden="true" />
                1:1 live sessions
              </span>
              <h1>Find Online 1:1 Tutors for Your Exam Prep</h1>
              <p>Book a private video session at a time that suits you. Your first session with each tutor is a trial.</p>
              <div className={styles.searchInputWrap} role="search">
                <Search className={styles.searchIcon} size={18} aria-hidden="true" />
                <Input
                  type="search"
                  enterKeyHint="search"
                  placeholder="Search by name, academy or subject..."
                  className={styles.searchInput}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search tutors by name, academy or subject"
                />
              </div>
            </div>
            <div className={styles.heroArt} aria-hidden="true">
              <span className={`${styles.artTile} ${styles.artLavender}`}>
                <Video size={26} strokeWidth={1.75} />
              </span>
              <span className={`${styles.artTile} ${styles.artMint}`}>
                <CalendarCheck size={24} strokeWidth={1.75} />
              </span>
              <span className={`${styles.artTile} ${styles.artBlue}`}>
                <Star size={22} strokeWidth={1.75} />
              </span>
              <span className={styles.artBubble}>1:1</span>
            </div>
          </header>

          <div className={styles.layout}>
            <aside className={styles.sidebar} aria-label="Filters">
              <p className={styles.sidebarTitle}>
                <SlidersHorizontal size={16} aria-hidden="true" /> Filters
              </p>
              {filterPanel}
            </aside>

            <section className={styles.results} aria-labelledby="expert-results-title" aria-busy={isFetching || undefined}>
              <div className={styles.resultsBar}>
                <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className={styles.filterButton}>
                      <SlidersHorizontal size={16} aria-hidden="true" />
                      Filters
                      {activeFilterCount > 0 && <span className={styles.filterCount}>{activeFilterCount}</span>}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className={styles.filterSheet}>
                    <SheetHeader>
                      <SheetTitle>Filter tutors</SheetTitle>
                    </SheetHeader>
                    <div className={styles.filterSheetBody}>{filterPanel}</div>
                    <SheetFooter>
                      <Button size="lg" onClick={() => setFiltersOpen(false)}>
                        Show {formatCount(totalCount)} {totalCount === 1 ? "tutor" : "tutors"}
                      </Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>

                <h2 id="expert-results-title" className={styles.resultsCount} aria-live="polite">
                  {isFetching && !data ? (
                    <Skeleton style={{ width: "100px", height: "20px" }} />
                  ) : (
                    <>
                      <strong>{formatCount(totalCount)}</strong> {totalCount === 1 ? "tutor" : "tutors"} available
                    </>
                  )}
                </h2>
                <div className={styles.sortControls}>
                  <span className={styles.sortLabel} id="expert-sort-label">
                    Sort by
                  </span>
                  <Select value={sortBy} onValueChange={(v) => updateParams({ sort: v === "recommended" ? null : v })}>
                    <SelectTrigger className={styles.sortTrigger} aria-labelledby="expert-sort-label">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className={styles.cardList}>{renderContent()}</div>

              {data && data.totalPages > 1 && (
                <nav className={styles.pagination} aria-label="Tutor pages">
                  {page > 1 ? (
                    <Button asChild variant="outline">
                      <Link to={pageHref(page - 1)} rel="prev">
                        Previous
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" disabled>
                      Previous
                    </Button>
                  )}
                  <span aria-current="page">
                    Page {page} of {data.totalPages}
                  </span>
                  {page < data.totalPages ? (
                    <Button asChild variant="outline">
                      <Link to={pageHref(page + 1)} rel="next">
                        Next
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" disabled>
                      Next
                    </Button>
                  )}
                </nav>
              )}
            </section>
          </div>

          <ExpertDirectoryContent subjects={subjectsData?.subjects ?? []} />
        </div>
      </div>
    </>
  );
};

export default ExpertsDirectoryPage;
