import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    
    const json = superjson.parse(await request.text());
    const result = schema.parse(json);

    await db.transaction().execute(async (trx) => {
      const updateData: {
        stage?: typeof result.stage;
        assignedToAdminId?: number | null;
        followUpDate?: Date | null;
        lastContactedAt?: Date;
        updatedAt: Date;
      } = { updatedAt: new Date() };

      if (result.stage) {
        updateData.stage = result.stage;
      }

      if (result.assignedToAdminId !== undefined) {
        updateData.assignedToAdminId = result.assignedToAdminId;
      }

      if (result.followUpDate !== undefined) {
        updateData.followUpDate = result.followUpDate ? new Date(result.followUpDate) : null;
      }

      if (result.note) {
        updateData.lastContactedAt = new Date();
      }

      const activities: {
        activityType: "stage_changed" | "assignment_changed" | "follow_up_changed" | "note_added" | "call_logged";
        details: string | null;
        newValue: string | null;
        oldValue: string | null;
      }[] = [];

      // Fetch current contact values BEFORE making the update to compare
      const currentContact = await trx
        .selectFrom("salesContacts")
        .select(["stage", "assignedToAdminId", "followUpDate"])
        .where("id", "=", result.contactId)
        .executeTakeFirst();

      if (!currentContact) {
        throw new Error("Sales contact not found");
      }

      // 1. Stage change
      if (result.stage && result.stage !== currentContact.stage) {
        activities.push({
          activityType: "stage_changed",
          oldValue: currentContact.stage,
          newValue: result.stage,
          details: null,
        });
      }

      // 2. Assignment change
      if (result.assignedToAdminId !== undefined) {
        const oldAssignedToAdminId = currentContact.assignedToAdminId;
        const newAssignedToAdminId = result.assignedToAdminId;

        if (oldAssignedToAdminId !== newAssignedToAdminId) {
          let oldAdminName = "Unassigned";
          let newAdminName = "Unassigned";

          if (oldAssignedToAdminId) {
            const oldAdmin = await trx
              .selectFrom("admins")
              .select("fullName")
              .where("id", "=", oldAssignedToAdminId)
              .executeTakeFirst();
            if (oldAdmin) {
              oldAdminName = oldAdmin.fullName;
            }
          }

          if (newAssignedToAdminId) {
            const newAdmin = await trx
              .selectFrom("admins")
              .select("fullName")
              .where("id", "=", newAssignedToAdminId)
              .executeTakeFirst();
            if (newAdmin) {
              newAdminName = newAdmin.fullName;
            }
          }

          activities.push({
            activityType: "assignment_changed",
            oldValue: oldAdminName,
            newValue: newAdminName,
            details: null,
          });
        }
      }

      // 3. Follow-up date change
      if (result.followUpDate !== undefined) {
        const oldDate = currentContact.followUpDate;
        const newDate = result.followUpDate ? new Date(result.followUpDate) : null;
        const oldDateStr = oldDate ? new Date(oldDate).toISOString() : null;
        const newDateStr = newDate ? newDate.toISOString() : null;

        if (oldDateStr !== newDateStr) {
          activities.push({
            activityType: "follow_up_changed",
            oldValue: oldDateStr,
            newValue: newDateStr,
            details: null,
          });
        }
      }

      await trx
        .updateTable("salesContacts")
        .set(updateData)
        .where("id", "=", result.contactId)
        .execute();

      // Insert note if provided
      if (result.note) {
        await trx
          .insertInto("salesContactNotes")
          .values({
            salesContactId: result.contactId,
            note: result.note,
            createdBy: admin.fullName,
            disposition: result.disposition || null,
          })
          .execute();

        // 4. Note added activity
        activities.push({
          activityType: "note_added",
          oldValue: null,
          newValue: result.disposition || null,
          details: result.note,
        });

        // 5. Call logged activity (if disposition is present with a note)
        if (result.disposition) {
          activities.push({
            activityType: "call_logged",
            oldValue: null,
            newValue: result.disposition,
            details: result.note,
          });
        }
      }

      // Insert all collected activities
      if (activities.length > 0) {
        await trx
          .insertInto("salesContactActivities")
          .values(
            activities.map((activity) => ({
              salesContactId: result.contactId,
              activityType: activity.activityType,
              createdBy: admin.fullName,
              oldValue: activity.oldValue,
              newValue: activity.newValue,
              details: activity.details,
            }))
          )
          .execute();
      }
    });

    return new Response(superjson.stringify({ success: true } satisfies OutputType), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error updating sales contact:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}