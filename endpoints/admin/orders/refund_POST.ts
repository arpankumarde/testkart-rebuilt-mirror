import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./refund_POST.schema";
import superjson from "superjson";
import { revokeOrderAccess, RevokeOrderAccessResult } from "../../../helpers/revokeOrderAccess";
import { sendEmail } from "../../../helpers/sendEmail";
import { emailTemplatesExtra } from "../../../helpers/emailTemplatesExtra";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const { orderId, reason } = schema.parse(json);

    const order = await db
      .selectFrom("orders")
      .select(["id", "status"])
      .where("id", "=", orderId)
      .executeTakeFirst();

    if (!order) {
      return new Response(
        superjson.stringify({
          success: false,
          message: "Order not found",
          order: null,
        } satisfies OutputType),
        { status: 404 }
      );
    }

    if (order.status !== "completed") {
      return new Response(
        superjson.stringify({
          success: false,
          message: `Only completed orders can be refunded. Current status is '${order.status}'`,
          order: {
            id: order.id,
            previousStatus: order.status,
            newStatus: order.status,
          },
        } satisfies OutputType),
        { status: 400 }
      );
    }

    let revoked: RevokeOrderAccessResult | null = null;

    await db.transaction().execute(async (trx) => {
      const lockedOrder = await trx
        .selectFrom("orders")
        .select(["status", "userId"])
        .where("id", "=", orderId)
        .forUpdate()
        .executeTakeFirst();

      if (!lockedOrder || lockedOrder.status !== "completed") {
        return;
      }

      await trx
        .updateTable("orders")
        .set({ status: "refunded", refundedAt: new Date(), refundReason: reason, updatedAt: new Date() })
        .where("id", "=", orderId)
        .execute();

      // A refund takes back what the order unlocked, except items the student
      // also holds through another completed order. Counters are re-synced inside.
      revoked = await revokeOrderAccess(trx, orderId);
    });

    if (revoked) {
      const { removed, cancelledBookingIds } = revoked as RevokeOrderAccessResult;
      await emailCancelledBookings(cancelledBookingIds, reason);

      const accessNote =
        removed > 0
          ? ` ${removed} ${removed === 1 ? "item was" : "items were"} removed from the student's account.`
          : " The student had nothing left to remove from this order.";

      return new Response(
        superjson.stringify({
          success: true,
          message: `Order refunded.${accessNote}`,
          order: {
            id: orderId,
            previousStatus: order.status,
            newStatus: "refunded",
          },
        } satisfies OutputType)
      );
    } else {
      return new Response(
        superjson.stringify({
          success: false,
          message: `Failed to refund the order. It might have been altered concurrently.`,
          order: {
            id: orderId,
            previousStatus: order.status,
            newStatus: order.status,
          },
        } satisfies OutputType),
        { status: 409 }
      );
    }
  } catch (error) {
    console.error("[RefundOrder] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}

async function emailCancelledBookings(bookingIds: string[], reason: string) {
  if (bookingIds.length === 0) return;
  try {
    const bookings = await db
      .selectFrom("mentorshipBookings")
      .innerJoin("users as student", "student.id", "mentorshipBookings.studentId")
      .innerJoin("users as teacher", "teacher.id", "mentorshipBookings.teacherId")
      .select([
        "mentorshipBookings.scheduledAt",
        "mentorshipBookings.durationMinutes",
        "mentorshipBookings.isTrial",
        "student.email as studentEmail",
        "student.displayName as studentName",
        "teacher.email as teacherEmail",
        "teacher.displayName as teacherName",
      ])
      .where("mentorshipBookings.id", "in", bookingIds)
      .execute();

    for (const booking of bookings) {
      const sessionLabel = `${booking.isTrial ? "Trial " : ""}1:1 session (${booking.durationMinutes} min)`;
      const cancelReason = `Order refunded: ${reason}`;
      if (booking.studentEmail) {
        const tmpl = emailTemplatesExtra.mentorshipBookingCancelled(
          booking.studentName,
          booking.teacherName,
          sessionLabel,
          booking.scheduledAt,
          cancelReason,
          true
        );
        await sendEmail({ to: booking.studentEmail, ...tmpl });
      }
      if (booking.teacherEmail) {
        const tmpl = emailTemplatesExtra.mentorshipBookingCancelled(
          booking.teacherName,
          booking.studentName,
          sessionLabel,
          booking.scheduledAt,
          cancelReason,
          false
        );
        await sendEmail({ to: booking.teacherEmail, ...tmpl });
      }
    }
  } catch (emailError) {
    console.error("[RefundOrder] Failed to send 1:1 cancellation emails:", emailError);
  }
}
