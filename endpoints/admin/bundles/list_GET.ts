import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const bundles = await db
      .selectFrom("courseBundles")
      .innerJoin("users", "users.id", "courseBundles.teacherId")
      .leftJoin("courseBundleItems", "courseBundleItems.bundleId", "courseBundles.id")
      .select(({ fn }) => [
        "courseBundles.id",
        "courseBundles.title",
        "courseBundles.slug",
        "courseBundles.price",
        "courseBundles.originalPrice",
        "courseBundles.discountPercentage",
        "courseBundles.isPublished",
        "courseBundles.publishedAt",
        "courseBundles.createdAt",
        "users.displayName as teacherName",
        "users.id as teacherId",
        fn.count<number>("courseBundleItems.id").as("itemsCount"),
      ])
      .groupBy([
        "courseBundles.id",
        "users.displayName",
        "users.id"
      ])
      .orderBy("courseBundles.createdAt", "desc")
      .execute();

    const output: OutputType = bundles.map((bundle) => ({
      ...bundle,
      price: Number(bundle.price),
      originalPrice: Number(bundle.originalPrice),
      discountPercentage: bundle.discountPercentage !== null ? Number(bundle.discountPercentage) : null,
      itemsCount: Number(bundle.itemsCount),
    }));

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching admin bundles list:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}