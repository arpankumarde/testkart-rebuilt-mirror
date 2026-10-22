import { z } from "zod";
import superjson from "superjson";
import type { ExamNewsDetail } from "./get_GET.schema";

export const NEWS_TYPE_VALUES = [
  "notification",
  "admit_card",
  "result",
  "answer_key",
  "syllabus",
  "cut_off",
  "date_change",
] as const;

export const keyDateSchema = z.object({
  /** Client-side identity for list keys; never stored. */
  key: z.string(),
  eventName: z.string().max(200),
  /** Free text shown as written: "23 October 2026", "To be announced", or blank when it does not apply. */
  startDate: z.string().max(120),
  endDate: z.string().max(120),
  examDate: z.string().max(120),
  resultDate: z.string().max(120),
  note: z.string().max(300),
});

export const sourceSchema = z.object({
  name: z.string().max(160),
  url: z.string().max(2000),
});

export const correctionSchema = z.object({
  key: z.string(),
  date: z.string(),
  note: z.string().max(2000),
});

/** Shared by the editor form and the save endpoint; publish rules live in helpers/examNewsValidation. */
export const schema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().max(255),
  slug: z.string().max(255),
  summary: z.string().max(600),
  newsType: z.enum(NEWS_TYPE_VALUES),
  examId: z.number().int().positive().nullable(),
  authorId: z.number().int().positive().nullable(),
  status: z.enum(["draft", "scheduled", "published"]),
  /** IST wall-clock "YYYY-MM-DDTHH:mm"; blank means "now" on publish. */
  publishAt: z.string(),
  body: z.string().max(200000),
  heroImageUrl: z.string(),
  heroImageFileId: z.string(),
  heroImageAlt: z.string().max(300),
  heroImageCredit: z.string().max(200),
  keyDates: z.array(keyDateSchema).max(30),
  officialSourceName: z.string().max(160),
  officialSourceUrl: z.string().max(2000),
  sources: z.array(sourceSchema).max(10),
  corrections: z.array(correctionSchema).max(20),
  seoTitle: z.string().max(120),
  seoDescription: z.string().max(320),
  ogTitle: z.string().max(120),
  ogDescription: z.string().max(320),
  ogImageUrl: z.string(),
  ogImageFileId: z.string(),
  canonicalUrl: z.string().max(2000),
});

export type InputType = z.infer<typeof schema>;
export type ExamNewsKeyDateInput = z.infer<typeof keyDateSchema>;
export type ExamNewsSourceInput = z.infer<typeof sourceSchema>;
export type ExamNewsCorrectionInput = z.infer<typeof correctionSchema>;

export type ValidationIssue = { path: string; message: string };

export type OutputType = {
  success: true;
  post: ExamNewsDetail;
};

/** Thrown by the fetch wrapper when the server rejects the content, carrying field-level issues. */
export class ExamNewsValidationError extends Error {
  issues: ValidationIssue[];
  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = "ExamNewsValidationError";
    this.issues = issues;
  }
}

export const postAdminExamNewsSave = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/exam-news/save`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; issues?: ValidationIssue[] }>(await result.text());
    if (errorObject.issues?.length) {
      throw new ExamNewsValidationError(errorObject.error, errorObject.issues);
    }
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};