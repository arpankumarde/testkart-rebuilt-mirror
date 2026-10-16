import superjson from "superjson";
import { schema, OutputType } from "./save_POST.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { currentAffairsServer, CurrentAffairsInputError } from "../../../helpers/currentAffairsServer";
import { validateCurrentAffairs } from "../../../helpers/currentAffairsValidation";

export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const issues = validateCurrentAffairs(input);
    if (issues.length > 0) {
      throw new CurrentAffairsInputError(
        `${issues.length} field${issues.length === 1 ? " needs" : "s need"} attention`,
        issues
      );
    }

    const id = await currentAffairsServer.save(input, admin.id);
    const post = await currentAffairsServer.loadDetail(id);
    if (!post) throw new Error("The post was saved but could not be read back");
    return new Response(superjson.stringify({ success: true, post } satisfies OutputType));
  } catch (error) {
    return currentAffairsServer.errorResponse(error, "Error saving current affairs post");
  }
}