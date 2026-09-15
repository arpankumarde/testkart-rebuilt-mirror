import { schema, OutputType } from "./distribute-prizes_POST.schema";
import superjson from "superjson";
import { getAdminServerSessionOrThrow, NotAuthenticatedError } from "../../helpers/getAdminSession";
import { distributeLiveTestPrizes } from "../../helpers/liveTestPrizePayout";

export async function handle(request: Request) {
  try {
    // Payouts run from the liveTestPrizePayout scheduled job. This route is
    // only a manual trigger for admins.
    await getAdminServerSessionOrThrow(request, ["super_admin", "admin"]);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const result = await distributeLiveTestPrizes(input.liveTestId);

    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    console.error("Error distributing prizes:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400 }
    );
  }
}
