import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Frown, MapPin, Briefcase, Star, Users as UsersIcon } from "lucide-react";
import { SEOHead } from "../components/SEOHead";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { Checkbox } from "../components/Checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { useDebounce } from "../helpers/useDebounce";
import { getExpertsList } from "../endpoints/experts/list_GET.schema";
import type { ExpertSortValue } from "../endpoints/experts/list_GET.schema";
import styles from "./expert.module.css";

const ITEMS_PER_PAGE = 20;

const SORT_OPTIONS: { value: ExpertSortValue; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Highest Rated" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const ExpertsDirectoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const sortBy = (searchParams.get("sort") as ExpertSortValue) || "recommended";
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

  const { data, isFetching, error } = useQuery({
    queryKey: ["experts", "list", debouncedSearch, minPrice, maxPrice, verifiedOnly, sortBy, page],
    queryFn: () =>
      getExpertsList({
        search: debouncedSearch || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
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

  const canonicalUrl = "https://testkart.in/expert";

  const renderContent = () => {
    if (isFetching) {
      return Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className={styles.skeletonCard} />);
    }

    if (error) {
      return (
        <div className={styles.stateContainer}>
          <Frown size={40} />
          <h3>Could not load tutors</h3>
          <p>Please try again in a moment.</p>
        </div>
      );
    }

    if (!data || data.teachers.length === 0) {
      return (
        <div className={styles.stateContainer}>
          <Search size={40} />
          <h3>No tutors found</h3>
          <p>Try a different search term or widen your filters.</p>
        </div>
      );
    }

    return data.teachers.map((teacher) => (
      <div
        key={teacher.id}
        className={styles.card}
        role="link"
        tabIndex={0}
        onClick={() => navigate(`/expert/${teacher.slug}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter") navigate(`/expert/${teacher.slug}`);
        }}
      >
        <div className={styles.cardAvatarCol}>
          {teacher.avatarUrl ? (
            <img src={teacher.avatarUrl} alt="" className={styles.avatar} loading="lazy" />
          ) : (
            <span className={styles.avatarFallback} aria-hidden="true">
              {getInitials(teacher.displayName)}
            </span>
          )}
        </div>

        <div className={styles.cardMain}>
          <div className={styles.cardTopRow}>
            <div>
              <div className={styles.cardNameRow}>
                <h3 className={styles.cardName}>{teacher.displayName}</h3>
                <VerifiedBadge isVerified={teacher.isVerified} size="xs" />
              </div>
              {teacher.rating != null && (
                <div className={styles.ratingRow}>
                  <span className={styles.ratingStars}>
                    <Star size={14} fill="currentColor" aria-hidden="true" />
                  </span>
                  <strong>{teacher.rating.toFixed(1)}</strong>
                  <span className={styles.ratingCount}>({teacher.reviewsCount} reviews)</span>
                </div>
              )}
            </div>
            {teacher.pricePer25Min != null && (
              <div className={styles.cardPriceBlock}>
                <span className={styles.cardPrice}>₹{teacher.pricePer25Min.toLocaleString("en-IN")}</span>
                <span className={styles.cardPriceUnit}>25-min lesson</span>
              </div>
            )}
          </div>

          {teacher.tagline && <p className={styles.cardTagline}>{teacher.tagline}</p>}
          {teacher.bio && <p className={styles.cardBio}>{teacher.bio}</p>}

          <div className={styles.cardMetaRow}>
            {teacher.location && (
              <span>
                <MapPin size={13} aria-hidden="true" /> {teacher.location}
              </span>
            )}
            {teacher.yearsOfExperience != null && (
              <span>
                <Briefcase size={13} aria-hidden="true" /> {teacher.yearsOfExperience}+ yrs experience
              </span>
            )}
            {teacher.studentsCount > 0 && (
              <span>
                <UsersIcon size={13} aria-hidden="true" /> {teacher.studentsCount.toLocaleString("en-IN")} students taught
              </span>
            )}
          </div>

          {(teacher.teachingCategories.length > 0 || teacher.expertiseAreas.length > 0) && (
            <div className={styles.cardTags}>
              {[...teacher.teachingCategories, ...teacher.expertiseAreas].slice(0, 4).map((tag, i) => (
                <span key={i} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className={styles.cardFooterRow} onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="outline" onClick={() => navigate(`/expert/${teacher.slug}`)}>
              View profile
            </Button>
            {teacher.mentorshipEnabled && (
              <Button size="sm" onClick={() => navigate(`/expert/${teacher.slug}`)}>
                Book a trial
              </Button>
            )}
          </div>
        </div>
      </div>
    ));
  };

  return (
    <>
      <SEOHead
        title="Find a Tutor | Testkart"
        description="Browse verified educators on Testkart, compare prices and ratings, and book a live 1:1 session or join a live group class with the tutor of your choice."
        url={canonicalUrl}
      />
      <div className={styles.pageContainer}>
        <header className={styles.pageHeader}>
          <h1>Find a Tutor</h1>
          <p>Browse our educators, compare prices and ratings, and book a live 1:1 session or group class.</p>
          <div className={styles.searchBar}>
            <div className={styles.searchInputWrap}>
              <Search className={styles.searchIcon} size={18} aria-hidden="true" />
              <Input
                type="search"
                placeholder="Search tutors by name or subject..."
                className={styles.searchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search tutors"
              />
            </div>
          </div>
        </header>

        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Price per 25-min lesson (₹)</span>
              <div className={styles.priceRow}>
                <Input
                  type="number"
                  min={0}
                  placeholder={data ? String(data.priceBounds.min) : "Min"}
                  className={styles.priceInput}
                  value={priceMinDraft}
                  onChange={(e) => setPriceMinDraft(e.target.value)}
                  aria-label="Minimum price"
                />
                <span className={styles.priceSeparator}>–</span>
                <Input
                  type="number"
                  min={0}
                  placeholder={data ? String(data.priceBounds.max) : "Max"}
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

            <Button variant="ghost" size="sm" className={styles.resetButton} onClick={handleResetFilters}>
              Reset filters
            </Button>
          </aside>

          <main>
            <div className={styles.resultsBar}>
              <p className={styles.resultsCount}>
                {isFetching ? (
                  <Skeleton style={{ width: "100px", height: "20px" }} />
                ) : (
                  <>
                    <strong>{data?.totalCount ?? 0}</strong> tutors found
                  </>
                )}
              </p>
              <div className={styles.sortControls}>
                <span className={styles.sortLabel}>Sort by:</span>
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
    </>
  );
};

export default ExpertsDirectoryPage;
