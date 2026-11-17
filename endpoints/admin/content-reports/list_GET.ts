import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "../../../helpers/db";
import { allAccounts } from "../../../helpers/allAccounts";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import type { ContentReportStatus } from "../../../helpers/schema";
import { CONTENT_REPORT_STATUS_VALUES } from "../../../helpers/contentReportTypes";
import { schema, OutputType } from "./list_GET.schema";

const json = (body: unknown, status = 200) =>
  new Response(superjson.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const { status, contentType, category, search, limit, offset } = schema.parse({
      status: url.searchParams.get("status"),
      contentType: url.searchParams.get("contentType"),
      category: url.searchParams.get("category"),
      search: url.searchParams.get("search"),
      limit: url.searchParams.get("limit") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
    });

    let base = db.selectFrom("contentReports");
    if (contentType) base = base.where("contentReports.contentType", "=", contentType);
    if (category) base = base.where("contentReports.category", "=", category);
    if (search) {
      const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const asId = /^#?\d+$/.test(search) ? Number(search.replace("#", "")) : null;
      base = base.where((eb) =>
        eb.or([
          eb("contentReports.pageTitle", "ilike", like),
          eb("contentReports.pageUrl", "ilike", like),
          eb("contentReports.description", "ilike", like),
          eb("contentReports.reporterEmail", "ilike", like),
          eb("contentReports.reporterPhone", "ilike", like),
          ...(asId !== null && Number.isSafeInteger(asId) ? [eb("contentReports.id", "=", asId)] : []),
        ])
      );
    }

    const filtered = status ? base.where("contentReports.status", "=", status) : base;

    const [rows, totalRow, countRows] = await Promise.all([
      filtered
        .leftJoin(allAccounts(db).as("users"), "users.id", "contentReports.reporterUserId")
        .leftJoin("admins", "admins.id", "contentReports.reviewedByAdminId")
        .select([
          "contentReports.id",
          "contentReports.contentType",
          "contentReports.contentId",
          "contentReports.contentSlug",
          "contentReports.parentSlug",
          "contentReports.pageUrl",
          "contentReports.pageTitle",
          "contentReports.category",
          "contentReports.description",
          "contentReports.locationHint",
          "contentReports.detectedSection",
          "contentReports.selectedText",
          "contentReports.suggestedCorrection",
          "contentReports.reporterEmail",
          "contentReports.reporterName",
          "contentReports.reporterPhone",
          "contentReports.reporterUserId",
          "users.displayName as reporterUserName",
          "contentReports.copyrightMaterialType",
          "contentReports.copyrightMaterialLocation",
          "contentReports.copyrightOriginalSource",
          "contentReports.captchaVerifiedAt",
          "contentReports.status",
          "contentReports.adminNotes",
          "admins.fullName as reviewedByName",
          "contentReports.statusChangedAt",
          "contentReports.createdAt",
          "contentReports.updatedAt",
        ])
        .orderBy("contentReports.createdAt", "desc")
        .orderBy("contentReports.id", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      filtered.select((eb) => eb.fn.countAll<string>().as("count")).executeTakeFirstOrThrow(),
      base
        .select(["contentReports.status", (eb) => eb.fn.countAll<string>().as("count")])
        .groupBy("contentReports.status")
        .execute(),
    ]);

    const statusCounts = Object.fromEntries(CONTENT_REPORT_STATUS_VALUES.map((s) => [s, 0])) as Record<
      ContentReportStatus,
      number
    >;
    for (const row of countRows) statusCounts[row.status] = Number(row.count);

    return json({
      reports: rows,
      total: Number(totalRow.count),
      statusCounts,
    } satisfies OutputType);
  } catch (error) {
    if (error instanceof ZodError) {
      return json({ error: "Invalid filters", details: error.errors }, 400);
    }
    if (error instanceof Error && (error.name === "NotAuthenticatedError" || error.name === "ForbiddenError")) {
      return json({ error: error.message }, error.name === "NotAuthenticatedError" ? 401 : 403);
    }
    console.error("Failed to list content reports:", error);
    return json({ error: error instanceof Error ? error.message : "An unknown error occurred" }, 500);
  }
}