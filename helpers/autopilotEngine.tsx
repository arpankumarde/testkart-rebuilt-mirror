import { sql } from "kysely";
import { db } from "./db";
import { getAutopilotSettings, offerExpiryDays, type AutopilotSettings } from "./getAutopilotSettings";
import { isInGlobalHoldout } from "./isInGlobalHoldout";
import { nextSendTime, offerCoins, pickVariant } from "./autopilotRules";
import { AUTOPILOT_PLAYBOOKS, type Playbook, type PlaybookContext } from "./autopilotPlaybooks";
import { loadCopyState, statsForLiveKeys, variantStats } from "./autopilotCopyVariants";
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
import {
  approvedTemplateNames,
  headerImageFor,
  resolveTemplate,
  templateLinkPath,
  templateUsable,
  templateVariables,
  type TemplateSlot,
} from "./autopilotWhatsAppTemplates";

/**
 * The autopilot's engine, run by the autopilotHourly job every 15 minutes:
 * 1. enrol: each playbook's triggers become rev_enrolments rows, with the
 *    global holdout decided once per enrolment (holdout users never get a
 *    message, so the playbook's lift can be measured against them);
 * 2. dispatch: due steps go out through the guardrails, in this order: still
 *    relevant (no success yet), quiet hours, daily and weekly caps, a reachable
 *    channel, then the variant (Thompson sampling on paid conversions over the
 *    step's live versions: built-in a/b plus approved AI or admin copy from
 *    helpers/autopilotCopyVariants) and the offer (Tcoins within the margin
 *    rule and the daily budget).
 * 3. rescue: a WhatsApp message Meta refused after accepting it (the failure
 *    arrives later through webhooks/waplify) is sent again by email when the
 *    person has a usable address.
 * Shadow mode logs every message it would send (rev_messages.shadow) and sends
 * nothing. Channels come from helpers/autopilotChannels and templates from
 * helpers/autopilotWhatsAppTemplates: WhatsApp on a first message, on an offer
 * step whose offer template Meta approved, and for people with no usable
 * email; otherwise email (app push is wired but unused while the app
 * registers no tokens). Each pass writes one autopilot_runs row.
 * Every send is awaited and failures are recorded, never thrown.
 */

type Row = Record<string, unknown>;
const pick = (row: Row | undefined, snake: string): unknown =>
  !row ? undefined : snake in row ? row[snake] : row[snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())];
const num = (row: Row | undefined, key: string) => Number(pick(row, key) ?? 0) || 0;

const MAX_DISPATCH_PER_RUN = 150;
const MAX_RESCUE_PER_RUN = 50;
const GIVE_UP_AFTER_DAYS = 14;
const PLAYBOOKS = new Map(AUTOPILOT_PLAYBOOKS.map((playbook) => [playbook.key, playbook]));
const DAY_MS = 24 * 60 * 60 * 1000;
const expiryLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type EngineCounts = {
  due: number;
  sent: number;
  shadow: number;
  failed: number;
  skipped: number;
  deferred: number;
  converted: number;
  rescued: number;
  errors: number;
};

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
    tone: "blue",
    heading: copy.heading,
    bodyHtml: `<p style="margin:0;font-size:15px;line-height:1.6;">${escape(copy.body)}</p>`,
    ctaLabel: copy.cta,
    ctaUrl: url,
    afterCtaHtml: `<p style="margin:16px 0 0;font-size:12px;color:#6B7280;">Don't want these reminders? <a href="${unsubscribePageUrl(userId, "student_marketing")}" style="color:#6B7280;">Unsubscribe</a>. Emails about your account and orders still arrive.</p>`,
    studentAppPromo: true,
  });
}

const isRateLimited = (error: unknown) => {
  const e = (error ?? {}) as { name?: string; statusCode?: number; message?: string };
  return e.name === "rate_limit_exceeded" || e.statusCode === 429 || /too many requests/i.test(e.message ?? "");
};

