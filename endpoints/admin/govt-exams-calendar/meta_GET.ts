import superjson from "superjson";
import type { OutputType } from "./meta_GET.schema";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { gecServer } from "../../../helpers/gecServer";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const [meta, pendingSummary] = await Promise.all([gecServer.adminMeta(), gecServer.pendingSummary()]);
    const result: OutputType = { ...meta, pendingSummary };
    return new Response(superjson.stringify(result));
  } catch (error) {
    return gecServer.errorResponse(error, "Error loading calendar status");
  }
}