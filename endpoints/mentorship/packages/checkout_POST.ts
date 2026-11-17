import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { schema, OutputType } from "./checkout_POST.schema";
import { teacherMaxClassesPerWeek } from "../../../helpers/mentorshipSlots";
import { getTeacherPlatformFee } from "../../../helpers/getTeacherPlatformFee";
import { cashfreeGatewayEnv, getCashfreeConfig } from "../../../helpers/cashfree";
import { createCashfreeSubscription } from "../../../helpers/cashfreeSubscriptions";
import { PACKAGE_CYCLE_DAYS, PACKAGE_WEEKS } from "../../../helpers/liveLessonConfig";
import { classPriceFor, packageMandateMax, pricesMeetFloors, resolveLivePrices } from "../../../helpers/livePricing";
import {
  abandonPendingPackage,
  cancelAbandonedMandates,
  getLiveBalance,
  getLivePackageFor,
  getTrialState,
  PACKAGE_CHECKOUT_HOLD_MS,
  roundMoney,
  studentBalanceLock,
} from "../../../helpers/livePackages";
import { getOrderClientInfo } from "../../../helpers/orderClientInfo";
import { getOrderAttribution } from "../../../helpers/getOrderAttribution";
import { recordFunnelEvent } from "../../../helpers/recordFunnelEvent";
import { SITE_ORIGIN } from "../../../helpers/shareLinks";
import { liveBookingPath } from "../../../helpers/liveBookingRoutes";
import { liveBookingContactProblem } from "../../../helpers/liveBookingContact";

const fail = (error: string, status = 400) => new Response(superjson.stringify({ error }), { status });

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") throw new NotAuthenticatedError("Only students can buy a package.");
    const contactProblem = await liveBookingContactProblem(user.id);
    if (contactProblem) return fail(contactProblem);

    const input = schema.parse(superjson.parse(await request.text()));
    const { teacherId, classesPerWeek, classMinutes } = input;
    const classCount = classesPerWeek * PACKAGE_WEEKS;

    getCashfreeConfig();

    const teacher = await db
      .selectFrom("teachers")
      .select([
        "id",
        "slug",
        "timezone",
        "displayName",
        "mentorshipEnabled",
        "mentorshipRatePerUnit",
        "mentorshipClassPrice60",
        "mentorshipTrialDiscount",
        "liveTeachingStatus",
      ])
      .where("id", "=", teacherId)
      .executeTakeFirst();
    const prices = teacher ? resolveLivePrices(teacher) : null;
    if (!teacher || !teacher.mentorshipEnabled || teacher.liveTeachingStatus !== "approved" || !prices || !pricesMeetFloors(prices)) {
      return fail("This teacher does not currently offer 1:1 classes.");
    }
    if ((await getTrialState(user.id, teacherId)) !== "done") {
      return fail("Take a trial class with this teacher first.");
    }
    if (await getLivePackageFor(user.id, teacherId)) {
      return fail("You already have a package with this teacher.");
    }
    const maxPerWeek = await teacherMaxClassesPerWeek(teacherId);
    if (classesPerWeek > maxPerWeek) {
      return fail(
        maxPerWeek > 0
          ? `${teacher.displayName} teaches on ${maxPerWeek} day${maxPerWeek > 1 ? "s" : ""} a week, so pick up to ${maxPerWeek} class${maxPerWeek > 1 ? "es" : ""} a week.`
          : "This teacher has no open hours right now."
      );
    }

    const now = Date.now();
    const cycleStart = new Date(now);
    const cycleEnd = new Date(now + PACKAGE_CYCLE_DAYS * 24 * 60 * 60000);

    const price = roundMoney(classPriceFor(prices, classMinutes));
    const amount = roundMoney(price * classCount);
    const maxAmount = roundMoney(packageMandateMax(price));
    const fee = await getTeacherPlatformFee(teacherId);

    const created = await db.transaction().execute(async (trx) => {
      await studentBalanceLock(user.id).execute(trx);
      const stale = await trx
        .selectFrom("livePackages")
        .select("id")
        .where("studentId", "=", user.id)
        .where("teacherId", "=", teacherId)
        .where("status", "=", "pending")
        .execute();
      const staleSubscriptionIds: string[] = [];
      for (const s of stale) staleSubscriptionIds.push(...(await abandonPendingPackage(trx, s.id, "Replaced by a newer checkout.")));

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

      // The balance stays held until the checkout is settled or abandoned, not just while the slots are held.
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
          liveHoldUntil: new Date(now + PACKAGE_CHECKOUT_HOLD_MS),
          gatewayEnv: cashfreeGatewayEnv(),
          emailsSentAt: new Date(),
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      // Pay first, schedule after: the paid cycle's classes start as credits waiting for a time.
      await trx
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

      return { packageId: pkg.id, subscriptionId, orderId: order.id, toPay, authAmount, staleSubscriptionIds };
    });

    await cancelAbandonedMandates(created.staleSubscriptionIds);

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
      const abandoned = await db.transaction().execute((trx) => abandonPendingPackage(trx, created.packageId, message));
      await cancelAbandonedMandates(abandoned);
      throw error;
    }
  } catch (error) {
    console.error("Package checkout failed:", error);
    return fail(error instanceof Error ? error.message : "Could not start the checkout.");
  }
}
