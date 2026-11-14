import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Skeleton } from "./Skeleton";
import { useAutopilotCopyAction, useAutopilotCopyVariants } from "../helpers/useAdminAutopilot";
import type { CopyFields, CopyStep, CopyVariant } from "../endpoints/admin/autopilot/copy-variants_GET.schema";
import type { InputType as CopyActionInput } from "../endpoints/admin/autopilot/copy-variants_POST.schema";
import styles from "./AutopilotCopyVariants.module.css";

const LIMITS: CopyFields = { subject: "90", heading: "80", body: "420", cta: "30" };
const FIELD_LABELS: Record<keyof CopyFields, string> = { subject: "Subject", heading: "Heading", body: "Body", cta: "Button" };
const PLACEHOLDER_HELP: Record<string, string> = {
  name: "first name",
  item: "series or product title",
  amount: "price, like Rs 99",
  exam: "chosen exam",
  offer: "the Tcoins sentence (required here)",
};
const EXAMPLE_SEPARATOR = "\n---\n";

type ActionError = Error & { problems?: string[] };

function Preview({ copy }: { copy: CopyFields }) {
  return (
    <div className={styles.preview}>
      <div className={styles.subject}>{copy.subject}</div>
      <div className={styles.heading}>{copy.heading}</div>
      <p className={styles.body}>{copy.body}</p>
      <span className={styles.cta}>{copy.cta}</span>
    </div>
  );
}

function Results({ variant }: { variant: CopyVariant }) {
  if (variant.sends === 0) return <span className={styles.meta}>Not sent yet</span>;
  const rate = Math.round((variant.conversions / variant.sends) * 1000) / 10;
  return (
    <span className={styles.meta}>
      {variant.sends.toLocaleString("en-IN")} sent, {variant.conversions} paid within 72 hours ({rate}%)
    </span>
  );
}

function sourceLabel(variant: CopyVariant) {
  if (variant.kind === "builtin") return `Built-in ${variant.key.toUpperCase()}`;
  return variant.source === "ai" ? "AI draft" : "Written by admin";
}

