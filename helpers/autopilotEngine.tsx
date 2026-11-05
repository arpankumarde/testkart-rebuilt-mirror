import { sql } from "kysely";
import { db } from "./db";
import { getAutopilotSettings, type AutopilotSettings } from "./getAutopilotSettings";
import { isInGlobalHoldout } from "./isInGlobalHoldout";
import { nextSendTime, offerCoins, pickVariant, type VariantStats } from "./autopilotRules";
import { AUTOPILOT_PLAYBOOKS, type Playbook, type PlaybookContext } from "./autopilotPlaybooks";
import { createMessageLink } from "./createMessageLink";
import { sendEmail } from "./sendEmail";
import { getBrandedEmailHtml } from "./emailBaseTemplate";
import { unsubscribeHeaders, unsubscribePageUrl } from "./emailUnsubscribe";
import {
  chooseChannel,
  emailFallback,
  sendPush,
  sendWhatsAppTemplate,
  type ChannelChoice,
  type SendOutcome,
} from "./autopilotChannels";

/**
 * The autopilot's engine, run by the autopilotHourly job every 15 minutes:
 * 1. enrol: each playbook's triggers become rev_enrolments rows, with the
 *    global holdout decided once per enrolment (holdout users never get a
 *    message, so the playbook's lift can be measured against them);
 * 2. dispatch: due steps go out through the guardrails, in this order: still
 *    relevant (no success yet), quiet hours, daily and weekly caps, a reachable
 *    channel, then the variant (Thompson sampling on paid conversions) and the
 *    offer (Tcoins within the margin rule and the daily budget).
 * Shadow mode logs every message it would send (rev_messages.shadow) and sends
 * nothing. Channels come from helpers/autopilotChannels: WhatsApp when the
 * student said yes and an approved template is set for the playbook, else
 * email (app push is wired but unused while the app registers no tokens).
 * Every send is awaited and failures are recorded, never thrown.
 */

type Row = Record<string, unknown>;
const pick = (row: Row | undefined, snake: string): unknown =>
  !row ? undefined : snake in row ? row[snake] : row[snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())];
const num = (row: Row | undefined, key: string) => Number(pick(row, key) ?? 0) || 0;

const MAX_DISPATCH_PER_RUN = 150;
const GIVE_UP_AFTER_DAYS = 14;
const PLAYBOOKS = new Map(AUTOPILOT_PLAYBOOKS.map((playbook) => [playbook.key, playbook]));
const DAY_MS = 24 * 60 * 60 * 1000;

export async function enrolTriggers(settings: AutopilotSettings): Promise<number> {
  let enrolled = 0;
  for (const playbook of AUTOPILOT_PLAYBOOKS) {
    try {
      const triggers = await playbook.findTriggers();
      const seen = new Set<number>();
      for (const trigger of triggers) {
        if (seen.has(trigger.userId)) continue;
        seen.add(trigger.userId);
        const firstDue = new Date(trigger.at.getTime() + playbook.steps[0].delayMinutes * 60 * 1000);
        const inserted = await db
          .insertInto("revEnrolments")
          .values({
            userId: trigger.userId,
            playbookKey: playbook.key,
            triggerRef: trigger.ref,
            triggerAt: trigger.at,
            context: trigger.context,
            isHoldout: isInGlobalHoldout(trigger.userId, settings.holdoutSalt, settings.holdoutPercent),
            nextStep: 1,
            nextDueAt: firstDue,
          })
          .onConflict((oc) => oc.columns(["playbookKey", "triggerRef"]).doNothing())
          .returning("id")
          .executeTakeFirst();
        if (inserted) enrolled++;
      }
    } catch (error) {
      console.error(`[autopilot] enrolling ${playbook.key} failed:`, error);
    }
  }
  return enrolled;
}

