import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { slugify } from "../../../helpers/slugify";
import { syncMockTestAggregates } from "../../../helpers/syncMockTestAggregates";
import { resolveExamByName } from "../../../helpers/resolveExam";
import { schema, OutputType } from "./create-with-items_POST.schema";
import superjson from "superjson";
import { sanitizeHtml } from "../../../helpers/sanitizeHtml";
import { nanoid } from "nanoid";

async function generateUniqueSlug(baseTitle: string): Promise<string> {
  const baseSlug = slugify(baseTitle);
  
  while (true) {
    const candidateSlug = `${baseSlug}-${nanoid(8).toLowerCase()}`;
    const existing = await db
      .selectFrom("mockTests")
      .select("id")
      .where("slug", "=", candidateSlug)
      .executeTakeFirst();
    
    if (!existing) {
      return candidateSlug;
    }
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

    // Fall back to a content-derived title (never a static generic string)
    // so that if a draft package is ever published without the teacher
    // setting a title, it still gets a unique, non-duplicate <title> tag
    // instead of every untitled package sharing the literal string
    // "Untitled Test Package".
    const title =
      input.title ||
      `${user.displayName}'s Practice Mock Test Package - Draft ${new Date()
        .toISOString()
        .slice(0, 10)}`;
    const slug = await generateUniqueSlug(title);

    const resolvedExam = await resolveExamByName(input.examName);
    const examId = input.examName ? resolvedExam.examId : null;
    const examName = input.examName ? resolvedExam.examName : "Unspecified";

    const price = input.price ?? 0;
    const isFree = input.isFree ?? (input.price ? input.price <= 0 : true);
    
        const newTest = await db
      .insertInto("mockTests")
      .values({
        teacherId: effectiveTeacherId,
        creatorName: user.displayName,
        title: title,
        slug: slug,
        description: input.description || "Draft test package",
        examName: examName,
        examId: examId,
        subject: JSON.stringify(input.subjects || []),
        price: price.toString(),
        discountPrice:
          input.discountPrice !== null && input.discountPrice !== undefined
            ? input.discountPrice.toString()
            : null,
        isFree: isFree,
        thumbnailUrl: input.thumbnailUrl || null,
        thumbnailFileId: input.thumbnailFileId || null,
        language: input.language || "English",
        whatYouLearn: input.whatYouLearn ? JSON.stringify(input.whatYouLearn) : null,
        requirements: input.requirements ? JSON.stringify(input.requirements) : null,
        longDescription: input.longDescription ? sanitizeHtml(input.longDescription) : null,
        isPublished: false, // Always created as unpublished
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    if (input.itemCount > 0) {
      const itemsToInsert = Array.from({ length: input.itemCount }).map((_, index) => ({
        packageId: newTest.id,
        title: `Test ${index + 1}`,
        durationMinutes: 60,
        isFree: false,
        calculatorEnabled: false,
        subjectWiseTiming: false,
        questionWiseTiming: false,
        orderIndex: index,
        subject: "",
      }));

      await db.insertInto("mockTestItems").values(itemsToInsert).execute();
    }

    await syncMockTestAggregates(newTest.id).catch(err => console.error("Failed to sync aggregates:", err));

    const output: OutputType = {
      ...newTest,
      price: Number(newTest.price),
      rating: newTest.rating ? Number(newTest.rating) : null,
      discountPrice: newTest.discountPrice ? Number(newTest.discountPrice) : null,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error creating mock test with items:", error);
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