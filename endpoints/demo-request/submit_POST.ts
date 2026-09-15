import { db } from "../../helpers/db";
import {
  schema,
  OutputType,
  normalizeIndianMobile,
  demoCallSlotStartMinutes,
  formatDemoCallSlot,
  istDateKey,
  istMinutesOfDay,
} from "./submit_POST.schema";
import { sendTemplateEmail, ADMIN_EMAIL } from "../../helpers/sendTemplateEmail";
import { assignUserSlug } from "../../helpers/assignUserSlug";
import superjson from "superjson";
import { sql } from "kysely";
import { ZodError } from "zod";

/** Author recorded on notes/activities created by this public form. */
const LEAD_AUTHOR = "Website (Demo Request)";

/** Stamped on users.signup_source so demo-created accounts stay identifiable. */
const DEMO_SIGNUP_SOURCE = "demo_request";

/**
 * Creates the teacher account behind a demo request, mirroring what the mobile
 * signup flow does: user row, unique slug, avatar, free plan. Deliberately does
 * NOT create a session or password — the visitor never chose a credential, so
 * they sign in later through the normal mobile-OTP path on the same number.
 *
 * Returns null on failure: a lead must never be lost because account creation
 * tripped (e.g. an email that got claimed between our lookup and this insert).
 */
