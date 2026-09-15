import superjson from "superjson";
import { z } from "zod";
import { type Selectable } from "kysely";
import { type Exams, type ExamCategories } from "../../../helpers/schema";
import { type AdminExamSectionType } from "../../../helpers/examContentTypes";

export const schema = z.object({});
export type InputType = z.infer<typeof schema>;

export type ContentSectionStatus = "published" | "draft" | "none";

export type DataHealthFlag =
  | "duplicate-name"
  | "duplicate-slug"
  | "missing-full-name"
  | "missing-description";

export type ExamDashboardRow = Selectable<Exams> & {
  categoryName: string;
  contentStatusByType: Record<AdminExamSectionType, ContentSectionStatus>;
  // Sections whose saved draft is marked ready for review, published or not.
  readyForReviewTypes: AdminExamSectionType[];
  // The Content dashboard's exam page queues, as the sections of this exam each one counts.
  // Live sections whose saved draft content differs from the published content.
  unpublishedEditTypes: AdminExamSectionType[];
  // Published sections whose draft has no SEO title or no SEO description.
  missingSeoTypes: AdminExamSectionType[];
  // Published sections with no FAQ items.
  missingFaqTypes: AdminExamSectionType[];
  publishedSectionCount: number;
  totalSectionCount: number;
  lastContentUpdatedAt: Date | null;
  dataHealthFlags: DataHealthFlag[];
  mockTestCount: number;
  digitalProductCount: number;
  totalProductCount: number;
};

export type OutputType = {
  rows: ExamDashboardRow[];
  categories: Pick<Selectable<ExamCategories>, "id" | "categoryName">[];
};

export const getAdminExamDashboard = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/exam-dashboard/list`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
