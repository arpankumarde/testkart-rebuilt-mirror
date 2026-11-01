import superjson from "superjson";
import { schema, type OutputType } from "./news-posts_GET.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { gecServer } from "../../../helpers/gecServer";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const params = new URL(request.url).searchParams;
    const input = schema.parse({
      q: params.get("q") || undefined,
      examId: params.get("examId") ? Number(params.get("examId")) : undefined,
    });
    const result: OutputType = { posts: await gecServer.searchNewsPosts(input) };
    return new Response(superjson.stringify(result));
  } catch (error) {
    return gecServer.errorResponse(error, "Error searching Exam News articles");
  }
}