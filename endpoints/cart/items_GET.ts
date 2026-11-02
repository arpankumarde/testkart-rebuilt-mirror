import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { OutputType, CartItem } from "./items_GET.schema";
import superjson from "superjson";
import { courseDiscountPrice, courseEffectivePrice } from "../../helpers/coursePricing";
import { productDiscountPrice, productEffectivePrice } from "../../helpers/digitalProductPricing";
import { loadCartAutoCandidates } from "../../helpers/courseCouponOffersServer";
import { pickAutoOffers, type StackLine } from "../../helpers/cartCouponStack";
import { autoOfferLines } from "../../helpers/cartCouponStackServer";
import { isExpired } from "../../helpers/contentExpiry";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const cartItems = await db
      .selectFrom("cartItems")
      .leftJoin("mockTests", "cartItems.mockTestId", "mockTests.id")
      .leftJoin("courses", "cartItems.courseId", "courses.id")
      .leftJoin("digitalProducts", "cartItems.digitalProductId", "digitalProducts.id")
      .leftJoin("users", "courses.teacherId", "users.id")
      .leftJoin("users as productTeacher", "digitalProducts.teacherId", "productTeacher.id")
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
        "mockTests.expiresAt as testExpiresAt",
        "mockTests.expiredAt as testExpiredAt",
        "courses.title as courseTitle",
        "courses.slug as courseSlug",
        "courses.price as coursePrice",
        "courses.discountPrice as courseDiscountPrice",
        "courses.thumbnailUrl as courseThumbnailUrl",
        "courses.thumbnailImageUrl as courseThumbnailImageUrl",
        "courses.teacherId as courseTeacherId",
        "courses.expiresAt as courseExpiresAt",
        "courses.expiredAt as courseExpiredAt",
        "users.displayName as courseTeacherName",
        "cartItems.digitalProductId",
        "digitalProducts.title as digitalProductTitle",
        "digitalProducts.slug as digitalProductSlug",
        "digitalProducts.price as digitalProductPrice",
        "digitalProducts.discountPrice as digitalProductDiscountPrice",
        "digitalProducts.teacherId as digitalProductTeacherId",
        "digitalProducts.thumbnailUrl as digitalProductThumbnailUrl",
        "digitalProducts.expiresAt as digitalProductExpiresAt",
        "digitalProducts.expiredAt as digitalProductExpiredAt",
        "productTeacher.displayName as digitalProductTeacherName",
      ])
      .orderBy("cartItems.addedAt", "desc")
      .execute();

    const now = new Date();
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
          expired: isExpired({ expiresAt: item.testExpiresAt, expiredAt: item.testExpiredAt }, now),
        };
      } else if (item.courseId) {
        return {
          type: 'course' as const,
          cartItemId: item.cartItemId,
          courseId: item.courseId,
          slug: item.courseSlug!,
          title: item.courseTitle!,
          price: parseFloat(item.coursePrice!),
          discountPrice: courseDiscountPrice(item.coursePrice, item.courseDiscountPrice),
          thumbnailUrl: item.courseThumbnailUrl,
          thumbnailImageUrl: item.courseThumbnailImageUrl,
          teacherName: item.courseTeacherName,
          expired: isExpired({ expiresAt: item.courseExpiresAt, expiredAt: item.courseExpiredAt }, now),
        };
      } else {
        return {
          type: 'digitalProduct' as const,
          cartItemId: item.cartItemId,
          digitalProductId: item.digitalProductId!,
          slug: item.digitalProductSlug!,
          title: item.digitalProductTitle!,
          price: parseFloat(item.digitalProductPrice!),
          discountPrice: productDiscountPrice(item.digitalProductPrice, item.digitalProductDiscountPrice),
          thumbnailUrl: item.digitalProductThumbnailUrl,
          teacherName: item.digitalProductTeacherName,
          expired: isExpired({ expiresAt: item.digitalProductExpiresAt, expiredAt: item.digitalProductExpiredAt }, now),
        };
      }
    });

    // The same picks checkout makes when no Tcoins are used.
    const offerLines = cartItems.flatMap((item): StackLine[] => {
      if (item.mockTestId) return [];
      if (item.courseId !== null) {
        return [{ kind: "course", id: item.courseId, teacherId: item.courseTeacherId, price: courseEffectivePrice(item.coursePrice, item.courseDiscountPrice) }];
      }
      if (item.digitalProductId !== null) {
        return [{
          kind: "digitalProduct",
          id: item.digitalProductId,
          teacherId: item.digitalProductTeacherId,
          price: productEffectivePrice(item.digitalProductPrice, item.digitalProductDiscountPrice),
        }];
      }
      return [];
    });
    const autoCandidates = await loadCartAutoCandidates({ userId: user.id, lines: autoOfferLines(offerLines) });
    const autoCoupons = pickAutoOffers(autoCandidates, offerLines);

    return new Response(
      superjson.stringify({ items, autoCoupon: autoCoupons[0] ?? null, autoCoupons } satisfies OutputType)
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