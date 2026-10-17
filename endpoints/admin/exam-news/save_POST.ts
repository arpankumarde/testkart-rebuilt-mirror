import superjson from "superjson";
import { schema, OutputType } from "./save_POST.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { examNewsServer, ExamNewsInputError } from "../../../helpers/examNewsServer";
import { validateExamNews } from "../../../helpers/examNewsValidation";

export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const issues = validateExamNews(input);
    if (issues.length > 0) {
      throw new ExamNewsInputError(`${issues.length} field${issues.length === 1 ? " needs" : "s need"} attention`, issues);
    }

    const id = await examNewsServer.save(input, admin.id);
    const post = await examNewsServer.loadDetail(id);
    if (!post) throw new Error("The story was saved but could not be read back");
    return new Response(superjson.stringify({ success: true, post } satisfies OutputType));
  } catch (error) {
    return examNewsServer.errorResponse(error, "Error saving exam news story");
  }
}