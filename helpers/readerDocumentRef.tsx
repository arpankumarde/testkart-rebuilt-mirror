import { z } from "zod";

const id = z.number().int().positive();

// A document the reader can open as server-rendered pages. "note" and "lesson" need the signed-in buyer or
// enrolled student; "notePreview" and "lessonPreview" are the public previews.
export const readerDocumentRefSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("note"), productId: id, fileId: id.optional() }),
  z.object({ type: z.literal("notePreview"), productId: id, fileId: id.optional() }),
  z.object({ type: z.literal("lesson"), courseId: id, lessonId: id }),
  z.object({ type: z.literal("lessonPreview"), courseId: id, lessonId: id }),
]);

export type ReaderDocumentRef = z.infer<typeof readerDocumentRefSchema>;

export const readerDocumentQuery = (ref: ReaderDocumentRef): URLSearchParams => {
  const query = new URLSearchParams({ type: ref.type });
  if (ref.type === "note" || ref.type === "notePreview") {
    query.set("productId", String(ref.productId));
    if (ref.fileId) query.set("fileId", String(ref.fileId));
  } else {
    query.set("courseId", String(ref.courseId));
    query.set("lessonId", String(ref.lessonId));
  }
  return query;
};

export const parseReaderDocumentRef = (params: URLSearchParams) => {
  const numberParam = (name: string) => {
    const value = params.get(name);
    return value === null || value === "" ? undefined : Number(value);
  };
  return readerDocumentRefSchema.safeParse({
    type: params.get("type"),
    productId: numberParam("productId"),
    fileId: numberParam("fileId"),
    courseId: numberParam("courseId"),
    lessonId: numberParam("lessonId"),
  });
};

// The image URL of one watermarked page. It needs the viewer's session, so it is useless to anyone else.
export const readerPageUrl = (ref: ReaderDocumentRef, page: number): string => {
  const query = readerDocumentQuery(ref);
  query.set("page", String(page));
  return `/_api/reader/page?${query.toString()}`;
};