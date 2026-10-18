import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  EyeOff,
  Image as ImageIcon,
  ListChecks,
  UserRound,
  XCircle,
} from "lucide-react";
import { Button } from "./Button";
import { currentAffairsMeta } from "../helpers/currentAffairsMeta";
import { sanitizeHtml } from "../helpers/sanitizeHtml";
import { slugify } from "../helpers/slugify";
import type { InputType, CurrentAffairsTagRef } from "../endpoints/admin/current-affairs/save_POST.schema";
import type { CurrentAffairsStatus } from "../helpers/schema";
import styles from "./CurrentAffairsPreview.module.css";

export type CurrentAffairsPreviewDoc = Omit<InputType, "status"> & { status: CurrentAffairsStatus };

interface CurrentAffairsPreviewProps {
  post: CurrentAffairsPreviewDoc;
  authorName: string | null;
  /* When it went or goes live; falls back to the form's publish time. */
  publishedAt?: Date | null;
  updatedAt?: Date | null;
  /* href turns a related post into a link (the public page passes one; the admin preview does not). */
  related?: { id: number; title: string; href?: string }[];
  /* The public page: it draws its own linked breadcrumb, and a missing cover is simply left out
     rather than flagged the way the admin preview flags it. */
  publicView?: boolean;
}

const LETTERS = ["A", "B", "C", "D"];

/* A section counts as the one being read once its top passes this far below the sticky
   contents list's own top (or the viewport top, when the list is not sticky). */
const ACTIVE_SLACK = 56;
const FALLBACK_OFFSET = 140;

const NOTICE: Record<CurrentAffairsStatus, string | null> = {
  draft: "Draft preview - not visible on the site",
  scheduled: "Scheduled - not visible on the site yet",
  archived: "Archived - hidden from the site",
  published: null,
};