/** The success the playbook is judged on, reached since the enrolment's trigger. */
async function reachedGoal(playbook: Playbook, userId: number, since: Date): Promise<{ orderId: number | null } | null> {
  if (playbook.goal === "first_attempt") {
    const attempt = await db
      .selectFrom("testAttempts")
      .select("id")
      .where("studentId", "=", userId)
      .executeTakeFirst();
    if (attempt) return { orderId: null };
  }
  const order = await db
    .selectFrom("orders")
    .select("id")
    .where("userId", "=", userId)
    .where("status", "=", "completed")
    .where("totalAmount", ">", "0")
    .where("createdAt", ">=", since)
    .orderBy("createdAt", "asc")
    .executeTakeFirst();
  return order ? { orderId: order.id } : null;
}

async function variantStats(): Promise<Map<string, VariantStats[]>> {
  const rows = await sql<Row>`
    SELECT m.playbook_key, m.step, m.variant_key,
      count(*)::int AS sends,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM orders o WHERE o.user_id = m.user_id AND o.status = 'completed' AND o.total_amount > 0
          AND o.created_at >= m.sent_at AND o.created_at < m.sent_at + interval '72 hours'))::int AS conversions
    FROM rev_messages m
    WHERE m.shadow = false AND m.sent_at IS NOT NULL AND m.variant_key IS NOT NULL
      AND m.sent_at > now() - interval '90 days'
    GROUP BY 1, 2, 3
  `.execute(db);
  const stats = new Map<string, VariantStats[]>();
  for (const row of rows.rows) {
    const key = `${pick(row, "playbook_key")}:${num(row, "step")}`;
    const list = stats.get(key) ?? [];
    list.push({ key: String(pick(row, "variant_key")), sends: num(row, "sends"), conversions: num(row, "conversions") });
    stats.set(key, list);
  }
  return stats;
}

/** Messages that count toward the caps: real sends, or in shadow mode the ones it would have sent. */
async function messagesSentRecently(userId: number, shadow: boolean): Promise<{ day: number; week: number }> {
  const result = await sql<Row>`
    SELECT count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS day,
           count(*)::int AS week
    FROM rev_messages
    WHERE user_id = ${userId} AND shadow = ${shadow} AND created_at > now() - interval '7 days'
      AND (${shadow} AND error = 'shadow' OR NOT ${shadow} AND status <> 'skipped'::rev_message_status)
  `.execute(db);
  return { day: num(result.rows[0], "day"), week: num(result.rows[0], "week") };
}

async function reachableEmail(userId: number): Promise<string | null> {
  const user = await db
    .selectFrom("users")
    .select(["email", "emailBouncedAt", "isActive"])
    .where("id", "=", userId)
    .executeTakeFirst();
  const email = user?.email?.trim();
  if (!user || user.isActive === false || !email || user.emailBouncedAt) return null;
  if (/@mail\.testkart\.in$/i.test(email)) return null;
  const unsubscribed = await db
    .selectFrom("emailUnsubscribes")
    .select("userId")
    .where("userId", "=", userId)
    .where("list", "=", "student_marketing")
    .executeTakeFirst();
  return unsubscribed ? null : email;
}

async function takeForContext(ctx: PlaybookContext): Promise<number> {
  if (ctx.orderId) {
    const result = await sql<Row>`
      SELECT coalesce(
        (SELECT sum((oi.price_at_purchase - coalesce(oi.discount_amount, 0)) * oi.platform_fee_percentage / 100)
           FROM order_items oi WHERE oi.order_id = o.id),
        o.total_amount * coalesce(o.platform_fee_percentage, 28) / 100) AS take
      FROM orders o WHERE o.id = ${ctx.orderId}
    `.execute(db);
    return num(result.rows[0], "take");
  }
  return ctx.amount * 0.268;
}

async function offerBudgetLeft(settings: AutopilotSettings, shadow: boolean): Promise<number> {
  const result = await sql<Row>`
    SELECT coalesce(sum(cost_rupees), 0)::float AS spent FROM rev_offers
    WHERE shadow = ${shadow} AND created_at > date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
  `.execute(db);
  return Math.max(0, settings.dailyOfferBudgetRupees - num(result.rows[0], "spent"));
}

