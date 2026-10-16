import superjson from "superjson";
import { schema, OutputType } from "./get_GET.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { currentAffairsServer } from "../../../helpers/currentAffairsServer";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const url = new URL(request.url);
    const input = schema.parse({ id: Number(url.searchParams.get("id")) });

    await currentAffairsServer.promoteDue();
    const post = await currentAffairsServer.loadDetail(input.id);
    if (!post) {
      return new Response(superjson.stringify({ error: "Current affairs post not found" }), { status: 404 });
    }
    return new Response(superjson.stringify({ post } satisfies OutputType));
  } catch (error) {
    return currentAffairsServer.errorResponse(error, "Error loading current affairs post");
  }
}