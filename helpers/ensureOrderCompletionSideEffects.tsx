import { db } from "./db";
import { sql } from "kysely";
import { sendOrderConfirmationEmails } from "./sendOrderConfirmationEmails";
import { followTeachersForOrder, followTeacher } from "./ensureTeacherFollow";
import { recordOrderOutcome } from "./recordOrderOutcome";
import { isTeacherSlotBookable } from "./mentorshipSlots";
import { sendEmail } from "./sendEmail";
import { emailTemplatesExtra } from "./emailTemplatesExtra";
import { completeLiveCycle, cycleForOrder } from "./livePackages";
import { sendRenewalPaidEmail, type CycleSummary } from "./livePackageEmails";
import { sendEnrolledNotices } from "./liveCourseNotices";

/**
 * Ensures all completion side effects (digital product purchases, course enrollments, live test enrollments) 
 * exist for a completed order. This is idempotent and safe to call multiple times.
 * 
 * This is needed to handle race conditions where multiple callbacks/verifications
 * might process the same order, or when an order is manually completed.
 * 
 * Note: Mock test enrollment counts are NOT handled here because they use SQL increment
 * which is not idempotent. We assume they were incremented when the order was first completed.
 * Live test enrolled_count IS handled here via idempotent check before incrementing.
 */
