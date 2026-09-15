import { db } from "./db";
import { sql } from "kysely";
import { sendOrderConfirmationEmails } from "./sendOrderConfirmationEmails";

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

  await db.transaction().execute(async (trx) => {
    // Get the order
    const order = await trx
      .selectFrom("orders")
      .select(["id", "userId", "status", "bundleId", "paymentTransactionId"])
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

    console.log(`[ensureOrderCompletionSideEffects] Completed side effects check for order ${orderId}`);
  });

  if (orderUserId !== null) {
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
}