import superjson from "superjson";
import { schema, OutputType } from "./get_GET.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { examNewsServer } from "../../../helpers/examNewsServer";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const url = new URL(request.url);
    const input = schema.parse({ id: Number(url.searchParams.get("id")) });

    await examNewsServer.promoteDue();
    const post = await examNewsServer.loadDetail(input.id);
    if (!post) {
      return new Response(superjson.stringify({ error: "News story not found" }), { status: 404 });
    }
    return new Response(superjson.stringify({ post } satisfies OutputType));
  } catch (error) {
    return examNewsServer.errorResponse(error, "Error loading exam news story");
  }
}