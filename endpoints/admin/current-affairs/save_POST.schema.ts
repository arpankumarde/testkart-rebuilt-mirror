import { z } from "zod";
import superjson from "superjson";
import type { CurrentAffairsPostDetail } from "./get_GET.schema";

export const tagRefSchema = z.object({
  id: z.number().int().positive().optional(),
  kind: z.enum(["topic", "exam", "syllabus"]),
  name: z.string().trim().min(1).max(80),
});

export const sourceSchema = z.object({
  name: z.string().max(160),
  url: z.string().max(2000),
});

export const itemSchema = z.object({
  /** Client-side identity for list keys and reordering; never stored. */
  key: z.string(),
  headline: z.string().max(300),
  whyInNews: z.string().max(5000),
  keyPoints: z.string().max(40000),
  background: z.string().max(40000),
  imageUrl: z.string(),
  imageFileId: z.string(),
  imageAlt: z.string().max(300),
  imageCredit: z.string().max(200),
  tags: z.array(tagRefSchema),
  sources: z.array(sourceSchema),
});

export const questionSchema = z.object({
  key: z.string(),
  question: z.string().max(2000),
  options: z.array(z.string().max(500)),
  /** 0-3, or null while the admin has not picked one. */
  correctOption: z.number().int().min(0).max(3).nullable(),
  explanation: z.string().max(5000),
  tags: z.array(tagRefSchema),
});

export const quizSchema = z.object({
  title: z.string().max(200),
  questionCount: z.number().int().min(1).max(50),
  isPublished: z.boolean(),
  questions: z.array(questionSchema),
});

export const correctionSchema = z.object({
  key: z.string(),
  date: z.string(),
  note: z.string().max(2000),
});

/** Shared by the editor form and the save endpoint; publish rules live in helpers/currentAffairsValidation. */
export const schema = z.object({
  id: z.number().int().positive().optional(),
  contentType: z.enum(["daily_digest", "editorial_analysis", "weekly_digest", "monthly_digest", "individual_item"]),
  title: z.string().max(255),
  slug: z.string().max(255),
  summary: z.string().max(600),
  coverImageUrl: z.string(),
  coverImageFileId: z.string(),
  coverImageAlt: z.string().max(300),
  coverImageCredit: z.string().max(200),
  authorId: z.number().int().positive().nullable(),
  language: z.enum(["en", "hi"]),
  status: z.enum(["draft", "scheduled", "published"]),
  /** IST wall-clock "YYYY-MM-DDTHH:mm"; blank means "now" on publish. */
  publishAt: z.string(),
  /** YYYY-MM-DD; the day a daily digest covers, or the first day of a weekly/monthly one. */
  digestDate: z.string(),
  atAGlance: z.array(z.string().max(300)),
  body: z.string().max(200000),
  readingTimeMinutes: z.number().int().min(1).max(240),
  readingTimeIsManual: z.boolean(),
  seoTitle: z.string().max(120),
  seoDescription: z.string().max(320),
  ogImageUrl: z.string(),
  ogImageFileId: z.string(),
  tags: z.array(tagRefSchema),
  sources: z.array(sourceSchema),
  items: z.array(itemSchema).max(40),
  relatedIds: z.array(z.number().int().positive()).max(12),
  corrections: z.array(correctionSchema).max(20),
  quiz: quizSchema.nullable(),
});

export type InputType = z.infer<typeof schema>;
export type CurrentAffairsTagRef = z.infer<typeof tagRefSchema>;
export type CurrentAffairsItemInput = z.infer<typeof itemSchema>;
export type CurrentAffairsQuestionInput = z.infer<typeof questionSchema>;
export type CurrentAffairsSourceInput = z.infer<typeof sourceSchema>;

export type ValidationIssue = { path: string; message: string };

export type OutputType = {
  success: true;
  post: CurrentAffairsPostDetail;
};

/** Thrown by the fetch wrapper when the server rejects the content, carrying field-level issues. */
export class CurrentAffairsValidationError extends Error {
  issues: ValidationIssue[];
  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = "CurrentAffairsValidationError";
    this.issues = issues;
  }
}

export const postAdminCurrentAffairsSave = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/current-affairs/save`, {
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
      throw new CurrentAffairsValidationError(errorObject.error, errorObject.issues);
    }
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};