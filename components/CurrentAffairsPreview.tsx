import React, { useState } from "react";
import { CheckCircle2, ChevronRight, ExternalLink, Image as ImageIcon, XCircle } from "lucide-react";
import { Button } from "./Button";
import { CurrentAffairsStatusBadge } from "./CurrentAffairsStatusBadge";
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
  related?: { id: number; title: string }[];
}

const LETTERS = ["A", "B", "C", "D"];

const Html: React.FC<{ html: string; className?: string }> = ({ html, className }) => (
  <div className={`${styles.prose} ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
);

const hasText = (html: string) => currentAffairsMeta.stripHtml(html).length > 0;

const Chips: React.FC<{ tags: CurrentAffairsTagRef[] }> = ({ tags }) =>
  tags.length === 0 ? null : (
    <ul className={styles.chips}>
      {tags.map((tag) => (
        <li key={`${tag.kind}-${tag.name}`} className={`${styles.chip} ${styles[`chip_${tag.kind}`]}`}>
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
      <span className={styles.sourceLabel}>Source:</span>{" "}
      {filled.map((source, index) => (
        <React.Fragment key={index}>
          {index > 0 && " - "}
          {source.url ? (
            <a href={source.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
              {source.name || source.url} <ExternalLink size={11} aria-hidden="true" />
            </a>
          ) : (
            source.name
          )}
        </React.Fragment>
      ))}
    </p>
  );
};

const QuizPreview: React.FC<{ quiz: NonNullable<InputType["quiz"]> }> = ({ quiz }) => {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const score = quiz.questions.filter((q, i) => answers[i] !== undefined && answers[i] === q.correctOption).length;

  return (
    <section id="quiz" className={styles.quiz}>
      <div className={styles.quizHead}>
        <h2 className={styles.h2}>{quiz.title || "Daily quiz"}</h2>
        <span className={styles.quizMeta}>
          {quiz.questions.length} MCQs - no login needed{quiz.isPublished ? "" : " - hidden on the site"}
        </span>
      </div>
      <ol className={styles.quizList}>
        {quiz.questions.map((question, index) => (
          <li key={question.key} className={styles.quizQuestion}>
            <p className={styles.quizText}>
              {index + 1}. {question.question || <em className={styles.missing}>Question not written yet</em>}
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
                    <span>{option || <em className={styles.missing}>Empty option</em>}</span>
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
              Score: {score} / {quiz.questions.length}
            </span>
            <Button
              variant="outline"
              onClick={() => {
                setAnswers({});
                setSubmitted(false);
              }}
            >
              Try again
            </Button>
          </>
        ) : (
          <Button onClick={() => setSubmitted(true)} disabled={Object.keys(answers).length === 0}>
            Submit answers
          </Button>
        )}
      </div>
    </section>
  );
};

/*
 * Renders a post roughly the way the planned public Current Affairs page will: hero, byline, at a
 * glance, a table of contents, every item, the quiz and sources. Works from unsaved editor state.
 */
export const CurrentAffairsPreview: React.FC<CurrentAffairsPreviewProps> = ({
  post,
  authorName,
  publishedAt,
  updatedAt,
  related = [],
}) => {
  const isEditorial = post.contentType === "editorial_analysis";
  const isSingle = post.contentType === "individual_item";
  const items = post.items;
  const anchors = items.map((item, index) => `item-${slugify(item.headline) || index + 1}`);
  const when = publishedAt ?? (post.publishAt ? currentAffairsMeta.fromIstInput(post.publishAt) : null);
  const minutes = post.readingTimeIsManual
    ? post.readingTimeMinutes
    : currentAffairsMeta.readingMinutes([
        post.summary,
        post.body,
        ...post.atAGlance,
        ...items.flatMap((i) => [i.headline, i.whyInNews, i.keyPoints, i.background]),
      ]);
  const glance = post.atAGlance.filter((line) => line.trim());
  const postSources = post.sources.filter((s) => s.name.trim() || s.url.trim());
  const corrections = post.corrections.filter((c) => c.date && c.note.trim());
  const showToc = !isSingle && items.length > 1;

  return (
    <article className={styles.root} lang={post.language}>
      <div className={styles.previewBar}>
        <span>Preview - how the public page will lay this out</span>
        <CurrentAffairsStatusBadge status={post.status} />
      </div>

      <nav className={styles.crumbs} aria-label="Breadcrumb">
        Home <ChevronRight size={12} aria-hidden="true" /> Current Affairs <ChevronRight size={12} aria-hidden="true" />{" "}
        {currentAffairsMeta.contentTypeShort(post.contentType)}
      </nav>

      <header className={styles.hero}>
        <h1 className={styles.title}>{post.title || <span className={styles.missing}>Untitled</span>}</h1>
        {post.summary && <p className={styles.standfirst}>{post.summary}</p>}
        <p className={styles.byline}>
          By <strong>{authorName ?? "No author"}</strong>
          {when && <> - Published {currentAffairsMeta.formatIst(when)}</>}
          {updatedAt && when && updatedAt.getTime() - when.getTime() > 60_000 && (
            <> - Updated {currentAffairsMeta.formatIst(updatedAt)}</>
          )}
          {" - "}
          {minutes} min read
          {post.digestDate && <> - Covers {currentAffairsMeta.formatDay(post.digestDate)}</>}
        </p>
        <Chips tags={post.tags} />
      </header>

      <figure className={styles.cover}>
        {post.coverImageUrl ? (
          <img src={post.coverImageUrl} alt={post.coverImageAlt} className={styles.coverImage} />
        ) : (
          <div className={styles.coverEmpty}>
            <ImageIcon size={28} aria-hidden="true" /> No cover image yet
          </div>
        )}
        {post.coverImageCredit && <figcaption className={styles.credit}>Image: {post.coverImageCredit}</figcaption>}
      </figure>

      <div className={`${styles.layout} ${showToc ? "" : styles.layoutSingle}`}>
        {showToc && (
          <aside className={styles.toc}>
            <p className={styles.tocTitle}>On this page</p>
            <ol className={styles.tocList}>
              {items.map((item, index) => (
                <li key={item.key}>
                  <a href={`#${anchors[index]}`} className={styles.tocLink}>
                    {item.headline || `Item ${index + 1}`}
                  </a>
                </li>
              ))}
              {post.quiz && (
                <li>
                  <a href="#quiz" className={styles.tocLink}>
                    Quiz
                  </a>
                </li>
              )}
            </ol>
          </aside>
        )}

        <div className={styles.main}>
          {glance.length > 0 && (
            <section className={styles.glance}>
              <h2 className={styles.label}>At a glance</h2>
              <ul>
                {glance.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </section>
          )}

          {hasText(post.body) && <Html html={post.body} className={isEditorial ? styles.editorial : undefined} />}

          {items.map((item, index) => (
            <section key={item.key} id={anchors[index]} className={styles.item}>
              {!isSingle && <h2 className={styles.h2}>{item.headline || <span className={styles.missing}>Item {index + 1}</span>}</h2>}
              {item.imageUrl && (
                <figure className={styles.itemFigure}>
                  <img src={item.imageUrl} alt={item.imageAlt} className={styles.itemImage} />
                  {item.imageCredit && <figcaption className={styles.credit}>Image: {item.imageCredit}</figcaption>}
                </figure>
              )}
              {item.whyInNews && (
                <>
                  <h3 className={styles.label}>Why in news</h3>
                  <p className={styles.para}>{item.whyInNews}</p>
                </>
              )}
              {hasText(item.keyPoints) && (
                <>
                  <h3 className={styles.label}>Key points</h3>
                  <Html html={item.keyPoints} />
                </>
              )}
              {hasText(item.background) && (
                <>
                  <h3 className={styles.label}>Background</h3>
                  <Html html={item.background} />
                </>
              )}
              <Chips tags={item.tags} />
              <SourceLine sources={item.sources} />
            </section>
          ))}

          {post.quiz && post.quiz.questions.length > 0 && <QuizPreview quiz={post.quiz} />}

          {postSources.length > 0 && (
            <section className={styles.boxed}>
              <h2 className={styles.label}>Sources</h2>
              <ul className={styles.sourceList}>
                {postSources.map((source, index) => (
                  <li key={index}>
                    {source.url ? (
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        {source.name || source.url} <ExternalLink size={11} aria-hidden="true" />
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
            <section className={styles.corrections}>
              <h2 className={styles.label}>Corrections</h2>
              {corrections.map((correction) => (
                <p key={correction.key} className={styles.para}>
                  <strong>{currentAffairsMeta.formatDay(correction.date)}:</strong> {correction.note}
                </p>
              ))}
            </section>
          )}

          {related.length > 0 && (
            <section className={styles.boxed}>
              <h2 className={styles.label}>Related</h2>
              <ul className={styles.sourceList}>
                {related.map((r) => (
                  <li key={r.id}>{r.title}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </article>
  );
};