/** One autopilot email; Resend's 10-a-second limit is retried twice, the idempotency key keeps that safe. */
async function sendStepEmail(params: {
  messageId: string;
  userId: number;
  email: string;
  copy: { subject: string; heading: string; body: string; cta: string };
  url: string;
}): Promise<SendOutcome> {
  const { messageId, userId, email, copy, url } = params;
  for (let attempt = 0; ; attempt++) {
    const result = await sendEmail({
      to: email,
      subject: copy.subject,
      html: emailHtml(copy, url, userId),
      text: `${copy.heading}\n\n${copy.body}\n\n${copy.cta}: ${url}\n\nUnsubscribe: ${unsubscribePageUrl(userId, "student_marketing")}`,
      tags: [{ name: "mid", value: String(messageId) }],
      headers: unsubscribeHeaders(userId, "student_marketing"),
      idempotencyKey: `autopilot-${messageId}`,
    });
    if (result.success) return { ok: true, providerId: (result.data as { data?: { id?: string } })?.data?.id ?? null };
    if (attempt < 2 && isRateLimited(result.error)) {
      await sleep(1200 * (attempt + 1));
      continue;
    }
    return { ok: false, error: result.error instanceof Error ? result.error.message : JSON.stringify(result.error).slice(0, 300) };
  }
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

export async function dispatchDue(settings: AutopilotSettings, counts: EngineCounts): Promise<void> {
  const now = new Date();
  const due = await db
    .selectFrom("revEnrolments")
    .select(["id", "userId", "playbookKey", "triggerAt", "context", "isHoldout", "nextStep", "createdAt"])
    .where("state", "=", "active")
    .where("nextDueAt", "<=", now)
    .orderBy("nextDueAt", "asc")
    .limit(MAX_DISPATCH_PER_RUN)
    .execute();
  counts.due = due.length;
  if (due.length === 0) return;

  const stats = await variantStats();
  const copyState = await loadCopyState();
  const tcoins = await tcoinsLimits();
  const approved = await approvedTemplateNames();

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
        counts.converted++;
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
        counts.deferred++;
        continue;
      }

      const recent = await messagesSentRecently(enrolment.userId, settings.shadow);
      if (recent.day >= settings.dailyMessageCap || recent.week >= settings.weeklyMessageCap) {
        const later = nextSendTime(new Date(now.getTime() + 6 * 60 * 60 * 1000), settings.sendWindowStartHour, settings.sendWindowEndHour);
        await db.updateTable("revEnrolments").set({ nextDueAt: later, updatedAt: now }).where("id", "=", enrolment.id).execute();
        counts.deferred++;
        continue;
      }

      let coins = 0;
      const coinsExpireAt = new Date(now.getTime() + offerExpiryDays(settings, playbook.key) * DAY_MS);
      const alreadyOffered =
        step.offer &&
        (await db.selectFrom("revOffers").select("id").where("enrolmentId", "=", enrolment.id).executeTakeFirst()) !== undefined;
      if (step.offer && tcoins.enabled && !alreadyOffered) {
        coins = offerCoins({
          takeRupees: await takeForContext(enrolment.context),
          cartRupees: enrolment.context.amount,
          marginShare: settings.offerMarginShare,
          redeemPercent: tcoins.redeemPercent,
          maxRedeem: tcoins.maxRedeem,
          budgetLeftRupees: await offerBudgetLeft(settings, settings.shadow),
        });
      }
      const slot: TemplateSlot = coins > 0 ? "offer" : enrolment.nextStep === 1 ? "first" : "followup";
      const usable = (name: string) => templateUsable(name, enrolment.context);
      const slotTemplate = resolveTemplate(playbook.key, slot, approved, settings.whatsappTemplates, usable);
      const template = slotTemplate ?? resolveTemplate(playbook.key, "followup", approved, settings.whatsappTemplates, usable);
      const preferWhatsApp = slot === "first" || (slot === "offer" && slotTemplate !== null);
      const choice: ChannelChoice | null = await chooseChannel(enrolment.userId, template, preferWhatsApp);
      const variantKey = pickVariant(
        statsForLiveKeys(copyState.liveKeys(playbook.key, enrolment.nextStep), stats.get(`${playbook.key}:${enrolment.nextStep}`))
      );

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
          templateKey: choice.channel === "whatsapp" ? choice.template : `${playbook.key}.${enrolment.nextStep}.${variantKey}`,
          status: "queued",
          shadow: settings.shadow,
          costPaise: settings.shadow ? 0 : settings.channelCostPaise[choice.channel],
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      if (coins > 0) {
          let grantId: number | null = null;
          if (!settings.shadow) {
            const grant = await db
              .insertInto("tcoinGrants")
              .values({
                userId: enrolment.userId,
                coins,
                reason: `Autopilot: ${playbook.label}`,
                grantedBy: "autopilot",
                expiresAt: coinsExpireAt,
              })
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

      const coinsExpireOn = expiryLabel.format(coinsExpireAt);
      const copy = copyState.copyFor(playbook, enrolment.nextStep, variantKey, enrolment.context, coins, coinsExpireOn);
      if (settings.shadow) {
        await db.updateTable("revMessages").set({ status: "skipped", error: "shadow" }).where("id", "=", message.id).execute();
        counts.shadow++;
      } else {
        const path = playbook.link(enrolment.context);
        const url = await createMessageLink(message.id, path);
        const sendByEmail = (email: string) =>
          sendStepEmail({ messageId: message.id, userId: enrolment.userId, email, copy, url });
        let outcome: SendOutcome;
        if (choice.channel === "push") {
          outcome = await sendPush({ tokens: choice.tokens, title: copy.subject, body: copy.body, path, messageId: message.id });
        } else if (choice.channel === "whatsapp") {
          const ownPath = templateLinkPath(choice.template, enrolment.context);
          const whatsappUrl = ownPath ? await createMessageLink(message.id, ownPath) : url;
          outcome = await sendWhatsAppTemplate({
            phone: choice.phone,
            template: choice.template,
            name: enrolment.context.firstName,
            variables: templateVariables(choice.template, enrolment.context, coins, coinsExpireOn),
            linkCode: new URL(whatsappUrl).searchParams.get("c") ?? "",
            mediaUrl: headerImageFor(choice.template, enrolment.context.imageUrl),
          });
          if (!outcome.ok) {
            const fallback = await emailFallback(enrolment.userId);
            if (fallback) {
              console.warn(`[autopilot] WhatsApp failed for message ${message.id} (${outcome.error}); sending email instead`);
              await db
                .updateTable("revMessages")
                .set({
                  channel: "email",
                  templateKey: `${playbook.key}.${enrolment.nextStep}.${variantKey}`,
                  costPaise: settings.channelCostPaise.email,
                  error: `whatsapp failed: ${outcome.error}`.slice(0, 300),
                })
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
          counts.failed++;
        }
      }
      await advance(enrolment, playbook, now);
    } catch (error) {
      console.error(`[autopilot] dispatch of enrolment ${enrolment.id} failed:`, error);
      counts.errors++;
      await db
        .updateTable("revEnrolments")
        .set({ nextDueAt: new Date(now.getTime() + 60 * 60 * 1000), updatedAt: now })
        .where("id", "=", enrolment.id)
        .execute()
        .catch(() => undefined);
    }
  }
}

/**
 * Re-sends by email the WhatsApp messages of the last 24 hours that Meta
 * refused after accepting them, with the same copy, offer and step. The row
 * becomes an email row (the WhatsApp reason stays in error), so a message is
 * rescued once; people with no usable email are marked and left alone.
 */
export async function rescueFailedWhatsApp(settings: AutopilotSettings, counts: EngineCounts): Promise<void> {
  if (settings.shadow) return;
  const now = new Date();
  if (nextSendTime(now, settings.sendWindowStartHour, settings.sendWindowEndHour).getTime() > now.getTime()) return;
  const rows = await sql<Row>`
    SELECT m.id, m.user_id, m.playbook_key, m.step, m.variant_key, m.error, e.trigger_at, e.context,
      o.coins, g.expires_at
    FROM rev_messages m
    JOIN rev_enrolments e ON e.id = m.intent_id
    LEFT JOIN rev_offers o ON o.message_id = m.id
    LEFT JOIN tcoin_grants g ON g.id = o.tcoin_grant_id
    WHERE m.channel = 'whatsapp' AND m.status = 'failed' AND m.shadow = false
      AND m.created_at > now() - interval '24 hours'
      AND coalesce(m.error, '') NOT LIKE '%(no email to fall back to)'
    ORDER BY m.id
    LIMIT ${MAX_RESCUE_PER_RUN}
  `.execute(db);
  if (rows.rows.length === 0) return;
  const copyState = await loadCopyState();
  for (const row of rows.rows) {
    const messageId = String(pick(row, "id"));
    const userId = num(row, "user_id");
    const reason = String(pick(row, "error") ?? "WhatsApp failed");
    try {
      const playbook = PLAYBOOKS.get(String(pick(row, "playbook_key")));
      const step = playbook?.steps[num(row, "step") - 1];
      const variant = String(pick(row, "variant_key") ?? "a");
      const ctx = (pick(row, "context") ?? {}) as unknown as PlaybookContext;
      const fallback = await emailFallback(userId);
      const goal = playbook ? await reachedGoal(playbook, userId, new Date(String(pick(row, "trigger_at")))) : null;
      if (!playbook || !step || !fallback || goal) {
        await db
          .updateTable("revMessages")
          .set({ error: `${reason} (no email to fall back to)`.slice(0, 500) })
          .where("id", "=", messageId)
          .execute();
        continue;
      }
      const coins = num(row, "coins");
      const expires = pick(row, "expires_at");
      const coinsExpireOn = expiryLabel.format(expires ? new Date(String(expires)) : new Date(now.getTime() + offerExpiryDays(settings, playbook.key) * DAY_MS));
      const copy = copyState.copyFor(playbook, num(row, "step"), variant, ctx, coins, coinsExpireOn);
      const url = await createMessageLink(messageId, playbook.link(ctx));
      await db
        .updateTable("revMessages")
        .set({
          channel: "email",
          templateKey: `${playbook.key}.${num(row, "step")}.${variant}`,
          status: "queued",
          costPaise: settings.channelCostPaise.email,
          error: `whatsapp failed: ${reason}`.slice(0, 300),
          deliveredAt: null,
          readAt: null,
        })
        .where("id", "=", messageId)
        .execute();
      const outcome = await sendStepEmail({ messageId, userId, email: fallback.email, copy, url });
      if (outcome.ok) {
        await db
          .updateTable("revMessages")
          .set({ status: "sent", sentAt: now, providerMessageId: outcome.providerId })
          .where("id", "=", messageId)
          .execute();
        counts.rescued++;
      } else {
        await db.updateTable("revMessages").set({ status: "failed", error: `whatsapp and email failed: ${outcome.error}`.slice(0, 300) }).where("id", "=", messageId).execute();
        counts.failed++;
      }
    } catch (error) {
      console.error(`[autopilot] rescue of message ${messageId} failed:`, error);
      counts.errors++;
    }
  }
}

/** One engine pass: enrol new triggers, send what is due, rescue refused WhatsApp messages, log the run. */
export async function runAutopilotEngine(): Promise<EngineCounts | null> {
  const settings = await getAutopilotSettings();
  if (!settings.enabled) return null;
  const startedAt = new Date();
  const counts: EngineCounts = { due: 0, sent: 0, shadow: 0, failed: 0, skipped: 0, deferred: 0, converted: 0, rescued: 0, errors: 0 };
  let enrolled = 0;
  let fatal: string | null = null;
  try {
    enrolled = await enrolTriggers(settings);
    await dispatchDue(settings, counts);
    await rescueFailedWhatsApp(settings, counts);
  } catch (error) {
    fatal = error instanceof Error ? error.message : String(error);
    console.error("[autopilot] engine pass failed:", error);
  }
  console.log(
    `[autopilot] enrolled ${enrolled}, due ${counts.due}, sent ${counts.sent}, shadow ${counts.shadow}, failed ${counts.failed}, no reachable channel ${counts.skipped}, deferred ${counts.deferred}, rescued ${counts.rescued}`
  );
  await db
    .insertInto("autopilotRuns")
    .values({
      startedAt,
      durationMs: Date.now() - startedAt.getTime(),
      shadow: settings.shadow,
      enrolled,
      due: counts.due,
      sent: counts.sent + counts.shadow,
      failed: counts.failed,
      skipped: counts.skipped,
      deferred: counts.deferred,
      converted: counts.converted,
      rescued: counts.rescued,
      errors: counts.errors + (fatal ? 1 : 0),
      error: fatal ? fatal.slice(0, 500) : null,
    })
    .execute()
    .catch((error) => console.error("[autopilot] could not log the run:", error));
  if (fatal) throw new Error(fatal);
  return counts;
}