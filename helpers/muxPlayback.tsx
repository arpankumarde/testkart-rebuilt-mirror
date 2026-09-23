import { createSign } from "crypto";

/**
 * Signed playback for Mux DRM playback ids. Backend only: it reads the signing key.
 *
 * A DRM playback id needs a playback token (aud "v") for the stream and a licence token
 * (aud "d") for the Widevine / PlayReady / FairPlay licence server. Thumbnail ("t") and
 * storyboard ("s") tokens are needed for the poster and the seek-bar previews.
 */

const MUX_PLAYER_BASE = "https://player.mux.com";
const MUX_STREAM_BASE = "https://stream.mux.com";
const MUX_IMAGE_BASE = "https://image.mux.com";
const MUX_LICENSE_BASE = "https://license.mux.com";

// Tokens must outlive the whole viewing session, so they cover long lessons with pauses
export const MUX_TOKEN_TTL_SECONDS = 6 * 60 * 60;

type MuxTokenAudience = "v" | "d" | "t" | "s";

export type MuxDrmPlayback = {
  playbackId: string;
  expiresIn: number;
  tokens: { playback: string; drm: string; thumbnail: string; storyboard: string };
  /** Mux's hosted player page, for an iframe or a WebView */
  embedUrl: string;
  /** For native players (react-native-video, expo-video) */
  hlsUrl: string;
  thumbnailUrl: string;
  widevineLicenseUrl: string;
  playreadyLicenseUrl: string;
  fairplayLicenseUrl: string;
  fairplayCertificateUrl: string;
};

export function isMuxSigningConfigured(): boolean {
  return !!process.env.MUX_SIGNING_KEY_ID && !!process.env.MUX_SIGNING_PRIVATE_KEY;
}

function readPrivateKey(): { keyId: string; pem: string } {
  const keyId = process.env.MUX_SIGNING_KEY_ID;
  const secret = process.env.MUX_SIGNING_PRIVATE_KEY;
  if (!keyId || !secret) throw new Error("MUX_SIGNING_KEY_ID and MUX_SIGNING_PRIVATE_KEY are not set.");
  // The dashboard hands out the PEM base64-encoded; accept a raw PEM too
  const pem = secret.includes("BEGIN") ? secret : Buffer.from(secret.trim(), "base64").toString("utf8");
  return { keyId, pem };
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

export function signMuxToken(playbackId: string, audience: MuxTokenAudience, ttlSeconds = MUX_TOKEN_TTL_SECONDS): string {
  const { keyId, pem } = readPrivateKey();
  const header = { alg: "RS256", typ: "JWT", kid: keyId };
  const payload = {
    sub: playbackId,
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    kid: keyId,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(pem);
  return `${unsigned}.${base64Url(signature)}`;
}

export function getMuxDrmPlayback(
  playbackId: string,
  options: { videoId?: string; videoTitle?: string; ttlSeconds?: number } = {}
): MuxDrmPlayback {
  const ttl = options.ttlSeconds ?? MUX_TOKEN_TTL_SECONDS;
  const tokens = {
    playback: signMuxToken(playbackId, "v", ttl),
    drm: signMuxToken(playbackId, "d", ttl),
    thumbnail: signMuxToken(playbackId, "t", ttl),
    storyboard: signMuxToken(playbackId, "s", ttl),
  };

  const embedParams = new URLSearchParams({
    "playback-token": tokens.playback,
    "drm-token": tokens.drm,
    "thumbnail-token": tokens.thumbnail,
    "storyboard-token": tokens.storyboard,
  });
  if (options.videoId) embedParams.set("metadata-video-id", options.videoId);
  if (options.videoTitle) embedParams.set("metadata-video-title", options.videoTitle.slice(0, 200));

  const license = (system: string) => `${MUX_LICENSE_BASE}/license/${system}/${playbackId}?token=${tokens.drm}`;

  return {
    playbackId,
    expiresIn: ttl,
    tokens,
    embedUrl: `${MUX_PLAYER_BASE}/${playbackId}?${embedParams.toString()}`,
    hlsUrl: `${MUX_STREAM_BASE}/${playbackId}.m3u8?token=${tokens.playback}`,
    thumbnailUrl: `${MUX_IMAGE_BASE}/${playbackId}/thumbnail.webp?token=${tokens.thumbnail}`,
    widevineLicenseUrl: license("widevine"),
    playreadyLicenseUrl: license("playready"),
    fairplayLicenseUrl: license("fairplay"),
    fairplayCertificateUrl: `${MUX_LICENSE_BASE}/appcert/fairplay/${playbackId}?token=${tokens.drm}`,
  };
}
