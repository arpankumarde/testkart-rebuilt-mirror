import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";
import { OutputType, schema } from "./detail_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    // Require admin session
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const contactIdStr = url.searchParams.get("contactId");

    if (!contactIdStr) {
      return new Response(
        superjson.stringify({ error: "contactId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const parsed = schema.safeParse({ contactId: parseInt(contactIdStr, 10) });
    if (!parsed.success) {
      return new Response(
        superjson.stringify({ error: "Invalid contactId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { contactId } = parsed.data;

    // Fetch contact
    // LEFT join: demo-request leads captured on the website have no user row
    // yet, so their name/email/phone live on the sales_contacts row itself.
    const contactRow = await db
      .selectFrom("salesContacts")
      .leftJoin("users", "salesContacts.userId", "users.id")
      .leftJoin("admins", "salesContacts.assignedToAdminId", "admins.id")
      .where("salesContacts.id", "=", contactId)
      .select([
        "salesContacts.id",
        "salesContacts.userId",
        "salesContacts.source",
        "salesContacts.leadExpertise",
        // As text, not a Date: the column is a bare DATE, and reading it as a
        // Date would make it midnight in the server's zone and render as the
        // day before for anyone west of it.
        sql<string | null>`to_char(sales_contacts.preferred_call_date, 'YYYY-MM-DD')`.as(
          "preferredCallDate"
        ),
        "salesContacts.preferredCallSlot",
        sql<string>`coalesce(users.display_name, sales_contacts.lead_name)`.as("displayName"),
        sql<string | null>`coalesce(users.email, sales_contacts.lead_email)`.as("email"),
        sql<string | null>`coalesce(users.mobile_number, sales_contacts.lead_phone)`.as("mobileNumber"),
        "users.academyName",
        "users.location",
        "salesContacts.stage",
        sql<Date>`coalesce(users.created_at, sales_contacts.created_at)`.as("signedUpAt"),
        "salesContacts.createdAt as importedAt",
        "salesContacts.updatedAt",
        "salesContacts.assignedToAdminId",
        "admins.fullName as assignedToAdminName",
        "salesContacts.followUpDate",
        "salesContacts.lastContactedAt",
        sql<boolean>`coalesce(users.onboarding_completed, false)`.as("onboardingCompleted"),
        "users.teachingCategories",
        "users.targetExams",
        "users.teachingExperienceLevel",
        "users.currentOccupation",
        "users.goals",
        "users.discoverySource",
        "users.schoolCollegeName",
        "users.signupSource",
        "users.productInterest",
        "users.expertiseAreas",
        "users.languages",
        "users.bio",
        "users.tagline",
        "users.avatarUrl",
      ])
      .executeTakeFirst();

    if (!contactRow) {
      return new Response(
        superjson.stringify({ error: "Contact not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch Notes
    const notes = await db
      .selectFrom("salesContactNotes")
      .where("salesContactId", "=", contactId)
      .select(["id", "note", "createdBy", "createdAt", "disposition"])
      .orderBy("createdAt", "desc")
      .execute();

    // Fetch Activities
    const activities = await db
      .selectFrom("salesContactActivities")
      .where("salesContactId", "=", contactId)
      .select(["id", "activityType", "oldValue", "newValue", "details", "createdBy", "createdAt"])
      .orderBy("createdAt", "desc")
      .execute();

    // Fetch Content Stats. A website lead has no user account yet, so there is
    // no authored content to count — skip the five queries entirely.
    const userId = contactRow.userId;

    if (userId === null) {
      return new Response(
        superjson.stringify({
          contact: contactRow,
          notes,
          activities,
          contentStats: {
            testsCount: 0,
            coursesCount: 0,
            productsCount: 0,
            bundlesCount: 0,
            liveTestsCount: 0,
          },
        } satisfies OutputType),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const [
      testsCountRow,
      coursesCountRow,
      productsCountRow,
      bundlesCountRow,
      liveTestsCountRow,
    ] = await Promise.all([
      db
        .selectFrom("mockTests")
        .where("teacherId", "=", userId)
        .select((eb) => eb.fn.count<string>("id").as("count"))
        .executeTakeFirst(),
      db
        .selectFrom("courses")
        .where("teacherId", "=", userId)
        .select((eb) => eb.fn.count<string>("id").as("count"))
        .executeTakeFirst(),
      db
        .selectFrom("digitalProducts")
        .where("teacherId", "=", userId)
        .select((eb) => eb.fn.count<string>("id").as("count"))
        .executeTakeFirst(),
      db
        .selectFrom("courseBundles")
        .where("teacherId", "=", userId)
        .select((eb) => eb.fn.count<string>("id").as("count"))
        .executeTakeFirst(),
      db
        .selectFrom("liveTests")
        .where("teacherId", "=", userId)
        .select((eb) => eb.fn.count<string>("id").as("count"))
        .executeTakeFirst(),
    ]);

    const contentStats = {
      testsCount: parseInt(testsCountRow?.count || "0", 10),
      coursesCount: parseInt(coursesCountRow?.count || "0", 10),
      productsCount: parseInt(productsCountRow?.count || "0", 10),
      bundlesCount: parseInt(bundlesCountRow?.count || "0", 10),
      liveTestsCount: parseInt(liveTestsCountRow?.count || "0", 10),
    };

    return new Response(
      superjson.stringify({
        contact: contactRow,
        notes,
        activities,
        contentStats,
      } satisfies OutputType),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching sales contact detail:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}