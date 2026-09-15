import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { slugify } from "../../../helpers/slugify";
import { resolveExamByName } from "../../../helpers/resolveExam";
import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";
import { customAlphabet } from "nanoid";
 
async function generateUniqueSlug(baseTitle: string): Promise<string> {
  const baseSlug = slugify(baseTitle);
  const generateId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

  let candidateSlug = `${baseSlug}-${generateId()}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const existingTest = await db
      .selectFrom("mockTests")
      .select("id")
      .where("slug", "=", candidateSlug)
      .executeTakeFirst();

    if (!existingTest) {
      return candidateSlug;
    }

    candidateSlug = `${baseSlug}-${generateId()}`;
  }

  throw new Error("Failed to generate a unique slug after multiple attempts. Please try again.");
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

    // Generate unique slug from title
    const slug = await generateUniqueSlug(input.title);
 
   // Resolve examId and examName from input.examName
   const resolvedExam = await resolveExamByName(input.examName);

       const newTest = await db
      .insertInto("mockTests")
      .values({
        teacherId: effectiveTeacherId,
        creatorName: user.displayName,
        title: input.title,
        slug: slug,
        description: input.description,
       examId: resolvedExam.examId,
       examName: resolvedExam.examName,
        subject: JSON.stringify(input.subjects || []),
        price: input.price.toString(),
        discountPrice: input.discountPrice !== null && input.discountPrice !== undefined ? input.discountPrice.toString() : null,
        isFree: input.isFree,
        thumbnailUrl: input.thumbnailUrl || null,
        thumbnailFileId: input.thumbnailFileId || null,
        introVideoUrl: input.introVideoUrl ?? null,
        introVideoFileId: input.introVideoFileId ?? null,
        language: input.language,
        whatYouLearn: input.whatYouLearn ? JSON.stringify(input.whatYouLearn) : null,
        requirements: input.requirements ? JSON.stringify(input.requirements) : null,
        longDescription: input.longDescription || null,
        isPublished: false, // Always created as unpublished
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const output: OutputType = {
      ...newTest,
      price: Number(newTest.price),
      rating: newTest.rating ? Number(newTest.rating) : null,
      discountPrice: newTest.discountPrice ? Number(newTest.discountPrice) : null,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error creating mock test:", error);
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