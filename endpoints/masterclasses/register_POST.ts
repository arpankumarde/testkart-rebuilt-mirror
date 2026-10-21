import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { sendTemplateEmail } from "../../helpers/sendTemplateEmail";
import { googleCalendarUrl, masterclassIcsPath } from "../../helpers/masterclassCalendarLinks";
import { schema, OutputType } from "./register_POST.schema";
import superjson from "superjson";

const BASE_URL = "https://testkart.in";
const MASTERCLASS_BASE_URL = `${BASE_URL}/masterclass`;

export async function handle(request: Request) {
  try {
    const input = schema.parse(superjson.parse(await request.text()));

    const m = await db.selectFrom("masterclasses").selectAll().where("slug", "=", input.slug).executeTakeFirst();
    if (!m) {
      throw new Error("This masterclass could not be found.");
    }
    if (m.status !== "published") {
      throw new Error("Registrations are not open for this masterclass.");
    }
    if (new Date(m.startTime).getTime() < Date.now()) {
      throw new Error("This masterclass has already started or ended.");
    }

    let userId: number | null = null;
    try {
      const { user } = await getServerUserSession(request);
      userId = user.id;
    } catch (err) {
      if (!(err instanceof NotAuthenticatedError)) {
        console.error("[masterclasses/register] Failed to resolve optional session:", err);
      }
    }

    const existing = await db
      .selectFrom("masterclassRegistrations")
      .select("id")
      .where("masterclassId", "=", m.id)
      .where("email", "=", input.email)
      .executeTakeFirst();

    if (existing) {
      return new Response(
        superjson.stringify({ success: true, alreadyRegistered: true, joinUrl: m.joinUrl } satisfies OutputType)
      );
    }

    if (m.capacity !== null) {
      const countRow = await db
        .selectFrom("masterclassRegistrations")
        .where("masterclassId", "=", m.id)
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .executeTakeFirst();
      if (countRow && Number(countRow.count) >= m.capacity) {
        throw new Error("This masterclass is full.");
      }
    }

    await db
      .insertInto("masterclassRegistrations")
      .values({
        masterclassId: m.id,
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        userId,
      })
      .execute();

    const formattedStartTime = new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(m.startTime));

    const masterclassUrl = `${MASTERCLASS_BASE_URL}/${m.slug}`;
    const emailResult = await sendTemplateEmail("masterclass_confirmation", input.email, {
      name: input.name,
      title: m.title,
      hostName: m.hostName || "the Testkart team",
      startTime: formattedStartTime,
      masterclassUrl,
      googleCalendarUrl: googleCalendarUrl({
        title: m.title,
        description: m.subtitle || "A free live masterclass for teachers, hosted on Testkart.",
        pageUrl: masterclassUrl,
        startTime: m.startTime,
        durationMinutes: m.durationMinutes,
      }),
      icsUrl: `${BASE_URL}${masterclassIcsPath(m.slug)}`,
    });

    if (emailResult.success) {
      await db
        .updateTable("masterclassRegistrations")
        .set({ confirmationSentAt: new Date() })
        .where("masterclassId", "=", m.id)
        .where("email", "=", input.email)
        .execute();
    }

    return new Response(
      superjson.stringify({ success: true, alreadyRegistered: false, joinUrl: m.joinUrl } satisfies OutputType)
    );
  } catch (error) {
    console.error("[masterclasses/register] Failed:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Could not complete registration." }),
      { status: 400 }
    );
  }
}
