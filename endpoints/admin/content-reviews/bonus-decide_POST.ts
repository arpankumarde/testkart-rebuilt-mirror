import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { creditClaim, declineClaim, reverseClaim } from "../../../helpers/teacherCampaign";
import { sendCampaignDecisionEmail } from "../../../helpers/teacherCampaignEmail";
import { formatRupees } from "../../../helpers/teacherCampaignRules";
import { schema, type OutputType } from "./bonus-decide_POST.schema";

/* Credit, decline or reverse one Creator Bonus claim. The teacher is emailed each decision. */
export async function handle(request: Request): Promise<Response> {
  let admin: Awaited<ReturnType<typeof getAdminServerSessionOrThrow>>;
  try {
    admin = await getAdminServerSessionOrThrow(request);
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
  const { claimId, action, note } = parsed.data;

  try {
    const claim = await db.transaction().execute((trx) => {
      if (action === "credit") return creditClaim(trx, claimId, admin.id);
      if (action === "decline") return declineClaim(trx, claimId, admin.id, note!);
      return reverseClaim(trx, claimId, admin.id, note!);
    });
    const decision = action === "credit" ? "credited" : action === "decline" ? "declined" : "reversed";
    await sendCampaignDecisionEmail(claim, decision);
    const amount = formatRupees(Number(claim.amount));
    const message =
      action === "credit"
        ? `${amount} credited to the teacher's wallet. They have been emailed.`
        : action === "decline"
          ? "Bonus declined. The teacher has been emailed the reason."
          : `${amount} taken back off the teacher's balance. They have been emailed the reason.`;
    return new Response(superjson.stringify({ success: true, message } satisfies OutputType));
  } catch (error) {
    console.error("Error deciding Creator Bonus claim:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Could not save the decision. Try again." }),
      { status: 400 }
    );
  }
}