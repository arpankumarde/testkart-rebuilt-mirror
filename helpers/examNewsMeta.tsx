import type { ExamNewsStatus, ExamNewsType } from "./schema";
import { currentAffairsMeta } from "./currentAffairsMeta";

const NEWS_TYPES: { value: ExamNewsType; label: string }[] = [
  { value: "notification", label: "Notification" },
  { value: "admit_card", label: "Admit Card" },
  { value: "result", label: "Result" },
  { value: "answer_key", label: "Answer Key" },
  { value: "syllabus", label: "Syllabus" },
  { value: "cut_off", label: "Cut-off" },
  { value: "date_change", label: "Date Change" },
];

const STATUSES: { value: ExamNewsStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

/** The URL a story will live at once the public News pages exist. */
const publicPath = (slug: string) => `/news/${slug}`;

const previewPath = (id: number) => `/admin/news/preview/${id}`;

const editPath = (id: number | "new") => `/admin/news/e/${id}`;

/** The public pages are not built yet, so every story opens in the admin preview. */
const openHref = (post: { id: number }) => previewPath(post.id);

const newsTypeLabel = (value: ExamNewsType) => NEWS_TYPES.find((t) => t.value === value)?.label ?? value;

const statusLabel = (value: ExamNewsStatus) => STATUSES.find((s) => s.value === value)?.label ?? value;

const isNewsType = (value: string | null | undefined): value is ExamNewsType =>
  NEWS_TYPES.some((t) => t.value === value);

export const examNewsMeta = {
  NEWS_TYPES,
  STATUSES,
  publicPath,
  previewPath,
  editPath,
  openHref,
  newsTypeLabel,
  statusLabel,
  isNewsType,
  toIstInput: currentAffairsMeta.toIstInput,
  fromIstInput: currentAffairsMeta.fromIstInput,
  formatIst: currentAffairsMeta.formatIst,
  formatDay: currentAffairsMeta.formatDay,
  istToday: currentAffairsMeta.istToday,
  stripHtml: currentAffairsMeta.stripHtml,
  readingMinutes: currentAffairsMeta.readingMinutes,
};