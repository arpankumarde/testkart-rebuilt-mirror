import { OutputType } from "./duplicates_GET.schema";
import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { getCustomExamNameCounts } from "../../../helpers/customExamNameCounts";
import { findDuplicateGroups } from "../../../helpers/duplicateExamNames";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const customNames = await getCustomExamNameCounts();
    const groups = findDuplicateGroups(customNames);

    return new Response(superjson.stringify({ groups } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
    });
  }
}
