import React, { Suspense, createContext, useContext, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ClipboardList,
  Eye,
  FileText,
  ListChecks,
  Lock,
  Type,
  Unlock,
  Video,
} from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { MathMLContent } from "./MathMLContent";
import { VideoPreview } from "./VideoPreview";
import { AdminPreviewQuestions } from "./AdminPreviewQuestions";
import {
  adminPreviewPath,
  PREVIEW_STATUS_LABELS,
  PREVIEW_TYPE_LABELS,
  useAdminContentPreview,
} from "../helpers/useAdminContentPreview";
import {
  OutputType,
  PreviewContentType,
  PreviewLesson,
  PreviewStatus,
  PreviewTestItem,
} from "../endpoints/admin/content-preview/details_GET.schema";
import styles from "./AdminPreviewContent.module.css";

const PdfReaderDialog = React.lazy(() =>
  import("./PdfReaderDialog").then((m) => ({ default: m.PdfReaderDialog })),
);

/*
 * Embedded: rendered inside the content reviews pane, which already owns an h2,
 * so section titles drop a level and links to other items open in a new tab.
 */
const EmbeddedContext = createContext(false);

const HTML_TAG_PATTERN = /<\/?[a-z][a-z0-9]*(\s[^>]*)?\/?>/i;

export const RichText = ({ text }: { text: string | null }) => {
  if (!text?.trim()) return null;
  if (!HTML_TAG_PATTERN.test(text)) return <p className={styles.plainText}>{text}</p>;
  return <MathMLContent html={text} className={styles.richText} />;
};

export const formatPreviewDate = (date: Date | string | null | undefined) =>
  date
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(date))
    : "Not set";

