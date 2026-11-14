import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { AutopilotAiError } from "../../../helpers/autopilotAi";
import {
  COPY_EXAMPLES_KEY,
  MAX_LIVE_PER_STEP,
  cleanCopyText,
  customKey,
  draftCopyVariants,
  loadCopyState,
  stepOf,
  validateCopy,
  type CopyTemplate,
} from "../../../helpers/autopilotCopyVariants";
import { schema, OutputType } from "./copy-variants_POST.schema";

class ProblemsError extends Error {
  constructor(public problems: string[]) {
    super(problems[0] ?? "The copy breaks a rule");
  }
}

const clean = (copy: CopyTemplate): CopyTemplate => ({
  subject: cleanCopyText(copy.subject),
  heading: cleanCopyText(copy.heading),
  body: cleanCopyText(copy.body),
  cta: cleanCopyText(copy.cta),
});

function requireStep(playbookKey: string, step: number) {
  const found = stepOf(playbookKey, step);
  if (!found) throw new Error("That playbook step does not exist");
  return found;
}

function checked(copy: CopyTemplate, playbookKey: string, step: number): CopyTemplate {
  const { offer } = requireStep(playbookKey, step);
  const cleaned = clean(copy);
  const problems = validateCopy(cleaned, playbookKey, offer);
  if (problems.length > 0) throw new ProblemsError(problems);
  return cleaned;
}

/** Takes a live version out of a step's rotation; at least one must stay live. */
async function retireKey(playbookKey: string, step: number, key: string, adminId: number, now: Date, liveAfterChange: string[]) {
  if (!liveAfterChange.includes(key)) throw new Error(`Version ${key} is not live on this step`);
  if (liveAfterChange.length <= 1) throw new Error("A step needs at least one live version");
  if (key === "a" || key === "b") {
    await db
      .insertInto("revCopyVariants")
      .values({ playbookKey, step, builtinKey: key, source: "builtin", status: "retired", decidedByAdminId: adminId, retiredAt: now })
      .onConflict((oc) =>
        oc.columns(["playbookKey", "step", "builtinKey"]).where("builtinKey", "is not", null).doUpdateSet({
          status: "retired",
          decidedByAdminId: adminId,
          retiredAt: now,
          updatedAt: now,
        })
      )
      .execute();
    return;
  }
  await db
    .updateTable("revCopyVariants")
    .set({ status: "retired", retiredAt: now, decidedByAdminId: adminId, updatedAt: now })
    .where("id", "=", Number(key.slice(1)))
    .where("playbookKey", "=", playbookKey)
    .where("step", "=", step)
    .execute();
}

