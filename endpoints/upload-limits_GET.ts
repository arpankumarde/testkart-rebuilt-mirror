import { db } from "../helpers/db";
import { OutputType } from "./upload-limits_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const limits = await db
      .selectFrom("uploadLimits")
      .selectAll()
      .limit(1)
      .executeTakeFirst();

    if (limits) {
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
    }

    // Default fallback if no row exists
    return new Response(
      superjson.stringify({
        thumbnailMaxMb: 3,
        profilePictureMaxMb: 2,
        kycDocumentMaxMb: 5,
        coursePdfMaxMb: 40,
        courseIntroVideoMaxMb: 50,
        lessonVideoMaxMb: 2048,
        digitalProductPdfMaxMb: 40,
        richTextImageMaxMb: 5,
      } satisfies OutputType)
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}