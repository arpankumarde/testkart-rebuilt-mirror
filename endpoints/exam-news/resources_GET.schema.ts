import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  /* The exam being read about. Without one, the exams marked Hot on /exams are used. */
  exam: z.string().trim().min(1).max(200).optional(),
  /* Every verified teacher's resources for `exam`. The sidebar shows one teacher and does not send it. */
  all: z.boolean().optional(),
});

export type InputType = z.infer<typeof schema>;

export type ExamResourceKind = "course" | "test_series";

export type ExamResource = {
  kind: ExamResourceKind;
  id: number;
  title: string;
  href: string;
  thumbnailUrl: string | null;
  price: number;
  discountPrice: number | null;
};

export type ExamResourceTeacher = {
  id: number;
  name: string;
  slug: string;
  avatarUrl: string | null;
  /* How many resources the teacher has for the exam; `resources` may hold fewer. */
  total: number;
  resources: ExamResource[];
};

export type ExamResourceGroup = {
  exam: { id: number; name: string; slug: string };
  /* One featured teacher in the sidebar, every verified teacher with `all`. */
  teachers: ExamResourceTeacher[];
  teacherCount: number;
  resourceCount: number;
};

export type OutputType = {
  /* "exam": resources for the requested exam. "hot": no exam was given, so the Hot exams were used. */
  source: "exam" | "hot";
  groups: ExamResourceGroup[];
};

export const getExamNewsResources = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.exam) params.set("exam", input.exam);
  if (input.all) params.set("all", "1");
  const result = await fetch(`/_api/exam-news/resources?${params.toString()}`, {
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