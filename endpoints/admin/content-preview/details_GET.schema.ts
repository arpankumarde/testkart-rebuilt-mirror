import { z } from "zod";
import superjson from "superjson";

export const PREVIEW_CONTENT_TYPES = ["mock_test", "course", "digital_product", "course_bundle", "live_test"] as const;
export type PreviewContentType = (typeof PREVIEW_CONTENT_TYPES)[number];

export const schema = z.object({
  type: z.enum(PREVIEW_CONTENT_TYPES),
  id: z.coerce.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type PreviewStatus = "published" | "draft" | "unpublished" | "archived" | "trashed";

export type PreviewTestItem = {
  id: number;
  title: string;
  description: string | null;
  durationMinutes: number;
  isFree: boolean;
  isTrashed: boolean;
  scheduledDate: Date | null;
  questionCount: number;
  subjects: string[];
};

export type PreviewLesson = {
  id: number;
  title: string;
  description: string | null;
  contentType: "pdf" | "quiz" | "text" | "video";
  contentUrl: string | null;
  textContent: string | null;
  durationMinutes: number | null;
  isPreview: boolean;
  gumletStatus: string | null;
};

export type PreviewSection = {
  id: number;
  title: string;
  description: string | null;
  lessons: PreviewLesson[];
};

export type PreviewNoteFile = {
  id: number;
  title: string;
  fileUrl: string;
  pageCount: number | null;
  fileSizeBytes: number | null;
};

export type PreviewBundleItem = {
  type: "mock_test" | "course" | "digital_product";
  id: number;
  title: string;
  status: PreviewStatus;
  price: number;
};

export type PreviewFact = { label: string; value: string };

/* The latest approve or reject decision, from the review queue or the preview page's status actions. */
export type PreviewReview = {
  status: "approved" | "rejected";
  notes: string | null;
  reviewedAt: Date | null;
};

type PreviewBase = {
  id: number;
  title: string;
  slug: string | null;
  status: PreviewStatus;
  inReview: boolean;
  teacher: { id: number; name: string; email: string | null };
  thumbnailUrl: string | null;
  introVideoUrl: string | null;
  description: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  publishedAt: Date | null;
  facts: PreviewFact[];
};

export type PreviewBody =
  | (PreviewBase & { type: "mock_test"; longDescription: string | null; whatYouLearn: string[]; tests: PreviewTestItem[] })
  | (PreviewBase & { type: "course"; sections: PreviewSection[] })
  | (PreviewBase & { type: "digital_product"; shortDescription: string | null; files: PreviewNoteFile[] })
  | (PreviewBase & { type: "course_bundle"; items: PreviewBundleItem[] })
  | (PreviewBase & {
      type: "live_test";
      mockTestId: number;
      startTime: Date | null;
      endTime: Date | null;
      registrationDeadline: Date | null;
      prizeTiers: PreviewFact[];
      tests: PreviewTestItem[];
    });

export type OutputType = PreviewBody & { lastReview: PreviewReview | null };

export const getAdminContentPreview = async (params: InputType, init?: RequestInit): Promise<OutputType> => {
  const validated = schema.parse(params);
  const searchParams = new URLSearchParams({ type: validated.type, id: String(validated.id) });
  const result = await fetch(`/_api/admin/content-preview/details?${searchParams.toString()}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};