import superjson from "superjson";
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";
import { pricesMeetFloors, resolveLivePrices } from "../../../../helpers/livePricing";
import { sendIntroVideoDecisionEmail, sendLiveTeachingDecisionEmail } from "../../../../helpers/liveTeachingEmail";
import { schema, OutputType } from "./decide_POST.schema";

/*
 * approve: a pending application goes live - status approved, the video goes on the profile and
 * 1:1 bookings switch on at the prices they applied with. reject: a pending application is turned
 * down with a reason. revoke: an approved teacher loses 1:1 and new group classes; classes already
 * scheduled stay. A video change (kind 'video') is only approved or rejected. The teacher is
 * emailed after the change commits.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const reason = input.action === "approve" ? null : input.reason ?? null;

    const application = await db
      .selectFrom("liveTeachingApplications as a")
      .innerJoin("users as u", "u.id", "a.teacherId")
      .select([
        "a.id",
        "a.kind",
        "a.status",
        "a.teacherId",
        "a.introVideoUrl",
        "a.introVideoFileId",
        "u.displayName",
        "u.email",
        "u.mentorshipRatePerUnit",
        "u.mentorshipClassPrice60",
        "u.mentorshipTrialDiscount",
        "u.liveTeachingStatus",
      ])
      .where("a.id", "=", input.applicationId)
      .executeTakeFirst();
    if (!application) {
      return new Response(superjson.stringify({ error: "Application not found." }), { status: 404 });
    }

    if (application.kind === "video") {
      return decideVideoChange(application, input.action, reason, admin.fullName);
    }

    const latest = await db
      .selectFrom("liveTeachingApplications")
      .select("id")
      .where("teacherId", "=", application.teacherId)
      .where("kind", "=", "application")
      .orderBy("createdAt", "desc")
      .limit(1)
      .executeTakeFirst();
    if (latest?.id !== application.id) {
      return new Response(superjson.stringify({ error: "This teacher has a newer application. Open that one." }), {
        status: 400,
      });
    }

    const expected = input.action === "revoke" ? "approved" : "pending";
    if (application.status !== expected) {
      return new Response(
        superjson.stringify({ error: `Only ${expected} applications can be ${input.action === "revoke" ? "revoked" : "decided"}.` }),
        { status: 400 }
      );
    }

    const now = new Date();
    const nextStatus = input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : "revoked";
    const resolvedPrices = resolveLivePrices(application);
    const rateValid = !!resolvedPrices && pricesMeetFloors(resolvedPrices);

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("liveTeachingApplications")
        .set({ status: nextStatus, decisionReason: reason, decidedBy: admin.fullName, decidedAt: now, updatedAt: now })
        .where("id", "=", application.id)
        .execute();
      await trx
        .updateTable("users")
        .set(
          input.action === "approve"
            ? {
                liveTeachingStatus: "approved",
                introVideoUrl: application.introVideoUrl,
                introVideoFileId: application.introVideoFileId,
                mentorshipEnabled: rateValid,
              }
            : { liveTeachingStatus: nextStatus, mentorshipEnabled: false }
        )
        .where("id", "=", application.teacherId)
        .execute();
    });

    let emailed = false;
    if (application.email) {
      await sendLiveTeachingDecisionEmail(application.email, application.displayName, input.action, reason);
      emailed = true;
    }

    const output: OutputType = { success: true, emailed };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error deciding live teaching application:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}

/* A replacement intro video from an approved teacher: approve puts it on the profile, reject keeps the old one. */
async function decideVideoChange(
  row: {
    id: string;
    status: string;
    teacherId: number;
    introVideoUrl: string;
    introVideoFileId: string | null;
    displayName: string;
    email: string | null;
    liveTeachingStatus: string | null;
  },
  action: "approve" | "reject" | "revoke",
  reason: string | null,
  adminName: string
): Promise<Response> {
  if (action === "revoke") {
    return new Response(superjson.stringify({ error: "A video change can only be approved or rejected." }), { status: 400 });
  }
  if (row.status !== "pending") {
    return new Response(superjson.stringify({ error: "Only pending video changes can be decided." }), { status: 400 });
  }
  if (action === "approve" && row.liveTeachingStatus !== "approved") {
    return new Response(superjson.stringify({ error: "This teacher is no longer approved for live teaching." }), { status: 400 });
  }
  const now = new Date();
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("liveTeachingApplications")
      .set({ status: action === "approve" ? "approved" : "rejected", decisionReason: reason, decidedBy: adminName, decidedAt: now, updatedAt: now })
      .where("id", "=", row.id)
      .execute();
    if (action === "approve") {
      await trx
        .updateTable("users")
        .set({ introVideoUrl: row.introVideoUrl, introVideoFileId: row.introVideoFileId })
        .where("id", "=", row.teacherId)
        .execute();
    }
  });
  let emailed = false;
  if (row.email) {
    await sendIntroVideoDecisionEmail(row.email, row.displayName, action === "approve", reason);
    emailed = true;
  }
  const output: OutputType = { success: true, emailed };
  return new Response(superjson.stringify(output));
}