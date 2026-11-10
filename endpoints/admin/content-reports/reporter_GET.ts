import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { parseUserAgent } from "../../../helpers/parseUserAgent";
import { schema, OutputType } from "./reporter_GET.schema";

const json = (body: unknown, status = 200) =>
  new Response(superjson.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });

/** Reporter IP and device for one report. Admins with the content_reports module only. */
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const { id } = schema.parse({ id: new URL(request.url).searchParams.get("id") });

    const row = await db
      .selectFrom("contentReports")
      .select(["reporterIp", "deviceType", "osName", "browserName", "userAgent", "createdAt"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return json({ error: "Report not found" }, 404);

    // Reports filed before device fields existed kept only the raw User-Agent.
    if (!row.deviceType && row.userAgent) {
      const parsed = parseUserAgent(row.userAgent);
      return json({ ...row, deviceType: parsed.deviceType, osName: parsed.os, browserName: parsed.browser } satisfies OutputType);
    }

    return json(row satisfies OutputType);
  } catch (error) {
    if (error instanceof ZodError) return json({ error: "Invalid report id" }, 400);
    if (error instanceof Error && (error.name === "NotAuthenticatedError" || error.name === "ForbiddenError")) {
      return json({ error: error.message }, error.name === "NotAuthenticatedError" ? 401 : 403);
    }
    console.error("Failed to load content report reporter details:", error);
    return json({ error: "Could not load the reporter details" }, 500);
  }
}