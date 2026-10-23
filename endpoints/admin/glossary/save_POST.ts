import superjson from "superjson";
import { schema, OutputType } from "./save_POST.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { glossaryServer, GlossaryInputError } from "../../../helpers/glossaryServer";
import { validateGlossaryTerm } from "../../../helpers/glossaryValidation";

export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const issues = validateGlossaryTerm(input);
    if (issues.length > 0) {
      throw new GlossaryInputError(`${issues.length} field${issues.length === 1 ? " needs" : "s need"} attention`, issues);
    }

    const id = await glossaryServer.save(input, admin.id);
    const term = await glossaryServer.loadDetail(id);
    if (!term) throw new Error("The term was saved but could not be read back");
    return new Response(superjson.stringify({ success: true, term } satisfies OutputType));
  } catch (error) {
    return glossaryServer.errorResponse(error, "Error saving glossary term");
  }
}