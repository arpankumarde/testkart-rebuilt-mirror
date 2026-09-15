import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, OutputType } from "./add_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    // Prevent teachers from adding items to cart
    if (user.role === "teacher") {
      console.warn(`Teacher (ID: ${user.id}) attempted to add item to cart`);
      return new Response(
        superjson.stringify({ error: "Teachers cannot add items to cart. Please use a student account." }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Handle mock test addition
    if (input.mockTestId) {
      const mockTestId = input.mockTestId;

      // Check if the test exists and is published. A live test's shadow
      // mockTests row must be excluded here — it's not a purchasable
      // standalone product; students purchase/enroll in live tests via the
      // dedicated live test flow.
      const test = await db
        .selectFrom("mockTests")
        .select(["id", "price", "discountPrice"])
        .where("id", "=", mockTestId)
        .where("isPublished", "=", true)
        .where("deletedAt", "is", null)
        .where((eb) =>
          eb.not(
            eb.exists(
              eb.selectFrom("liveTests")
                .select("liveTests.id")
                .whereRef("liveTests.mockTestId", "=", "mockTests.id")
            )
          )
        )
        .executeTakeFirst();

      if (!test) {
        return new Response(
          superjson.stringify({ error: "Mock test not found or not available." }),
          { status: 404 }
        );
      }

      // Block free items from being added to cart
      if (parseFloat(String(test.discountPrice ?? test.price)) === 0) {
        return new Response(
          superjson.stringify({ error: "This test is free! You can enroll directly without adding to cart." }),
          { status: 400 }
        );
      }

      // Check if the user has already purchased this test via a direct order
      const purchasedTest = await db
        .selectFrom("orderItems")
        .innerJoin("orders", "orders.id", "orderItems.orderId")
        .select("orderItems.id")
        .where("orders.userId", "=", user.id)
        .where("orders.status", "=", "completed")
        .where("orderItems.mockTestId", "=", mockTestId)
        .executeTakeFirst();

      // Also check teacher-sponsored enrollments
      const sponsoredEnrollment = !purchasedTest
        ? await db
            .selectFrom("teacherSponsoredEnrollments")
            .leftJoin("orders", "orders.id", "teacherSponsoredEnrollments.orderId")
            .select("teacherSponsoredEnrollments.id")
            .where("teacherSponsoredEnrollments.studentId", "=", user.id)
            .where("teacherSponsoredEnrollments.mockTestId", "=", mockTestId)
            .where((eb) =>
              eb.or([
                eb("teacherSponsoredEnrollments.orderId", "is", null),
                eb("orders.status", "=", "completed"),
              ])
            )
            .executeTakeFirst()
        : null;

      if (purchasedTest || sponsoredEnrollment) {
        return new Response(
          superjson.stringify({ error: "You already own this test. Visit your dashboard to access it." }),
          { status: 400 }
        );
      }

      // Check if the item is already in the user's cart
      const existingCartItem = await db
        .selectFrom("cartItems")
        .select("id")
        .where("userId", "=", user.id)
        .where("mockTestId", "=", mockTestId)
        .executeTakeFirst();

      if (existingCartItem) {
        return new Response(
          superjson.stringify({
            message: "Item is already in your cart.",
          } satisfies OutputType)
        );
      }

      // Add the item to the cart
      await db
        .insertInto("cartItems")
        .values({
          userId: user.id,
          mockTestId: mockTestId,
          courseId: null,
        })
        .execute();

      return new Response(
        superjson.stringify({
          message: "Item added to cart successfully.",
        } satisfies OutputType)
      );
    }

    // Handle course addition
    if (input.courseId) {
      const courseId = input.courseId;

      // Check if the course exists and is published
      const course = await db
        .selectFrom("courses")
        .select(["id", "price"])
        .where("id", "=", courseId)
        .where("status", "=", "published")
        .executeTakeFirst();

      if (!course) {
        return new Response(
          superjson.stringify({ error: "Course not found or not available." }),
          { status: 404 }
        );
      }

      // Block free items from being added to cart
      if (parseFloat(String(course.price)) === 0) {
        return new Response(
          superjson.stringify({ error: "This course is free! You can enroll directly without adding to cart." }),
          { status: 400 }
        );
      }

      // Check if the user is already enrolled in this course
      const enrollment = await db
        .selectFrom("courseEnrollments")
        .select("id")
        .where("studentId", "=", user.id)
        .where("courseId", "=", courseId)
        .executeTakeFirst();

      if (enrollment) {
        return new Response(
          superjson.stringify({ error: "You are already enrolled in this course." }),
          { status: 400 }
        );
      }

      // Check if user has already purchased this course
      const purchasedCourse = await db
        .selectFrom("courseTransactions")
        .select("id")
        .where("studentId", "=", user.id)
        .where("courseId", "=", courseId)
        .where("status", "=", "completed")
        .executeTakeFirst();

      if (purchasedCourse) {
        return new Response(
          superjson.stringify({ error: "You already own this course. Visit your dashboard to access it." }),
          { status: 400 }
        );
      }

      // Check if the item is already in the user's cart
      const existingCartItem = await db
        .selectFrom("cartItems")
        .select("id")
        .where("userId", "=", user.id)
        .where("courseId", "=", courseId)
        .executeTakeFirst();

      if (existingCartItem) {
        return new Response(
          superjson.stringify({
            message: "Item is already in your cart.",
          } satisfies OutputType)
        );
      }

      // Add the item to the cart
      await db
        .insertInto("cartItems")
        .values({
          userId: user.id,
          mockTestId: null,
          courseId: courseId,
        })
        .execute();

      return new Response(
        superjson.stringify({
          message: "Item added to cart successfully.",
        } satisfies OutputType)
      );
    }

    // Handle digital product addition
    if (input.digitalProductId) {
      const digitalProductId = input.digitalProductId;

      // Check if the digital product exists and is published
      const product = await db
        .selectFrom("digitalProducts")
        .select(["id", "price"])
        .where("id", "=", digitalProductId)
        .where("status", "=", "published")
        .executeTakeFirst();

      if (!product) {
        return new Response(
          superjson.stringify({ error: "Digital product not found or not available." }),
          { status: 404 }
        );
      }

      // Block free items from being added to cart
      if (parseFloat(String(product.price)) === 0) {
        return new Response(
          superjson.stringify({ error: "This product is free! You can access it directly without adding to cart." }),
          { status: 400 }
        );
      }

      // Check if the user has already purchased this digital product
      const purchasedProduct = await db
        .selectFrom("digitalProductPurchases")
        .innerJoin("orders", "orders.id", "digitalProductPurchases.orderId")
        .select("digitalProductPurchases.id")
        .where("digitalProductPurchases.studentId", "=", user.id)
        .where("orders.status", "=", "completed")
        .where("digitalProductPurchases.productId", "=", digitalProductId)
        .executeTakeFirst();

      if (purchasedProduct) {
        return new Response(
          superjson.stringify({ error: "You already own this product. Visit your dashboard to access it." }),
          { status: 400 }
        );
      }

      // Check if the item is already in the user's cart
      const existingCartItem = await db
        .selectFrom("cartItems")
        .select("id")
        .where("userId", "=", user.id)
        .where("digitalProductId", "=", digitalProductId)
        .executeTakeFirst();

      if (existingCartItem) {
        return new Response(
          superjson.stringify({
            message: "Item is already in your cart.",
          } satisfies OutputType)
        );
      }

      // Add the item to the cart
      await db
        .insertInto("cartItems")
        .values({
          userId: user.id,
          mockTestId: null,
          courseId: null,
          digitalProductId: digitalProductId,
        })
        .execute();

      return new Response(
        superjson.stringify({
          message: "Item added to cart successfully.",
        } satisfies OutputType)
      );
    }

    // This should never happen due to schema validation
    return new Response(
      superjson.stringify({ error: "Invalid request" }),
      { status: 400 }
    );
  } catch (error) {
    console.error("Failed to add item to cart:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to add item to cart.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}