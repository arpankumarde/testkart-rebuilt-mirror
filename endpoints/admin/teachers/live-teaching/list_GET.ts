import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";
import { asStringList } from "../../../../helpers/liveTeachingRules";
import { schema, OutputType, LiveTeachingApplicationRow } from "./list_GET.schema";

const IS_LATEST = sql<boolean>`NOT EXISTS (SELECT 1 FROM live_teaching_applications later WHERE later.teacher_id = a.teacher_id AND later.kind = a.kind AND later.created_at > a.created_at)`;

/*
 * Status tabs and their counts show each teacher's current state: only the latest row per teacher
 * and kind, so a teacher revoked earlier and approved later is not listed under both. "all" keeps
 * the full history, with isLatest marking the current row.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const url = new URL(request.url);
    const { status } = schema.parse({ status: url.searchParams.get("status") ?? undefined });

    let query = db
      .selectFrom("liveTeachingApplications as a")
      .innerJoin("teachers as u", "u.id", "a.teacherId")
      .select([
        "a.id",
        "a.kind",
        "a.status",
        "a.createdAt",
        "a.decidedAt",
        "a.decidedBy",
        "a.decisionReason",
        "a.introVideoUrl",
        "a.ratePerUnit",
        "u.id as teacherId",
        "u.displayName",
        "u.email",
        "u.avatarUrl",
        "u.slug",
        "u.tagline",
        "u.bio",
        "u.expertiseAreas",
        "u.teachingCategories",
        "u.languages",
        "u.yearsOfExperience",
        "u.isVerified",
        sql<string>`(SELECT count(*) FROM mentorship_availability m WHERE m.teacher_id = u.id AND m.is_active)`.as(
          "hourWindows"
        ),
        IS_LATEST.as("isLatest"),
        "u.introVideoUrl as currentVideoUrl",
      ])
      .orderBy("a.createdAt", status === "pending" ? "asc" : "desc")
      .limit(200);
    if (status !== "all") query = query.where("a.status", "=", status).where(IS_LATEST);

    const [rows, countRows] = await Promise.all([
      query.execute(),
      db
        .selectFrom("liveTeachingApplications as a")
        .select(["a.status", db.fn.countAll<string>().as("n")])
        .where(IS_LATEST)
        .groupBy("a.status")
        .execute(),
    ]);

    const counts: OutputType["counts"] = { pending: 0, approved: 0, rejected: 0, revoked: 0 };
    for (const row of countRows) {
      if (row.status in counts) counts[row.status as keyof typeof counts] = Number(row.n);
    }

    const applications: LiveTeachingApplicationRow[] = rows.map((r) => ({
      id: r.id,
      kind: r.kind as LiveTeachingApplicationRow["kind"],
      currentVideoUrl: r.kind === "video" ? r.currentVideoUrl : null,
      status: r.status as LiveTeachingApplicationRow["status"],
      createdAt: r.createdAt,
      decidedAt: r.decidedAt,
      decidedBy: r.decidedBy,
      decisionReason: r.decisionReason,
      introVideoUrl: r.introVideoUrl,
      ratePerUnit: r.ratePerUnit !== null ? Number(r.ratePerUnit) : null,
      isLatest: Boolean(r.isLatest),
      teacher: {
        id: r.teacherId,
        displayName: r.displayName ?? "Teacher",
        email: r.email ?? "",
        avatarUrl: r.avatarUrl,
        slug: r.slug,
        tagline: r.tagline,
        bio: r.bio,
        subjects: Array.from(new Set([...asStringList(r.expertiseAreas), ...asStringList(r.teachingCategories)])),
        languages: asStringList(r.languages),
        yearsOfExperience: r.yearsOfExperience,
        isVerified: Boolean(r.isVerified),
        weeklyHourWindows: Number(r.hourWindows ?? 0),
      },
    }));

    const output: OutputType = { applications, counts };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error listing live teaching applications:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}