import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { slugify } from "../../../helpers/slugify";
import { resolveExamByName } from "../../../helpers/resolveExam";
import type { Courses } from "../../../helpers/schema";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";
import type { Updateable } from "kysely";
import { ZodError } from "zod";

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

    const { courseId, price, examName, ...fields } = input;

    // Verify ownership
    const existingCourse = await db
      .selectFrom("courses")
      .select(["teacherId", "status", "title"])
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

    const resolvedExam = examName !== undefined ? await resolveExamByName(examName) : undefined;

    // Only columns present in the request are written. An omitted optional field
    // keeps its stored value; an explicit null clears it.
    const changes: Updateable<Courses> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        (changes as Record<string, unknown>)[key] = value;
      }
    }
    if (price !== undefined) changes.price = price.toString();
    if (slug) changes.slug = slug;
    if (resolvedExam) {
      changes.examId = resolvedExam.examId;
      changes.examName = resolvedExam.examName;
    }

    const updatedCourse = await db
      .updateTable("courses")
      .set(changes)
      .where("id", "=", courseId)
      .returningAll()
      .executeTakeFirstOrThrow();

    const output: OutputType = {
      ...updatedCourse,
      price: Number(updatedCourse.price),
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
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