const Html: React.FC<{ html: string; className?: string }> = ({ html, className }) => (
  <div className={`${styles.prose} ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
);

const hasText = (html: string) => currentAffairsMeta.stripHtml(html).length > 0;

const Pills: React.FC<{ tags: CurrentAffairsTagRef[] }> = ({ tags }) =>
  tags.length === 0 ? null : (
    <ul className={styles.pills} aria-label="Tags">
      {tags.map((tag) => (
        <li key={`${tag.kind}-${tag.name}`} className={`${styles.pill} ${styles[`pill_${tag.kind}`]}`}>
          {tag.name}
        </li>
      ))}
    </ul>
  );

const SourceLine: React.FC<{ sources: { name: string; url: string }[] }> = ({ sources }) => {
  const filled = sources.filter((s) => s.name.trim() || s.url.trim());
  if (filled.length === 0) return null;
  return (
    <p className={styles.sourceLine}>
      <span className={styles.sourceLabel}>Source</span>
      {filled.map((source, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span aria-hidden="true">,</span>}
          {source.url ? (
            <a href={source.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
              {source.name || source.url}
              <ExternalLink size={11} aria-hidden="true" />
            </a>
          ) : (
            <span>{source.name}</span>
          )}
        </React.Fragment>
      ))}
    </p>
  );
};

const QuizPreview: React.FC<{ quiz: NonNullable<InputType["quiz"]>; id: string }> = ({ quiz, id }) => {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const score = quiz.questions.filter((q, i) => answers[i] !== undefined && answers[i] === q.correctOption).length;

  return (
    <section id={id} className={styles.quiz} data-toc-section>
      <header className={styles.quizHead}>
        <span className={styles.quizIcon} aria-hidden="true">
          <ListChecks size={18} />
        </span>
        <div>
          <h2 className={styles.quizTitle}>{quiz.title || "Quiz"}</h2>
          <p className={styles.quizMeta}>
            {quiz.questions.length} questions - no login needed
            {quiz.isPublished ? "" : " - hidden on the site"}
          </p>
        </div>
      </header>
      <ol className={styles.quizList}>
        {quiz.questions.map((question, index) => (
          <li key={question.key} className={styles.quizQuestion}>
            <p className={styles.quizText}>
              <span className={styles.quizNumber}>{index + 1}.</span>
              {question.question || <em className={styles.missing}>Question not written yet</em>}
            </p>
            <div className={styles.quizOptions}>
              {question.options.map((option, optionIndex) => {
                const picked = answers[index] === optionIndex;
                const correct = question.correctOption === optionIndex;
                const state = submitted ? (correct ? styles.optRight : picked ? styles.optWrong : "") : picked ? styles.optPicked : "";
                return (
                  <button
                    key={optionIndex}
                    type="button"
                    disabled={submitted}
                    aria-pressed={picked}
                    className={`${styles.quizOption} ${state}`}
                    onClick={() => setAnswers((prev) => ({ ...prev, [index]: optionIndex }))}
                  >
                    <span className={styles.optLetter}>{LETTERS[optionIndex]}</span>
                    <span className={styles.optText}>{option || <em className={styles.missing}>Empty option</em>}</span>
                    {submitted && correct && <CheckCircle2 size={16} className={styles.optIcon} aria-label="Correct answer" />}
                    {submitted && picked && !correct && <XCircle size={16} className={styles.optIcon} aria-label="Your answer" />}
                  </button>
                );
              })}
            </div>
            {submitted && question.explanation && <p className={styles.explanation}>{question.explanation}</p>}
          </li>
        ))}
      </ol>
      <div className={styles.quizFoot}>
        {submitted ? (
          <>
            <span className={styles.score}>
              You scored {score} / {quiz.questions.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAnswers({});
                setSubmitted(false);
              }}
            >
              Try again
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => setSubmitted(true)} disabled={Object.keys(answers).length === 0}>
            Submit answers
          </Button>
        )}
      </div>
    </section>
  );
};

/*
 * Renders a post the way the planned public Current Affairs page will: header, cover, a sticky
 * table of contents beside the items, the quiz and sources. Works from unsaved editor state, so
 * the editor's preview dialog and the saved-version preview page share it.
 */
export const CurrentAffairsPreview: React.FC<CurrentAffairsPreviewProps> = ({
  post,
  authorName,
  publishedAt,
  updatedAt,
  related = [],
  publicView = false,
}) => {
  const rootRef = useRef<HTMLElement | null>(null);
  const tocRef = useRef<HTMLElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(false);

  const isSingle = post.contentType === "individual_item";
  const items = post.items;
  const anchors = items.map((item, index) => currentAffairsMeta.itemAnchor(index, item.headline));
  const quizId = "quiz";
  const hasQuiz = !!post.quiz && post.quiz.questions.length > 0;
  const when = publishedAt ?? (post.publishAt ? currentAffairsMeta.fromIstInput(post.publishAt) : null);
  const minutes = post.readingTimeIsManual
    ? post.readingTimeMinutes
    : currentAffairsMeta.readingMinutes([
        post.summary,
        post.body,
        ...post.atAGlance,
        ...items.flatMap((i) => [i.headline, i.whyInNews, i.keyPoints, i.background]),
      ]);
  const period = post.digestDate ? currentAffairsMeta.periodLabel(post.contentType, post.digestDate) : "";
  const glance = post.atAGlance.filter((line) => line.trim());
  const postSources = post.sources.filter((s) => s.name.trim() || s.url.trim());
  const corrections = post.corrections.filter((c) => c.date && c.note.trim());
  const toc = [
    ...items.map((item, index) => ({ id: anchors[index], label: item.headline || `Item ${index + 1}` })),
    ...(hasQuiz ? [{ id: quizId, label: post.quiz?.title || "Quiz" }] : []),
  ];
  const showToc = !isSingle && toc.length > 1;
  const notice = NOTICE[post.status];

  // Scroll events do not bubble, so listen in the capture phase: the page may scroll inside the
  // admin main area or a dialog body rather than the window.
  useEffect(() => {
    if (!showToc) return;
    const update = () => {
      const sections = Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-toc-section]") ?? []);
      if (sections.length === 0) return;
      // The sticky offset is relative to whatever scrolls, so measure where the list really sits.
      const toc = tocRef.current;
      const threshold =
        toc && getComputedStyle(toc).position === "sticky" ? toc.getBoundingClientRect().top + ACTIVE_SLACK : FALLBACK_OFFSET;
      let current: string | null = sections[0]?.id ?? null;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= threshold) current = section.id;
      }
      // A short last section may never reach the line; at the end of the article it wins.
      const last = sections[sections.length - 1];
      const articleBottom = rootRef.current?.getBoundingClientRect().bottom ?? Infinity;
      if (articleBottom <= window.innerHeight + 4 && last.getBoundingClientRect().top < window.innerHeight) {
        current = last.id;
      }
      setActiveId(current);
    };
    update();
    document.addEventListener("scroll", update, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", update, { capture: true });
  }, [showToc, toc.length]);

  const jumpTo = (event: React.MouseEvent, id: string) => {
    event.preventDefault();
    const target = rootRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
    setTocOpen(false);
  };

  return (
    <article ref={rootRef} className={styles.root} lang={post.language}>
      {notice && (
        <p className={styles.notice}>
          <EyeOff size={14} aria-hidden="true" />
          {notice}
        </p>
      )}

      <header className={styles.hero}>
        {!publicView && (
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <span>Home</span>
            <ChevronRight size={12} aria-hidden="true" />
            <span>Current Affairs</span>
            <ChevronRight size={12} aria-hidden="true" />
            <span>{currentAffairsMeta.contentTypeShort(post.contentType)}</span>
          </nav>
        )}

        <h1 className={styles.title}>{post.title || <span className={styles.missing}>Untitled</span>}</h1>
        {post.summary && <p className={styles.standfirst}>{post.summary}</p>}

        <ul className={styles.byline}>
          <li>
            <UserRound size={14} aria-hidden="true" />
            By <strong>{authorName ?? "No author"}</strong>
          </li>
          {when && (
            <li>
              <CalendarCheck size={14} aria-hidden="true" />
              {currentAffairsMeta.formatIst(when)}
            </li>
          )}
          {updatedAt && when && updatedAt.getTime() - when.getTime() > 60_000 && (
            <li>Updated {currentAffairsMeta.formatIst(updatedAt)}</li>
          )}
          <li>
            <Clock size={14} aria-hidden="true" />
            {minutes} min read
          </li>
          {period && (
            <li>
              <CalendarRange size={14} aria-hidden="true" />
              Covers {period}
            </li>
          )}
        </ul>

        <Pills tags={post.tags} />
      </header>

      {post.coverImageUrl ? (
        <figure className={styles.cover}>
          <img src={post.coverImageUrl} alt={post.coverImageAlt} className={styles.coverImage} />
          {post.coverImageCredit && <figcaption className={styles.credit}>Image: {post.coverImageCredit}</figcaption>}
        </figure>
      ) : publicView ? null : (
        <div className={styles.coverEmpty}>
          <ImageIcon size={18} aria-hidden="true" /> No cover image
        </div>
      )}

      <div className={`${styles.layout} ${showToc ? "" : styles.layoutSingle}`}>
        {showToc && (
          <nav ref={tocRef} className={styles.toc} aria-label="On this page">
            <button
              type="button"
              className={styles.tocToggle}
              aria-expanded={tocOpen}
              onClick={() => setTocOpen((open) => !open)}
            >
              On this page <span className={styles.tocCount}>{toc.length}</span>
              <ChevronDown size={16} className={`${styles.tocChevron} ${tocOpen ? styles.tocChevronOpen : ""}`} aria-hidden="true" />
            </button>
            <p className={styles.tocTitle}>On this page</p>
            <ol className={`${styles.tocList} ${tocOpen ? styles.tocListOpen : ""}`}>
              {toc.map((entry, index) => (
                <li key={entry.id}>
                  <a
                    href={`#${entry.id}`}
                    className={`${styles.tocLink} ${activeId === entry.id ? styles.tocLinkActive : ""}`}
                    aria-current={activeId === entry.id ? "location" : undefined}
                    onClick={(event) => jumpTo(event, entry.id)}
                  >
                    <span className={styles.tocNumber}>{entry.id === quizId ? "Q" : index + 1}</span>
                    <span className={styles.tocLabel}>{entry.label}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className={styles.main}>
          {glance.length > 0 && (
            <section className={styles.glance}>
              <h2 className={styles.label}>At a glance</h2>
              <ul className={styles.list}>
                {glance.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </section>
          )}

          {hasText(post.body) && <Html html={post.body} />}

          {items.map((item, index) => (
            <section key={item.key} id={anchors[index]} className={styles.item} data-toc-section>
              {!isSingle && (
                <h2 className={styles.itemTitle}>
                  <span className={styles.itemNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <span>{item.headline || <span className={styles.missing}>Item {index + 1}</span>}</span>
                </h2>
              )}
              {item.imageUrl && (
                <figure className={styles.itemFigure}>
                  <img src={item.imageUrl} alt={item.imageAlt} className={styles.itemImage} />
                  {item.imageCredit && <figcaption className={styles.credit}>Image: {item.imageCredit}</figcaption>}
                </figure>
              )}
              {item.whyInNews && (
                <div className={styles.why}>
                  <h3 className={styles.label}>Why in news</h3>
                  <p className={styles.para}>{item.whyInNews}</p>
                </div>
              )}
              {hasText(item.keyPoints) && (
                <div className={styles.block}>
                  {item.whyInNews && <h3 className={styles.label}>Key points</h3>}
                  <Html html={item.keyPoints} />
                </div>
              )}
              {hasText(item.background) && (
                <div className={styles.block}>
                  <h3 className={styles.label}>Background</h3>
                  <Html html={item.background} />
                </div>
              )}
              {(item.tags.length > 0 || item.sources.some((s) => s.url.trim() || s.name.trim())) && (
                <footer className={styles.itemFoot}>
                  <Pills tags={item.tags} />
                  <SourceLine sources={item.sources} />
                </footer>
              )}
            </section>
          ))}

          {hasQuiz && post.quiz && <QuizPreview quiz={post.quiz} id={quizId} />}

          {postSources.length > 0 && (
            <section className={styles.panel}>
              <h2 className={styles.label}>Sources</h2>
              <ul className={styles.list}>
                {postSources.map((source, index) => (
                  <li key={index}>
                    {source.url ? (
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        {source.name || source.url}
                        <ExternalLink size={11} aria-hidden="true" />
                      </a>
                    ) : (
                      source.name
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {corrections.length > 0 && (
            <section className={`${styles.panel} ${styles.corrections}`}>
              <h2 className={styles.label}>Corrections</h2>
              {corrections.map((correction) => (
                <p key={correction.key} className={styles.para}>
                  <strong>{currentAffairsMeta.formatDay(correction.date)}:</strong> {correction.note}
                </p>
              ))}
            </section>
          )}

          {related.length > 0 && (
            <section className={styles.panel}>
              <h2 className={styles.label}>Related</h2>
              <ul className={styles.list}>
                {related.map((r) => (
                  <li key={r.id}>
                    {r.href ? (
                      <Link to={r.href} className={styles.link}>
                        {r.title}
                      </Link>
                    ) : (
                      r.title
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </article>
  );
};
