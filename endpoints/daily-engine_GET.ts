import { createHash } from "crypto";
import { DAILY_ENGINE_FILES, DAILY_ENGINE_VERSION } from "../helpers/dailyEngine";

/*
 * Serves Daily's call engine from the app's own domain (see helpers/dailyEngine.tsx). Only the
 * pinned files of the pinned version are served, and only when their SHA-256 matches, so this is
 * not a proxy: nothing else can be fetched through it. Answers are the same for everyone, so the
 * CDN keeps them; the backend only runs on a cache miss.
 */
export async function handle(request: Request) {
  const url = new URL(request.url);
  const version = url.searchParams.get("v");
  // The engine asks for chunks as "/<file>.js?<hash>"; the hash is a cache buster only.
  const file = (url.searchParams.get("f") ?? "").replace(/^\/+/, "").split("?")[0];
  const expected = DAILY_ENGINE_FILES[file];
  if (version !== DAILY_ENGINE_VERSION || !expected) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
  }

  const source = `https://c.daily.co/call-machine/versioned/${DAILY_ENGINE_VERSION}/static/${file}`;
  try {
    const upstream = await fetch(source);
    if (!upstream.ok) {
      console.log("[classroom]", JSON.stringify({ event: "daily-engine-upstream", file, status: upstream.status }));
      return new Response("Video engine temporarily unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    const body = Buffer.from(await upstream.arrayBuffer());
    const sha = createHash("sha256").update(body).digest("hex");
    if (sha !== expected) {
      console.log("[classroom]", JSON.stringify({ event: "daily-engine-checksum-mismatch", file, sha }));
      return new Response("Video engine failed verification", { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    return new Response(body, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        // Version and file are in the URL and the bytes are verified, so the answer never changes.
        "Cache-Control": "public, max-age=86400, s-maxage=2592000, immutable",
      },
    });
  } catch (error) {
    console.log("[classroom]", JSON.stringify({ event: "daily-engine-fetch-failed", file, message: error instanceof Error ? error.message : String(error) }));
    return new Response("Video engine temporarily unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}