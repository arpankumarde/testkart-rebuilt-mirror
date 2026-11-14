import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { getAutopilotSettings } from "../../../helpers/getAutopilotSettings";
import { AUTOPILOT_PLAYBOOKS } from "../../../helpers/autopilotPlaybooks";
import {
  MAX_LIVE_PER_STEP,
  SAMPLE_EXPIRY,
  allowedPlaceholders,
  customKey,
  getCopyExamples,
  renderCopy,
  sampleContext,
  variantStats,
  type CopyRow,
} from "../../../helpers/autopilotCopyVariants";
import { schema, OutputType, CopyStep, CopyVariant } from "./copy-variants_GET.schema";

const delayLabel = (minutes: number) =>
  minutes === 0
    ? "straight away"
    : minutes < 60
      ? `after ${minutes} minutes`
      : minutes < 48 * 60
        ? `after ${Math.round(minutes / 60)} hours`
        : `after ${Math.round(minutes / 1440)} days`;

const STATUS_ORDER: Record<string, number> = { live: 0, draft: 1, retired: 2, rejected: 3 };

/** Admin (autopilot module): each playbook step's email versions, for the Messages tab. */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    schema.parse({});
    const [rows, stats, examples, settings] = await Promise.all([
      db.selectFrom("revCopyVariants").selectAll().orderBy("id", "desc").execute() as unknown as Promise<CopyRow[]>,
      variantStats(),
      getCopyExamples(),
      getAutopilotSettings(),
    ]);

    const steps: CopyStep[] = [];
    for (const playbook of AUTOPILOT_PLAYBOOKS) {
      const sample = sampleContext(playbook.key);
      playbook.steps.forEach((stepDef, index) => {
        const step = index + 1;
        const offer = stepDef.offer === true;
        const coins = offer ? 40 : 0;
        const stepStats = stats.get(`${playbook.key}:${step}`) ?? [];
        const statFor = (key: string) => stepStats.find((s) => s.key === key) ?? { sends: 0, conversions: 0 };
        const stepRows = rows.filter((r) => r.playbookKey === playbook.key && r.step === step);

        const variants: CopyVariant[] = (["a", "b"] as const).map((key) => {
          const copy = stepDef.variants[key](sample, coins, SAMPLE_EXPIRY);
          const retired = stepRows.some((r) => r.source === "builtin" && r.builtinKey === key && r.status === "retired");
          return {
            key,
            kind: "builtin",
            id: null,
            status: retired ? "retired" : "live",
            source: "builtin",
            template: copy,
            preview: copy,
            ...statFor(key),
            brief: null,
            aiModel: null,
            createdAt: null,
          };
        });
        for (const row of stepRows.filter((r) => r.source !== "builtin")) {
          const template = { subject: row.subject ?? "", heading: row.heading ?? "", body: row.body ?? "", cta: row.cta ?? "" };
          const key = customKey(row.id);
          variants.push({
            key,
            kind: "custom",
            id: row.id,
            status: row.status as CopyVariant["status"],
            source: row.source === "admin" ? "admin" : "ai",
            template,
            preview: renderCopy(template, sample, coins, SAMPLE_EXPIRY),
            ...statFor(key),
            brief: row.brief,
            aiModel: row.aiModel,
            createdAt: row.createdAt,
          });
        }
        variants.sort((x, y) => (STATUS_ORDER[x.status] ?? 9) - (STATUS_ORDER[y.status] ?? 9));

        steps.push({
          playbookKey: playbook.key,
          playbookLabel: playbook.label,
          step,
          totalSteps: playbook.steps.length,
          offer,
          delayLabel: delayLabel(stepDef.delayMinutes),
          placeholders: allowedPlaceholders(playbook.key, offer),
          variants,
        });
      });
    }

    return new Response(
      superjson.stringify({ steps, examples, maxLivePerStep: MAX_LIVE_PER_STEP, aiProvider: settings.aiProvider } satisfies OutputType)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the message versions";
    const status = /authenticat/i.test(message) ? 401 : /access/i.test(message) ? 403 : 500;
    if (status === 500) console.error("Autopilot copy variants failed:", error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}
