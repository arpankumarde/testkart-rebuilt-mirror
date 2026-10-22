import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { editExamCampaign, endExamCampaign, startExamCampaign } from "../../../helpers/teacherExamCampaignAdmin";
import { schema, type OutputType } from "./exam-campaign-save_POST.schema";

/* Start, edit or end one Exam Bonus campaign. */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
  } catch (error) {
    const notSignedIn = error instanceof Error && error.name === "NotAuthenticatedError";
    return new Response(superjson.stringify({ error: notSignedIn ? "Not authenticated" : "Access denied" }), {
      status: notSignedIn ? 401 : 403,
    });
  }

  const parsed = schema.safeParse(superjson.parse(await request.text()));
  if (!parsed.success) {
    return new Response(superjson.stringify({ error: parsed.error.issues[0]?.message ?? "Invalid request" }), {
      status: 400,
    });
  }
  const input = parsed.data;

  try {
    const campaign = await db.transaction().execute((trx) => {
      if (input.action === "start") return startExamCampaign(trx, input);
      if (input.action === "edit") return editExamCampaign(trx, input);
      return endExamCampaign(trx, input.id);
    });
    const message =
      input.action === "start"
        ? `The ${campaign.title} is live. Teachers can see it now.`
        : input.action === "edit"
          ? `The ${campaign.title} is updated.`
          : `The ${campaign.title} has ended. Claims already waiting can still be decided.`;
    return new Response(superjson.stringify({ success: true, message } satisfies OutputType));
  } catch (error) {
    console.error("Error saving Exam Bonus:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Could not save the Exam Bonus. Try again." }),
      { status: 400 }
    );
  }
}