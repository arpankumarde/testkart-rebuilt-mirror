import { createHmac, timingSafeEqual } from "crypto";
import { db } from "../../helpers/db";
import { describeMuxAssetErrors } from "../../helpers/syncLessonVideoToMux";
import { schema, OutputType } from "./mux_POST.schema";

// Mux signs `${timestamp}.${rawBody}` with HMAC-SHA256; its SDKs accept a 5 minute window
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function isValidSignature(header: string | null, rawBody: string, secret: string): boolean {
  if (!header) return false;
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2).map((s) => s.trim());
    if (key === "t") timestamp = value ?? "";
    if (key === "v1" && value) signatures.push(value);
  }
  const seconds = Number(timestamp);
  if (!timestamp || !Number.isFinite(seconds) || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - seconds) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex"), "utf8");
  return signatures.some((signature) => {
    const given = Buffer.from(signature, "utf8");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/**
 * Mux asset events for DRM lesson videos. ready and errored move mux_status on every lesson
 * using the asset; deleted (for example from the Mux dashboard) clears the lesson's Mux
 * columns so its next save pushes again. Other events are acknowledged and ignored.
 */
export async function handle(request: Request): Promise<Response> {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhooks/mux] MUX_WEBHOOK_SECRET is not set; refusing the event so Mux retries it.");
    return json({ error: "Webhook not configured" }, 503);
  }

  const rawBody = await request.text();
  if (!isValidSignature(request.headers.get("mux-signature"), rawBody, secret)) {
    return json({ error: "Invalid signature" }, 401);
  }

  let event;
  try {
    event = schema.parse(JSON.parse(rawBody));
  } catch {
    return json({ error: "Invalid payload" }, 400);
  }

  const assetId = event.data.id;
  try {
    if (event.type === "video.asset.ready") {
      const result = await db
        .updateTable("courseLessons")
        .set({ muxStatus: "ready", muxError: null })
        .where("muxAssetId", "=", assetId)
        .executeTakeFirst();
      console.log(`[webhooks/mux] Asset ${assetId} ready (${result.numUpdatedRows} lessons)`);
    } else if (event.type === "video.asset.errored") {
      const result = await db
        .updateTable("courseLessons")
        .set({ muxStatus: "failed", muxError: describeMuxAssetErrors(event.data.errors) })
        .where("muxAssetId", "=", assetId)
        .executeTakeFirst();
      console.log(`[webhooks/mux] Asset ${assetId} errored (${result.numUpdatedRows} lessons)`);
    } else if (event.type === "video.asset.deleted") {
      await db
        .updateTable("courseLessons")
        .set({ muxAssetId: null, muxPlaybackId: null, muxSourceUrl: null, muxStatus: null, muxError: null })
        .where("muxAssetId", "=", assetId)
        .execute();
    }
  } catch (error) {
    console.error(`[webhooks/mux] Could not apply ${event.type} for asset ${assetId}:`, error);
    return json({ error: "Could not apply event" }, 500);
  }

  return json({ received: true } satisfies OutputType);
}
