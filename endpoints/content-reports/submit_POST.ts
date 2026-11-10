import { createHash } from "crypto";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "../../helpers/db";
import { getTrustedClientIp } from "../../helpers/trustedClientIp";
import { parseUserAgent } from "../../helpers/parseUserAgent";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { classifyContentReportPath, COPYRIGHT_CATEGORY } from "../../helpers/contentReportTypes";
import { resolveReportedContent } from "../../helpers/resolveReportedContent";
import { verifyTurnstileToken } from "../../helpers/verifyTurnstileToken";
import { schema, OutputType, type CaptchaErrorCode } from "./submit_POST.schema";

const MIN_FILL_MS = 2500;
const MAX_PER_IP_10_MIN = 5;
const MAX_PER_IP_PER_DAY = 30;
const MAX_PER_EMAIL_PER_DAY = 30;
const USER_AGENT_MAX = 2048;

const json = (body: unknown, status = 200) =>
  new Response(superjson.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const captchaError = (error: string, code: CaptchaErrorCode, status: number) => json({ error, code }, status);

/**
 * Every report needs a Turnstile token that Cloudflare accepts. Unlike the OTP sends, a missing
 * TURNSTILE_SECRET_KEY refuses the report rather than skipping the check.
 */
async function checkCaptcha(token: string | undefined, ip: string | null): Promise<Response | null> {
  if (!token) {
    return captchaError("Please complete the security check before submitting.", "captcha_missing", 400);
  }
  const result = await verifyTurnstileToken(token, ip);
  if (result.status === "valid") return null;
  if (result.status === "not_configured") {
    return captchaError("Reporting is temporarily unavailable. Please try again later.", "captcha_unavailable", 503);
  }
  switch (result.reason) {
    case "expired_or_reused":
      return captchaError("Your security check has expired. Please verify again and resubmit.", "captcha_expired", 403);
    case "unreachable":
      return captchaError("We could not reach the security check service. Please try again in a moment.", "captcha_unavailable", 503);
    case "missing":
      return captchaError("Please complete the security check before submitting.", "captcha_missing", 400);
    default:
      return captchaError("The security check failed. Please verify again and resubmit.", "captcha_failed", 403);
  }
}

/** Plain text only: tags, control and zero-width characters go, long blank runs collapse. */
function clean(value: string | undefined | null): string | null {
  if (!value) return null;
  const text = value
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‍⁠﻿]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`content-report:${process.env.JWT_SECRET ?? ""}:${ip}`).digest("hex");
}

function normalisePageUrl(raw: string): { path: string; pathname: string } | null {
  try {
    const url = new URL(raw, "https://testkart.in");
    return { path: `${url.pathname}${url.search}`.slice(0, 2000), pathname: url.pathname };
  } catch {
    return null;
  }
}

async function currentUserId(request: Request): Promise<number | null> {
  try {
    const { user } = await getServerUserSession(request);
    return user.id;
  } catch {
    return null;
  }
}

