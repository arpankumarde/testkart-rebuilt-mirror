import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CalendarCheck,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  EyeOff,
  HelpCircle,
  Image as ImageIcon,
  ListChecks,
  LockOpen,
  Newspaper,
  Tag,
  UserRound,
  XCircle,
} from "lucide-react";
import { Button } from "./Button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./Dialog";
import { CurrentAffairsSourceLinks } from "./CurrentAffairsSourceLinks";
import { currentAffairsMeta } from "../helpers/currentAffairsMeta";
import { wrapContentTables } from "../helpers/contentTables";
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
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
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
  <div className={`${styles.prose} ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: wrapContentTables(sanitizeHtml(html)) }} />
);

const hasText = (html: string) => currentAffairsMeta.stripHtml(html).length > 0;

/* Server-rendered pages hand dates over as JSON strings; accept either form. */
const toDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

/* On the public page a topic pill opens the Current Affairs list filtered to that topic. */
const Pills: React.FC<{ tags: CurrentAffairsTagRef[]; linkTopics?: boolean }> = ({ tags, linkTopics = false }) =>
  tags.length === 0 ? null : (
    <ul className={styles.pills} aria-label="Tags">
      {tags.map((tag) => (
        <li key={`${tag.kind}-${tag.name}`}>
          {linkTopics && tag.kind === "topic" ? (
            <Link
              to={`${currentAffairsMeta.HUB_PATH}?topic=${slugify(tag.name)}`}
              className={`${styles.pill} ${styles[`pill_${tag.kind}`]} ${styles.pillLink}`}
              title={`More stories on ${tag.name}`}
            >
              {tag.name}
            </Link>
          ) : (
            <span className={`${styles.pill} ${styles[`pill_${tag.kind}`]}`}>{tag.name}</span>
          )}
        </li>
      ))}
    </ul>
  );

const hasSource = (sources: { name: string; url: string }[]) => sources.some((s) => s.name.trim() || s.url.trim());

type Quiz = NonNullable<InputType["quiz"]>;

const QUIZ_BLURB: Record<"daily" | "weekly" | "monthly", string> = {
  daily: "Test your knowledge of the day's current affairs.",
  weekly: "Test your knowledge of the week's current affairs.",
  monthly: "Test your knowledge of the month's current affairs.",
};

const QuizQuestions: React.FC<{
  quiz: Quiz;
  answers: Record<number, number>;
  submitted: boolean;
  onPick: (question: number, option: number) => void;
}> = ({ quiz, answers, submitted, onPick }) => (
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
                onClick={() => onPick(index, optionIndex)}
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
);

/*
 * The quiz sits in the article as a preview card; the questions open in a dialog. Answers live
 * here rather than in the dialog, so closing it and coming back resumes where the reader left off.
 */
const QuizSection: React.FC<{ quiz: Quiz; id: string; period: string; blurb: string }> = ({ quiz, id, period, blurb }) => {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const total = quiz.questions.length;
  const answered = Object.keys(answers).length;
  const score = quiz.questions.filter((q, i) => answers[i] !== undefined && answers[i] === q.correctOption).length;
  const title = quiz.title || "Quiz";
  const showDate = !!period && !title.includes(period);
  const minutes = Math.max(1, Math.ceil(total / 2));
  const questionsLabel = `${total} ${total === 1 ? "question" : "questions"}`;
  const cta = submitted ? "Review Answers" : answered > 0 ? "Resume Quiz" : "Start Quiz";
  const titleId = `${id}-title`;

  const toTop = () => bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  const submit = () => {
    setSubmitted(true);
    toTop();
  };
  const reset = () => {
    setAnswers({});
    setSubmitted(false);
    toTop();
  };

  return (
    <section id={id} className={styles.quizCard} data-toc-section aria-labelledby={titleId} onClick={() => setOpen(true)}>
      <span className={styles.quizArt} aria-hidden="true">
        <ListChecks size={30} strokeWidth={2.25} />
      </span>
      <div className={styles.quizCardBody}>
        <p className={styles.quizEyebrow}>Current affairs quiz</p>
        <h2 id={titleId} className={styles.quizCardTitle}>
          {title}
        </h2>
        <p className={styles.quizBlurb}>{blurb}</p>
        <ul className={styles.quizFacts}>
          {showDate && (
            <li>
              <CalendarDays size={14} aria-hidden="true" />
              {period}
            </li>
          )}
          <li>
            <HelpCircle size={14} aria-hidden="true" />
            {questionsLabel}
          </li>
          <li>
            <Clock size={14} aria-hidden="true" />
            About {minutes} min
          </li>
          <li>
            <LockOpen size={14} aria-hidden="true" />
            No login needed
          </li>
          {!quiz.isPublished && (
            <li className={styles.quizHidden}>
              <EyeOff size={14} aria-hidden="true" />
              Hidden on the site
            </li>
          )}
        </ul>
        <div className={styles.quizCardActions}>
          <Button
            size="lg"
            className={styles.quizCta}
            aria-haspopup="dialog"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(true);
            }}
          >
            {cta}
            <ArrowRight size={18} aria-hidden="true" />
          </Button>
          {submitted ? (
            <span className={styles.quizStatus}>
              You scored {score} / {total}
            </span>
          ) : answered > 0 ? (
            <span className={styles.quizStatus}>
              {answered} of {total} answered
            </span>
          ) : null}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={styles.quizDialog} onClick={(event) => event.stopPropagation()}>
          <header className={styles.quizHead}>
            <span className={styles.quizIcon} aria-hidden="true">
              <ListChecks size={18} />
            </span>
            <div>
              <DialogTitle className={styles.quizTitle}>{title}</DialogTitle>
              <DialogDescription className={styles.quizMeta}>
                {questionsLabel} - no login needed
                {quiz.isPublished ? "" : " - hidden on the site"}
              </DialogDescription>
            </div>
          </header>
          <div
            className={styles.quizProgress}
            role="progressbar"
            aria-label="Questions answered"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={answered}
          >
            <span style={{ width: `${total ? (answered / total) * 100 : 0}%` }} />
          </div>
          <div ref={bodyRef} className={styles.quizBody}>
            <QuizQuestions
              quiz={quiz}
              answers={answers}
              submitted={submitted}
              onPick={(question, option) => setAnswers((prev) => ({ ...prev, [question]: option }))}
            />
          </div>
          <footer className={styles.quizFoot}>
            {submitted ? (
              <>
                <span className={styles.score}>
                  You scored {score} / {total}
                </span>
                <Button variant="outline" size="sm" className={styles.quizFootEnd} onClick={reset}>
                  Try again
                </Button>
                <Button size="sm" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </>
            ) : (
              <>
                <span className={styles.quizCount}>
                  {answered} of {total} answered
                </span>
                <Button size="sm" className={styles.quizFootEnd} onClick={submit} disabled={answered === 0}>
                  Submit answers
                </Button>
              </>
            )}
          </footer>
        </DialogContent>
      </Dialog>
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
  // The same ids the server saves as anchor_slug, so story links from the listing land here.
  const anchors = currentAffairsMeta.itemAnchors(items.map((item) => item.headline));
  const quizId = "quiz";
  const hasQuiz = !!post.quiz && post.quiz.questions.length > 0;
  const when = toDate(publishedAt) ?? (post.publishAt ? currentAffairsMeta.fromIstInput(post.publishAt) : null);
  const updated = toDate(updatedAt);
  const minutes = post.readingTimeIsManual
    ? post.readingTimeMinutes
    : currentAffairsMeta.readingMinutes([
        post.summary,
        post.body,
        ...post.atAGlance,
        ...items.flatMap((i) => [i.headline, i.whyInNews, i.keyPoints, i.background]),
      ]);
  const period = post.digestDate ? currentAffairsMeta.periodLabel(post.contentType, post.digestDate) : "";
  const archive = currentAffairsMeta.archiveOf(post.contentType);
  const quizBlurb = archive ? QUIZ_BLURB[archive] : "Test your knowledge of the stories above.";
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
          {updated && when && updated.getTime() - when.getTime() > 60_000 && (
            <li>Updated {currentAffairsMeta.formatIst(updated)}</li>
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
              {item.whyInNews.trim() && (
                <div className={styles.why}>
                  <h3 className={`${styles.label} ${styles.labelIcon}`}>
                    <Newspaper size={14} aria-hidden="true" />
                    Why in news
                  </h3>
                  <p className={styles.para}>{item.whyInNews}</p>
                </div>
              )}
              {hasText(item.keyPoints) && (
                <div className={styles.block}>
                  <h3 className={styles.label}>Key points</h3>
                  <Html html={item.keyPoints} className={styles.keyPoints} />
                </div>
              )}
              {hasText(item.background) && (
                <div className={styles.block}>
                  <h3 className={styles.label}>Background</h3>
                  <Html html={item.background} className={styles.proseQuiet} />
                </div>
              )}
              {(item.tags.length > 0 || hasSource(item.sources)) && (
                <footer className={styles.itemFoot}>
                  {item.tags.length > 0 && (
                    <div className={styles.footGroup}>
                      <h3 className={styles.footLabel}>
                        <Tag size={13} aria-hidden="true" />
                        Topics
                      </h3>
                      <Pills tags={item.tags} linkTopics={publicView} />
                    </div>
                  )}
                  <CurrentAffairsSourceLinks sources={item.sources} />
                </footer>
              )}
            </section>
          ))}

          {hasQuiz && post.quiz && <QuizSection quiz={post.quiz} id={quizId} period={period} blurb={quizBlurb} />}

          {postSources.length > 0 && (
            <div className={styles.panel}>
              <CurrentAffairsSourceLinks sources={postSources} headingLevel={2} />
            </div>
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
