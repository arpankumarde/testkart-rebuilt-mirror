import superjson from "superjson";
import { schema, OutputType } from "./slug-check_GET.schema";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { currentAffairsServer } from "../../../helpers/currentAffairsServer";
import { slugify } from "../../../helpers/slugify";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const params = new URL(request.url).searchParams;
    const excludeId = params.get("excludeId");
    const input = schema.parse({
      slug: params.get("slug") ?? "",
      excludeId: excludeId ? Number(excludeId) : undefined,
    });

    const slug = slugify(input.slug);
    const usedBy = slug ? (await currentAffairsServer.findSlugOwner(db, slug, input.excludeId)) ?? null : null;
    return new Response(superjson.stringify({ slug, available: !!slug && !usedBy, usedBy } satisfies OutputType));
  } catch (error) {
    return currentAffairsServer.errorResponse(error, "Error checking current affairs slug");
  }
}