import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { slugify } from "../../../helpers/slugify";
import {
  ContentExamError,
  loadContentExamList,
  primaryExamFields,
  resolveExamSelection,
  saveContentExams,
} from "../../../helpers/contentExams";
import type { Courses } from "../../../helpers/schema";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";
import type { Updateable } from "kysely";
import { ZodError } from "zod";
import { sanitizeHtml } from "../../../helpers/sanitizeHtml";
import { courseDiscountError } from "../../../helpers/coursePricing";

async function generateUniqueSlug(baseTitle: string, excludeCourseId: number): Promise<string> {
  const baseSlug = slugify(baseTitle);
  
  // Check if the base slug exists (excluding the current course)
  const existingCourse = await db
    .selectFrom("courses")
    .select("id")
    .where("slug", "=", baseSlug)
    .where("id", "!=", excludeCourseId)
    .executeTakeFirst();
  
  if (!existingCourse) {
    return baseSlug;
  }
  
  // If it exists, try appending numbers until we find a unique slug
  let counter = 1;
  while (true) {
    const candidateSlug = `${baseSlug}-${counter}`;
    const existing = await db
      .selectFrom("courses")
      .select("id")
      .where("slug", "=", candidateSlug)
      .where("id", "!=", excludeCourseId)
      .executeTakeFirst();
    
    if (!existing) {
      return candidateSlug;
    }
    counter++;
  }
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const { courseId, price, discountPrice, examName, examNames, ...fields } = input;

    // Verify ownership
    const existingCourse = await db
      .selectFrom("courses")
      .select(["teacherId", "status", "title", "discountPrice"])
      .where("id", "=", courseId)
      .executeTakeFirst();

    if (!existingCourse) {
      return new Response(
        superjson.stringify({ error: "Course not found" }),
        { status: 404 }
      );
    }

    if (existingCourse.teacherId !== effectiveTeacherId && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "You do not own this course" }),
        { status: 403 }
      );
    }

    // Check if title has changed and generate new slug if needed
    // Only regenerate slug if course is not published
    let slug: string | undefined;
    if (fields.title && fields.title !== existingCourse.title && existingCourse.status !== "published") {
      slug = await generateUniqueSlug(fields.title, courseId);
    }

    const exams =
      examNames !== undefined || examName !== undefined
        ? await resolveExamSelection({
            examNames,
            examName,
            existing: await loadContentExamList(db, "course", courseId),
          })
        : undefined;

    // Only columns present in the request are written. An omitted optional field
    // keeps its stored value; an explicit null clears it.
    const changes: Updateable<Courses> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        (changes as Record<string, unknown>)[key] = value;
      }
    }
    if (price !== undefined) changes.price = price.toString();

    // Discounted price: an omitted value keeps the stored one, but it is
    // re-checked against the (possibly new) price. Making a course free
    // clears its discount.
    if (price === 0 && discountPrice === undefined) {
      changes.discountPrice = null;
    } else {
      const nextDiscount =
        discountPrice !== undefined
          ? discountPrice
          : existingCourse.discountPrice === null
            ? null
            : Number(existingCourse.discountPrice);
      const discountError = courseDiscountError(price, nextDiscount);
      if (discountError) {
        return new Response(superjson.stringify({ error: discountError }), { status: 400 });
      }
      if (discountPrice !== undefined) {
        changes.discountPrice = discountPrice === null ? null : discountPrice.toString();
      }
    }
    if (typeof changes.description === "string") changes.description = sanitizeHtml(changes.description);
    if (slug) changes.slug = slug;
    if (exams) Object.assign(changes, primaryExamFields(exams));

    const updatedCourse = await db
      .updateTable("courses")
      .set(changes)
      .where("id", "=", courseId)
      .returningAll()
      .executeTakeFirstOrThrow();

    if (exams) await saveContentExams(db, "course", courseId, exams);

    const output: OutputType = {
      ...updatedCourse,
      price: Number(updatedCourse.price),
      discountPrice: updatedCourse.discountPrice === null ? null : Number(updatedCourse.discountPrice),
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof ContentExamError) {
      return new Response(superjson.stringify({ error: error.message }), { status: 400 });
    }
    if (error instanceof ZodError) {
      return new Response(
        superjson.stringify({ error: error.errors[0]?.message ?? "Invalid course details" }),
        { status: 400 }
      );
    }
    console.error("Error updating course:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to update course", details: errorMessage }),
      { status: 500 }
    );
  }
}