export async function ensureOrderCompletionSideEffects(orderId: number): Promise<void> {
  console.log(`[ensureOrderCompletionSideEffects] Checking side effects for order ${orderId}`);

  let orderUserId: number | null = null;
  let pendingMentorshipBookingEmail: {
    studentId: number;
    teacherId: number;
    sessionTypeTitle: string;
    scheduledAt: Date;
    durationMinutes: number;
    bookingId: string;
    price: number;
  } | null = null;
  let pendingGroupLessonEnrollmentEmail: {
    studentId: number;
    teacherId: number;
    lessonTitle: string;
    startTime: Date;
    groupLessonId: string;
  } | null = null;
  let pendingLiveCycleSummary: CycleSummary | null = null;
  let pendingLiveCourseEnrollment: { courseId: string; studentId: number; amount: number } | null = null;

  await db.transaction().execute(async (trx) => {
    // Get the order
    const order = await trx
      .selectFrom("orders")
      .select(["id", "userId", "status", "bundleId", "paymentTransactionId", "totalAmount"])
      .where("id", "=", orderId)
      .executeTakeFirst();

    if (!order) {
      console.error(`[ensureOrderCompletionSideEffects] Order ${orderId} not found`);
      return;
    }

    if (order.status !== "completed") {
      console.log(`[ensureOrderCompletionSideEffects] Order ${orderId} is not completed (status: ${order.status}), skipping`);
      return;
    }

    orderUserId = order.userId;

    // Bundle id used by the bundle-enrollment block further down. Normally
    // this comes straight from the order, but sponsor orders (see below)
    // only learn their bundleId once we backfill the sponsorship record.
    let effectiveBundleId: number | null = order.bundleId;

    // Teacher-sponsored orders are completed by a dedicated PayU callback
    // (endpoints/payment/payu/sponsor-callback_POST.ts) that atomically marks
    // the sponsorship record paid AND creates its orderItems/enrollment. If an
    // order gets marked "completed" through any OTHER path (admin reconcile,
    // verify-and-complete, etc.) that callback never runs, so the sponsorship
    // stays stuck on "online_pending" with no orderItems and no enrollment,
    // even though the order itself looks complete. Detect and backfill that
    // here so every completion path ends up consistent.
    const sponsorship = await trx
      .selectFrom("teacherSponsoredEnrollments")
      .selectAll()
      .where("orderId", "=", orderId)
      .executeTakeFirst();

    // For a sponsor order, the order's userId is the TEACHER who paid, not
    // the student who should actually be enrolled — every enrollment check
    // below must key off the sponsored student instead of the order buyer.
    if (sponsorship && sponsorship.studentId === null) {
      console.error(`[ensureOrderCompletionSideEffects] Sponsor order ${orderId} (sponsorship ${sponsorship.id}) has no student to enroll: the sponsored account was closed`);
      orderUserId = null;
      return;
    }
    const beneficiaryUserId: number = sponsorship?.studentId ?? order.userId;

    if (sponsorship) {
      // Each piece below is independently idempotent (guarded by its own
      // "is this already done?" check), so this whole block is safe to run
      // on every completed sponsor order, not just ones still flagged
      // "online_pending" — a previous partial run (e.g. before this
      // content-type matching was fixed) could have updated the payment
      // fields without ever creating the order item / enrollment.
      if (sponsorship.paymentMethod === "online_pending") {
        console.log(`[ensureOrderCompletionSideEffects] Order ${orderId} is a sponsor order (sponsorship ${sponsorship.id}) still marked online_pending, marking paid`);
        await trx
          .updateTable("teacherSponsoredEnrollments")
          .set({
            paymentMethod: "online_payment",
            paymentTransactionId: order.paymentTransactionId ?? sponsorship.paymentTransactionId,
          })
          .where("id", "=", sponsorship.id)
          .where("paymentMethod", "=", "online_pending")
          .execute();
      }

      // NOTE: matches the values enroll_POST.ts actually writes
      // ("test" | "course" | "product" | "bundle"), not the
      // "mock_test"/"digital_product"/"course_bundle" values used for
      // content-review types elsewhere in the codebase.
      const contentType = sponsorship.contentType ?? "test";

      if (contentType === "bundle" && sponsorship.bundleId !== null) {
        if (!order.bundleId) {
          console.log(`[ensureOrderCompletionSideEffects] Backfilling bundleId ${sponsorship.bundleId} on order ${orderId} from sponsorship ${sponsorship.id}`);
          effectiveBundleId = sponsorship.bundleId;
          await trx
            .updateTable("orders")
            .set({ bundleId: sponsorship.bundleId })
            .where("id", "=", orderId)
            .execute();
        }
      } else {
        const existingItem = await trx
          .selectFrom("orderItems")
          .select("id")
          .where("orderId", "=", orderId)
          .executeTakeFirst();

        if (!existingItem) {
          console.log(`[ensureOrderCompletionSideEffects] Backfilling missing orderItem for sponsor order ${orderId} (sponsorship ${sponsorship.id}, contentType ${contentType})`);

          if (contentType === "test" && sponsorship.mockTestId !== null) {
            await trx
              .insertInto("orderItems")
              .values({
                orderId,
                mockTestId: sponsorship.mockTestId,
                quantity: 1,
                priceAtPurchase: sponsorship.testPrice,
                discountAmount: 0,
                platformFeePercentage: sponsorship.platformFeePercentage,
              })
              .execute();
          } else if (contentType === "course" && sponsorship.courseId !== null) {
            await trx
              .insertInto("orderItems")
              .values({
                orderId,
                courseId: sponsorship.courseId,
                quantity: 1,
                priceAtPurchase: sponsorship.testPrice,
                discountAmount: 0,
                platformFeePercentage: sponsorship.platformFeePercentage,
              })
              .execute();
          } else if (contentType === "product" && sponsorship.digitalProductId !== null) {
            await trx
              .insertInto("orderItems")
              .values({
                orderId,
                digitalProductId: sponsorship.digitalProductId,
                quantity: 1,
                priceAtPurchase: sponsorship.testPrice,
                discountAmount: 0,
                platformFeePercentage: sponsorship.platformFeePercentage,
              })
              .execute();
          } else {
            console.error(`[ensureOrderCompletionSideEffects] Sponsorship ${sponsorship.id} has unsupported contentType "${contentType}" or missing content id, could not backfill orderItems for order ${orderId}`);
          }
        }
      }

      if (sponsorship.wasNewUser && !sponsorship.temporaryPasswordSent) {
        await trx
          .updateTable("teacherSponsoredEnrollments")
          .set({ temporaryPasswordSent: true })
          .where("id", "=", sponsorship.id)
          .execute();
      }
    }

    // Get all order items
    const orderItems = await trx
      .selectFrom("orderItems")
      .select(["courseId", "digitalProductId", "mockTestId"])
      .where("orderId", "=", orderId)
      .execute();

    const courseIds = orderItems
      .filter(item => item.courseId !== null)
      .map(item => item.courseId!);

    const digitalProductIds = orderItems
      .filter(item => item.digitalProductId !== null)
      .map(item => item.digitalProductId!);

    const mockTestIds = orderItems
      .filter(item => item.mockTestId !== null)
      .map(item => item.mockTestId!);

    // Check and create missing course enrollments
    if (courseIds.length > 0) {
      const existingEnrollments = await trx
        .selectFrom("courseEnrollments")
        .select("courseId")
        .where("studentId", "=", beneficiaryUserId)
        .where("courseId", "in", courseIds)
        .execute();

      const existingCourseIds = new Set(existingEnrollments.map(e => e.courseId));
      const missingCourseIds = courseIds.filter(id => !existingCourseIds.has(id));

      if (missingCourseIds.length > 0) {
        console.log(`[ensureOrderCompletionSideEffects] Creating ${missingCourseIds.length} missing course enrollments for order ${orderId}`);
        await trx
          .insertInto("courseEnrollments")
          .values(
            missingCourseIds.map(courseId => ({
              studentId: beneficiaryUserId,
              courseId: courseId,
              enrolledAt: new Date(),
            }))
          )
          .onConflict((oc) => oc.columns(["studentId", "courseId"]).doNothing())
          .execute();
      } else {
        console.log(`[ensureOrderCompletionSideEffects] All course enrollments exist for order ${orderId}`);
      }
    }

    // Check and create missing digital product purchases
    if (digitalProductIds.length > 0) {
      const existingPurchases = await trx
        .selectFrom("digitalProductPurchases")
        .select("productId")
        .where("studentId", "=", beneficiaryUserId)
        .where("productId", "in", digitalProductIds)
        .execute();

      const existingProductIds = new Set(existingPurchases.map(p => p.productId));
      const missingProductIds = digitalProductIds.filter(id => !existingProductIds.has(id));

      if (missingProductIds.length > 0) {
        console.log(`[ensureOrderCompletionSideEffects] Creating ${missingProductIds.length} missing digital product purchases for order ${orderId}`);
        await trx
          .insertInto("digitalProductPurchases")
          .values(
            missingProductIds.map(productId => ({
              studentId: beneficiaryUserId,
              productId: productId,
              orderId: order.id,
              purchasedAt: new Date(),
            }))
          )
          .onConflict((oc) => oc.columns(["studentId", "productId"]).doNothing())
          .execute();

        // Increment totalPurchases for digital products
        await trx
          .updateTable("digitalProducts")
          .set((eb) => ({
            totalPurchases: eb("totalPurchases", "+", 1),
          }))
          .where("id", "in", missingProductIds)
          .execute();
      } else {
        console.log(`[ensureOrderCompletionSideEffects] All digital product purchases exist for order ${orderId}`);
      }
    }

    // Check and create missing mock test enrollments
    if (mockTestIds.length > 0) {
      const existingEnrollments = await trx
        .selectFrom("mockTestEnrollments")
        .select("mockTestId")
        .where("studentId", "=", beneficiaryUserId)
        .where("mockTestId", "in", mockTestIds)
        .execute();

      const existingMockTestIds = new Set(existingEnrollments.map(e => e.mockTestId));
      const missingMockTestIds = mockTestIds.filter(id => !existingMockTestIds.has(id));

      if (missingMockTestIds.length > 0) {
        console.log(`[ensureOrderCompletionSideEffects] Creating ${missingMockTestIds.length} missing mock test enrollments for order ${orderId}`);
        await trx
          .insertInto("mockTestEnrollments")
          .values(
            missingMockTestIds.map(mockTestId => ({
              studentId: beneficiaryUserId,
              mockTestId: mockTestId,
              orderId: order.id,
              enrolledAt: new Date(),
            }))
          )
          .onConflict((oc) => oc.columns(["mockTestId", "studentId"]).doNothing())
          .execute();

        // Increment studentsEnrolled for mock tests
        await trx
          .updateTable("mockTests")
          .set((eb) => ({
            studentsEnrolled: eb("studentsEnrolled", "+", 1),
          }))
          .where("id", "in", missingMockTestIds)
          .execute();
      } else {
        console.log(`[ensureOrderCompletionSideEffects] All mock test enrollments exist for order ${orderId}`);
      }
    }

    // Check and create missing live test enrollments (safety net)
    if (mockTestIds.length > 0) {
      const liveTests = await trx
        .selectFrom("liveTests")
        .select(["id", "enrolledCount"])
        .where("mockTestId", "in", mockTestIds)
        .execute();

      for (const liveTest of liveTests) {
        const existingEnrollment = await trx
          .selectFrom("liveTestEnrollments")
          .select("id")
          .where("studentId", "=", beneficiaryUserId)
          .where("liveTestId", "=", liveTest.id)
          .executeTakeFirst();

        if (!existingEnrollment) {
          console.log(`[ensureOrderCompletionSideEffects] Creating missing live test enrollment for user ${beneficiaryUserId} in live test ${liveTest.id} (order ${orderId})`);
          await trx
            .insertInto("liveTestEnrollments")
            .values({
              studentId: beneficiaryUserId,
              liveTestId: liveTest.id,
              paymentOrderId: order.id,
            })
            .execute();

          await trx
            .updateTable("liveTests")
            .set({ enrolledCount: sql`enrolled_count + 1` })
            .where("id", "=", liveTest.id)
            .execute();

          console.log(`[ensureOrderCompletionSideEffects] Live test enrollment created for user ${beneficiaryUserId} in live test ${liveTest.id}`);
        } else {
          console.log(`[ensureOrderCompletionSideEffects] Live test enrollment already exists for user ${beneficiaryUserId} in live test ${liveTest.id}`);
        }
      }
    }

    // Check and create bundle enrollments and items if this is a bundle order
    if (effectiveBundleId) {
      console.log(`[ensureOrderCompletionSideEffects] Order ${orderId} is for bundle ${effectiveBundleId}, checking bundle side effects`);

      // 1. Ensure bundle enrollment
      const existingBundleEnrollment = await trx
        .selectFrom("bundleEnrollments")
        .select("id")
        .where("studentId", "=", beneficiaryUserId)
        .where("bundleId", "=", effectiveBundleId)
        .executeTakeFirst();

      if (!existingBundleEnrollment) {
        console.log(`[ensureOrderCompletionSideEffects] Creating missing bundle enrollment for user ${beneficiaryUserId} in bundle ${effectiveBundleId} (order ${orderId})`);
        await trx
          .insertInto("bundleEnrollments")
          .values({
            studentId: beneficiaryUserId,
            bundleId: effectiveBundleId,
            orderId: order.id,
            enrolledAt: new Date(),
          })
          .onConflict((oc) => oc.columns(["studentId", "bundleId"]).doNothing())
          .execute();
      } else {
        console.log(`[ensureOrderCompletionSideEffects] Bundle enrollment already exists for user ${beneficiaryUserId} in bundle ${effectiveBundleId}`);
      }

      // 2. Fetch bundle items
      const bundleItems = await trx
        .selectFrom("courseBundleItems")
        .select(["itemType", "mockTestId", "courseId", "digitalProductId"])
        .where("bundleId", "=", effectiveBundleId)
        .execute();

      const bundleCourseIds = bundleItems.filter(item => item.itemType === 'course' && item.courseId).map(i => i.courseId!);
      const bundleDigitalProductIds = bundleItems.filter(item => item.itemType === 'digital_product' && item.digitalProductId).map(i => i.digitalProductId!);
      const bundleMockTestIds = bundleItems.filter(item => item.itemType === 'test' && item.mockTestId).map(i => i.mockTestId!);

      // Process bundle course enrollments
      if (bundleCourseIds.length > 0) {
        const existingEnrollments = await trx
          .selectFrom("courseEnrollments")
          .select("courseId")
          .where("studentId", "=", beneficiaryUserId)
          .where("courseId", "in", bundleCourseIds)
          .execute();

        const existingCourseIds = new Set(existingEnrollments.map(e => e.courseId));
        const missingCourseIds = bundleCourseIds.filter(id => !existingCourseIds.has(id));

        if (missingCourseIds.length > 0) {
          console.log(`[ensureOrderCompletionSideEffects] Creating ${missingCourseIds.length} missing course enrollments for bundle ${effectiveBundleId} (order ${orderId})`);
          await trx
            .insertInto("courseEnrollments")
            .values(
              missingCourseIds.map(courseId => ({
                studentId: beneficiaryUserId,
                courseId: courseId,
                enrolledAt: new Date(),
              }))
            )
            .onConflict((oc) => oc.columns(["studentId", "courseId"]).doNothing())
            .execute();
        }
      }

      // Process bundle digital product purchases
      if (bundleDigitalProductIds.length > 0) {
        const existingPurchases = await trx
          .selectFrom("digitalProductPurchases")
          .select("productId")
          .where("studentId", "=", beneficiaryUserId)
          .where("productId", "in", bundleDigitalProductIds)
          .execute();

        const existingProductIds = new Set(existingPurchases.map(p => p.productId));
        const missingProductIds = bundleDigitalProductIds.filter(id => !existingProductIds.has(id));

        if (missingProductIds.length > 0) {
          console.log(`[ensureOrderCompletionSideEffects] Creating ${missingProductIds.length} missing digital product purchases for bundle ${effectiveBundleId} (order ${orderId})`);
          await trx
            .insertInto("digitalProductPurchases")
            .values(
              missingProductIds.map(productId => ({
                studentId: beneficiaryUserId,
                productId: productId,
                orderId: order.id,
                purchasedAt: new Date(),
              }))
            )
            .onConflict((oc) => oc.columns(["studentId", "productId"]).doNothing())
            .execute();

          await trx
            .updateTable("digitalProducts")
            .set((eb) => ({
              totalPurchases: eb("totalPurchases", "+", 1),
            }))
            .where("id", "in", missingProductIds)
            .execute();
        }
      }

      // Process bundle mock test enrollments
      if (bundleMockTestIds.length > 0) {
        const existingEnrollments = await trx
          .selectFrom("mockTestEnrollments")
          .select("mockTestId")
          .where("studentId", "=", beneficiaryUserId)
          .where("mockTestId", "in", bundleMockTestIds)
          .execute();

        const existingMockTestIds = new Set(existingEnrollments.map(e => e.mockTestId));
        const missingMockTestIds = bundleMockTestIds.filter(id => !existingMockTestIds.has(id));

        if (missingMockTestIds.length > 0) {
          console.log(`[ensureOrderCompletionSideEffects] Creating ${missingMockTestIds.length} missing mock test enrollments for bundle ${effectiveBundleId} (order ${orderId})`);
          await trx
            .insertInto("mockTestEnrollments")
            .values(
              missingMockTestIds.map(mockTestId => ({
                studentId: beneficiaryUserId,
                mockTestId: mockTestId,
                orderId: order.id,
                enrolledAt: new Date(),
              }))
            )
            .onConflict((oc) => oc.columns(["mockTestId", "studentId"]).doNothing())
            .execute();

          await trx
            .updateTable("mockTests")
            .set((eb) => ({
              studentsEnrolled: eb("studentsEnrolled", "+", 1),
            }))
            .where("id", "in", missingMockTestIds)
            .execute();
        }
      }
    }

    // Check and create a missing 1:1 mentorship booking (safety net).
    // Normally the client itself creates the booking via a follow-up call to
    // mentorship/bookings/create_POST right after payment verifies, passing
    // paymentOrderId - mirroring the live-test enroll_POST pattern. This
    // branch exists for order completion paths where that follow-up call
    // never happens (e.g. the async PayU server-to-server callback racing
    // ahead of, or instead of, the client's verify-and-complete request),
    // which would otherwise leave an order marked paid with no booking ever
    // created.
    const mentorshipItem = await trx
      .selectFrom("orderItems")
      .select(["id", "mentorshipTeacherId", "mentorshipDurationMinutes", "mentorshipRequestedStartTime", "priceAtPurchase", "platformFeePercentage"])
      .where("orderId", "=", orderId)
      .where("mentorshipTeacherId", "is not", null)
      .where("mentorshipBookingId", "is", null)
      .executeTakeFirst();

    if (mentorshipItem && mentorshipItem.mentorshipTeacherId !== null) {
      if (mentorshipItem.mentorshipRequestedStartTime === null || mentorshipItem.mentorshipDurationMinutes === null) {
        console.error(`[ensureOrderCompletionSideEffects] Order ${orderId} paid for a 1:1 session with teacher ${mentorshipItem.mentorshipTeacherId} but is missing its requested start time/duration; booking was NOT created. This order needs manual review/refund.`);
      } else {
        const teacherId = mentorshipItem.mentorshipTeacherId;
        const durationMinutes = mentorshipItem.mentorshipDurationMinutes;
        const startTime = mentorshipItem.mentorshipRequestedStartTime;

        // Same per-teacher advisory lock create_POST uses, so this safety net
        // can never race with (or double-book against) a normal booking attempt.
        await sql`select pg_advisory_xact_lock(hashtext(${"mentorship_booking_teacher_" + teacherId}))`.execute(trx);

        const bookable = await isTeacherSlotBookable(teacherId, startTime, durationMinutes, trx);
        const alreadyCredited = await trx.selectFrom("liveClassCredits").select("id").where("orderId", "=", order.id).executeTakeFirst();
        if (!bookable.ok && !alreadyCredited) {
          // The slot went while the student was paying: the price goes to their live class
          // balance, so booking the trial again at another time costs nothing more.
          await trx
            .insertInto("liveClassCredits")
            .values({
              studentId: beneficiaryUserId,
              teacherId,
              kind: "trial",
              orderId: order.id,
              classMinutes: durationMinutes,
              amount: mentorshipItem.priceAtPurchase,
              platformFeePercentage: mentorshipItem.platformFeePercentage ?? "0",
              status: "released",
              releasedAt: new Date(),
            })
            .execute();
          console.error(`[ensureOrderCompletionSideEffects] Order ${orderId} paid for a 1:1 session but the slot is no longer bookable (${bookable.reason}); the price went to the student's live class balance.`);
        } else if (!bookable.ok) {
          console.log(`[ensureOrderCompletionSideEffects] Order ${orderId} already credited to the live class balance`);
        } else {
          const priorBooking = await trx
            .selectFrom("mentorshipBookings")
            .select("id")
            .where("teacherId", "=", teacherId)
            .where("studentId", "=", beneficiaryUserId)
            .where("status", "!=", "cancelled")
            .executeTakeFirst();
          const isTrial = !priorBooking;

          // The trial is held as a credit like every paid live class, so cancelling it, a teacher
          // no-show and the teacher's earning all follow the package rules. Its amount is the full
          // trial price, including any part paid from the live class balance.
          const trialCredit = isTrial
            ? await trx
                .insertInto("liveClassCredits")
                .values({
                  studentId: beneficiaryUserId,
                  teacherId,
                  kind: "trial",
                  orderId: order.id,
                  classMinutes: durationMinutes,
                  amount: mentorshipItem.priceAtPurchase,
                  platformFeePercentage: mentorshipItem.platformFeePercentage ?? "0",
                  status: "booked",
                })
                .returning("id")
                .executeTakeFirstOrThrow()
            : null;

          const insertedBooking = await trx
            .insertInto("mentorshipBookings")
            .values({
              teacherId,
              studentId: beneficiaryUserId,
              scheduledAt: startTime,
              durationMinutes,
              amountPaid: mentorshipItem.priceAtPurchase,
              orderId: order.id,
              status: "scheduled",
              isTrial,
              creditId: trialCredit?.id ?? null,
            })
            .returning(["id", "scheduledAt"])
            .executeTakeFirstOrThrow();

          if (trialCredit) {
            await trx.updateTable("liveClassCredits").set({ bookingId: insertedBooking.id }).where("id", "=", trialCredit.id).execute();
          }
          await trx.updateTable("orderItems").set({ mentorshipBookingId: insertedBooking.id }).where("id", "=", mentorshipItem.id).execute();
          await followTeacher(trx, beneficiaryUserId, teacherId);

          pendingMentorshipBookingEmail = {
            studentId: beneficiaryUserId,
            teacherId,
            sessionTypeTitle: `${isTrial ? "Trial " : ""}1:1 session (${durationMinutes} min)`,
            scheduledAt: insertedBooking.scheduledAt,
            durationMinutes,
            bookingId: insertedBooking.id,
            price: Number(order.totalAmount),
          };
          console.log(`[ensureOrderCompletionSideEffects] Safety-net created mentorship booking ${insertedBooking.id} for order ${orderId}`);
        }
      }
    }

    // Check and create a missing group lesson enrollment (safety net, same
    // rationale as the mentorship booking branch above).
    const groupLessonItem = await trx
      .selectFrom("orderItems")
      .select(["id", "groupLessonId"])
      .where("orderId", "=", orderId)
      .where("groupLessonId", "is not", null)
      .executeTakeFirst();

    if (groupLessonItem && groupLessonItem.groupLessonId !== null) {
      const alreadyLinked = await trx
        .selectFrom("groupLessonEnrollments")
        .select("id")
        .where("orderId", "=", orderId)
        .executeTakeFirst();

      if (!alreadyLinked) {
        const lesson = await trx
          .selectFrom("groupLessons")
          .selectAll()
          .where("id", "=", groupLessonItem.groupLessonId)
          .forUpdate()
          .executeTakeFirst();

        if (!lesson || lesson.status !== "scheduled" || lesson.startTime < new Date() || lesson.enrolledCount >= lesson.maxCapacity) {
          console.error(`[ensureOrderCompletionSideEffects] Order ${orderId} paid for group lesson ${groupLessonItem.groupLessonId} but it is no longer open (cancelled, started, or full); enrollment was NOT created. This order needs manual review/refund.`);
        } else {
          const existingEnrollment = await trx
            .selectFrom("groupLessonEnrollments")
            .select(["id", "status"])
            .where("groupLessonId", "=", lesson.id)
            .where("studentId", "=", beneficiaryUserId)
            .executeTakeFirst();

          if (existingEnrollment?.status === "enrolled") {
            console.log(`[ensureOrderCompletionSideEffects] Student already enrolled in group lesson ${lesson.id}, linking order ${orderId} without double-counting capacity`);
            await trx.updateTable("groupLessonEnrollments").set({ orderId: order.id }).where("id", "=", existingEnrollment.id).execute();
          } else {
            if (existingEnrollment) {
              await trx
                .updateTable("groupLessonEnrollments")
                .set({ status: "enrolled", orderId: order.id, amountPaid: order.totalAmount, removedByTeacher: false, cancelledAt: null, enrolledAt: new Date() })
                .where("id", "=", existingEnrollment.id)
                .execute();
            } else {
              await trx
                .insertInto("groupLessonEnrollments")
                .values({
                  groupLessonId: lesson.id,
                  studentId: beneficiaryUserId,
                  orderId: order.id,
                  amountPaid: order.totalAmount,
                  status: "enrolled",
                })
                .execute();
            }

            await trx.updateTable("groupLessons").set({ enrolledCount: lesson.enrolledCount + 1 }).where("id", "=", lesson.id).execute();
            await followTeacher(trx, beneficiaryUserId, lesson.teacherId);

            pendingGroupLessonEnrollmentEmail = {
              studentId: beneficiaryUserId,
              teacherId: lesson.teacherId,
              lessonTitle: lesson.title,
              startTime: lesson.startTime,
              groupLessonId: lesson.id,
            };
            console.log(`[ensureOrderCompletionSideEffects] Safety-net created group lesson enrollment for student ${beneficiaryUserId} in lesson ${lesson.id} (order ${orderId})`);
          }
        }
      }
    }

    // Live course enrolment. A seat race (two students paying for the last seat at once) is let
    // through rather than refunded; a course cancelled while the student paid needs a manual refund.
    const liveCourseItem = await trx
      .selectFrom("orderItems")
      .select(["id", "liveCourseId"])
      .where("orderId", "=", orderId)
      .where("liveCourseId", "is not", null)
      .executeTakeFirst();

    if (liveCourseItem?.liveCourseId) {
      const linked = await trx
        .selectFrom("liveCourseEnrollments")
        .select("id")
        .where("orderId", "=", orderId)
        .executeTakeFirst();
      if (!linked) {
        const course = await trx
          .selectFrom("liveCourses")
          .select(["id", "status", "teacherId", "enrolledCount", "seatLimit"])
          .where("id", "=", liveCourseItem.liveCourseId)
          .forUpdate()
          .executeTakeFirst();
        const active = course
          ? await trx
              .selectFrom("liveCourseEnrollments")
              .select("id")
              .where("liveCourseId", "=", course.id)
              .where("studentId", "=", beneficiaryUserId)
              .where("status", "=", "enrolled")
              .executeTakeFirst()
          : undefined;
        if (!course || course.status !== "published") {
          console.error(`[ensureOrderCompletionSideEffects] Order ${orderId} paid for live course ${liveCourseItem.liveCourseId} but it is not published (${course?.status ?? "missing"}); no enrolment created. Refund by hand.`);
        } else if (active) {
          console.error(`[ensureOrderCompletionSideEffects] Order ${orderId}: student ${beneficiaryUserId} was already enrolled in live course ${course.id}; this second payment needs a refund.`);
        } else {
          if (course.enrolledCount >= course.seatLimit) {
            console.warn(`[ensureOrderCompletionSideEffects] Live course ${course.id} goes over its ${course.seatLimit} seats with order ${orderId}.`);
          }
          await trx
            .insertInto("liveCourseEnrollments")
            .values({ liveCourseId: course.id, studentId: beneficiaryUserId, orderId: order.id, amountPaid: order.totalAmount, status: "enrolled" })
            .execute();
          await trx
            .updateTable("liveCourses")
            .set({ enrolledCount: course.enrolledCount + 1, updatedAt: new Date() })
            .where("id", "=", course.id)
            .execute();
          await followTeacher(trx, beneficiaryUserId, course.teacherId);
          pendingLiveCourseEnrollment = { courseId: course.id, studentId: beneficiaryUserId, amount: Number(order.totalAmount) };
        }
      }
    }

    // A one-time "Pay now" order for a live package cycle whose autopay debit failed.
    const liveCycle = await cycleForOrder(trx, orderId);
    if (liveCycle && liveCycle.status !== "paid") {
      pendingLiveCycleSummary = await completeLiveCycle(trx, liveCycle.id);
    }

    // Buying anything from a teacher is treated as following them - this
    // covers every order completion path (PayU callback/redirect, wallet
    // purchases, admin reconcile), not just the first-touch flows below.
    await followTeachersForOrder(trx, orderId, effectiveBundleId, beneficiaryUserId);

    console.log(`[ensureOrderCompletionSideEffects] Completed side effects check for order ${orderId}`);
  });

  if (orderUserId !== null) {
    await recordOrderOutcome(orderId, "payment_succeeded");

    // After transaction completes, check if we need to send emails
    const emailUpdateResult = await db
      .updateTable("orders")
      .set({ emailsSentAt: new Date() })
      .where("id", "=", orderId)
      .where("emailsSentAt", "is", null)
      .returning("id")
      .executeTakeFirst();

    if (emailUpdateResult) {
      console.log(`[ensureOrderCompletionSideEffects] Order ${orderId} emails not sent yet, sending now`);
      await sendOrderConfirmationEmails(orderId, orderUserId).catch((error) => {
        console.error(`[ensureOrderCompletionSideEffects] Failed to send emails for order ${orderId}:`, error);
      });
    } else {
      console.log(`[ensureOrderCompletionSideEffects] Emails for order ${orderId} were already sent (or marked as sent)`);
    }
  }

  // Safety-net booking/enrollment confirmation emails. These are only ever
  // populated when this function itself just created the booking/enrollment
  // (gated above on mentorshipBookingId / a linked enrollment being absent),
  // so this can't double-send against the normal create_POST/enroll_POST
  // email already sent on the client-triggered path.
  if (pendingMentorshipBookingEmail) {
    const { studentId, teacherId, sessionTypeTitle, scheduledAt, durationMinutes, bookingId, price } = pendingMentorshipBookingEmail;
    try {
      const [student, teacher] = await Promise.all([
        db.selectFrom("users").select(["email", "displayName"]).where("id", "=", studentId).executeTakeFirst(),
        db.selectFrom("users").select(["email", "displayName"]).where("id", "=", teacherId).executeTakeFirst(),
      ]);
      if (student?.email) {
        const tmpl = emailTemplatesExtra.mentorshipBookingConfirmed(student.displayName, teacher?.displayName ?? "your teacher", sessionTypeTitle, scheduledAt, durationMinutes, bookingId);
        await sendEmail({ to: student.email, ...tmpl });
      }
      if (teacher?.email) {
        const tmpl = emailTemplatesExtra.newPurchaseNotification(teacher.displayName, student?.displayName ?? "A student", `1:1 session (${sessionTypeTitle})`, "1:1 session", price);
        await sendEmail({ to: teacher.email, ...tmpl });
      }
    } catch (emailError) {
      console.error(`[ensureOrderCompletionSideEffects] Failed to send safety-net mentorship booking emails for order ${orderId}:`, emailError);
    }
  }

  if (pendingLiveCycleSummary) {
    await sendRenewalPaidEmail(pendingLiveCycleSummary);
  }

  if (pendingLiveCourseEnrollment) {
    const { courseId, studentId, amount } = pendingLiveCourseEnrollment;
    await sendEnrolledNotices(courseId, studentId, amount);
  }

  if (pendingGroupLessonEnrollmentEmail) {
    const { studentId, teacherId, lessonTitle, startTime, groupLessonId } = pendingGroupLessonEnrollmentEmail;
    try {
      const [student, teacher] = await Promise.all([
        db.selectFrom("users").select(["email", "displayName"]).where("id", "=", studentId).executeTakeFirst(),
        db.selectFrom("users").select(["displayName"]).where("id", "=", teacherId).executeTakeFirst(),
      ]);
      if (student?.email) {
        const tmpl = emailTemplatesExtra.groupLessonEnrolled(student.displayName, teacher?.displayName ?? "the teacher", lessonTitle, startTime, groupLessonId);
        await sendEmail({ to: student.email, ...tmpl });
      }
    } catch (emailError) {
      console.error(`[ensureOrderCompletionSideEffects] Failed to send safety-net group lesson enrollment email for order ${orderId}:`, emailError);
    }
  }
}