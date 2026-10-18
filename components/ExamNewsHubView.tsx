import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ChevronLeft, ChevronRight, Newspaper, Search, X } from "lucide-react";
import { examNewsPublicMeta, type ListingScope } from "../helpers/examNewsPublicMeta";
import { useExamNewsList, useExamNewsSidebar } from "../helpers/useExamNewsPublic";
import type { InputType as ListInput } from "../endpoints/exam-news/list_GET.schema";
import { SEOHead } from "./SEOHead";
import { Button } from "./Button";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "./Select";
import { ExamNewsListItem } from "./ExamNewsListItem";
import { ExamNewsSidebar } from "./ExamNewsSidebar";
import styles from "./ExamNewsHubView.module.css";

const ALL_EXAMS = "__all";

interface ExamNewsHubViewProps {
  scope: ListingScope;
  page: number;
  /* The URL itself is wrong (unknown type, bad page number): show the not-found state. */
  invalid?: boolean;
}

/** Page numbers to link, with null for a gap: 1 ... 4 5 6 ... 12. */
const pageWindow = (page: number, totalPages: number): (number | null)[] => {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= totalPages));
  const sorted = [...wanted].sort((a, b) => a - b);
  return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1] > 1 ? [null, n] : [n]));
};

/* Every Exam News listing: the hub, one news type, or one exam, a page at a time. */
export const ExamNewsHubView: React.FC<ExamNewsHubViewProps> = ({ scope, page, invalid = false }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";

  const input: ListInput = { page };
  if (scope.type) input.type = scope.type;
  if (scope.examSlug) input.exam = scope.examSlug;
  if (q) input.q = q;

  const list = useExamNewsList(input, !invalid);
  const sidebar = useExamNewsSidebar();
  const data = list.data;

  const [searchText, setSearchText] = useState(q);
  useEffect(() => setSearchText(q), [q]);

  const examName = data?.exam?.name ?? sidebar.data?.examsWithNews.find((e) => e.slug === scope.examSlug)?.name ?? null;
  const typePlural = scope.type ? examNewsPublicMeta.typePlural(scope.type) : null;
  const pageSuffix = page > 1 ? ` - Page ${page}` : "";

  const heading = scope.type
    ? `Exam ${typePlural}`
    : scope.examSlug
      ? `${examName ?? "Exam"} News & Updates`
      : "Exam News & Updates";
  const intro = scope.type
    ? `The latest ${typePlural!.toLowerCase()} for competitive exams, newest first, each linked to its official notice.`
    : scope.examSlug
      ? `Notifications, admit cards, results, answer keys and date changes for ${examName ?? "this exam"}, in one place.`
      : "Exam notifications, admit cards, results, answer keys, syllabus updates, cut-offs and date changes, in one place and newest first.";
  const seoTitle = scope.type
    ? `Exam ${typePlural}: Latest Updates${pageSuffix}`
    : scope.examSlug
      ? `${examName ?? "Exam"} News, Results & Admit Card Updates${pageSuffix}`
      : `Exam News & Updates${pageSuffix}`;
  const canonicalPath = examNewsPublicMeta.listingPath(scope, page);
  const unknownExam = !!scope.examSlug && !!data && !data.exam;
  const pastTheEnd = !!data && page > data.totalPages;
  const notFound = invalid || unknownExam || pastTheEnd;

  const examOptions = sidebar.data
    ? {
        popular: sidebar.data.popularExams,
        others: sidebar.data.examsWithNews.filter((e) => !sidebar.data!.popularExams.some((p) => p.slug === e.slug)),
      }
    : { popular: [], others: [] };
  const examKnown =
    !scope.examSlug || [...examOptions.popular, ...examOptions.others].some((e) => e.slug === scope.examSlug);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const term = searchText.trim();
    // A new search starts again from the first page of the same listing.
    const base = examNewsPublicMeta.listingPath(scope);
    navigate(term ? `${base}?${new URLSearchParams({ q: term }).toString()}` : base);
  };

  const pageHref = (n: number) => {
    const path = examNewsPublicMeta.listingPath(scope, n);
    return q ? `${path}?${new URLSearchParams({ q }).toString()}` : path;
  };

  const renderList = () => {
    if (list.isLoading && !data) {
      return (
        <div className={styles.skeletons} aria-busy="true" aria-label="Loading exam news">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className={styles.skeletonRow}>
              <Skeleton style={{ width: "10rem", aspectRatio: "16 / 10", borderRadius: "var(--radius-md)" }} />
              <div className={styles.skeletonText}>
                <Skeleton style={{ height: "1rem", width: "30%" }} />
                <Skeleton style={{ height: "1.25rem", width: "85%" }} />
                <Skeleton style={{ height: "0.875rem", width: "70%" }} />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (list.isError && !data) {
      return (
        <div className={styles.state} role="alert">
          <span className={`${styles.stateIcon} ${styles.stateIconError}`} aria-hidden="true">
            <AlertCircle size={22} />
          </span>
          <h2 className={styles.stateTitle}>We could not load exam news</h2>
          <p className={styles.stateText}>Check your connection and try again.</p>
          <Button variant="outline" onClick={() => list.refetch()}>
            Try again
          </Button>
        </div>
      );
    }

    if (!data || data.rows.length === 0) {
      const filtered = !!q || !!scope.type || !!scope.examSlug;
      return (
        <div className={styles.state}>
          <span className={styles.stateIcon} aria-hidden="true">
            <Newspaper size={22} />
          </span>
          <h2 className={styles.stateTitle}>
            {q ? `No updates match "${q}"` : filtered ? "No updates here yet" : "No exam news yet"}
          </h2>
          <p className={styles.stateText}>
            {q
              ? "Try a shorter search, or browse by news type or exam."
              : filtered
                ? "New notifications, results and admit cards will show here as soon as they are published."
                : "Exam updates will show here as soon as they are published."}
          </p>
          {filtered && (
            <Button asChild variant="outline">
              <Link to={examNewsPublicMeta.HUB_PATH}>See all exam news</Link>
            </Button>
          )}
        </div>
      );
    }

    return (
      <>
        <div className={styles.list}>
          {data.rows.map((item) => (
            <ExamNewsListItem key={item.id} item={item} />
          ))}
        </div>
        {data.totalPages > 1 && (
          <nav className={styles.pager} aria-label="Pages">
            {page > 1 ? (
              <Link to={pageHref(page - 1)} className={styles.pagerStep} rel="prev">
                <ChevronLeft size={16} aria-hidden="true" /> Newer
              </Link>
            ) : (
              <span className={`${styles.pagerStep} ${styles.pagerDisabled}`} aria-hidden="true">
                <ChevronLeft size={16} /> Newer
              </span>
            )}
            <ol className={styles.pagerNumbers}>
              {pageWindow(page, data.totalPages).map((n, i) =>
                n === null ? (
                  <li key={`gap-${i}`} className={styles.pagerGap} aria-hidden="true">
                    ...
                  </li>
                ) : (
                  <li key={n}>
                    <Link
                      to={pageHref(n)}
                      className={`${styles.pagerNumber} ${n === page ? styles.pagerCurrent : ""}`}
                      aria-current={n === page ? "page" : undefined}
                      aria-label={`Page ${n}`}
                    >
                      {n}
                    </Link>
                  </li>
                )
              )}
            </ol>
            {page < data.totalPages ? (
              <Link to={pageHref(page + 1)} className={styles.pagerStep} rel="next">
                Older <ChevronRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <span className={`${styles.pagerStep} ${styles.pagerDisabled}`} aria-hidden="true">
                Older <ChevronRight size={16} />
              </span>
            )}
          </nav>
        )}
      </>
    );
  };

  if (notFound) {
    return (
      <div className={styles.page}>
        <SEOHead title="Page not found" description="This Exam News page does not exist." url={canonicalPath} noIndex />
        <div className={styles.state}>
          <span className={styles.stateIcon} aria-hidden="true">
            <Newspaper size={22} />
          </span>
          <h1 className={styles.stateTitle}>{unknownExam ? "We could not find that exam" : "We could not find that page"}</h1>
          <p className={styles.stateText}>
            {unknownExam ? "The link may be wrong, or the exam may have been renamed." : "The link may be wrong, or this page no longer exists."}
          </p>
          <Button asChild variant="outline">
            <Link to={examNewsPublicMeta.HUB_PATH}>Back to Exam News</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SEOHead
        title={seoTitle}
        description={intro}
        url={canonicalPath}
        // An exam or type listing with nothing in it yet is thin: kept crawlable but out of the index.
        noIndex={!!data && data.total === 0 && (!!scope.type || !!scope.examSlug) && !q}
      />

      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            {scope.type || scope.examSlug ? <Link to={examNewsPublicMeta.HUB_PATH}>Exam News</Link> : <span aria-current="page">Exam News</span>}
          </li>
          {(scope.type || scope.examSlug) && (
            <li>
              <span aria-current="page">{scope.type ? typePlural : examName ?? scope.examSlug}</span>
            </li>
          )}
        </ol>
      </nav>

      <header className={styles.header}>
        <h1 className={styles.heading}>
          {heading}
          {page > 1 && <span className={styles.headingPage}> - Page {page}</span>}
        </h1>
        <p className={styles.intro}>{intro}</p>
      </header>

      <section className={styles.discovery} aria-label="Filter exam news">
        <nav className={styles.typeChips} aria-label="News types">
          <Link
            to={examNewsPublicMeta.HUB_PATH}
            className={`${styles.typeChip} ${!scope.type && !scope.examSlug ? styles.typeChipActive : ""}`}
            aria-current={!scope.type && !scope.examSlug ? "page" : undefined}
          >
            All
          </Link>
          {examNewsPublicMeta.TYPES.map((type) => (
            <Link
              key={type.value}
              to={examNewsPublicMeta.listingPath({ type: type.value })}
              className={`${styles.typeChip} ${scope.type === type.value ? styles.typeChipActive : ""}`}
              aria-current={scope.type === type.value ? "page" : undefined}
            >
              {type.plural}
            </Link>
          ))}
        </nav>

        <div className={styles.filterRow}>
          <form className={styles.searchForm} role="search" onSubmit={submitSearch}>
            <Search size={16} className={styles.searchIcon} aria-hidden="true" />
            <Input
              type="search"
              name="q"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search news headlines"
              aria-label="Search news headlines"
              className={styles.searchInput}
            />
            <Button type="submit" className={styles.searchButton}>
              Search
            </Button>
          </form>

          <div className={styles.examFilter}>
            <Select
              value={scope.examSlug ?? ALL_EXAMS}
              onValueChange={(value) => {
                // Radix can report "" while the chosen item is still mounting; that is not a choice.
                if (!value || value === (scope.examSlug ?? ALL_EXAMS)) return;
                navigate(value === ALL_EXAMS ? examNewsPublicMeta.HUB_PATH : examNewsPublicMeta.listingPath({ examSlug: value }));
              }}
            >
              <SelectTrigger aria-label="Filter by exam" className={styles.examTrigger}>
                <SelectValue placeholder="All exams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_EXAMS}>All exams</SelectItem>
                {!examKnown && scope.examSlug && <SelectItem value={scope.examSlug}>{examName ?? scope.examSlug}</SelectItem>}
                {examOptions.popular.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Popular exams</SelectLabel>
                    {examOptions.popular.map((exam) => (
                      <SelectItem key={exam.slug} value={exam.slug}>
                        {exam.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {examOptions.others.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>More exams in the news</SelectLabel>
                    {examOptions.others.map((exam) => (
                      <SelectItem key={exam.slug} value={exam.slug}>
                        {exam.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {q && (
          <p className={styles.searchNote} role="status">
            {data ? `${data.total} result${data.total === 1 ? "" : "s"}` : "Searching"} for <strong>"{q}"</strong>
            <Link to={examNewsPublicMeta.listingPath(scope)} className={styles.clearSearch}>
              <X size={14} aria-hidden="true" /> Clear search
            </Link>
          </p>
        )}
      </section>

      <div className={styles.layout}>
        <main className={styles.main} aria-busy={list.isFetching}>
          <div className={styles.listHead}>
            <h2 className={styles.listTitle}>{q ? "Search results" : "Latest updates"}</h2>
            {data && data.total > 0 && (
              <span className={styles.listCount}>
                {data.total} update{data.total === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {renderList()}
        </main>

        <ExamNewsSidebar
          data={sidebar.data}
          isLoading={sidebar.isLoading}
          activeType={scope.type}
          activeExam={scope.examSlug}
        />
      </div>
    </div>
  );
};