async function createTeacherAccountForLead(input: {
  name: string;
  phone: string;
  email: string | null;
  expertise: string;
}): Promise<number | null> {
  try {
    const newUser = await db
      .insertInto("users")
      .values({
        displayName: input.name,
        mobileNumber: input.phone,
        email: input.email,
        role: "teacher",
        // Neither was confirmed — they filled a marketing form, not a signup.
        mobileVerified: false,
        emailVerified: false,
        isActive: true,
        onboardingCompleted: false,
        signupSource: DEMO_SIGNUP_SOURCE,
        // Same vocabulary the onboarding quiz uses, so the profile lines up.
        teachingCategories: [input.expertise],
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    await assignUserSlug(newUser.id, input.name);

    await db
      .updateTable("users")
      .set({ avatarUrl: `https://api.dicebear.com/9.x/fun-emoji/png?seed=${newUser.id}` })
      .where("id", "=", newUser.id)
      .execute();

    const freePlan = await db
      .selectFrom("subscriptionPlans")
      .select(["id", "durationDays"])
      .where("price", "=", "0")
      .where("isActive", "=", true)
      .executeTakeFirst();

    if (freePlan) {
      const now = new Date();
      await db
        .insertInto("teacherSubscriptions")
        .values({
          teacherId: newUser.id,
          planId: freePlan.id,
          status: "active",
          startDate: now,
          endDate: freePlan.durationDays
            ? new Date(now.getTime() + freePlan.durationDays * 24 * 60 * 60 * 1000)
            : null,
          nextChargeDate: null,
        })
        .execute();
    } else {
      console.warn(
        `No active free plan found (price = 0); demo teacher ${newUser.id} created without a subscription.`
      );
    }

    return newUser.id;
  } catch (error) {
    console.error("Failed to create teacher account for demo lead:", error);
    return null;
  }
}

// A repeat submission updates the existing lead instead of creating a second
// one; we only append another note if the last website note is older than this,
// so a double-click (or an impatient visitor) doesn't spam the sales rep.
const NOTE_DEDUPE_WINDOW_MS = 10 * 60 * 1000;

/**
 * How far into a slot we still accept a booking for it. The form only offers
 * slots that have not started yet, so this only ever absorbs the gap between
 * the visitor's clock and ours, plus the time they spent filling the form.
 */
const LATE_BOOKING_GRACE_MINUTES = 30;

export async function handle(request: Request): Promise<Response> {
  try {
    if (request.method !== "POST") {
      return new Response(superjson.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const phone = normalizeIndianMobile(input.phone);
    if (!phone) {
      return new Response(
        superjson.stringify({ error: "Enter a valid 10-digit mobile number" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const name = input.name.trim();
    const email = input.email?.trim() ? input.email.trim().toLowerCase() : null;
    const expertise = input.expertise;
    const { preferredDate, preferredSlot } = input;

    // The schema bounded the date against the caller's clock; ours is the one
    // that decides. A stale tab can otherwise book a slot that has gone by.
    if (
      preferredDate === istDateKey() &&
      demoCallSlotStartMinutes(preferredSlot) <
        istMinutesOfDay() - LATE_BOOKING_GRACE_MINUTES
    ) {
      return new Response(
        superjson.stringify({
          error: "That time has already passed today. Please pick another slot.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const callSlotLabel = formatDemoCallSlot(preferredDate, preferredSlot);

    const noteText = [
      "Requested a demo from the website popup.",
      `Wants a call on ${callSlotLabel}.`,
      `Expertise: ${expertise}.`,
      email ? `Email: ${email}.` : null,
      input.pageUrl ? `Page: ${input.pageUrl}` : null,
    ]
      .filter(Boolean)
      .join(" ");

    // If the phone (or email) belongs to an existing user, attach the demo
    // request to their pipeline row rather than creating a parallel lead.
    let matchedUserId: number | null = null;
    const userByPhone = await db
      .selectFrom("users")
      .select("id")
      .where("mobileNumber", "=", phone)
      .executeTakeFirst();
    if (userByPhone) {
      matchedUserId = userByPhone.id;
    } else if (email) {
      const userByEmail = await db
        .selectFrom("users")
        .select("id")
        .where("email", "=", email)
        .executeTakeFirst();
      if (userByEmail) {
        matchedUserId = userByEmail.id;
      }
    }

    // No existing account behind this number/email — stand one up as a teacher,
    // tagged as demo-sourced. From here the pipeline treats it like any signup.
    const createdNewAccount = matchedUserId === null;
    if (createdNewAccount) {
      matchedUserId = await createTeacherAccountForLead({
        name,
        phone,
        email,
        expertise,
      });
    }

    const { contactId, alreadyInPipeline, slotChanged } = await db
      .transaction()
      .execute(async (trx) => {
        // The date comes back as text so it compares directly with the date key
        // the visitor sent; as a Date it would be midnight in the server's zone.
        const existingColumns = [
          "id",
          "userId",
          sql<string | null>`to_char(sales_contacts.preferred_call_date, 'YYYY-MM-DD')`.as(
            "preferredCallDate"
          ),
          "preferredCallSlot",
        ] as const;

        let existing = matchedUserId
          ? await trx
              .selectFrom("salesContacts")
              .select(existingColumns)
              .where("userId", "=", matchedUserId)
              .executeTakeFirst()
          : undefined;

        if (!existing) {
          existing = await trx
            .selectFrom("salesContacts")
            .select(existingColumns)
            .where("leadPhone", "=", phone)
            .where("source", "=", "demo_request")
            .orderBy("id", "desc")
            .executeTakeFirst();
        }

        if (existing) {
          await trx
            .updateTable("salesContacts")
            .set({
              leadName: name,
              leadPhone: phone,
              leadExpertise: expertise,
              preferredCallDate: preferredDate,
              preferredCallSlot: preferredSlot,
              // The lead has just restated when they want to be called, so that
              // beats whatever was on the row - including a rep's own date. The
              // note below records the change so nobody loses track of it.
              followUpDate: preferredDate,
              updatedAt: new Date(),
              // Email is optional on the form — a later submission that leaves
              // it blank must not erase an address we already captured.
              ...(email ? { leadEmail: email } : {}),
              // Link an older account-less lead to the account we just made.
              ...(existing.userId === null && matchedUserId
                ? { userId: matchedUserId }
                : {}),
            })
            .where("id", "=", existing.id)
            .execute();

          return {
            contactId: existing.id,
            alreadyInPipeline: true,
            slotChanged:
              existing.preferredCallDate !== preferredDate ||
              existing.preferredCallSlot !== preferredSlot,
          };
        }

        const inserted = await trx
          .insertInto("salesContacts")
          .values({
            userId: matchedUserId,
            source: "demo_request",
            stage: "new",
            leadName: name,
            leadPhone: phone,
            leadEmail: email,
            leadExpertise: expertise,
            preferredCallDate: preferredDate,
            preferredCallSlot: preferredSlot,
            // Seeds the sales team's follow-up queue with the day the lead asked for.
            followUpDate: preferredDate,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning("id")
          .executeTakeFirstOrThrow();

        return {
          contactId: inserted.id,
          alreadyInPipeline: false,
          slotChanged: true,
        };
      });

    // Note + activity trail, outside the transaction so a note failure can
    // never cost us the lead itself.
    try {
      const lastWebsiteNote = await db
        .selectFrom("salesContactNotes")
        .select("createdAt")
        .where("salesContactId", "=", contactId)
        .where("createdBy", "=", LEAD_AUTHOR)
        .orderBy("createdAt", "desc")
        .executeTakeFirst();

      // A changed slot is never a double-click, and it is the one thing on this
      // form a rep has to act on, so it always gets its own note.
      const isDuplicateBurst =
        !slotChanged &&
        !!lastWebsiteNote?.createdAt &&
        Date.now() - new Date(lastWebsiteNote.createdAt).getTime() <
          NOTE_DEDUPE_WINDOW_MS;

      if (!isDuplicateBurst) {
        const accountNote = createdNewAccount
          ? matchedUserId
            ? " Teacher account created from this request."
            : " Teacher account could not be created — lead saved without one."
          : " Matched an existing account.";
        const repeatPrefix = slotChanged
          ? "Rescheduled demo request."
          : "Repeat demo request.";
        const note =
          (alreadyInPipeline ? `${repeatPrefix} ${noteText}` : noteText) + accountNote;

        await db
          .insertInto("salesContactNotes")
          .values({
            salesContactId: contactId,
            note,
            createdBy: LEAD_AUTHOR,
            disposition: null,
          })
          .execute();

        await db
          .insertInto("salesContactActivities")
          .values({
            salesContactId: contactId,
            activityType: "note_added",
            oldValue: null,
            newValue: null,
            details: note,
            createdBy: LEAD_AUTHOR,
          })
          .execute();
      }
    } catch (noteError) {
      console.error("Failed to log demo request note:", noteError);
    }

    sendTemplateEmail("contact_form_admin_alert", ADMIN_EMAIL, {
      name,
      email: email ?? "Not provided",
      phone,
      message: `Demo request from the website popup. Requested call: ${callSlotLabel}. Expertise: ${expertise}.${
        input.pageUrl ? ` Page: ${input.pageUrl}` : ""
      }`,
    }).catch((err) =>
      console.error("Failed to send demo request admin alert:", err)
    );

    return new Response(
      superjson.stringify({
        success: true,
        alreadyInPipeline,
      } satisfies OutputType),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Failed to submit demo request:", error);
    if (error instanceof ZodError) {
      return new Response(
        superjson.stringify({
          error: error.errors[0]?.message || "Invalid input provided",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "An unknown error occurred",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
