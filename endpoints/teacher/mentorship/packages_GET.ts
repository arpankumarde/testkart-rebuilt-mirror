import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { LIVE_PACKAGE_STATUSES } from "../../../helpers/livePackages";
import type { OutputType, TeacherPackageRow } from "./packages_GET.schema";

/** The teacher's students on live class packages. */
export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Only teachers can view this." }), { status: 403 });
    }

    const rows = await db
      .selectFrom("livePackages")
      .innerJoin("students as student", "student.id", "livePackages.studentId")
      .select([
        "livePackages.id",
        "livePackages.status",
        "livePackages.classesPerWeek",
        "livePackages.classMinutes",
        "livePackages.pricePerClass",
        "livePackages.autoRenew",
        "student.displayName as studentName",
        "student.avatarUrl as studentAvatarUrl",
      ])
      .where("livePackages.teacherId", "=", effectiveTeacherId)
      .where("livePackages.status", "in", [...LIVE_PACKAGE_STATUSES])
      .orderBy("livePackages.activatedAt", "desc")
      .execute();
    const ids = rows.map((r) => r.id);

    const [cycles, credits] = await Promise.all([
      ids.length
        ? db
            .selectFrom("livePackageCycles")
            .select(["packageId", "endsAt"])
            .where("packageId", "in", ids)
            .where("status", "=", "paid")
            .orderBy("cycleNumber", "desc")
            .execute()
        : Promise.resolve([]),
      ids.length
        ? db.selectFrom("liveClassCredits").select(["packageId", "status"]).where("packageId", "in", ids).execute()
        : Promise.resolve([]),
    ]);

    const packages: TeacherPackageRow[] = rows.map((r) => ({
      id: r.id,
      status: r.status as TeacherPackageRow["status"],
      studentName: r.studentName,
      studentAvatarUrl: r.studentAvatarUrl,
      classesPerWeek: r.classesPerWeek,
      classMinutes: r.classMinutes,
      pricePerClass: Number(r.pricePerClass),
      cycleEndsAt: cycles.find((c) => c.packageId === r.id)?.endsAt ?? null,
      autoRenew: r.autoRenew,
      upcomingCount: credits.filter((c) => c.packageId === r.id && c.status === "booked").length,
      heldCount: credits.filter((c) => c.packageId === r.id && c.status === "spent").length,
    }));
    const output: OutputType = { packages };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Teacher packages failed:", error);
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Could not load packages." }), { status: 400 });
  }
}
