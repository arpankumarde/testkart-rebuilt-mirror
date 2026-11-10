import superjson from "superjson";
import { toZonedTime } from "date-fns-tz";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { schema, OutputType } from "./checkout_POST.schema";
import { isTeacherSlotBookable } from "../../../helpers/mentorshipSlots";
import { getTeacherPlatformFee } from "../../../helpers/getTeacherPlatformFee";
import { getCashfreeConfig } from "../../../helpers/cashfree";
import { createCashfreeSubscription } from "../../../helpers/cashfreeSubscriptions";
import { CHECKOUT_HOLD_MINUTES, PACKAGE_CYCLE_DAYS, PACKAGE_WEEKS } from "../../../helpers/liveLessonConfig";
import { classPriceFor, packageMandateMax, pricesMeetFloors, resolveLivePrices } from "../../../helpers/livePricing";
import {
  abandonPendingPackage,
  getLiveBalance,
  getLivePackageFor,
  getTrialState,
  isStudentFree,
  roundMoney,
  teacherBookingLock,
} from "../../../helpers/livePackages";
import { getOrderClientInfo } from "../../../helpers/orderClientInfo";
import { getOrderAttribution } from "../../../helpers/getOrderAttribution";
import { recordFunnelEvent } from "../../../helpers/recordFunnelEvent";
import { SITE_ORIGIN } from "../../../helpers/shareLinks";
import { liveBookingPath } from "../../../helpers/liveBookingRoutes";

