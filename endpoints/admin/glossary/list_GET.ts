import superjson from "superjson";
import { schema, OutputType } from "./list_GET.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { glossaryServer } from "../../../helpers/glossaryServer";

const toInt = (value: string | null) => (value ? Number.parseInt(value, 10) : undefined);

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const params = new URL(request.url).searchParams;
    const input = schema.parse({
      search: params.get("search") || undefined,
      category: params.get("category") || undefined,
      status: params.get("status") || undefined,
      sort: params.get("sort") || undefined,
      page: toInt(params.get("page")),
      limit: toInt(params.get("limit")),
    });

    return new Response(superjson.stringify((await glossaryServer.list(input)) satisfies OutputType));
  } catch (error) {
    return glossaryServer.errorResponse(error, "Error listing glossary terms");
  }
}