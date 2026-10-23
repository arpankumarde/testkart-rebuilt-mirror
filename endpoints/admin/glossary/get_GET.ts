import superjson from "superjson";
import { schema, OutputType } from "./get_GET.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { glossaryServer } from "../../../helpers/glossaryServer";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse({ id: Number(new URL(request.url).searchParams.get("id")) });

    const term = await glossaryServer.loadDetail(input.id);
    if (!term) {
      return new Response(superjson.stringify({ error: "Glossary term not found" }), { status: 404 });
    }
    return new Response(superjson.stringify({ term } satisfies OutputType));
  } catch (error) {
    return glossaryServer.errorResponse(error, "Error loading glossary term");
  }
}