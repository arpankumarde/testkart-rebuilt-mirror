import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { OutputType, CartItem } from "./items_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const cartItems = await db
      .selectFrom("cartItems")
      .leftJoin("mockTests", "cartItems.mockTestId", "mockTests.id")
      .leftJoin("courses", "cartItems.courseId", "courses.id")
      .leftJoin("digitalProducts", "cartItems.digitalProductId", "digitalProducts.id")
      .leftJoin("users", "courses.teacherId", "users.id")
      .where("cartItems.userId", "=", user.id)
      .select([
        "cartItems.id as cartItemId",
        "cartItems.mockTestId",
        "cartItems.courseId",
        "mockTests.title as testTitle",
        "mockTests.slug as testSlug",
        "mockTests.price as testPrice",
        "mockTests.discountPrice as testDiscountPrice",
        "mockTests.thumbnailUrl as testThumbnailUrl",
        "mockTests.creatorName as testCreatorName",
        "courses.title as courseTitle",
        "courses.slug as courseSlug",
        "courses.price as coursePrice",
        "courses.thumbnailUrl as courseThumbnailUrl",
        "courses.thumbnailImageUrl as courseThumbnailImageUrl",
        "users.displayName as courseTeacherName",
        "cartItems.digitalProductId",
        "digitalProducts.title as digitalProductTitle",
        "digitalProducts.slug as digitalProductSlug",
        "digitalProducts.price as digitalProductPrice",
        "digitalProducts.thumbnailUrl as digitalProductThumbnailUrl",
      ])
      .orderBy("cartItems.addedAt", "desc")
      .execute();

    const items: CartItem[] = cartItems.map((item) => {
      if (item.mockTestId) {
        return {
          type: 'test' as const,
          cartItemId: item.cartItemId,
          mockTestId: item.mockTestId,
          slug: item.testSlug!,
          title: item.testTitle!,
          price: parseFloat(item.testPrice!),
          discountPrice: item.testDiscountPrice ? parseFloat(item.testDiscountPrice) : null,
          thumbnailUrl: item.testThumbnailUrl,
          creatorName: item.testCreatorName,
        };
      } else if (item.courseId) {
        return {
          type: 'course' as const,
          cartItemId: item.cartItemId,
          courseId: item.courseId,
          slug: item.courseSlug!,
          title: item.courseTitle!,
          price: parseFloat(item.coursePrice!),
          discountPrice: null, // Courses don't have discount prices yet
          thumbnailUrl: item.courseThumbnailUrl,
          thumbnailImageUrl: item.courseThumbnailImageUrl,
          teacherName: item.courseTeacherName,
        };
      } else {
        return {
          type: 'digitalProduct' as const,
          cartItemId: item.cartItemId,
          digitalProductId: item.digitalProductId!,
          slug: item.digitalProductSlug!,
          title: item.digitalProductTitle!,
          price: parseFloat(item.digitalProductPrice!),
          discountPrice: null,
          thumbnailUrl: item.digitalProductThumbnailUrl,
        };
      }
    });

    return new Response(
      superjson.stringify({ items } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to fetch cart items:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to fetch cart items.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}