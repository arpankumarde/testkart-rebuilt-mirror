import { db } from "../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../helpers/getAdminSession";
import { OutputType } from "./orders_GET.schema";
import { paymentFailureReason } from "../../helpers/paymentFailureReason";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'billing_manager']);

    // First query: Fetch all orders with user details
    const orders = await db
      .selectFrom("orders")
      .innerJoin("users", "users.id", "orders.userId")
      .select([
        "orders.id",
        "orders.bundleId",
        "orders.createdAt",
        "orders.totalAmount",
        "orders.status",
        "orders.paymentMethod",
        "orders.paymentTransactionId",
        "orders.invoiceNumber",
        "orders.paymentErrorCode",
        "orders.paymentErrorMessage",
        "orders.paymentBankMessage",
        "orders.paymentGatewayStatus",
        "users.displayName as studentName",
        "users.email as studentEmail",
        "users.mobileNumber as studentPhone",
      ])
      .orderBy("orders.createdAt", "desc")
      .execute();

    // Extract live test IDs from orders whose paymentTransactionId starts with "live-test-"
    // Format: "live-test-{liveTestId}-{nanoid}"
    const liveTestOrderMap = new Map<number, number>(); // orderId -> liveTestId
    for (const order of orders) {
      if (order.paymentTransactionId?.startsWith("live-test-")) {
        const parts = order.paymentTransactionId.split("-");
        // Format: ["live", "test", "{liveTestId}", "{nanoid}"]
        const liveTestId = parseInt(parts[2], 10);
        if (!isNaN(liveTestId)) {
          liveTestOrderMap.set(order.id, liveTestId);
        }
      }
    }

    // Batch-query live test titles for all discovered live test IDs
    const liveTestIdToTitle = new Map<number, string>();
    const uniqueLiveTestIds = [...new Set(liveTestOrderMap.values())];
    if (uniqueLiveTestIds.length > 0) {
      const liveTests = await db
        .selectFrom("liveTests")
        .select(["id", "title"])
        .where("id", "in", uniqueLiveTestIds)
        .execute();
      for (const lt of liveTests) {
        liveTestIdToTitle.set(lt.id, lt.title);
      }
    }

    // Build a map from orderId -> live test title for orders that are live test purchases
    const orderIdToLiveTestTitle = new Map<number, string>();
    for (const [orderId, liveTestId] of liveTestOrderMap.entries()) {
      const title = liveTestIdToTitle.get(liveTestId);
      if (title) {
        orderIdToLiveTestTitle.set(orderId, title);
      }
    }

    // Collect the set of order IDs that are live test orders (to exclude from mock test lookup)
    const liveTestOrderIds = new Set(orderIdToLiveTestTitle.keys());

    // Handle bundle orders: collect bundleIds and fetch bundle details
    const bundleOrders = orders.filter((o) => o.bundleId !== null);
    const uniqueBundleIds = [...new Set(bundleOrders.map((o) => o.bundleId!))];

    const bundleIdToTitle = new Map<number, string>();
    const bundleIdToSlug = new Map<number, string>();
    const bundleIdToTeacherId = new Map<number, number>();
    const bundleTeacherIdToName = new Map<number, string>();

    if (uniqueBundleIds.length > 0) {
      const bundleDetails = await db
        .selectFrom("courseBundles")
        .select(["id", "title", "slug", "teacherId"])
        .where("id", "in", uniqueBundleIds)
        .execute();
      for (const b of bundleDetails) {
        bundleIdToTitle.set(b.id, b.title);
        bundleIdToSlug.set(b.id, b.slug);
        bundleIdToTeacherId.set(b.id, b.teacherId);
      }

      // Resolve teacher names for bundle teachers
      const uniqueBundleTeacherIds = [...new Set(bundleIdToTeacherId.values())];
      if (uniqueBundleTeacherIds.length > 0) {
        const bundleTeachers = await db
          .selectFrom("users")
          .select(["id", "displayName"])
          .where("id", "in", uniqueBundleTeacherIds)
          .execute();
        for (const t of bundleTeachers) {
          bundleTeacherIdToName.set(t.id, t.displayName);
        }
      }
    }

    // Second query: Fetch all order items with their mock test titles and slugs
    // Exclude orders that are live test purchases (their mock test is just the underlying test, not the product)
    const orderItemsWithTests = await db
      .selectFrom("orderItems")
      .innerJoin("mockTests", "mockTests.id", "orderItems.mockTestId")
      .select([
        "orderItems.orderId",
        "mockTests.title",
        "mockTests.slug",
      ])
      .where("orderItems.mockTestId", "is not", null)
      .execute();

    // Third query: Fetch all order items with their course titles and slugs
    const orderItemsWithCourses = await db
      .selectFrom("orderItems")
      .innerJoin("courses", "courses.id", "orderItems.courseId")
      .select([
        "orderItems.orderId",
        "courses.title",
        "courses.slug",
      ])
      .where("orderItems.courseId", "is not", null)
      .execute();

    // Fourth query: Fetch all order items with their digital product titles and slugs
    const orderItemsWithProducts = await db
      .selectFrom("orderItems")
      .innerJoin("digitalProducts", "digitalProducts.id", "orderItems.digitalProductId")
      .select([
        "orderItems.orderId",
        "digitalProducts.title",
        "digitalProducts.slug",
      ])
      .where("orderItems.digitalProductId", "is not", null)
      .execute();

    // Combine titles by orderId, giving priority to live test title for live test orders
    const orderItemsMap = new Map<number, string[]>();
    // Build purchasedItemDetailsMap with title, type, and url
    const purchasedItemDetailsMap = new Map<number, Array<{ title: string; type: 'test' | 'course' | 'product' | 'live_test' | 'bundle'; url: string }>>();

    // Add live test titles first (these override mock test titles for live test orders)
    for (const [orderId, title] of orderIdToLiveTestTitle.entries()) {
      orderItemsMap.set(orderId, [title]);
      const liveTestId = liveTestOrderMap.get(orderId)!;
      purchasedItemDetailsMap.set(orderId, [{ title, type: 'live_test', url: `/mock-test/live/${liveTestId}` }]);
    }

    // Add mock test (test series) titles — skip if this order is a live test order
    for (const item of orderItemsWithTests) {
      if (liveTestOrderIds.has(item.orderId)) {
        // Skip: this mock test is the underlying test for a live test purchase
        continue;
      }
      const titles = orderItemsMap.get(item.orderId) || [];
      titles.push(item.title);
      orderItemsMap.set(item.orderId, titles);
      const details = purchasedItemDetailsMap.get(item.orderId) || [];
      details.push({ title: item.title, type: 'test', url: `/mock-test/${item.slug}` });
      purchasedItemDetailsMap.set(item.orderId, details);
    }

    // Add course titles
    for (const item of orderItemsWithCourses) {
      const titles = orderItemsMap.get(item.orderId) || [];
      titles.push(item.title);
      orderItemsMap.set(item.orderId, titles);
      const details = purchasedItemDetailsMap.get(item.orderId) || [];
      details.push({ title: item.title, type: 'course', url: `/course/${item.slug}` });
      purchasedItemDetailsMap.set(item.orderId, details);
    }

    // Add digital product titles
    for (const item of orderItemsWithProducts) {
      const titles = orderItemsMap.get(item.orderId) || [];
      titles.push(item.title);
      orderItemsMap.set(item.orderId, titles);
      const details = purchasedItemDetailsMap.get(item.orderId) || [];
      details.push({ title: item.title, type: 'product', url: `/study-notes/${item.slug}` });
      purchasedItemDetailsMap.set(item.orderId, details);
    }

    // Fifth query: Fetch teacher names per order via order items joined with product tables and users
    const orderItemsWithTeacher = await db
      .selectFrom("orderItems")
      .leftJoin("mockTests", "mockTests.id", "orderItems.mockTestId")
      .leftJoin("courses", "courses.id", "orderItems.courseId")
      .leftJoin("digitalProducts", "digitalProducts.id", "orderItems.digitalProductId")
      .innerJoin("users", (join) =>
        join.on((eb) =>
          eb.or([
            eb("users.id", "=", eb.ref("mockTests.teacherId")),
            eb("users.id", "=", eb.ref("courses.teacherId")),
            eb("users.id", "=", eb.ref("digitalProducts.teacherId")),
          ])
        )
      )
      .select([
        "orderItems.orderId",
        "users.displayName as teacherName",
      ])
      .execute();

    const orderIdToTeacherName = new Map<number, string>();
    for (const item of orderItemsWithTeacher) {
      if (item.teacherName && !orderIdToTeacherName.has(item.orderId)) {
        orderIdToTeacherName.set(item.orderId, item.teacherName);
      }
    }

    // Supplement with bundle teacher names (deferred from earlier bundle resolution)
    for (const order of bundleOrders) {
      if (orderIdToTeacherName.has(order.id)) continue;
      const bundleTeacherId = bundleIdToTeacherId.get(order.bundleId!);
      if (bundleTeacherId) {
        const teacherName = bundleTeacherIdToName.get(bundleTeacherId);
        if (teacherName) {
          orderIdToTeacherName.set(order.id, teacherName);
        }
      }
    }

    // Sixth query: For teacher-sponsored orders, orders.userId is the TEACHER
    // who paid (the "buyer"), not the student who was actually enrolled. Look
    // up the real student via teacherSponsoredEnrollments so the Student
    // column doesn't show the sponsoring teacher's own name/email. Left join,
    // because a student who closed their account leaves student_id null.
    const sponsoredEnrollments = await db
      .selectFrom("teacherSponsoredEnrollments")
      .leftJoin("users", "users.id", "teacherSponsoredEnrollments.studentId")
      .select([
        "teacherSponsoredEnrollments.orderId",
        "users.displayName as studentName",
        "users.email as studentEmail",
        "users.mobileNumber as studentPhone",
      ])
      .where("teacherSponsoredEnrollments.orderId", "is not", null)
      .execute();

    const orderIdToSponsoredStudent = new Map<
      number,
      { studentName: string; studentEmail: string | null; studentPhone: string | null }
    >();
    for (const row of sponsoredEnrollments) {
      if (row.orderId !== null) {
        orderIdToSponsoredStudent.set(row.orderId, {
          studentName: row.studentName ?? "Deleted account",
          studentEmail: row.studentEmail,
          studentPhone: row.studentPhone,
        });
      }
    }

    // Map the final result to match OutputType
    const responseData: OutputType = orders.map((o) => {
      // For bundle orders, fall back to bundle title if no order items were found
      let purchasedItems: string | null = orderItemsMap.get(o.id)?.join(", ") || null;
      if (!purchasedItems && o.bundleId) {
        const bundleTitle = bundleIdToTitle.get(o.bundleId);
        purchasedItems = bundleTitle ? `Bundle: ${bundleTitle}` : null;
      }

      // Build purchasedItemDetails, falling back to bundle for bundle orders
      let purchasedItemDetails = purchasedItemDetailsMap.get(o.id) || [];
      if (purchasedItemDetails.length === 0 && o.bundleId) {
        const bundleTitle = bundleIdToTitle.get(o.bundleId);
        const bundleSlug = bundleIdToSlug.get(o.bundleId);
        if (bundleTitle && bundleSlug) {
          purchasedItemDetails = [{ title: bundleTitle, type: 'bundle', url: `/bundles/${bundleSlug}` }];
        }
      }

      const sponsoredStudent = orderIdToSponsoredStudent.get(o.id);

      return {
        id: o.id,
        createdAt: o.createdAt,
        studentName: sponsoredStudent?.studentName ?? o.studentName,
        studentEmail: sponsoredStudent ? sponsoredStudent.studentEmail : o.studentEmail,
        studentPhone: sponsoredStudent ? sponsoredStudent.studentPhone : (o.studentPhone || null),
        isSponsored: sponsoredStudent !== undefined,
        teacherName: orderIdToTeacherName.get(o.id) || null,
        purchasedItems,
        purchasedItemDetails,
        totalAmount: parseFloat(o.totalAmount as unknown as string),
        status: o.status,
        paymentMethod: o.paymentMethod,
        paymentTransactionId: o.paymentTransactionId,
        invoiceNumber: o.invoiceNumber,
        paymentFailure:
          o.status === "failed" || o.status === "cancelled"
            ? paymentFailureReason.details({
                paymentErrorCode: o.paymentErrorCode,
                paymentErrorMessage: o.paymentErrorMessage,
                paymentBankMessage: o.paymentBankMessage,
                paymentGatewayStatus: o.paymentGatewayStatus,
              })
            : null,
      };
    });

    return new Response(superjson.stringify(responseData), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to fetch admin orders:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}