import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { OutputType, ContactNote, SalesContactSort } from "./contacts_GET.schema";
import superjson from "superjson";
import { SalesStage, SalesContactSource } from "../../../helpers/schema";
import { sql } from "kysely";

// A pipeline row is either a signed-up user (joined from `users`) or a website
// lead captured before signup (source = 'demo_request', details on the row
// itself). Everything below reads through these so both kinds render the same.
const displayNameExpr = sql<string>`coalesce(users.display_name, sales_contacts.lead_name)`;
const emailExpr = sql<string | null>`coalesce(users.email, sales_contacts.lead_email)`;
const phoneExpr = sql<string | null>`coalesce(users.mobile_number, sales_contacts.lead_phone)`;
const createdAtExpr = sql<Date>`coalesce(users.created_at, sales_contacts.created_at)`;
// As text, not a Date: the column is a bare DATE, and reading it as a Date would
// make it midnight in the server's zone and render as the day before for anyone
// west of it. The demo form sends the same "YYYY-MM-DD" shape.
const preferredCallDateExpr = sql<string | null>`to_char(sales_contacts.preferred_call_date, 'YYYY-MM-DD')`;
const IST = "Asia/Kolkata";

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'manager']);

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const stage = url.searchParams.get("stage") as SalesStage | null;
    const source = url.searchParams.get("source") as SalesContactSource | null;
    const assignedTo = url.searchParams.get("assignedTo");
    const followUpFilter = url.searchParams.get("followUpFilter") as "today" | "overdue" | "upcoming" | "unscheduled" | null;
    const signupDateFrom = url.searchParams.get("signupDateFrom");
    const signupDateTo = url.searchParams.get("signupDateTo");
    const myLeads = url.searchParams.get("myLeads") === "true";
    const openOverdue = url.searchParams.get("openOverdue") === "true";
    const sort = url.searchParams.get("sort") as SalesContactSort | null;
    const sortOrderParam = url.searchParams.get("sortOrder");
    const sortOrder = sortOrderParam === "asc" || sortOrderParam === "desc" ? sortOrderParam : null;
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;

    // Fetch Stats
    const [rawStats, demoRequestRow] = await Promise.all([
      db
        .selectFrom("salesContacts")
        .select(["stage", (eb) => eb.fn.count<string>("id").as("count")])
        .groupBy("stage")
        .execute(),
      db
        .selectFrom("salesContacts")
        .select((eb) => eb.fn.count<string>("id").as("count"))
        .where("source", "=", "demo_request")
        .executeTakeFirst(),
    ]);

    const stats = {
      total: 0,
      new: 0,
      followUp: 0,
      qualified: 0,
      converted: 0,
      notInterested: 0,
      demoRequests: parseInt(demoRequestRow?.count || "0", 10),
    };

    for (const row of rawStats) {
      const count = parseInt(row.count, 10);
      stats.total += count;
      if (row.stage === "new") stats.new = count;
      if (row.stage === "follow_up") stats.followUp = count;
      if (row.stage === "qualified") stats.qualified = count;
      if (row.stage === "converted") stats.converted = count;
      if (row.stage === "not_interested") stats.notInterested = count;
    }

    // Build main query. LEFT join: demo-request leads have no user row yet.
    let baseQuery = db
      .selectFrom("salesContacts")
      .leftJoin("users", "salesContacts.userId", "users.id")
      .leftJoin("admins", "salesContacts.assignedToAdminId", "admins.id");

    if (search) {
      const searchQuery = `%${search}%`;
      baseQuery = baseQuery.where((eb) =>
        eb.or([
          eb(displayNameExpr, "ilike", searchQuery),
          eb(emailExpr, "ilike", searchQuery),
          eb(phoneExpr, "ilike", searchQuery),
        ])
      );
    }

    if (stage) {
      baseQuery = baseQuery.where("salesContacts.stage", "=", stage);
    }

    if (source) {
      baseQuery = baseQuery.where("salesContacts.source", "=", source);
    }

    if (assignedTo) {
      const assignedToId = parseInt(assignedTo, 10);
      if (!isNaN(assignedToId)) {
        baseQuery = baseQuery.where("salesContacts.assignedToAdminId", "=", assignedToId);
      }
    }

    if (myLeads) {
      baseQuery = baseQuery.where("salesContacts.assignedToAdminId", "=", admin.id);
    }

    if (followUpFilter) {
      if (followUpFilter === "unscheduled") {
        baseQuery = baseQuery.where("salesContacts.followUpDate", "is", null);
      } else {
        const todayStartIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        todayStartIST.setHours(0, 0, 0, 0);

        const todayEndIST = new Date(todayStartIST);
        todayEndIST.setHours(23, 59, 59, 999);

        if (followUpFilter === "today") {
          baseQuery = baseQuery.where((eb) =>
            eb.and([
              eb("salesContacts.followUpDate", "is not", null),
              eb("salesContacts.followUpDate", ">=", todayStartIST),
              eb("salesContacts.followUpDate", "<=", todayEndIST),
            ])
          );
        } else if (followUpFilter === "overdue") {
          baseQuery = baseQuery.where((eb) =>
            eb.and([
              eb("salesContacts.followUpDate", "is not", null),
              eb("salesContacts.followUpDate", "<", todayStartIST),
            ])
          );
        } else if (followUpFilter === "upcoming") {
          baseQuery = baseQuery.where((eb) =>
            eb.and([
              eb("salesContacts.followUpDate", "is not", null),
              eb("salesContacts.followUpDate", ">", todayEndIST),
            ])
          );
        }
      }
    }

    if (signupDateFrom) {
      baseQuery = baseQuery.where(createdAtExpr, ">=", new Date(signupDateFrom));
    }

    if (signupDateTo) {
      baseQuery = baseQuery.where(createdAtExpr, "<=", new Date(signupDateTo + "T23:59:59.999Z"));
    }

    // The Overview's overdue follow-ups tile uses this exact condition, so its link lands on the same rows.
    if (openOverdue) {
      baseQuery = baseQuery.where(
        sql<boolean>`sales_contacts.stage IN ('new', 'follow_up', 'qualified') AND sales_contacts.follow_up_date < (now() AT TIME ZONE ${IST})::date`
      );
    }

    // Count total matched
    const countResult = await baseQuery
      .select((eb) => eb.fn.count<string>("salesContacts.id").as("count"))
      .executeTakeFirstOrThrow();
    const totalCount = parseInt(countResult.count, 10);
    const totalPages = Math.ceil(totalCount / limit);

    /* Without an explicit order each sort keeps its original direction. Leads never called count as the least recently called. */
    const asc = sortOrder
      ? sortOrder === "asc"
      : sort === "follow_up_date" || sort === "last_contacted" || sort === "name" || sort === "stage";
    const dir = asc ? sql`ASC` : sql`DESC`;
    const orderExpr =
      sort === "follow_up_date"
        ? sql`sales_contacts.follow_up_date ${dir} NULLS LAST`
        : sort === "last_contacted"
          ? sql`sales_contacts.last_contacted_at ${dir} ${asc ? sql`NULLS FIRST` : sql`NULLS LAST`}`
          : sort === "name"
            ? sql`lower(${displayNameExpr}) ${dir} NULLS LAST`
            : sort === "stage"
              ? sql`sales_contacts.stage ${dir}`
              : sql`${createdAtExpr} ${dir}`;

    // Fetch paginated contacts
    const contactsRows = await baseQuery
      .select([
        "salesContacts.id",
        "salesContacts.userId",
        "salesContacts.source",
        "salesContacts.leadExpertise",
        preferredCallDateExpr.as("preferredCallDate"),
        "salesContacts.preferredCallSlot",
        displayNameExpr.as("displayName"),
        emailExpr.as("email"),
        phoneExpr.as("mobileNumber"),
        "users.academyName",
        "users.location",
        "salesContacts.stage",
        createdAtExpr.as("signedUpAt"),
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
      ])
      .orderBy(orderExpr)
      .orderBy("salesContacts.id", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    // Fetch latest 5 notes per contact
    const contactIds = contactsRows.map((c) => c.id);
    const notesMap: Record<number, ContactNote[]> = {};

    if (contactIds.length > 0) {
      const rawNotes = await db
        .selectFrom("salesContactNotes")
        .selectAll()
        .where("salesContactId", "in", contactIds)
        .orderBy("createdAt", "desc")
        .execute();

      for (const note of rawNotes) {
        if (!notesMap[note.salesContactId]) {
          notesMap[note.salesContactId] = [];
        }
        if (notesMap[note.salesContactId].length < 5) {
          notesMap[note.salesContactId].push({
            id: note.id,
            note: note.note,
            createdBy: note.createdBy,
            createdAt: note.createdAt,
            disposition: note.disposition,
          });
        }
      }
    }

    const contacts = contactsRows.map((c) => ({
      ...c,
      notes: notesMap[c.id] || [],
    }));

    return new Response(
      superjson.stringify({
        contacts,
        totalCount,
        currentPage: page,
        totalPages,
        stats,
      } satisfies OutputType),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching sales contacts:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
