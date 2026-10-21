import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./registrations_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const url = new URL(request.url);
    const { masterclassId } = schema.parse({ masterclassId: Number(url.searchParams.get("masterclassId")) });

    const registrations = await db
      .selectFrom("masterclassRegistrations")
      .selectAll()
      .where("masterclassId", "=", masterclassId)
      .orderBy("registeredAt", "desc")
      .execute();

    return new Response(superjson.stringify({ registrations } satisfies OutputType), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching masterclass registrations:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Failed to load registrations" }),
      { status: 400 }
    );
  }
}