async function tcoinsLimits(): Promise<{ redeemPercent: number; maxRedeem: number; enabled: boolean }> {
  const row = await db.selectFrom("platformSettings").select("settingValue").where("settingKey", "=", "tcoins_config").executeTakeFirst();
  try {
    const config = JSON.parse(row?.settingValue ?? "{}") as { enabled?: boolean; redeemPercent?: number; maxRedeem?: number };
    return { enabled: config.enabled === true, redeemPercent: config.redeemPercent ?? 10, maxRedeem: config.maxRedeem ?? 200 };
  } catch {
    return { enabled: false, redeemPercent: 10, maxRedeem: 200 };
  }
}

function emailHtml(copy: { heading: string; body: string; cta: string }, url: string, userId: number): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return getBrandedEmailHtml({
    title: copy.heading,
    preheaderText: copy.body.slice(0, 120),
    heading: copy.heading,
    bodyHtml: `<p style="margin:0;font-size:15px;line-height:1.6;">${escape(copy.body)}</p>`,
    ctaLabel: copy.cta,
    ctaUrl: url,
    afterCtaHtml: `<p style="margin:16px 0 0;font-size:12px;color:#6B7280;">Don't want these reminders? <a href="${unsubscribePageUrl(userId, "student_marketing")}" style="color:#6B7280;">Unsubscribe</a>. Emails about your account and orders still arrive.</p>`,
    studentAppPromo: true,
  });
}

type DueEnrolment = {
  id: string;
  userId: number;
  playbookKey: string;
  triggerAt: Date;
  context: PlaybookContext;
  isHoldout: boolean;
  nextStep: number;
  createdAt: Date;
};

async function advance(enrolment: DueEnrolment, playbook: Playbook, now: Date): Promise<void> {
  const nextIndex = enrolment.nextStep;
  if (nextIndex >= playbook.steps.length) {
    await db
      .updateTable("revEnrolments")
      .set({ state: "completed", nextStep: nextIndex + 1, nextDueAt: null, updatedAt: now })
      .where("id", "=", enrolment.id)
      .execute();
    return;
  }
  const due = new Date(Math.max(now.getTime(), enrolment.triggerAt.getTime() + playbook.steps[nextIndex].delayMinutes * 60 * 1000));
  await db
    .updateTable("revEnrolments")
    .set({ nextStep: nextIndex + 1, nextDueAt: due, updatedAt: now })
    .where("id", "=", enrolment.id)
    .execute();
}

async function exit(enrolmentId: string, state: string, reason: string, now: Date, orderId: number | null = null) {
  await db
    .updateTable("revEnrolments")
    .set({
      state,
      exitReason: reason,
      nextDueAt: null,
      updatedAt: now,
      ...(state === "converted" ? { convertedAt: now, convertedOrderId: orderId } : {}),
    })
    .where("id", "=", enrolmentId)
    .execute();
}

