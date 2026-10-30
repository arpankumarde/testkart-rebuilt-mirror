import superjson from "superjson";
import { schema, type OutputType } from "./content-save_POST.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { gecServer, GecInputError } from "../../../helpers/gecServer";

export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const parsed = schema.safeParse(superjson.parse(await request.text()));
    if (!parsed.success) {
      throw new GecInputError(
        "Some fields need attention",
        parsed.error.issues.map((issue) => ({ path: issue.path.slice(1).join("."), message: issue.message }))
      );
    }
    const result: OutputType = await gecServer.saveContent(parsed.data.block, parsed.data.page, admin.id);
    return new Response(superjson.stringify(result));
  } catch (error) {
    return gecServer.errorResponse(error, "Error saving page content");
  }
}