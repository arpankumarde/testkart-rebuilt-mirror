import superjson from "superjson";
import { db } from "./db";
import { getServerUserSession } from "./getServerUserSession";
import { PdfPreviewUnavailableError } from "./pdfPreviewRender";
import type { ReaderDocumentRef } from "./readerDocumentRef";
import type { User } from "./User";

export class ReaderAccessError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export type ReaderDocument = {
  sourceUrl: string;
  title: string;
  // Pages past this are not part of the document for this viewer (a public preview's page count).
  lastPage: number | null;
  viewer: User | null;
};

async function requireViewer(request: Request): Promise<User> {
  try {
    return (await getServerUserSession(request)).user;
  } catch (error) {
    if (error instanceof Error && error.name === "NotAuthenticatedError") {
      throw new ReaderAccessError(401, "Sign in to open this document.");
    }
    throw error;
  }
}

async function productFile(productId: number, fileId: number) {
  const file = await db
    .selectFrom("digitalProductFiles")
    .select(["fileUrl", "title"])
    .where("id", "=", fileId)
    .where("productId", "=", productId)
    .executeTakeFirst();
  if (!file) {
    throw new ReaderAccessError(404, "This file is not part of the study notes.");
  }
  return file;
}

async function pdfLesson(courseId: number, lessonId: number) {
  const lesson = await db
    .selectFrom("courseLessons")
    .innerJoin("courseSections", "courseSections.id", "courseLessons.sectionId")
    .innerJoin("courses", "courses.id", "courseSections.courseId")
    .select([
      "courseSections.courseId",
      "courses.status as courseStatus",
      "courseLessons.contentUrl",
      "courseLessons.contentType",
      "courseLessons.isPreview",
      "courseLessons.title",
    ])
    .where("courseLessons.id", "=", lessonId)
    .executeTakeFirst();
  if (!lesson || lesson.courseId !== courseId) {
    throw new ReaderAccessError(404, "Lesson not found.");
  }
  if (lesson.contentType !== "pdf" || !lesson.contentUrl) {
    throw new ReaderAccessError(404, "This lesson has no PDF.");
  }
  return { ...lesson, contentUrl: lesson.contentUrl };
}

// Checks that the caller may read the document and says where its file lives. The file location never
// leaves the server.
export async function resolveReaderDocument(request: Request, ref: ReaderDocumentRef): Promise<ReaderDocument> {
  switch (ref.type) {
    case "note": {
      const viewer = await requireViewer(request);
      const purchase = await db
        .selectFrom("digitalProductPurchases")
        .innerJoin("digitalProducts", "digitalProducts.id", "digitalProductPurchases.productId")
        .select(["digitalProducts.pdfUrl", "digitalProducts.title"])
        .where("digitalProductPurchases.productId", "=", ref.productId)
        .where("digitalProductPurchases.studentId", "=", viewer.id)
        .executeTakeFirst();
      if (!purchase) {
        throw new ReaderAccessError(403, "These study notes are not in your purchases.");
      }
      const file = ref.fileId ? await productFile(ref.productId, ref.fileId) : null;
      return {
        sourceUrl: file?.fileUrl ?? purchase.pdfUrl,
        title: file?.title || purchase.title,
        lastPage: null,
        viewer,
      };
    }
    case "notePreview": {
      const product = await db
        .selectFrom("digitalProducts")
        .select(["pdfUrl", "title", "previewPages"])
        .where("id", "=", ref.productId)
        .where("status", "=", "published")
        .executeTakeFirst();
      if (!product) {
        throw new ReaderAccessError(404, "Study notes not found.");
      }
      const previewPages = product.previewPages ?? 0;
      if (previewPages < 1) {
        throw new ReaderAccessError(404, "No preview pages are available for this document.");
      }
      const file = ref.fileId ? await productFile(ref.productId, ref.fileId) : null;
      return {
        sourceUrl: file?.fileUrl ?? product.pdfUrl,
        title: file?.title || product.title,
        lastPage: previewPages,
        viewer: null,
      };
    }
    case "lesson": {
      const viewer = await requireViewer(request);
      if (viewer.role !== "student" && viewer.role !== "admin") {
        throw new ReaderAccessError(403, "Only enrolled students can open this lesson.");
      }
      const lesson = await pdfLesson(ref.courseId, ref.lessonId);
      if (viewer.role === "student") {
        const enrollment = await db
          .selectFrom("courseEnrollments")
          .select("id")
          .where("courseId", "=", ref.courseId)
          .where("studentId", "=", viewer.id)
          .executeTakeFirst();
        if (!enrollment) {
          throw new ReaderAccessError(403, "You are not enrolled in this course.");
        }
      }
      return { sourceUrl: lesson.contentUrl, title: lesson.title, lastPage: null, viewer };
    }
    case "lessonPreview": {
      const lesson = await pdfLesson(ref.courseId, ref.lessonId);
      if (lesson.courseStatus !== "published" || !lesson.isPreview) {
        throw new ReaderAccessError(404, "This lesson has no free preview.");
      }
      return { sourceUrl: lesson.contentUrl, title: lesson.title, lastPage: null, viewer: null };
    }
  }
}

export function readerErrorResponse(error: unknown, context: string): Response {
  if (error instanceof ReaderAccessError) {
    return new Response(superjson.stringify({ error: error.message }), { status: error.status });
  }
  if (error instanceof PdfPreviewUnavailableError) {
    return new Response(superjson.stringify({ error: "This document cannot be displayed." }), { status: 422 });
  }
  console.error(`${context}:`, error);
  return new Response(superjson.stringify({ error: "Failed to load the document." }), { status: 500 });
}