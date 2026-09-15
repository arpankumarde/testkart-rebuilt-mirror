import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType, schema } from "./update_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin']);

    const json = superjson.parse(await request.text());
    const validatedData = schema.parse(json);

    // Filter out undefined values
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (validatedData.thumbnailMaxMb !== undefined) updateData.thumbnailMaxMb = validatedData.thumbnailMaxMb;
    if (validatedData.profilePictureMaxMb !== undefined) updateData.profilePictureMaxMb = validatedData.profilePictureMaxMb;
    if (validatedData.kycDocumentMaxMb !== undefined) updateData.kycDocumentMaxMb = validatedData.kycDocumentMaxMb;
    if (validatedData.coursePdfMaxMb !== undefined) updateData.coursePdfMaxMb = validatedData.coursePdfMaxMb;
    if (validatedData.courseIntroVideoMaxMb !== undefined) updateData.courseIntroVideoMaxMb = validatedData.courseIntroVideoMaxMb;
    if (validatedData.lessonVideoMaxMb !== undefined) updateData.lessonVideoMaxMb = validatedData.lessonVideoMaxMb;
    if (validatedData.digitalProductPdfMaxMb !== undefined) updateData.digitalProductPdfMaxMb = validatedData.digitalProductPdfMaxMb;
    if (validatedData.richTextImageMaxMb !== undefined) updateData.richTextImageMaxMb = validatedData.richTextImageMaxMb;

    let limits = await db
      .updateTable("uploadLimits")
      .set(updateData)
      .where("id", "=", 1)
      .returningAll()
      .executeTakeFirst();

    if (!limits) {
      // If no row exists, insert one with defaults overwritten by the validated data
      limits = await db
        .insertInto("uploadLimits")
        .values({
          id: 1,
          thumbnailMaxMb: validatedData.thumbnailMaxMb ?? 3,
          profilePictureMaxMb: validatedData.profilePictureMaxMb ?? 2,
          kycDocumentMaxMb: validatedData.kycDocumentMaxMb ?? 5,
          coursePdfMaxMb: validatedData.coursePdfMaxMb ?? 40,
          courseIntroVideoMaxMb: validatedData.courseIntroVideoMaxMb ?? 50,
          lessonVideoMaxMb: validatedData.lessonVideoMaxMb ?? 2048,
          digitalProductPdfMaxMb: validatedData.digitalProductPdfMaxMb ?? 40,
          richTextImageMaxMb: validatedData.richTextImageMaxMb ?? 5,
          updatedAt: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    return new Response(
      superjson.stringify({
        thumbnailMaxMb: limits.thumbnailMaxMb,
        profilePictureMaxMb: limits.profilePictureMaxMb,
        kycDocumentMaxMb: limits.kycDocumentMaxMb,
        coursePdfMaxMb: limits.coursePdfMaxMb,
        courseIntroVideoMaxMb: limits.courseIntroVideoMaxMb,
        lessonVideoMaxMb: limits.lessonVideoMaxMb,
        digitalProductPdfMaxMb: limits.digitalProductPdfMaxMb,
        richTextImageMaxMb: limits.richTextImageMaxMb,
      } satisfies OutputType)
    );
  } catch (error) {
    if (error instanceof Error && error.name === "NotAuthenticatedError") {
      return new Response(superjson.stringify({ error: "Not authenticated" }), {
        status: 401,
      });
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}