import superjson from "superjson";
import { schema, OutputType } from "./duplicate_POST.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { currentAffairsServer } from "../../../helpers/currentAffairsServer";

export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const detail = await currentAffairsServer.loadDetail(input.id);
    if (!detail) {
      return new Response(superjson.stringify({ error: "Current affairs post not found" }), { status: 404 });
    }

    const source = currentAffairsServer.detailToInput(detail, "draft");
    // A copy starts undated: a daily digest is one per day, and a copied time would read as scheduled.
    const id = await currentAffairsServer.save(
      {
        ...source,
        id: undefined,
        title: `Copy of ${detail.title}`.slice(0, 255),
        slug: `${detail.slug}-copy`,
        publishAt: "",
        digestDate: "",
        corrections: [],
        quiz: source.quiz ? { ...source.quiz, isPublished: false } : null,
      },
      admin.id,
      { autoSlug: true }
    );

    return new Response(superjson.stringify({ success: true, id } satisfies OutputType));
  } catch (error) {
    return currentAffairsServer.errorResponse(error, "Error duplicating current affairs post");
  }
}