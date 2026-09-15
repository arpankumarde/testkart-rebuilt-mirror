import { z } from "zod";
import superjson from "superjson";
import { ADMIN_EXAM_SECTION_TYPES, type AdminExamSectionType, type ExamContentPageType, type FaqItem } from "../../helpers/examContentTypes";

// Accepts the full admin section set (including "overview") since the exam
// hub page fetches its own FAQ block through this same endpoint — "overview"
// just never gets a public URL of its own.
export const schema = z.object({
  examSlug: z.string().min(1),
  pageType: z.enum(ADMIN_EXAM_SECTION_TYPES),
});

export type InputType = z.infer<typeof schema>;

export type PublicExamContentPage = {
  pageType: AdminExamSectionType;
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  description: string | null;
  content: string | null;
  faqItems: FaqItem[] | null;
  publishedAt: Date;
};

export type OutputType = {
  exam: {
    id: number;
    examName: string;
    fullName: string;
    examSlug: string;
    categoryName: string;
  };
  page: PublicExamContentPage | null;
  // Every page type for this exam that currently has a published version -
  // ExamPageNav links only these, so types that don't exist yet stay hidden.
  publishedPageTypes: ExamContentPageType[];
};

export const getPublicExamContent = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(input);
  const searchParams = new URLSearchParams({
    examSlug: validatedInput.examSlug,
    pageType: validatedInput.pageType,
  });
  const result = await fetch(`/_api/exam-content/get?${searchParams.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
