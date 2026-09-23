import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { slugify } from "../../../helpers/slugify";
import {
  ContentExamError,
  primaryExamFields,
  resolveExamSelection,
  saveContentExams,
} from "../../../helpers/contentExams";
import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";
import { sanitizeHtml } from "../../../helpers/sanitizeHtml";
import { courseDiscountError } from "../../../helpers/coursePricing";

async function generateUniqueSlug(baseTitle: string): Promise<string> {
  const baseSlug = slugify(baseTitle);
  
  // Check if the base slug exists
  const existingCourse = await db
    .selectFrom("courses")
    .select("id")
    .where("slug", "=", baseSlug)
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
      .executeTakeFirst();
    
    if (!existing) {
      return candidateSlug;
    }
    counter++;
  }
}

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const discountError = courseDiscountError(input.price, input.discountPrice);
    if (discountError) {
      return new Response(superjson.stringify({ error: discountError }), { status: 400 });
    }

    const exams = (await resolveExamSelection({ examNames: input.examNames, examName: input.examName })) ?? [];

    // Generate unique slug from title
    const slug = await generateUniqueSlug(input.title);

    const newCourse = await db
      .insertInto("courses")
      .values({
        teacherId: effectiveTeacherId,
        title: input.title,
        slug: slug,
        description: sanitizeHtml(input.description ?? ""),
        category: input.category,
        level: input.level,
        price: input.price.toString(),
        discountPrice: input.discountPrice == null ? null : input.discountPrice.toString(),
        thumbnailUrl: input.thumbnailUrl ?? null,
        thumbnailFileId: input.thumbnailFileId ?? null,
        thumbnailImageUrl: input.thumbnailImageUrl ?? null,
        thumbnailImageFileId: input.thumbnailImageFileId ?? null,
        introVideoUrl: input.introVideoUrl ?? null,
        introVideoFileId: input.introVideoFileId ?? null,
        language: input.language ?? null,
        ...primaryExamFields(exams),
        status: "draft", // Always created as a draft
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    if (exams.length > 0) await saveContentExams(db, "course", newCourse.id, exams);

    const output: OutputType = {
      ...newCourse,
      price: Number(newCourse.price),
      discountPrice: newCourse.discountPrice === null ? null : Number(newCourse.discountPrice),
    };

    return new Response(superjson.stringify(output), { status: 201 });
  } catch (error) {
    if (error instanceof ContentExamError) {
      return new Response(superjson.stringify({ error: error.message }), { status: 400 });
    }
    console.error("Error creating course:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to create course", details: errorMessage }),
      { status: 500 }
    );
  }
}