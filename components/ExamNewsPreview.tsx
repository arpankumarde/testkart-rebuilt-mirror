import React from "react";
import { AlertTriangle, CalendarClock, ExternalLink, FilePenLine, Image as ImageIcon, Landmark } from "lucide-react";
import { examNewsMeta } from "../helpers/examNewsMeta";
import { sanitizeHtml } from "../helpers/sanitizeHtml";
import type { InputType } from "../endpoints/admin/exam-news/save_POST.schema";
import type { ExamNewsStatus } from "../helpers/schema";
import styles from "./ExamNewsPreview.module.css";

export type ExamNewsPreviewDoc = Omit<InputType, "status"> & { status: ExamNewsStatus };

interface ExamNewsPreviewProps {
  post: ExamNewsPreviewDoc;
  examName: string | null;
  authorName: string | null;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
}

const NOTICE: Record<ExamNewsStatus, string | null> = {
  draft: "Draft preview - not visible on the site",
  scheduled: "Scheduled - not visible on the site yet",
  archived: "Archived - hidden from the site",
  published: null,
};

const DATE_LABELS = [
  { key: "startDate", label: "Starts" },
  { key: "endDate", label: "Ends" },
  { key: "examDate", label: "Exam" },
  { key: "resultDate", label: "Result" },
] as const;

const hasText = (html: string) => examNewsMeta.stripHtml(html).length > 0;

/* A story laid out like its public /exam-news/{slug} page (wireframe page 4), for the admin preview. */
export const ExamNewsPreview: React.FC<ExamNewsPreviewProps> = ({ post, examName, authorName, publishedAt, updatedAt }) => {
  const notice = NOTICE[post.status];
  const keyDates = post.keyDates.filter((row) => row.eventName.trim() || DATE_LABELS.some((d) => row[d.key].trim()));
  const sources = post.sources.filter((s) => s.url.trim());
  const corrections = post.corrections.filter((c) => c.date && c.note.trim());
  const liveAt = publishedAt ?? (post.publishAt ? examNewsMeta.fromIstInput(post.publishAt) : null);
  const wasUpdated = !!(publishedAt && updatedAt && updatedAt.getTime() - publishedAt.getTime() > 5 * 60_000);

  return (
    <article className={styles.story}>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <span>Home</span>
        <span aria-hidden="true">/</span>
        <span>News</span>
        {examName && (
          <>
            <span aria-hidden="true">/</span>
            <span>{examName}</span>
          </>
        )}
      </nav>

      <div className={styles.tags}>
        <span className={`${styles.typeBadge} ${styles[`type_${post.newsType}`] ?? ""}`}>{examNewsMeta.newsTypeLabel(post.newsType)}</span>
        {examName ? <span className={styles.examTag}>{examName}</span> : <span className={styles.missing}>No exam chosen</span>}
      </div>

      <h1 className={styles.headline}>{post.title.trim() || <span className={styles.missing}>Headline goes here</span>}</h1>

      {post.summary.trim() ? (
        <p className={styles.standfirst}>{post.summary}</p>
      ) : (
        <p className={`${styles.standfirst} ${styles.missing}`}>Standfirst: one or two lines summarising the update.</p>
      )}

      <p className={styles.byline}>
        By <strong>{authorName ?? "No author"}</strong>
        <span aria-hidden="true"> - </span>
        {liveAt ? `Published ${examNewsMeta.formatIst(liveAt)}` : "Not published yet"}
        {wasUpdated && updatedAt && (
          <>
            <span aria-hidden="true"> - </span>Updated {examNewsMeta.formatIst(updatedAt)}
          </>
        )}
      </p>

      {post.heroImageUrl ? (
        <figure className={styles.hero}>
          <img src={post.heroImageUrl} alt={post.heroImageAlt} className={styles.heroImage} />
          {post.heroImageCredit.trim() && <figcaption className={styles.credit}>{post.heroImageCredit}</figcaption>}
        </figure>
      ) : (
        <div className={styles.heroEmpty}>
          <ImageIcon size={22} aria-hidden="true" />
          No hero image
        </div>
      )}

      {keyDates.length > 0 && (
        <section className={styles.block} aria-labelledby="en-key-dates">
          <h2 id="en-key-dates" className={styles.blockTitle}>
            <CalendarClock size={18} aria-hidden="true" /> Key dates
          </h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Date</th>
                </tr>
              </thead>
              <tbody>
                {keyDates.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">
                      {row.eventName || "Untitled event"}
                      {row.note.trim() && <span className={styles.rowNote}>{row.note}</span>}
                    </th>
                    <td>
                      <ul className={styles.dateList}>
                        {DATE_LABELS.filter((d) => row[d.key].trim()).map((d) => (
                          <li key={d.key}>
                            <span className={styles.dateLabel}>{d.label}</span> {row[d.key]}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {hasText(post.body) ? (
        <div className={styles.prose} dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.body) }} />
      ) : (
        <p className={styles.missing}>The story has no text yet.</p>
      )}

      {(post.officialSourceUrl.trim() || sources.length > 0) && (
        <section className={styles.sourceBox} aria-labelledby="en-sources">
          <h2 id="en-sources" className={styles.boxTitle}>
            <Landmark size={16} aria-hidden="true" /> Official source
          </h2>
          {post.officialSourceUrl.trim() && (
            <a href={post.officialSourceUrl} target="_blank" rel="noopener noreferrer" className={styles.primarySource}>
              {post.officialSourceName.trim() || post.officialSourceUrl}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
          {sources.length > 0 && (
            <ul className={styles.sourceList}>
              {sources.map((source, index) => (
                <li key={`${source.url}-${index}`}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.name.trim() || source.url}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {corrections.length > 0 && (
        <section className={styles.correctionBox} aria-labelledby="en-corrections">
          <h2 id="en-corrections" className={styles.boxTitle}>
            <FilePenLine size={16} aria-hidden="true" /> Corrections
          </h2>
          <ul className={styles.correctionList}>
            {corrections.map((c) => (
              <li key={c.key}>
                <span className={styles.correctionDate}>{examNewsMeta.formatDay(c.date)}</span>
                {c.note}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!post.officialSourceUrl.trim() && post.status !== "published" && (
        <p className={styles.hintLine}>
          <AlertTriangle size={14} aria-hidden="true" /> No official source linked. Readers trust stories that link the notice.
        </p>
      )}
    </article>
  );
};