export async function handle(request: Request) {
  try {
    const input = schema.parse(superjson.parse(await request.text()));

    const page = normalisePageUrl(input.pageUrl);
    const target = page ? classifyContentReportPath(page.pathname) : null;
    if (!page || !target) {
      return json({ error: "Issues can only be reported from a public content page." }, 400);
    }

    const clientIp = getTrustedClientIp(request);
    const captchaRefusal = await checkCaptcha(input.turnstileToken, clientIp);
    if (captchaRefusal) return captchaRefusal;
    const captchaVerifiedAt = new Date();

    if (input.website || input.fillMs < MIN_FILL_MS) {
      return json({ success: true, reportId: null, duplicate: false } satisfies OutputType);
    }

    const existing = await db
      .selectFrom("contentReports")
      .select("id")
      .where("clientToken", "=", input.clientToken)
      .executeTakeFirst();
    if (existing) {
      return json({ success: true, reportId: existing.id, duplicate: true } satisfies OutputType);
    }

    const description = clean(input.description);
    if (!description || description.length < 10) {
      return json({ error: "Please describe the issue in at least 10 characters" }, 400);
    }
    const email = input.email.toLowerCase();
    const ipHash = hashIp(clientIp);
    const isCopyright = input.category === COPYRIGHT_CATEGORY;
    const now = Date.now();

    if (ipHash) {
      const counts = await db
        .selectFrom("contentReports")
        .select((eb) => [
          eb.fn.count<string>("id").filterWhere("createdAt", ">=", new Date(now - 10 * 60 * 1000)).as("recent"),
          eb.fn.count<string>("id").as("day"),
        ])
        .where("ipHash", "=", ipHash)
        .where("createdAt", ">=", new Date(now - 24 * 60 * 60 * 1000))
        .executeTakeFirst();
      if (Number(counts?.recent ?? 0) >= MAX_PER_IP_10_MIN) {
        return json({ error: "You have sent several reports in a short time. Please wait a few minutes and try again." }, 429);
      }
      if (Number(counts?.day ?? 0) >= MAX_PER_IP_PER_DAY) {
        return json({ error: "You have reached today's limit for reports. Please try again tomorrow." }, 429);
      }

      const repeat = await db
        .selectFrom("contentReports")
        .select("id")
        .where("ipHash", "=", ipHash)
        .where("pageUrl", "=", page.path)
        .where((eb) => eb(eb.fn("lower", ["description"]), "=", description.toLowerCase()))
        .where("createdAt", ">=", new Date(now - 24 * 60 * 60 * 1000))
        .executeTakeFirst();
      if (repeat) {
        return json({ success: true, reportId: repeat.id, duplicate: true } satisfies OutputType);
      }
    }

    if (email) {
      const emailCount = await db
        .selectFrom("contentReports")
        .select((eb) => eb.fn.count<string>("id").as("day"))
        .where("reporterEmail", "=", email)
        .where("createdAt", ">=", new Date(now - 24 * 60 * 60 * 1000))
        .executeTakeFirst();
      if (Number(emailCount?.day ?? 0) >= MAX_PER_EMAIL_PER_DAY) {
        return json({ error: "You have reached today's limit for reports. Please try again tomorrow." }, 429);
      }
    }

    const [resolved, reporterUserId] = await Promise.all([resolveReportedContent(target), currentUserId(request)]);
    const userAgent = request.headers.get("user-agent")?.trim().slice(0, USER_AGENT_MAX) || null;
    const device = parseUserAgent(userAgent, {
      mobile: request.headers.get("sec-ch-ua-mobile"),
      platform: request.headers.get("sec-ch-ua-platform"),
    });

    const inserted = await db
      .insertInto("contentReports")
      .values({
        contentType: target.contentType,
        contentId: resolved.contentId,
        contentSlug: target.slug,
        parentSlug: target.parentSlug,
        pageUrl: page.path,
        pageTitle: (resolved.title ?? clean(input.pageTitle))?.slice(0, 300) ?? null,
        category: input.category,
        description,
        locationHint: isCopyright ? null : clean(input.locationHint)?.slice(0, 500) ?? null,
        detectedSection: clean(input.detectedSection)?.slice(0, 300) ?? null,
        selectedText: clean(input.selectedText)?.slice(0, 1000) ?? null,
        suggestedCorrection: isCopyright ? null : clean(input.suggestedCorrection),
        reporterName: isCopyright ? clean(input.reporterName)?.slice(0, 150) ?? null : null,
        reporterPhone: input.phone.replace(/[\s-]+/g, " ").trim(),
        copyrightMaterialType: isCopyright ? input.copyrightMaterialType ?? null : null,
        copyrightMaterialLocation: isCopyright ? clean(input.copyrightMaterialLocation)?.slice(0, 2000) ?? null : null,
        copyrightOriginalSource: isCopyright ? clean(input.copyrightOriginalSource)?.slice(0, 2000) ?? null : null,
        captchaVerifiedAt,
        reporterEmail: email,
        reporterUserId,
        ipHash,
        reporterIp: clientIp,
        userAgent,
        deviceType: device.deviceType,
        osName: device.os.slice(0, 60),
        browserName: device.browser.slice(0, 60),
        clientToken: input.clientToken,
      })
      .onConflict((oc) => oc.column("clientToken").doNothing())
      .returning("id")
      .executeTakeFirst();

    if (!inserted) {
      const raced = await db
        .selectFrom("contentReports")
        .select("id")
        .where("clientToken", "=", input.clientToken)
        .executeTakeFirst();
      return json({ success: true, reportId: raced?.id ?? null, duplicate: true } satisfies OutputType);
    }

    return json({ success: true, reportId: inserted.id, duplicate: false } satisfies OutputType);
  } catch (error) {
    if (error instanceof ZodError) {
      return json({ error: error.errors[0]?.message ?? "Please check the form and try again." }, 400);
    }
    console.error("Failed to submit content report:", error);
    return json({ error: "We could not submit your report. Please try again." }, 500);
  }
}