import superjson from "superjson";
import { schema, type OutputType } from "./export_GET.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { gecServer } from "../../../helpers/gecServer";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse({ format: new URL(request.url).searchParams.get("format") ?? "csv" });
    const result: OutputType = await gecServer.exportData(input.format);
    return new Response(superjson.stringify(result));
  } catch (error) {
    return gecServer.errorResponse(error, "Error exporting the calendar");
  }
}