export async function dispatchDue(settings: AutopilotSettings): Promise<{ sent: number; shadow: number; skipped: number }> {
  const counts = { sent: 0, shadow: 0, skipped: 0 };
  const now = new Date();
  const due = await db
    .selectFrom("revEnrolments")
    .select(["id", "userId", "playbookKey", "triggerAt", "context", "isHoldout", "nextStep", "createdAt"])
    .where("state", "=", "active")
    .where("nextDueAt", "<=", now)
    .orderBy("nextDueAt", "asc")
    .limit(MAX_DISPATCH_PER_RUN)
    .execute();
  if (due.length === 0) return counts;

  const stats = await variantStats();
  const tcoins = await tcoinsLimits();

  for (const row of due) {
    const enrolment: DueEnrolment = {
      ...row,
      context: (row.context ?? {}) as unknown as PlaybookContext,
    };
    try {
      const playbook = PLAYBOOKS.get(enrolment.playbookKey);
      if (!playbook) {
        await exit(enrolment.id, "exited", "unknown_playbook", now);
        continue;
      }
      const goal = await reachedGoal(playbook, enrolment.userId, enrolment.triggerAt);
      if (goal) {
        await exit(enrolment.id, "converted", "goal_reached", now, goal.orderId);
        continue;
      }
      if (now.getTime() - enrolment.createdAt.getTime() > GIVE_UP_AFTER_DAYS * DAY_MS) {
        await exit(enrolment.id, "exited", "expired", now);
        continue;
      }
      const step = playbook.steps[enrolment.nextStep - 1];
      if (!step) {
        await exit(enrolment.id, "completed", "steps_done", now);
        continue;
      }
      if (enrolment.isHoldout) {
        await advance(enrolment, playbook, now);
        continue;
      }

      const sendAt = nextSendTime(now, settings.sendWindowStartHour, settings.sendWindowEndHour);
      if (sendAt.getTime() > now.getTime()) {
        await db.updateTable("revEnrolments").set({ nextDueAt: sendAt, updatedAt: now }).where("id", "=", enrolment.id).execute();
        continue;
      }

      const recent = await messagesSentRecently(enrolment.userId, settings.shadow);
      if (recent.day >= settings.dailyMessageCap || recent.week >= settings.weeklyMessageCap) {
        const later = nextSendTime(new Date(now.getTime() + 6 * 60 * 60 * 1000), settings.sendWindowStartHour, settings.sendWindowEndHour);
        await db.updateTable("revEnrolments").set({ nextDueAt: later, updatedAt: now }).where("id", "=", enrolment.id).execute();
        continue;
      }

      const choice: ChannelChoice | null = await chooseChannel(enrolment.userId, playbook.key, settings, enrolment.nextStep === 1);
      const variantKey = pickVariant(
        stats.get(`${playbook.key}:${enrolment.nextStep}`) ?? [
          { key: "a", sends: 0, conversions: 0 },
          { key: "b", sends: 0, conversions: 0 },
        ]
      ) as "a" | "b";

      if (!choice) {
        await db
          .insertInto("revMessages")
          .values({
            userId: enrolment.userId,
            intentId: enrolment.id,
            playbookKey: playbook.key,
            step: enrolment.nextStep,
            variantKey,
            channel: "email",
            status: "skipped",
            shadow: settings.shadow,
            error: "no reachable channel",
          })
          .execute();
        counts.skipped++;
        await advance(enrolment, playbook, now);
        continue;
      }

      const message = await db
        .insertInto("revMessages")
        .values({
          userId: enrolment.userId,
          intentId: enrolment.id,
          playbookKey: playbook.key,
          step: enrolment.nextStep,
          variantKey,
          channel: choice.channel,
          templateKey: `${playbook.key}.${enrolment.nextStep}.${variantKey}`,
          status: "queued",
          shadow: settings.shadow,
          costPaise: settings.shadow ? 0 : settings.channelCostPaise[choice.channel],
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      let coins = 0;
      if (step.offer && tcoins.enabled) {
        coins = offerCoins({
          takeRupees: await takeForContext(enrolment.context),
          cartRupees: enrolment.context.amount,
          marginShare: settings.offerMarginShare,
          redeemPercent: tcoins.redeemPercent,
          maxRedeem: tcoins.maxRedeem,
          budgetLeftRupees: await offerBudgetLeft(settings, settings.shadow),
        });
        if (coins > 0) {
          let grantId: number | null = null;
          if (!settings.shadow) {
            const grant = await db
              .insertInto("tcoinGrants")
              .values({ userId: enrolment.userId, coins, reason: `Autopilot: ${playbook.label}`, grantedBy: "autopilot" })
              .returning("id")
              .executeTakeFirst();
            grantId = grant?.id ?? null;
          }
          await db
            .insertInto("revOffers")
            .values({
              enrolmentId: enrolment.id,
              messageId: message.id,
              userId: enrolment.userId,
              offerType: "tcoins",
              coins,
              costRupees: String(coins),
              tcoinGrantId: grantId,
              shadow: settings.shadow,
            })
            .execute();
        }
      }

      const copy = step.variants[variantKey](enrolment.context, coins);
      if (settings.shadow) {
        await db.updateTable("revMessages").set({ status: "skipped", error: "shadow" }).where("id", "=", message.id).execute();
        counts.shadow++;
      } else {
        const path = playbook.link(enrolment.context);
        const url = await createMessageLink(message.id, path);
        const sendByEmail = async (email: string): Promise<SendOutcome> => {
          const result = await sendEmail({
            to: email,
            subject: copy.subject,
            html: emailHtml(copy, url, enrolment.userId),
            text: `${copy.heading}\n\n${copy.body}\n\n${copy.cta}: ${url}\n\nUnsubscribe: ${unsubscribePageUrl(enrolment.userId, "student_marketing")}`,
            tags: [{ name: "mid", value: String(message.id) }],
            headers: unsubscribeHeaders(enrolment.userId, "student_marketing"),
            idempotencyKey: `autopilot-${message.id}`,
          });
          return result.success
            ? { ok: true, providerId: (result.data as { data?: { id?: string } })?.data?.id ?? null }
            : { ok: false, error: result.error instanceof Error ? result.error.message : JSON.stringify(result.error).slice(0, 300) };
        };
        let outcome: SendOutcome;
        if (choice.channel === "push") {
          outcome = await sendPush({ tokens: choice.tokens, title: copy.subject, body: copy.body, path, messageId: message.id });
        } else if (choice.channel === "whatsapp") {
          outcome = await sendWhatsAppTemplate({
            phone: choice.phone,
            template: choice.template,
            name: enrolment.context.firstName,
            variables: [
              enrolment.context.firstName,
              enrolment.context.itemTitle || enrolment.context.examName || "your exam",
            ],
            linkCode: new URL(url).searchParams.get("c") ?? "",
          });
          if (!outcome.ok) {
            const fallback = await emailFallback(enrolment.userId);
            if (fallback) {
              console.warn(`[autopilot] WhatsApp failed for message ${message.id} (${outcome.error}); sending email instead`);
              await db
                .updateTable("revMessages")
                .set({ channel: "email", costPaise: settings.channelCostPaise.email, error: `whatsapp failed: ${outcome.error}`.slice(0, 300) })
                .where("id", "=", message.id)
                .execute();
              outcome = await sendByEmail(fallback.email);
            }
          }
        } else {
          outcome = await sendByEmail(choice.email);
        }
        if (outcome.ok) {
          await db
            .updateTable("revMessages")
            .set({ status: "sent", sentAt: now, providerMessageId: outcome.providerId })
            .where("id", "=", message.id)
            .execute();
          counts.sent++;
        } else {
          await db.updateTable("revMessages").set({ status: "failed", error: outcome.error }).where("id", "=", message.id).execute();
        }
      }
      await advance(enrolment, playbook, now);
    } catch (error) {
      console.error(`[autopilot] dispatch of enrolment ${enrolment.id} failed:`, error);
      await db
        .updateTable("revEnrolments")
        .set({ nextDueAt: new Date(now.getTime() + 60 * 60 * 1000), updatedAt: now })
        .where("id", "=", enrolment.id)
        .execute()
        .catch(() => undefined);
    }
  }
  return counts;
}

/** One engine pass: enrol new triggers, then send what is due. Off when the autopilot is switched off. */
export async function runAutopilotEngine(): Promise<void> {
  const settings = await getAutopilotSettings();
  if (!settings.enabled) return;
  const enrolled = await enrolTriggers(settings);
  const counts = await dispatchDue(settings);
  console.log(
    `[autopilot] enrolled ${enrolled}, sent ${counts.sent}, shadow ${counts.shadow}, no reachable channel ${counts.skipped}`
  );
}