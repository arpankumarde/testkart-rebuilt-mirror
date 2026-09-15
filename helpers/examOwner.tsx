import type { Kysely } from "kysely";
import type { DB } from "./schema";

// An exam's owner is whoever last edited its content: saving or AI-generating
// any section draft copies that admin's name into owner_tag. A name picked by
// hand holds until the next content edit.
export async function setExamOwnerToEditor(executor: Kysely<DB>, examId: number, adminId: number) {
  const editor = await executor
    .selectFrom("admins")
    .select("fullName")
    .where("id", "=", adminId)
    .executeTakeFirst();
  if (!editor) return;
  await executor
    .updateTable("exams")
    .set({ ownerTag: editor.fullName })
    .where("id", "=", examId)
    .execute();
}