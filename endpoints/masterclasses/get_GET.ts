import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { schema, OutputType, MasterclassDetail } from "./get_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const { slug } = schema.parse({ slug: url.searchParams.get("slug") ?? "" });

    const m = await db.selectFrom("masterclasses").selectAll().where("slug", "=", slug).executeTakeFirst();
    if (!m || m.status === "draft") {
      return new Response(superjson.stringify({ error: "This masterclass could not be found." }), { status: 404 });
    }

    const registrantCountRow = await db
      .selectFrom("masterclassRegistrations")
      .where("masterclassId", "=", m.id)
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .executeTakeFirst();
    const registrantCount = registrantCountRow ? Number(registrantCountRow.count) : 0;

    let isRegistered = false;
    let prefill: MasterclassDetail["prefill"] = null;
    try {
      const { user } = await getServerUserSession(request);
      prefill = { name: user.displayName, email: user.email ?? "", phone: user.mobileNumber ?? null };
      if (user.email) {
        const existing = await db
          .selectFrom("masterclassRegistrations")
          .select("id")
          .where("masterclassId", "=", m.id)
          .where("email", "=", user.email)
          .executeTakeFirst();
        isRegistered = !!existing;
      }
    } catch (err) {
      if (!(err instanceof NotAuthenticatedError)) {
        console.error("[masterclasses/get] Failed to resolve optional session:", err);
      }
    }

    const now = Date.now();
    const isPast = new Date(m.startTime).getTime() + (m.durationMinutes ?? 60) * 60 * 1000 < now;
    const isFull = m.capacity !== null && registrantCount >= m.capacity;

    const masterclass: MasterclassDetail = {
      id: m.id,
      slug: m.slug,
      title: m.title,
      subtitle: m.subtitle,
      description: m.description,
      coverImageUrl: m.coverImageUrl,
      hostName: m.hostName,
      hostTitle: m.hostTitle,
      hostImageUrl: m.hostImageUrl,
      platformLabel: m.platformLabel,
      startTime: m.startTime,
      durationMinutes: m.durationMinutes,
      capacity: m.capacity,
      status: m.status,
      registrantCount,
      isPast,
      isFull,
      isRegistered,
      // The actual meeting link is only meaningful once registered; otherwise it's not returned.
      joinUrl: isRegistered ? m.joinUrl : null,
      prefill,
    };

    return new Response(superjson.stringify({ masterclass } satisfies OutputType), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching masterclass:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Failed to load this masterclass." }),
      { status: 400 }
    );
  }
}
