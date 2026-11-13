import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { getLiveBalance, isLateForStudent, isTrialCreditHeld, LIVE_PACKAGE_STATUSES } from "../../../helpers/livePackages";
import { teacherMaxClassesPerWeek } from "../../../helpers/mentorshipSlots";
import type { LivePackageView, OutputType, TrialFollowUp } from "./list_GET.schema";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(superjson.stringify({ error: "Only students have live class packages." }), { status: 403 });
    }

    const packages = await db
      .selectFrom("livePackages")
      .innerJoin("users as teacher", "teacher.id", "livePackages.teacherId")
      .select([
        "livePackages.id",
        "livePackages.status",
        "livePackages.teacherId",
        "livePackages.classesPerWeek",
        "livePackages.nextClassesPerWeek",
        "livePackages.classMinutes",
        "livePackages.pricePerClass",
        "livePackages.autoRenew",
        "teacher.displayName as teacherName",
        "teacher.avatarUrl as teacherAvatarUrl",
      ])
      .where("livePackages.studentId", "=", user.id)
      .where("livePackages.status", "in", [...LIVE_PACKAGE_STATUSES])
      .orderBy("livePackages.createdAt", "desc")
      .execute();
    const ids = packages.map((p) => p.id);
    const teacherIds = [...new Set(packages.map((p) => p.teacherId))];
    const maxPerWeek = new Map(await Promise.all(teacherIds.map(async (t) => [t, await teacherMaxClassesPerWeek(t)] as const)));

    const [cycles, credits, bookings, mandates, balance] = await Promise.all([
      ids.length
        ? db.selectFrom("livePackageCycles").selectAll().where("packageId", "in", ids).orderBy("cycleNumber", "desc").execute()
        : Promise.resolve([]),
      ids.length
        ? db.selectFrom("liveClassCredits").select(["id", "packageId", "amount", "status"]).where("packageId", "in", ids).execute()
        : Promise.resolve([]),
      ids.length
        ? db
            .selectFrom("mentorshipBookings")
            .select(["id", "packageId", "scheduledAt", "durationMinutes"])
            .where("packageId", "in", ids)
            .where("status", "=", "scheduled")
            .orderBy("scheduledAt", "asc")
            .execute()
        : Promise.resolve([]),
      ids.length
        ? db.selectFrom("liveMandates").select(["packageId", "status"]).where("packageId", "in", ids).where("status", "=", "active").execute()
        : Promise.resolve([]),
      getLiveBalance(user.id),
    ]);

    const views: LivePackageView[] = packages.map((p) => {
      const own = cycles.filter((c) => c.packageId === p.id);
      const paid = own.find((c) => c.status === "paid");
      const open = own.find((c) => (c.status === "pending" || c.status === "failed") && (!paid || c.cycleNumber > paid.cycleNumber));
      const ownCredits = credits.filter((c) => c.packageId === p.id);
      return {
        id: p.id,
        status: p.status as LivePackageView["status"],
        teacher: { id: p.teacherId, displayName: p.teacherName, avatarUrl: p.teacherAvatarUrl },
        classesPerWeek: p.classesPerWeek,
        nextClassesPerWeek: p.nextClassesPerWeek,
        maxClassesPerWeek: Math.max(maxPerWeek.get(p.teacherId) ?? 0, p.classesPerWeek),
        classMinutes: p.classMinutes,
        pricePerClass: Number(p.pricePerClass),
        autoRenew: p.autoRenew,
        autopayActive: mandates.some((m) => m.packageId === p.id),
        cycle: paid
          ? { number: paid.cycleNumber, startsAt: paid.startsAt, endsAt: paid.endsAt, amount: Number(paid.amount) }
          : null,
        renewal: open
          ? {
              number: open.cycleNumber,
              status: open.status as "pending" | "failed",
              startsAt: open.startsAt,
              amount: Number(open.amount),
              failureReason: open.failureReason,
              graceUntil: open.graceUntil,
            }
          : null,
        waitingCredits: ownCredits.filter((c) => c.status === "unscheduled").map((c) => ({ id: c.id, amount: Number(c.amount) })),
        upcoming: bookings
          .filter((b) => b.packageId === p.id)
          .map((b) => ({
            bookingId: b.id,
            scheduledAt: b.scheduledAt,
            durationMinutes: b.durationMinutes,
            freeChange: !isLateForStudent(new Date(b.scheduledAt)),
          })),
        heldCount: ownCredits.filter((c) => c.status === "spent").length,
      };
    });

    const trials = await db
      .selectFrom("liveClassCredits")
      .innerJoin("mentorshipBookings", "mentorshipBookings.id", "liveClassCredits.bookingId")
      .innerJoin("users as teacher", "teacher.id", "liveClassCredits.teacherId")
      .select((eb) => [
        "mentorshipBookings.id as bookingId",
        "mentorshipBookings.scheduledAt",
        "mentorshipBookings.status as bookingStatus",
        "mentorshipBookings.durationMinutes",
        "liveClassCredits.status",
        "liveClassCredits.teacherId",
        "teacher.slug as teacherSlug",
        "teacher.displayName",
        "teacher.avatarUrl",
        eb
          .exists(
            eb
              .selectFrom("liveLessonAttendance")
              .innerJoin("users", "users.id", "liveLessonAttendance.userId")
              .select("liveLessonAttendance.id")
              .whereRef("liveLessonAttendance.mentorshipBookingId", "=", "mentorshipBookings.id")
              .where("liveLessonAttendance.role", "=", "teacher")
              .where("users.role", "=", "teacher")
          )
          .as("teacherJoined"),
      ])
      .where("liveClassCredits.studentId", "=", user.id)
      .where("liveClassCredits.kind", "=", "trial")
      .where("liveClassCredits.status", "in", ["booked", "spent"])
      .where("mentorshipBookings.scheduledAt", ">", new Date(Date.now() - 14 * DAY_MS))
      .where(({ not, exists, selectFrom }) =>
        not(
          exists(
            selectFrom("livePackages")
              .select("livePackages.id")
              .whereRef("livePackages.teacherId", "=", "liveClassCredits.teacherId")
              .where("livePackages.studentId", "=", user.id)
              .where("livePackages.status", "!=", "failed")
          )
        )
      )
      .orderBy("mentorshipBookings.scheduledAt", "desc")
      .execute();

    const nowMs = Date.now();
    const trialFollowUps: TrialFollowUp[] = trials.filter((t) => isTrialCreditHeld(t, nowMs)).map((t) => ({
      bookingId: t.bookingId,
      teacherId: t.teacherId,
      teacherSlug: t.teacherSlug,
      teacherName: t.displayName,
      teacherAvatarUrl: t.avatarUrl,
      classAt: t.scheduledAt,
    }));

    const output: OutputType = { balance: Math.max(0, balance), packages: views, trialFollowUps };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Package list failed:", error);
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Could not load your packages." }), { status: 400 });
  }
}
