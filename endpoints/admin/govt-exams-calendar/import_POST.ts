import superjson from "superjson";
import { schema, type OutputType } from "./import_POST.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { gecServer } from "../../../helpers/gecServer";

export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const result: OutputType = await gecServer.importData(input, admin.id);
    return new Response(superjson.stringify(result));
  } catch (error) {
    return gecServer.errorResponse(error, "Error importing into the calendar");
  }
}