/** Admin (autopilot module): drafts, edits and approvals of autopilot email versions. */
export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const now = new Date();

    if (input.action === "examples") {
      const examples = input.examples.map((e) => e.trim()).filter(Boolean);
      const value = JSON.stringify(examples);
      const updated = await db
        .updateTable("platformSettings")
        .set({ settingValue: value })
        .where("settingKey", "=", COPY_EXAMPLES_KEY)
        .returning("id")
        .executeTakeFirst();
      if (!updated) await db.insertInto("platformSettings").values({ settingKey: COPY_EXAMPLES_KEY, settingValue: value }).execute();
      return new Response(superjson.stringify({ ok: true, message: `${examples.length} proven messages saved` } satisfies OutputType));
    }

    if (input.action === "draft") {
      requireStep(input.playbookKey, input.step);
      const result = await draftCopyVariants({
        playbookKey: input.playbookKey,
        step: input.step,
        count: input.count,
        brief: input.brief?.trim() || null,
        adminId: admin.id,
      });
      const message =
        result.saved.length > 0
          ? `${result.saved.length} new draft${result.saved.length === 1 ? "" : "s"} to review`
          : "The AI's drafts all broke a rule, so none were saved";
      return new Response(superjson.stringify({ ok: true, message, rejected: result.rejected } satisfies OutputType));
    }

    if (input.action === "create") {
      const copy = checked(input.copy, input.playbookKey, input.step);
      await db
        .insertInto("revCopyVariants")
        .values({ playbookKey: input.playbookKey, step: input.step, status: "draft", source: "admin", ...copy, createdByAdminId: admin.id })
        .execute();
      return new Response(superjson.stringify({ ok: true, message: "Draft saved" } satisfies OutputType));
    }

    if (input.action === "retire") {
      requireStep(input.playbookKey, input.step);
      const state = await loadCopyState();
      await retireKey(input.playbookKey, input.step, input.key, admin.id, now, state.liveKeys(input.playbookKey, input.step));
      return new Response(superjson.stringify({ ok: true, message: "Version taken out of rotation" } satisfies OutputType));
    }

    if (input.action === "restore") {
      requireStep(input.playbookKey, input.step);
      const state = await loadCopyState();
      const live = state.liveKeys(input.playbookKey, input.step);
      if (live.includes(input.key)) throw new Error("That version is already live");
      if (live.length >= MAX_LIVE_PER_STEP) {
        if (!input.retireKey) throw new Error(`This step already has ${MAX_LIVE_PER_STEP} live versions; choose one to take out`);
        await retireKey(input.playbookKey, input.step, input.retireKey, admin.id, now, live);
      }
      if (input.key === "a" || input.key === "b") {
        await db
          .deleteFrom("revCopyVariants")
          .where("playbookKey", "=", input.playbookKey)
          .where("step", "=", input.step)
          .where("builtinKey", "=", input.key)
          .execute();
      } else {
        await db
          .updateTable("revCopyVariants")
          .set({ status: "live", liveAt: now, retiredAt: null, decidedByAdminId: admin.id, updatedAt: now })
          .where("id", "=", Number(input.key.slice(1)))
          .where("playbookKey", "=", input.playbookKey)
          .where("step", "=", input.step)
          .where("status", "=", "retired")
          .execute();
      }
      return new Response(superjson.stringify({ ok: true, message: "Version back in rotation" } satisfies OutputType));
    }

    const row = await db.selectFrom("revCopyVariants").selectAll().where("id", "=", input.id).executeTakeFirst();
    if (!row || row.source === "builtin") throw new Error("That draft no longer exists");
    if (row.status !== "draft") throw new Error("Only drafts can be changed this way");

    if (input.action === "edit") {
      const copy = checked(input.copy, row.playbookKey, row.step);
      await db.updateTable("revCopyVariants").set({ ...copy, updatedAt: now }).where("id", "=", row.id).execute();
      return new Response(superjson.stringify({ ok: true, message: "Draft updated" } satisfies OutputType));
    }

    if (input.action === "reject") {
      await db
        .updateTable("revCopyVariants")
        .set({ status: "rejected", decidedByAdminId: admin.id, updatedAt: now })
        .where("id", "=", row.id)
        .execute();
      return new Response(superjson.stringify({ ok: true, message: "Draft rejected" } satisfies OutputType));
    }

    checked({ subject: row.subject ?? "", heading: row.heading ?? "", body: row.body ?? "", cta: row.cta ?? "" }, row.playbookKey, row.step);
    const state = await loadCopyState();
    const live = state.liveKeys(row.playbookKey, row.step);
    if (live.length >= MAX_LIVE_PER_STEP) {
      if (!input.retireKey) throw new Error(`This step already has ${MAX_LIVE_PER_STEP} live versions; choose one to take out`);
      await retireKey(row.playbookKey, row.step, input.retireKey, admin.id, now, live);
    }
    await db
      .updateTable("revCopyVariants")
      .set({ status: "live", liveAt: now, decidedByAdminId: admin.id, updatedAt: now })
      .where("id", "=", row.id)
      .execute();
    console.log(`Autopilot copy ${customKey(row.id)} for ${row.playbookKey} step ${row.step} put live by admin ${admin.id}`);
    return new Response(superjson.stringify({ ok: true, message: "Draft is live and joins the rotation" } satisfies OutputType));
  } catch (error) {
    if (error instanceof ProblemsError) {
      return new Response(superjson.stringify({ error: error.message, problems: error.problems }), { status: 400 });
    }
    if (error instanceof AutopilotAiError) {
      const status = error.code === "OUT_OF_CREDITS" ? 503 : error.code === "UPSTREAM" ? 502 : 400;
      return new Response(superjson.stringify({ error: error.message }), { status });
    }
    const message = error instanceof Error ? error.message : "Could not save";
    const status = /authenticat/i.test(message) ? 401 : /access/i.test(message) ? 403 : 400;
    if (status === 400 && !(error instanceof Error)) console.error("Autopilot copy action failed:", error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}
