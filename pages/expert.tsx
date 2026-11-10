import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Frown, Star, BookOpen, Languages, Award, Sparkles, Building2 } from "lucide-react";
import { SEOHead } from "../components/SEOHead";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { Checkbox } from "../components/Checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { useDebounce } from "../helpers/useDebounce";
import { liveBookingPath } from "../helpers/liveBookingRoutes";
import { getExpertsList } from "../endpoints/experts/list_GET.schema";
import type { ExpertListItem, ExpertSortValue } from "../endpoints/experts/list_GET.schema";
import styles from "./expert.module.css";

const ITEMS_PER_PAGE = 20;
/* Cards show the 50-minute price; the API rate is per 25 minutes. */
const SESSION_MINUTES = 50;
const RATE_UNIT_MINUTES = 25;

const SORT_OPTIONS: { value: ExpertSortValue; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Highest rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

const PHOTO_TONES = ["lavender", "blue", "sage", "butter", "mint"] as const;

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const sessionPrice = (pricePer25Min: number) => Math.round((pricePer25Min * SESSION_MINUTES) / RATE_UNIT_MINUTES);

const formatCount = (n: number) => n.toLocaleString("en-IN");

const TutorCard: React.FC<{ teacher: ExpertListItem; index: number }> = ({ teacher, index }) => {
  const profilePath = `/expert/${teacher.slug}`;
  const subjects = [...teacher.expertiseAreas, ...teacher.teachingCategories].filter(Boolean);
  const languages = teacher.languages.filter(Boolean);
  const tone = PHOTO_TONES[index % PHOTO_TONES.length];
  const headline = teacher.tagline?.trim();
  const bio = teacher.bio?.trim();

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
          <img src={teacher.avatarUrl} alt="" className={styles.photo} loading="lazy" />
        ) : (
          <span className={styles.photoFallback}>{getInitials(teacher.displayName)}</span>
        )}
      </Link>

      <div className={styles.info}>
        <div className={styles.nameRow}>
          <h2 className={styles.name}>
            <Link to={profilePath}>{teacher.displayName}</Link>
          </h2>
          <VerifiedBadge isVerified={teacher.isVerified} size="xs" />
        </div>

        {teacher.academyName && (
          <p className={styles.metaLine}>
            <Building2 size={15} aria-hidden="true" /> {teacher.academyName}
          </p>
        )}
        {subjects.length > 0 && (
          <p className={styles.metaLine}>
            <BookOpen size={15} aria-hidden="true" /> {subjects.slice(0, 3).join(", ")}
          </p>
        )}
        {languages.length > 0 && (
          <p className={styles.metaLine}>
            <Languages size={15} aria-hidden="true" /> Speaks {languages.slice(0, 2).join(", ")}
            {languages.length > 2 && <span className={styles.more}> +{languages.length - 2}</span>}
          </p>
        )}

        <span className={styles.chip}>
          <Sparkles size={13} aria-hidden="true" /> First session is a trial
        </span>

        {(headline || bio) && (
          <p className={styles.headline}>
            {headline && <strong>{headline}</strong>}
            {headline && bio && " - "}
            {bio}
          </p>
        )}
        <Link to={profilePath} className={styles.learnMore}>
          Learn more
        </Link>

        {teacher.yearsOfExperience != null && teacher.yearsOfExperience > 0 && (
          <p className={styles.metaLine}>
            <Award size={15} aria-hidden="true" /> Experienced tutor - {teacher.yearsOfExperience}{" "}
            {teacher.yearsOfExperience === 1 ? "year" : "years"} teaching
          </p>
        )}
      </div>

      <div className={styles.side}>
        <div className={styles.sideTop}>
          {teacher.trialFrom != null ? (
            <div className={styles.price}>
              {teacher.trialFrom > 0 ? (
                <>
                  <span className={styles.priceUnit}>Trial from</span>
                  <span className={styles.priceValue}>₹{formatCount(teacher.trialFrom)}</span>
                </>
              ) : (
                <span className={styles.priceValue}>Free trial</span>
              )}
            </div>
          ) : (
            teacher.pricePer25Min != null && (
              <div className={styles.price}>
                <span className={styles.priceValue}>₹{formatCount(sessionPrice(teacher.pricePer25Min))}</span>
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
                    {s.star && <Star size={14} fill="currentColor" aria-label="stars" className={styles.star} />}
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
          <Button asChild size="lg" className={styles.actionButton}>
            <Link to={liveBookingPath(teacher)}>Book trial session</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className={styles.actionButton}>
            <Link to={profilePath}>View profile</Link>
          </Button>
        </div>
      </div>
    </article>
  );
};

const ExpertsDirectoryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const sortBy = (searchParams.get("sort") as ExpertSortValue) || "recommended";
  /* minPrice / maxPrice in the URL are per 50-minute session, as shown on the cards. */
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const verifiedOnly = searchParams.get("verified") === "1";

  const [search, setSearch] = useState(urlSearch);
  const debouncedSearch = useDebounce(search, 300);
  const [priceMinDraft, setPriceMinDraft] = useState(minPrice);
  const [priceMaxDraft, setPriceMaxDraft] = useState(maxPrice);
  const debouncedMinPrice = useDebounce(priceMinDraft, 400);
  const debouncedMaxPrice = useDebounce(priceMaxDraft, 400);

  const updateParams = (updates: Record<string, string | null>, resetPage = true) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (resetPage) next.set("page", "1");
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

  const toRate = (sessionValue: string) =>
    sessionValue ? (Number(sessionValue) * RATE_UNIT_MINUTES) / SESSION_MINUTES : undefined;

  const { data, isFetching, error } = useQuery({
    queryKey: ["experts", "list", debouncedSearch, minPrice, maxPrice, verifiedOnly, sortBy, page],
    queryFn: () =>
      getExpertsList({
        search: debouncedSearch || undefined,
        minPrice: toRate(minPrice),
        maxPrice: toRate(maxPrice),
        verifiedOnly: verifiedOnly || undefined,
        sortBy,
        page,
        limit: ITEMS_PER_PAGE,
      }),
  });

  const handleResetFilters = () => {
    setPriceMinDraft("");
    setPriceMaxDraft("");
    updateParams({ minPrice: null, maxPrice: null, verified: null, sort: null });
  };

  const hasFilters = !!(minPrice || maxPrice || verifiedOnly || urlSearch);
  const canonicalUrl = "https://testkart.in/expert";

  const renderContent = () => {
    if (isFetching && !data) {
      return Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className={styles.skeletonCard} />);
    }

    if (error) {
      return (
        <div className={styles.stateContainer}>
          <Frown size={36} />
          <h3>Could not load tutors</h3>
          <p>Please try again in a moment.</p>
        </div>
      );
    }

    if (!data || data.teachers.length === 0) {
      return (
        <div className={styles.stateContainer}>
          <Search size={36} />
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

    return data.teachers.map((teacher, index) => <TutorCard key={teacher.id} teacher={teacher} index={index} />);
  };

  return (
    <>
      <SEOHead
        title="Find a 1:1 Tutor | Testkart"
        description="Book a private live 1:1 session with a Testkart educator. Compare prices and ratings - your first session with each tutor is a trial."
        url={canonicalUrl}
      />
      <div className={`${styles.page} tk-flow`}>
        <div className={styles.pageContainer}>
          <header className={styles.pageHeader}>
            <span className={styles.eyebrow}>1:1 live sessions</span>
            <h1>Find a tutor who fits your goals</h1>
            <p>Book a private video session at a time that suits you. Your first session with each tutor is a trial.</p>
            <div className={styles.searchInputWrap}>
              <Search className={styles.searchIcon} size={18} aria-hidden="true" />
              <Input
                type="search"
                placeholder="Search by name, academy or subject..."
                className={styles.searchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search tutors"
              />
            </div>
          </header>

          <div className={styles.layout}>
            <aside className={styles.sidebar} aria-label="Filters">
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Price per {SESSION_MINUTES}-min session (₹)</span>
                <div className={styles.priceRow}>
                  <Input
                    type="number"
                    min={0}
                    placeholder={data ? String(sessionPrice(data.priceBounds.min)) : "Min"}
                    className={styles.priceInput}
                    value={priceMinDraft}
                    onChange={(e) => setPriceMinDraft(e.target.value)}
                    aria-label="Minimum price"
                  />
                  <span className={styles.priceSeparator}>to</span>
                  <Input
                    type="number"
                    min={0}
                    placeholder={data ? String(sessionPrice(data.priceBounds.max)) : "Max"}
                    className={styles.priceInput}
                    value={priceMaxDraft}
                    onChange={(e) => setPriceMaxDraft(e.target.value)}
                    aria-label="Maximum price"
                  />
                </div>
              </div>

              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Trust</span>
                <label className={styles.checkboxRow}>
                  <Checkbox
                    checked={verifiedOnly}
                    onChange={(e) => updateParams({ verified: e.target.checked ? "1" : null })}
                  />
                  Verified tutors only
                </label>
              </div>

              {hasFilters && (
                <Button variant="ghost" size="sm" className={styles.resetButton} onClick={handleResetFilters}>
                  Reset filters
                </Button>
              )}
            </aside>

            <main>
              <div className={styles.resultsBar}>
                <p className={styles.resultsCount}>
                  {isFetching && !data ? (
                    <Skeleton style={{ width: "100px", height: "20px" }} />
                  ) : (
                    <>
                      <strong>{data?.totalCount ?? 0}</strong> {data?.totalCount === 1 ? "tutor" : "tutors"} available
                    </>
                  )}
                </p>
                <div className={styles.sortControls}>
                  <span className={styles.sortLabel}>Sort by</span>
                  <Select value={sortBy} onValueChange={(v) => updateParams({ sort: v === "recommended" ? null : v })}>
                    <SelectTrigger className={styles.sortTrigger}>
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
                <div className={styles.pagination}>
                  <Button
                    onClick={() => updateParams({ page: String(page - 1) }, false)}
                    disabled={page <= 1}
                    variant="outline"
                  >
                    Previous
                  </Button>
                  <span>
                    Page {page} of {data.totalPages}
                  </span>
                  <Button
                    onClick={() => updateParams({ page: String(page + 1) }, false)}
                    disabled={page >= data.totalPages}
                    variant="outline"
                  >
                    Next
                  </Button>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </>
  );
};

export default ExpertsDirectoryPage;