const fail = (error: string, status = 400) => new Response(superjson.stringify({ error }), { status });

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") throw new NotAuthenticatedError("Only students can buy a package.");

    const input = schema.parse(superjson.parse(await request.text()));
    const { teacherId, classesPerWeek, classMinutes } = input;
    const classCount = classesPerWeek * PACKAGE_WEEKS;
    const startTimes = [...input.startTimes].sort((a, b) => a.getTime() - b.getTime());
    if (startTimes.length !== classCount) return fail(`Pick ${classCount} class times.`);

    getCashfreeConfig();

    const teacher = await db
      .selectFrom("users")
      .select([
        "id",
        "slug",
        "role",
        "timezone",
        "displayName",
        "mentorshipEnabled",
        "mentorshipRatePerUnit",
        "mentorshipClassPrice50",
        "mentorshipTrialPrice25",
        "mentorshipTrialPrice50",
        "liveTeachingStatus",
      ])
      .where("id", "=", teacherId)
      .executeTakeFirst();
    const prices = teacher ? resolveLivePrices(teacher) : null;
    if (!teacher || teacher.role !== "teacher" || !teacher.mentorshipEnabled || teacher.liveTeachingStatus !== "approved" || !prices || !pricesMeetFloors(prices)) {
      return fail("This teacher does not currently offer 1:1 classes.");
    }
    if ((await getTrialState(user.id, teacherId)) !== "done") {
      return fail("Take a trial class with this teacher first.");
    }
    if (await getLivePackageFor(user.id, teacherId)) {
      return fail("You already have a package with this teacher.");
    }

    const now = Date.now();
    const cycleStart = new Date(now);
    const cycleEnd = new Date(now + PACKAGE_CYCLE_DAYS * 24 * 60 * 60000);
    const days = new Set<string>();
    for (const t of startTimes) {
      if (t.getTime() >= cycleEnd.getTime()) return fail("Every class must fall within the next 4 weeks.");
      const z = toZonedTime(t, teacher.timezone);
      const key = `${z.getFullYear()}-${z.getMonth()}-${z.getDate()}`;
      if (days.has(key)) return fail("Pick at most one class a day.");
      days.add(key);
    }

    const price = roundMoney(classPriceFor(prices, classMinutes));
    const amount = roundMoney(price * classCount);
    const maxAmount = roundMoney(packageMandateMax(price));
    const fee = await getTeacherPlatformFee(teacherId);
    const holdUntil = new Date(now + CHECKOUT_HOLD_MINUTES * 60000);

    const created = await db.transaction().execute(async (trx) => {
      const stale = await trx
        .selectFrom("livePackages")
        .select("id")
        .where("studentId", "=", user.id)
        .where("teacherId", "=", teacherId)
        .where("status", "=", "pending")
        .execute();
      for (const s of stale) await abandonPendingPackage(trx, s.id, "Replaced by a newer checkout.");

      await teacherBookingLock(teacherId).execute(trx);
      for (const t of startTimes) {
        const slot = await isTeacherSlotBookable(teacherId, t, classMinutes, trx);
        if (!slot.ok) throw new Error(`${slot.reason} (${t.toISOString()})`);
        if (!(await isStudentFree(trx, user.id, t, classMinutes))) {
          throw new Error("One of these times clashes with another class of yours.");
        }
      }

      const balance = await getLiveBalance(user.id, trx);
      const balanceUsed = roundMoney(Math.max(0, Math.min(balance, amount)));
      const toPay = roundMoney(amount - balanceUsed);

      const pkg = await trx
        .insertInto("livePackages")
        .values({
          studentId: user.id,
          teacherId,
          classesPerWeek,
          classMinutes,
          pricePerClass: price.toFixed(2),
          status: "pending",
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      const subscriptionId = `lp_${pkg.id.replace(/-/g, "")}`;

      const order = await trx
        .insertInto("orders")
        .values({
          userId: user.id,
          ...getOrderClientInfo(request),
          ...getOrderAttribution(request),
          totalAmount: toPay.toFixed(2),
          status: "pending",
          paymentMethod: "cashfree_mandate",
          paymentTransactionId: subscriptionId,
          liveBalanceUsed: balanceUsed.toFixed(2),
          liveHoldUntil: holdUntil,
          emailsSentAt: new Date(),
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      const cycle = await trx
        .insertInto("livePackageCycles")
        .values({
          packageId: pkg.id,
          cycleNumber: 1,
          classesPerWeek,
          classCount,
          pricePerClass: price.toFixed(2),
          platformFeePercentage: fee.toFixed(2),
          amount: amount.toFixed(2),
          startsAt: cycleStart,
          endsAt: cycleEnd,
          status: "pending",
          orderId: order.id,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("liveSlotHolds")
        .values(
          startTimes.map((t) => ({
            cycleId: cycle.id,
            teacherId,
            studentId: user.id,
            startsAt: t,
            durationMinutes: classMinutes,
            expiresAt: holdUntil,
          }))
        )
        .execute();

      // UPI and card mandates charge at least ₹1 at setup; when the balance covers the cycle that rupee is refunded.
      const authAmount = Math.max(toPay, 1);
      await trx
        .insertInto("liveMandates")
        .values({
          packageId: pkg.id,
          studentId: user.id,
          subscriptionId,
          maxAmount: maxAmount.toFixed(2),
          authAmount: authAmount.toFixed(2),
          status: "initialized",
        })
        .execute();

      return { packageId: pkg.id, subscriptionId, orderId: order.id, toPay, authAmount };
    });

    const phone = (user.mobileNumber ?? "").replace(/\D/g, "").slice(-10);
    const customerPhone = phone.length === 10 ? phone : "9999999999";
    try {
      const session = await createCashfreeSubscription({
        subscriptionId: created.subscriptionId,
        customerName: user.displayName || "Student",
        customerEmail: user.email ?? `${customerPhone}@mail.testkart.in`,
        customerPhone,
        planName: `Live classes with ${teacher.displayName}`.slice(0, 40),
        maxAmount,
        authAmount: created.authAmount,
        refundAuth: created.toPay <= 0,
        returnUrl: `${SITE_ORIGIN}${liveBookingPath(teacher)}?package=${created.packageId}&gateway=cashfree_mandate`,
        note: `${classesPerWeek} x ${classMinutes} min a week`,
      });
      await db
        .updateTable("liveMandates")
        .set({ cfSubscriptionId: session.cfSubscriptionId, gatewayStatus: session.status, updatedAt: new Date() })
        .where("subscriptionId", "=", created.subscriptionId)
        .execute();

      await recordFunnelEvent({
        event: "checkout_started",
        request,
        userId: user.id,
        orderId: created.orderId,
        entityType: "mentorship_booking",
        entityId: teacherId,
        amount: created.toPay.toFixed(2),
        props: { path: "mentorship_package", gateway: "cashfree_mandate", classesPerWeek, classMinutes },
      });

      const output: OutputType = { packageId: created.packageId, subsSessionId: session.subscriptionSessionId, mode: session.mode };
      return new Response(superjson.stringify(output));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start autopay.";
      await db.transaction().execute((trx) => abandonPendingPackage(trx, created.packageId, message));
      throw error;
    }
  } catch (error) {
    console.error("Package checkout failed:", error);
    return fail(error instanceof Error ? error.message : "Could not start the checkout.");
  }
}