const formatSize = (bytes: number | null) => {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const previewStatusVariant = (status: PreviewStatus): "success" | "warning" | "outline" | "destructive" =>
  status === "published" ? "success" : status === "trashed" ? "destructive" : status === "draft" ? "warning" : "outline";

type PdfTarget = { url: string; title: string };

const SectionTitle = ({ children }: { children: React.ReactNode }) => {
  const Heading = useContext(EmbeddedContext) ? "h3" : "h2";
  return <Heading className={styles.sectionTitle}>{children}</Heading>;
};

/* Expand/collapse row shared by tests and lessons. */
const Disclosure = ({
  open,
  onToggle,
  icon,
  title,
  meta,
  badges,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  badges?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <li className={styles.row}>
    <button type="button" className={styles.rowButton} onClick={onToggle} aria-expanded={open}>
      <span className={styles.rowIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.rowMain}>
        <span className={styles.rowTitle}>{title}</span>
        {meta && <span className={styles.rowMeta}>{meta}</span>}
      </span>
      {badges && <span className={styles.rowBadges}>{badges}</span>}
      <ChevronDown size={18} className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} aria-hidden="true" />
    </button>
    {open && <div className={styles.rowBody}>{children}</div>}
  </li>
);

const useToggleSet = () => {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return { open, toggle };
};

const TestsSection = ({ tests }: { tests: PreviewTestItem[] }) => {
  const { open, toggle } = useToggleSet();
  const liveCount = tests.filter((t) => !t.isTrashed).length;
  return (
    <section className={styles.section}>
      <SectionTitle>
        Tests <span className={styles.count}>{liveCount}</span>
      </SectionTitle>
      {tests.length === 0 ? (
        <p className={styles.muted}>No tests have been added yet.</p>
      ) : (
        <ul className={styles.rows}>
          {tests.map((test, index) => (
            <Disclosure
              key={test.id}
              open={open.has(test.id)}
              onToggle={() => toggle(test.id)}
              icon={<ClipboardList size={18} />}
              title={`${index + 1}. ${test.title}`}
              meta={[
                `${test.questionCount} questions`,
                `${test.durationMinutes} min`,
                test.subjects.length ? test.subjects.join(", ") : null,
                test.scheduledDate ? `Scheduled ${formatPreviewDate(test.scheduledDate)}` : null,
              ]
                .filter(Boolean)
                .join(" - ")}
              badges={
                <>
                  {test.isFree && <Badge variant="secondary">Free</Badge>}
                  {test.isTrashed && <Badge variant="destructive">In trash</Badge>}
                  {test.questionCount === 0 && <Badge variant="warning">No questions</Badge>}
                </>
              }
            >
              <RichText text={test.description} />
              <AdminPreviewQuestions testItemId={test.id} />
            </Disclosure>
          ))}
        </ul>
      )}
    </section>
  );
};

type QuizQuestion = {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation?: string;
};

const parseQuiz = (text: string | null): QuizQuestion[] | null => {
  if (!text) return null;
  try {
    const data = JSON.parse(text);
    return Array.isArray(data?.questions) ? data.questions : null;
  } catch {
    return null;
  }
};

const QuizContent = ({ text }: { text: string | null }) => {
  const questions = parseQuiz(text);
  if (!questions) return <p className={styles.errorText}>This quiz has no readable questions.</p>;
  return (
    <ol className={styles.quiz}>
      {questions.map((q, index) => (
        <li key={q.id ?? index} className={styles.quizItem}>
          <div className={styles.quizQuestion}>
            <strong>Q{index + 1}.</strong> <MathMLContent html={q.questionText} inline />
          </div>
          <ul className={styles.quizOptions}>
            {(["A", "B", "C", "D"] as const).map((key) => (
              <li key={key} className={q.correctAnswer === key ? styles.quizCorrect : undefined}>
                <strong>{key}.</strong> <MathMLContent html={q[`option${key}`]} inline />
                {q.correctAnswer === key && (
                  <span className={styles.correctTag}>
                    <Check size={14} aria-hidden="true" />
                    Correct
                  </span>
                )}
              </li>
            ))}
          </ul>
          {q.explanation && <RichText text={q.explanation} />}
        </li>
      ))}
    </ol>
  );
};

const LESSON_ICONS: Record<PreviewLesson["contentType"], React.ReactNode> = {
  video: <Video size={18} />,
  pdf: <FileText size={18} />,
  text: <Type size={18} />,
  quiz: <ListChecks size={18} />,
};

const LESSON_LABELS: Record<PreviewLesson["contentType"], string> = {
  video: "Video",
  pdf: "PDF",
  text: "Reading",
  quiz: "Quiz",
};

const LessonContent = ({ lesson, onOpenPdf }: { lesson: PreviewLesson; onOpenPdf: (pdf: PdfTarget) => void }) => {
  switch (lesson.contentType) {
    case "video":
      return lesson.contentUrl ? (
        <VideoPreview videoUrl={lesson.contentUrl} title={lesson.title} mode="player" className={styles.player} />
      ) : (
        <p className={styles.errorText}>No video has been uploaded for this lesson.</p>
      );
    case "pdf":
      return lesson.contentUrl ? (
        <Button variant="outline" onClick={() => onOpenPdf({ url: lesson.contentUrl!, title: lesson.title })}>
          <FileText size={16} />
          Open PDF
        </Button>
      ) : (
        <p className={styles.errorText}>No PDF has been uploaded for this lesson.</p>
      );
    case "text":
      return lesson.textContent ? (
        <RichText text={lesson.textContent} />
      ) : (
        <p className={styles.errorText}>This reading lesson is empty.</p>
      );
    case "quiz":
      return <QuizContent text={lesson.textContent} />;
  }
};

const CourseSections = ({
  data,
  onOpenPdf,
}: {
  data: Extract<OutputType, { type: "course" }>;
  onOpenPdf: (pdf: PdfTarget) => void;
}) => {
  const { open, toggle } = useToggleSet();
  if (data.sections.length === 0) {
    return (
      <section className={styles.section}>
        <SectionTitle>Curriculum</SectionTitle>
        <p className={styles.muted}>No chapters have been added yet.</p>
      </section>
    );
  }
  return (
    <>
      {data.sections.map((section, sectionIndex) => (
        <section key={section.id} className={styles.section}>
          <SectionTitle>
            {sectionIndex + 1}. {section.title} <span className={styles.count}>{section.lessons.length}</span>
          </SectionTitle>
          <RichText text={section.description} />
          {section.lessons.length === 0 ? (
            <p className={styles.muted}>No lessons in this chapter.</p>
          ) : (
            <ul className={styles.rows}>
              {section.lessons.map((lesson) => (
                <Disclosure
                  key={lesson.id}
                  open={open.has(lesson.id)}
                  onToggle={() => toggle(lesson.id)}
                  icon={LESSON_ICONS[lesson.contentType]}
                  title={lesson.title}
                  meta={[LESSON_LABELS[lesson.contentType], lesson.durationMinutes ? `${lesson.durationMinutes} min` : null]
                    .filter(Boolean)
                    .join(" - ")}
                  badges={
                    <>
                      {lesson.isPreview ? (
                        <Badge variant="secondary">
                          <Unlock size={12} aria-hidden="true" /> Free preview
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Lock size={12} aria-hidden="true" /> Enrolled only
                        </Badge>
                      )}
                      {lesson.gumletStatus && <Badge variant="outline">DRM {lesson.gumletStatus}</Badge>}
                    </>
                  }
                >
                  <RichText text={lesson.description} />
                  <LessonContent lesson={lesson} onOpenPdf={onOpenPdf} />
                </Disclosure>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
};

const BundleItems = ({ items }: { items: Extract<OutputType, { type: "course_bundle" }>["items"] }) => {
  const embedded = useContext(EmbeddedContext);
  return (
    <section className={styles.section}>
      <SectionTitle>
        In this bundle <span className={styles.count}>{items.length}</span>
      </SectionTitle>
      {items.length === 0 ? (
        <p className={styles.errorText}>Nothing has been added to this bundle.</p>
      ) : (
        <ul className={styles.rows}>
          {items.map((item) => {
            const body = (
              <>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{item.title}</span>
                  <span className={styles.rowMeta}>
                    {PREVIEW_TYPE_LABELS[item.type]} - {item.price > 0 ? `Rs ${item.price.toLocaleString("en-IN")}` : "Free"}
                  </span>
                </span>
                <Badge variant={previewStatusVariant(item.status)}>{PREVIEW_STATUS_LABELS[item.status]}</Badge>
                <span className={styles.linkHint}>Preview</span>
              </>
            );
            return (
              <li key={`${item.type}-${item.id}`} className={styles.row}>
                {embedded ? (
                  <a
                    href={`${adminPreviewPath(item.type, item.id)}?from=reviews`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.rowStatic}
                  >
                    {body}
                  </a>
                ) : (
                  <Link to={adminPreviewPath(item.type, item.id)} className={styles.rowStatic}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const TypeContent = ({ data, onOpenPdf }: { data: OutputType; onOpenPdf: (pdf: PdfTarget) => void }) => {
  switch (data.type) {
    case "mock_test":
      return (
        <>
          {data.whatYouLearn.length > 0 && (
            <section className={styles.section}>
              <SectionTitle>What students will learn</SectionTitle>
              <ul className={styles.bullets}>
                {data.whatYouLearn.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </section>
          )}
          {data.longDescription && (
            <section className={styles.section}>
              <SectionTitle>Full description</SectionTitle>
              <RichText text={data.longDescription} />
            </section>
          )}
          <TestsSection tests={data.tests} />
        </>
      );
    case "live_test":
      return (
        <>
          <section className={styles.section}>
            <SectionTitle>Schedule</SectionTitle>
            <dl className={styles.facts}>
              <div className={styles.fact}>
                <dt>Registration closes</dt>
                <dd>{formatPreviewDate(data.registrationDeadline)}</dd>
              </div>
              <div className={styles.fact}>
                <dt>Starts</dt>
                <dd>{formatPreviewDate(data.startTime)}</dd>
              </div>
              <div className={styles.fact}>
                <dt>Ends</dt>
                <dd>{formatPreviewDate(data.endTime)}</dd>
              </div>
            </dl>
          </section>
          {data.prizeTiers.length > 0 && (
            <section className={styles.section}>
              <SectionTitle>Prizes</SectionTitle>
              <dl className={styles.facts}>
                {data.prizeTiers.map((tier) => (
                  <div key={tier.label} className={styles.fact}>
                    <dt>{tier.label}</dt>
                    <dd>{tier.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <TestsSection tests={data.tests} />
        </>
      );
    case "course":
      return <CourseSections data={data} onOpenPdf={onOpenPdf} />;
    case "digital_product":
      return (
        <>
          {data.shortDescription && (
            <section className={styles.section}>
              <SectionTitle>Short description</SectionTitle>
              <RichText text={data.shortDescription} />
            </section>
          )}
          <section className={styles.section}>
            <SectionTitle>
              Files <span className={styles.count}>{data.files.length}</span>
            </SectionTitle>
            {data.files.length === 0 ? (
              <p className={styles.errorText}>No files have been uploaded.</p>
            ) : (
              <ul className={styles.rows}>
                {data.files.map((file, index) => (
                  <li key={file.id} className={styles.row}>
                    <div className={styles.rowStatic}>
                      <span className={styles.rowIcon} aria-hidden="true">
                        <FileText size={18} />
                      </span>
                      <span className={styles.rowMain}>
                        <span className={styles.rowTitle}>
                          {index + 1}. {file.title}
                        </span>
                        <span className={styles.rowMeta}>
                          {[file.pageCount ? `${file.pageCount} pages` : null, formatSize(file.fileSizeBytes)]
                            .filter(Boolean)
                            .join(" - ") || "PDF"}
                        </span>
                      </span>
                      <Button variant="outline" size="sm" onClick={() => onOpenPdf({ url: file.fileUrl, title: file.title })}>
                        <Eye size={14} />
                        Open
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      );
    case "course_bundle":
      return <BundleItems items={data.items} />;
  }
};

/* Everything a student would get: intro media, description and every test, lesson, file or bundle item. */
export const AdminPreviewContent = ({ data, embedded = false }: { data: OutputType; embedded?: boolean }) => {
  const [pdf, setPdf] = useState<PdfTarget | null>(null);
  return (
    <EmbeddedContext.Provider value={embedded}>
      <div className={styles.content}>
        {(data.introVideoUrl || data.thumbnailUrl) && (
          <div className={styles.media}>
            {data.introVideoUrl ? (
              <VideoPreview
                videoUrl={data.introVideoUrl}
                thumbnailUrl={data.thumbnailUrl}
                title={`${data.title} intro video`}
                inlinePlayback
              />
            ) : (
              <img src={data.thumbnailUrl!} alt={`${data.title} thumbnail`} className={styles.thumbnail} />
            )}
          </div>
        )}

        {data.description && (
          <section className={styles.section}>
            <SectionTitle>Description</SectionTitle>
            <RichText text={data.description} />
          </section>
        )}

        <TypeContent data={data} onOpenPdf={setPdf} />
      </div>

      {pdf && (
        <Suspense fallback={null}>
          <PdfReaderDialog isOpen onClose={() => setPdf(null)} title={pdf.title} source={{ kind: "pdf", url: pdf.url }} />
        </Suspense>
      )}
    </EmbeddedContext.Provider>
  );
};

/* Loads an item's full contents for the content reviews pane and dialog. */
export const AdminPreviewContentLoader = ({ type, id }: { type: PreviewContentType; id: number }) => {
  const { data, isFetching, isError, error, refetch } = useAdminContentPreview(type, id);

  if (isFetching && (!data || data.id !== id || data.type !== type)) {
    return (
      <div className={styles.content} aria-busy="true" aria-label="Loading contents">
        <Skeleton style={{ height: "10rem", width: "100%" }} />
        <Skeleton style={{ height: "14rem", width: "100%" }} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.loadError} role="alert">
        <AlertCircle size={18} aria-hidden="true" />
        <p>
          Could not load the contents.{" "}
          {error instanceof Error ? error.message : "The request did not come back."}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return <AdminPreviewContent data={data} embedded />;
};
