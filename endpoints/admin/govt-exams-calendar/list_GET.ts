import superjson from "superjson";
import { schema, type OutputType } from "./list_GET.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { gecServer } from "../../../helpers/gecServer";

const toInt = (value: string | null) => (value ? Number.parseInt(value, 10) : undefined);

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const params = new URL(request.url).searchParams;
    const input = schema.parse({
      tab: params.get("tab") || undefined,
      search: params.get("search") || undefined,
      category: params.get("category") || undefined,
      status: params.get("status") || undefined,
      verification: params.get("verification") || undefined,
      month: params.get("month") || undefined,
      year: params.get("year") || undefined,
      page: toInt(params.get("page")),
      limit: toInt(params.get("limit")),
    });
    const result: OutputType = await gecServer.listExams(input);
    return new Response(superjson.stringify(result));
  } catch (error) {
    return gecServer.errorResponse(error, "Error listing calendar records");
  }
}