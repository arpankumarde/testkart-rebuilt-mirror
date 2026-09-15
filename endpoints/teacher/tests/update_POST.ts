import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { slugify } from "../../../helpers/slugify";
import { resolveExamByName } from "../../../helpers/resolveExam";
import { buildMockTestUpdateSet } from "../../../helpers/testSeriesEditing";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";

async function generateUniqueSlug(baseTitle: string, excludeTestId: number): Promise<string> {
  const baseSlug = slugify(baseTitle);
  
  // Check if the base slug exists (excluding the current test)
  const existingTest = await db
    .selectFrom("mockTests")
    .select("id")
    .where("slug", "=", baseSlug)
    .where("id", "!=", excludeTestId)
    .executeTakeFirst();
  
  if (!existingTest) {
    return baseSlug;
  }
  
  // If it exists, try appending numbers until we find a unique slug
  let counter = 1;
  while (true) {
    const candidateSlug = `${baseSlug}-${counter}`;
    const existing = await db
      .selectFrom("mockTests")
      .select("id")
      .where("slug", "=", candidateSlug)
      .where("id", "!=", excludeTestId)
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

    const existingTest = await db
      .selectFrom("mockTests")
      .select(["teacherId", "isPublished", "title", "deletedAt"])
      .where("id", "=", input.testId)
      .executeTakeFirst();

    if (!existingTest) {
      return new Response(
        superjson.stringify({ error: "Test not found" }),
        { status: 404 }
      );
    }

    if (existingTest.teacherId !== effectiveTeacherId) {
      return new Response(
        superjson.stringify({ error: "You do not own this test" }),
        { status: 403 }
      );
    }

    if (existingTest.deletedAt) {
      return new Response(
        superjson.stringify({ error: "This test series is in the Trash. Restore it before editing." }),
        { status: 400 }
      );
    }

    const { testId, examName, ...fields } = input;

    // Exam fields change only when the request carries examName; null or "" clears them.
    const exam = examName !== undefined ? await resolveExamByName(examName) : undefined;

    // The slug follows the title only while the series is unpublished.
    let slug: string | undefined;
    if (fields.title !== existingTest.title && !existingTest.isPublished) {
      slug = await generateUniqueSlug(fields.title, testId);
    }

    const updatedTest = await db
      .updateTable("mockTests")
      .set(buildMockTestUpdateSet(fields, { now: new Date(), slug, exam }))
      .where("id", "=", testId)
      .returningAll()
      .executeTakeFirstOrThrow();

    const output: OutputType = {
      ...updatedTest,
      price: Number(updatedTest.price),
      rating: updatedTest.rating ? Number(updatedTest.rating) : null,
      discountPrice: updatedTest.discountPrice ? Number(updatedTest.discountPrice) : null,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error updating mock test:", error);
    if (error instanceof Error) {
      return new Response(superjson.stringify({ error: error.message }), {
        status: 400,
      });
    }
    return new Response(
      superjson.stringify({ error: "An unknown error occurred" }),
      { status: 500 }
    );
  }
}