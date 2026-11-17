import type { Insertable, Kysely, Transaction, Updateable } from "kysely";
import type { DB, Students, Teachers } from "./schema";

/**
 * Account writes since the users split (testkart/misc/USER-SPLIT-SPEC.md, Phase 4): accounts are created and
 * edited in students or teachers, and a trigger copies each write into users (with the role) in the same
 * statement, so code that still reads users sees it straight away.
 */

export type AccountSide = "student" | "teacher";

type Executor = Kysely<DB> | Transaction<DB>;

export type NewAccount = {
  id: number;
  role: AccountSide;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  mobileNumber: string | null;
  mobileVerified: boolean;
};

const RETURNING = ["id", "email", "displayName", "avatarUrl", "mobileNumber", "mobileVerified"] as const;

export async function insertAccount(executor: Executor, side: "teacher", values: Insertable<Teachers>): Promise<NewAccount>;
export async function insertAccount(executor: Executor, side: AccountSide, values: Insertable<Students>): Promise<NewAccount>;
export async function insertAccount(
  executor: Executor,
  side: AccountSide,
  values: Insertable<Students> | Insertable<Teachers>
): Promise<NewAccount> {
  const row =
    side === "teacher"
      ? await executor
          .insertInto("teachers")
          .values(values as Insertable<Teachers>)
          .returning([...RETURNING])
          .executeTakeFirstOrThrow()
      : await executor
          .insertInto("students")
          .values(values as Insertable<Students>)
          .returning([...RETURNING])
          .executeTakeFirstOrThrow();
  return { ...row, role: side };
}

/**
 * Updates shared columns on an account when the caller does not know its side. Ids are unique across students
 * and teachers (both use users_id_seq), so at most one of the two updates matches. Returns the rows updated.
 */
export async function updateAccountById(executor: Executor, id: number, values: Updateable<Students>): Promise<number> {
  const [studentResult, teacherResult] = [
    await executor.updateTable("students").set(values).where("id", "=", id).executeTakeFirst(),
    await executor.updateTable("teachers").set(values).where("id", "=", id).executeTakeFirst(),
  ];
  return Number(studentResult.numUpdatedRows) + Number(teacherResult.numUpdatedRows);
}

export async function updateAccount(executor: Executor, side: "teacher", id: number, values: Updateable<Teachers>): Promise<void>;
export async function updateAccount(executor: Executor, side: AccountSide, id: number, values: Updateable<Students>): Promise<void>;
export async function updateAccount(
  executor: Executor,
  side: AccountSide,
  id: number,
  values: Updateable<Students> | Updateable<Teachers>
): Promise<void> {
  if (side === "teacher") {
    await executor.updateTable("teachers").set(values as Updateable<Teachers>).where("id", "=", id).execute();
  } else {
    await executor.updateTable("students").set(values as Updateable<Students>).where("id", "=", id).execute();
  }
}
