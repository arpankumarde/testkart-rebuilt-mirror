import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { isUploadedIntroVideoUrl, toLiveTeachingStatus } from "../../../helpers/liveTeachingRules";
import { schema, OutputType } from "./video_POST.schema";

/* Saves the intro video before applying. It is locked while an application is in review or approved. */
export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" || user.teacherRole === "manager") {
      return new Response(superjson.stringify({ error: "Only the account owner can change the intro video." }), {
        status: 403,
      });
    }

    const input = schema.parse(superjson.parse(await request.text()));
    if (input.introVideoUrl !== null && !isUploadedIntroVideoUrl(input.introVideoUrl)) {
      return new Response(superjson.stringify({ error: "Upload your intro video here. Links to other sites are not accepted." }), {
        status: 400,
      });
    }

    const row = await db
      .selectFrom("users")
      .select("liveTeachingStatus")
      .where("id", "=", effectiveTeacherId)
      .executeTakeFirst();
    const status = toLiveTeachingStatus(row?.liveTeachingStatus);
    if (status === "pending" || status === "approved") {
      return new Response(
        superjson.stringify({
          error:
            status === "pending"
              ? "Your application is in review, so the video cannot change now."
              : "Your video is approved. Contact support to replace it.",
        }),
        { status: 400 }
      );
    }

    await db
      .updateTable("users")
      .set({
        introVideoUrl: input.introVideoUrl,
        introVideoFileId: input.introVideoUrl ? input.introVideoFileId ?? null : null,
      })
      .where("id", "=", effectiveTeacherId)
      .execute();

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error saving live teaching intro video:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}