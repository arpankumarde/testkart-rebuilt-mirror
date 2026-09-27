import { z } from "zod";
import superjson from "superjson";
import type { NoteReadingStatus } from "../../../helpers/teacherPerformance";

/** No productId picks the study note with the most buyers. */
export const schema = z.object({
  productId: z.coerce.number().int().positive().optional(),
});

export type InputType = z.infer<typeof schema>;

export type NoteOption = { id: number; title: string; status: string; buyers: number; pages: number };

export type { NoteReadingStatus };

/** Pages read are distinct pages opened in the web reader. */
export type NoteReaderRow = {
  studentId: number;
  name: string;
  avatarUrl: string | null;
  boughtAt: Date | null;
  pagesRead: number;
  pagesTotal: number;
  progress: number;
  status: NoteReadingStatus;
  lastOpenedAt: Date | null;
};

export type OutputType = {
  notes: NoteOption[];
  note: {
    id: number;
    title: string;
    pages: number;
    totals: { buyers: number; opened: number; finished: number; averageProgress: number | null };
    rows: NoteReaderRow[];
  } | null;
};

export const getTeacherPerformanceNote = async (query: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (query.productId) params.set("productId", String(query.productId));
  const result = await fetch(`/_api/teacher/performance/note?${params.toString()}`, {
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