function CopyForm({
  initial,
  placeholders,
  saving,
  problems,
  onSave,
  onCancel,
}: {
  initial: CopyFields;
  placeholders: string[];
  saving: boolean;
  problems: string[];
  onSave: (copy: CopyFields) => void;
  onCancel: () => void;
}) {
  const [copy, setCopy] = useState<CopyFields>(initial);
  return (
    <div className={styles.form}>
      {(Object.keys(FIELD_LABELS) as (keyof CopyFields)[]).map((field) => (
        <label key={field} className={styles.field}>
          <span className={styles.fieldLabel}>
            {FIELD_LABELS[field]}
            <span className={styles.counter}>
              {copy[field].length}/{LIMITS[field]}
            </span>
          </span>
          {field === "body" ? (
            <Textarea rows={4} value={copy.body} onChange={(e) => setCopy({ ...copy, body: e.target.value })} disabled={saving} />
          ) : (
            <Input value={copy[field]} onChange={(e) => setCopy({ ...copy, [field]: e.target.value })} disabled={saving} />
          )}
        </label>
      ))}
      <p className={styles.hint}>
        Fill-ins: {placeholders.map((p) => `{${p}} ${PLACEHOLDER_HELP[p] ?? ""}`).join(", ")}.
      </p>
      {problems.length > 0 ? (
        <ul className={styles.problems}>
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
      <div className={styles.actions}>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => onSave(copy)} disabled={saving}>
          {saving ? "Saving..." : "Save draft"}
        </Button>
      </div>
    </div>
  );
}

function StepPanel({ step, maxLive }: { step: CopyStep; maxLive: number }) {
  const action = useAutopilotCopyAction();
  const [count, setCount] = useState(2);
  const [brief, setBrief] = useState("");
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [formProblems, setFormProblems] = useState<string[]>([]);
  const [replaceKey, setReplaceKey] = useState<Record<number, string>>({});
  const [aiRejected, setAiRejected] = useState<{ copy: CopyFields; problems: string[] }[]>([]);
  const [showRetired, setShowRetired] = useState(false);

  useEffect(() => {
    setEditing(null);
    setFormProblems([]);
    setAiRejected([]);
    setBrief("");
  }, [step.playbookKey, step.step]);

  const live = step.variants.filter((v) => v.status === "live");
  const drafts = step.variants.filter((v) => v.status === "draft");
  const retired = step.variants.filter((v) => v.status === "retired" || v.status === "rejected");
  const atCap = live.length >= maxLive;

  const run = (body: CopyActionInput, after?: () => void) =>
    action.mutate(body, {
      onSuccess: (result) => {
        toast(result.message);
        setFormProblems([]);
        if (body.action === "draft") setAiRejected(result.rejected ?? []);
        after?.();
      },
      onError: (error) => {
        const problems = (error as ActionError).problems ?? [];
        if (problems.length > 0) setFormProblems(problems);
        else toast.error(error instanceof Error ? error.message : "Could not save");
      },
    });

  return (
    <div className={styles.stepPanel}>
      <div className={styles.stepHead}>
        <div>
          <div className={styles.stepTitle}>
            {step.playbookLabel}: message {step.step} of {step.totalSteps}
          </div>
          <div className={styles.meta}>
            Sent {step.delayLabel}
            {step.offer ? ", carries the Tcoins offer" : ""}. Up to {maxLive} versions run side by side; the better one gets more sends.
          </div>
        </div>
      </div>

      <section className={styles.group}>
        <h3 className={styles.groupTitle}>Live now</h3>
        <div className={styles.grid}>
          {live.map((variant) => (
            <article key={variant.key} className={styles.item}>
              <div className={styles.itemHead}>
                <Badge variant="success">{sourceLabel(variant)}</Badge>
                <Results variant={variant} />
              </div>
              <Preview copy={variant.preview} />
              <div className={styles.actions}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={live.length <= 1 || action.isPending}
                  onClick={() => run({ action: "retire", playbookKey: step.playbookKey, step: step.step, key: variant.key })}
                >
                  Take out
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.group}>
        <h3 className={styles.groupTitle}>New versions</h3>
        <div className={styles.drafter}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>What to try (optional)</span>
            <Input
              placeholder="For example: lead with the saved order, mention UPI, sound like a friend"
              value={brief}
              maxLength={500}
              onChange={(e) => setBrief(e.target.value)}
              disabled={action.isPending}
            />
          </label>
          <label className={styles.fieldSmall}>
            <span className={styles.fieldLabel}>How many</span>
            <select className={styles.select} value={count} onChange={(e) => setCount(Number(e.target.value))} disabled={action.isPending}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          <div className={styles.drafterButtons}>
            <Button
              size="sm"
              disabled={action.isPending}
              onClick={() =>
                run({ action: "draft", playbookKey: step.playbookKey, step: step.step, count, brief: brief.trim() || undefined })
              }
            >
              {action.isPending && action.variables?.action === "draft" ? "Drafting..." : "Draft with AI"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={action.isPending}
              onClick={() => {
                setFormProblems([]);
                setEditing("new");
              }}
            >
              Write my own
            </Button>
          </div>
        </div>
        <p className={styles.hint}>
          The AI sees this step's live versions and their results, and the proven messages below. Drafts that use pressure
          words, emojis, links or money claims are thrown away; only the {"{offer}"} fill-in may mention Tcoins.
        </p>

        {editing === "new" ? (
          <CopyForm
            initial={{ subject: "", heading: "", body: step.offer ? " {offer}" : "", cta: "" }}
            placeholders={step.placeholders}
            saving={action.isPending}
            problems={formProblems}
            onCancel={() => setEditing(null)}
            onSave={(copy) => run({ action: "create", playbookKey: step.playbookKey, step: step.step, copy }, () => setEditing(null))}
          />
        ) : null}

        {aiRejected.length > 0 ? (
          <div className={styles.rejectedBox}>
            <div className={styles.fieldLabel}>Not saved because they broke a rule</div>
            {aiRejected.map((item, index) => (
              <div key={index} className={styles.rejectedItem}>
                <div className={styles.meta}>{item.copy.subject}</div>
                <div className={styles.meta}>{item.problems.join("; ")}</div>
              </div>
            ))}
          </div>
        ) : null}

        {drafts.length === 0 && editing !== "new" ? <p className={styles.meta}>No drafts waiting.</p> : null}
        <div className={styles.grid}>
          {drafts.map((variant) =>
            editing === variant.id ? (
              <article key={variant.key} className={styles.item}>
                <CopyForm
                  initial={variant.template}
                  placeholders={step.placeholders}
                  saving={action.isPending}
                  problems={formProblems}
                  onCancel={() => setEditing(null)}
                  onSave={(copy) => run({ action: "edit", id: variant.id!, copy }, () => setEditing(null))}
                />
              </article>
            ) : (
              <article key={variant.key} className={styles.item}>
                <div className={styles.itemHead}>
                  <Badge variant="warning">{sourceLabel(variant)}</Badge>
                  {variant.brief ? <span className={styles.meta}>Asked for: {variant.brief}</span> : null}
                </div>
                <Preview copy={variant.preview} />
                {atCap ? (
                  <label className={styles.replaceRow}>
                    <span className={styles.meta}>Replaces</span>
                    <select
                      className={styles.select}
                      value={replaceKey[variant.id!] ?? ""}
                      onChange={(e) => setReplaceKey({ ...replaceKey, [variant.id!]: e.target.value })}
                    >
                      <option value="">Choose a live version</option>
                      {live.map((l) => (
                        <option key={l.key} value={l.key}>
                          {sourceLabel(l)}: {l.preview.subject.slice(0, 40)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className={styles.actions}>
                  <Button size="sm" variant="ghost" disabled={action.isPending} onClick={() => run({ action: "reject", id: variant.id! })}>
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={action.isPending}
                    onClick={() => {
                      setFormProblems([]);
                      setEditing(variant.id);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    disabled={action.isPending || (atCap && !replaceKey[variant.id!])}
                    onClick={() =>
                      run({ action: "approve", id: variant.id!, retireKey: atCap ? replaceKey[variant.id!] : undefined })
                    }
                  >
                    Approve
                  </Button>
                </div>
              </article>
            )
          )}
        </div>
      </section>

      {retired.length > 0 ? (
        <section className={styles.group}>
          <button type="button" className={styles.linkButton} onClick={() => setShowRetired(!showRetired)}>
            {showRetired ? "Hide" : "Show"} {retired.length} retired or rejected
          </button>
          {showRetired ? (
            <div className={styles.grid}>
              {retired.map((variant) => (
                <article key={variant.key} className={styles.item}>
                  <div className={styles.itemHead}>
                    <Badge variant="outline">
                      {sourceLabel(variant)}, {variant.status}
                    </Badge>
                    <Results variant={variant} />
                  </div>
                  <Preview copy={variant.preview} />
                  {variant.status === "retired" && !atCap ? (
                    <div className={styles.actions}>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={action.isPending}
                        onClick={() => run({ action: "restore", playbookKey: step.playbookKey, step: step.step, key: variant.key })}
                      >
                        Put back live
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function ProvenMessages({ examples }: { examples: string[] }) {
  const action = useAutopilotCopyAction();
  const [text, setText] = useState(examples.join(EXAMPLE_SEPARATOR));
  useEffect(() => setText(examples.join(EXAMPLE_SEPARATOR)), [examples]);
  const parsed = text
    .split(/\n-{3,}\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <div className={styles.form}>
      <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} disabled={action.isPending} />
      <div className={styles.actions}>
        <span className={styles.meta}>
          {parsed.length} message{parsed.length === 1 ? "" : "s"}. Put a line with --- between messages.
        </span>
        <Button
          size="sm"
          disabled={action.isPending || parsed.join() === examples.join()}
          onClick={() =>
            action.mutate(
              { action: "examples", examples: parsed },
              {
                onSuccess: (result) => toast(result.message),
                onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
              }
            )
          }
        >
          {action.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

/** Messages tab of /admin/autopilot: AI and admin drafts of each step's email copy, approval and rotation. */
export function AutopilotCopyVariants({ active }: { active: boolean }) {
  const query = useAutopilotCopyVariants(active);
  const data = query.data;
  const [selected, setSelected] = useState<string>("");

  const steps = data?.steps ?? [];
  const current = useMemo(
    () => steps.find((s) => `${s.playbookKey}:${s.step}` === selected) ?? steps[0] ?? null,
    [steps, selected]
  );
  const groups = useMemo(() => {
    const map = new Map<string, CopyStep[]>();
    for (const s of steps) map.set(s.playbookLabel, [...(map.get(s.playbookLabel) ?? []), s]);
    return [...map.entries()];
  }, [steps]);

  if (query.error) {
    return <div className={styles.errorBox}>{query.error instanceof Error ? query.error.message : "Could not load"}</div>;
  }
  if (!data || !current) return <Skeleton className={styles.skeleton} />;

  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <div className={styles.pickerRow}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Email message</span>
            <select
              className={styles.select}
              value={`${current.playbookKey}:${current.step}`}
              onChange={(e) => setSelected(e.target.value)}
            >
              {groups.map(([label, list]) => (
                <optgroup key={label} label={label}>
                  {list.map((s) => {
                    const drafts = s.variants.filter((v) => v.status === "draft").length;
                    return (
                      <option key={`${s.playbookKey}:${s.step}`} value={`${s.playbookKey}:${s.step}`}>
                        Message {s.step} ({s.delayLabel}){drafts > 0 ? ` - ${drafts} draft${drafts === 1 ? "" : "s"}` : ""}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
          </label>
          <span className={styles.meta}>
            Drafts use {data.aiProvider === "floot" ? "Floot AI" : "our DeepSeek model"}; change it in Settings. WhatsApp messages use
            Meta-approved templates and are not drafted here.
          </span>
        </div>
        <StepPanel step={current} maxLive={data.maxLivePerStep} />
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Proven messages</h2>
        <p className={styles.meta}>
          Messages that worked for us or that we like, from any brand or channel. The AI copies their tone and directness, not
          their words.
        </p>
        <ProvenMessages examples={data.examples} />
      </section>
    </div>
  );
}
