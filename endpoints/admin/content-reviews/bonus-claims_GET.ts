import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import {
  campaignRequirements,
  campaignSlotLimit,
  loadCampaignContent,
  measureContent,
} from "../../../helpers/teacherCampaign";
import {
  meetsCampaignCriteria,
  type CampaignClaimStatus,
  type CampaignContentType,
  type CampaignCriteria,
} from "../../../helpers/teacherCampaignRules";
import { schema, type BonusClaimAdminView, type OutputType } from "./bonus-claims_GET.schema";

const PAGE_SIZE = 25;

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const url = new URL(request.url);
    const parsed = schema.safeParse({
      status: url.searchParams.get("status") || undefined,
      page: url.searchParams.get("page") || undefined,
    });
    if (!parsed.success) return new Response(superjson.stringify({ error: "Invalid request" }), { status: 400 });
    const { status, page } = parsed.data;

    let query = db
      .selectFrom("teacherCampaignClaims as c")
      .innerJoin("users as u", "u.id", "c.teacherId")
      .leftJoin("contentReviews as r", "r.id", "c.contentReviewId")
      .leftJoin("admins as a", "a.id", "c.decidedBy")
      .select([
        "c.id",
        "c.status",
        "c.amount",
        "c.campaignId",
        "c.contentType",
        "c.contentId",
        "c.teacherId",
        "c.criteriaAtClaim",
        "c.decisionNote",
        "c.reverseReason",
        "c.createdAt",
        "c.decidedAt",
        "c.reversedAt",
        "u.displayName as teacherName",
        "u.email as teacherEmail",
        "r.status as reviewStatus",
        "a.fullName as decidedByName",
      ]);
    if (status !== "all") query = query.where("c.status", "=", status);

    const [rows, countRows, creditedRow] = await Promise.all([
      query
        .orderBy(status === "claimed" ? "c.createdAt" : "c.updatedAt", status === "claimed" ? "asc" : "desc")
        .orderBy("c.id", "desc")
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE)
        .execute(),
      db
        .selectFrom("teacherCampaignClaims")
        .select(["status", (eb) => eb.fn.countAll<string>().as("count")])
        .groupBy("status")
        .execute(),
      db
        .selectFrom("teacherCampaignClaims")
        .select(sql<string>`COALESCE(SUM(amount), 0)`.as("total"))
        .where("status", "=", "credited")
        .executeTakeFirst(),
    ]);

    const campaignIds = [...new Set(rows.map((r) => r.campaignId))];
    const campaigns =
      campaignIds.length > 0 ? await db.selectFrom("teacherCampaigns").selectAll().where("id", "in", campaignIds).execute() : [];
    const campaignById = new Map(campaigns.map((c) => [c.id, c]));

    const claims: BonusClaimAdminView[] = [];
    for (const row of rows) {
      const type = row.contentType as CampaignContentType;
      const campaign = campaignById.get(row.campaignId)!;
      const open = row.status === "claimed";
      const [content, criteriaNow, credited] = await Promise.all([
        loadCampaignContent(db, type, row.contentId),
        open ? measureContent(db, type, row.contentId, campaignRequirements(campaign)) : Promise.resolve(null),
        db
          .selectFrom("teacherCampaignClaims")
          .select((eb) => eb.fn.countAll<string>().as("count"))
          .where("campaignId", "=", row.campaignId)
          .where("teacherId", "=", row.teacherId)
          .where("contentType", "=", type)
          .where("status", "=", "credited")
          .executeTakeFirst(),
      ]);
      claims.push({
        id: row.id,
        status: row.status as CampaignClaimStatus,
        amount: Number(row.amount),
        contentType: type,
        contentId: row.contentId,
        contentTitle: content?.title ?? "Deleted item",
        live: content?.live ?? false,
        teacherId: row.teacherId,
        teacherName: row.teacherName,
        teacherEmail: row.teacherEmail,
        reviewStatus: row.reviewStatus,
        criteriaAtClaim: row.criteriaAtClaim as CampaignCriteria,
        criteriaNow,
        meetsNow: criteriaNow ? meetsCampaignCriteria(criteriaNow, campaignRequirements(campaign)) : null,
        requirements: campaignRequirements(campaign),
        slots: { credited: Number(credited?.count ?? 0), limit: campaignSlotLimit(campaign, type) },
        decisionNote: row.decisionNote,
        reverseReason: row.reverseReason,
        decidedByName: row.decidedByName,
        createdAt: row.createdAt,
        decidedAt: row.decidedAt,
        reversedAt: row.reversedAt,
      });
    }

    const counts = { claimed: 0, credited: 0, declined: 0, reversed: 0 };
    let filteredTotal = 0;
    for (const row of countRows) {
      if (row.status in counts) counts[row.status as keyof typeof counts] = Number(row.count);
      if (status === "all" || row.status === status) filteredTotal += Number(row.count);
    }

    const output: OutputType = {
      claims,
      counts,
      creditedTotal: Number(creditedRow?.total ?? 0),
      currentPage: page,
      totalPages: Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE)),
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error listing Creator Bonus claims:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = error instanceof Error && error.name === "NotAuthenticatedError" ? 401 : 500;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}