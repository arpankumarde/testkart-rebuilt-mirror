import { randomBytes } from "crypto";
import { VIDEO_PROVIDER_MODE } from "./liveLessonConfig";

export type VideoParticipantRole = "teacher" | "learner";

export interface VideoRoomCredentials {
  /** Opaque room identifier, stable for the lifetime of the lesson. */
  roomId: string;
  /** Short-lived, single-identity token the client uses to connect. Never a long-lived secret. */
  token: string;
  /** Where the client SDK/iframe should connect. For the mock provider this is not a real video URL. */
  url: string;
  expiresAt: Date;
  /** "mock" here, or a real provider's key once configured (see helpers/liveLessonConfig.tsx). */
  provider: string;
}

export interface VideoProvider {
  /**
   * Issues short-lived, access-controlled credentials for one identity to join one room. Callers
   * must have already validated lesson membership and the join time window - this function does
   * not re-check either; it just mints credentials for a request the caller already authorized.
   */
  issueRoomCredentials(params: {
    roomName: string;
    identity: string;
    displayName: string;
    role: VideoParticipantRole;
    ttlSeconds: number;
  }): Promise<VideoRoomCredentials>;
}

/**
 * Development-only mock video provider. It does NOT establish a real audio/video connection -
 * there is no media server behind it. It exists so the full classroom UI, join-credential flow,
 * and server/client boundary can be built and tested before a real provider is configured, and as
 * an automatic fallback (see getVideoProvider() below) if DAILY_API_KEY isn't connected yet.
 *
 * The token is a random opaque string (not a JWT, not tied to any real service) and the "url" is a
 * placeholder the client recognises as "render the mock classroom" rather than something that can
 * be dialed into.
 */
class MockVideoProvider implements VideoProvider {
  async issueRoomCredentials(params: {
    roomName: string;
    identity: string;
    displayName: string;
    role: VideoParticipantRole;
    ttlSeconds: number;
  }): Promise<VideoRoomCredentials> {
    const token = randomBytes(24).toString("hex");
    return {
      roomId: `mock-room-${params.roomName}`,
      token,
      url: `mock://classroom/${params.roomName}?identity=${encodeURIComponent(params.identity)}&role=${params.role}`,
      expiresAt: new Date(Date.now() + params.ttlSeconds * 1000),
      provider: "mock",
    };
  }
}

const DAILY_API_BASE = "https://api.daily.co/v1";

async function dailyFetch(path: string, init?: RequestInit): Promise<Response> {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) throw new Error("DAILY_API_KEY is not configured");
  return fetch(`${DAILY_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/** Daily.co room names only allow letters, numbers and hyphens, and are capped at 41 characters. */
function sanitizeDailyRoomName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 40);
}

/**
 * Real video provider backed by Daily.co (server-only DAILY_API_KEY secret, never sent to the
 * client). One Daily "room" is created per lesson (booking or group lesson) and reused across every
 * join for that lesson; each individual join gets its own short-lived meeting token scoping that
 * person's name/role/expiry, which the client passes to the Daily Prebuilt iframe
 * (components/LiveClassroom.tsx).
 */
class DailyVideoProvider implements VideoProvider {
  async issueRoomCredentials(params: {
    roomName: string;
    identity: string;
    displayName: string;
    role: VideoParticipantRole;
    ttlSeconds: number;
  }): Promise<VideoRoomCredentials> {
    const roomName = sanitizeDailyRoomName(params.roomName);
    const room = await this.getOrCreateRoom(roomName);

    const exp = Math.floor(Date.now() / 1000) + params.ttlSeconds;
    const tokenRes = await dailyFetch("/meeting-tokens", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: params.displayName,
          user_id: params.identity,
          is_owner: params.role === "teacher",
          exp,
        },
      }),
    });
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Daily meeting token request failed: ${text}`);
    }
    const tokenData = (await tokenRes.json()) as { token: string };

    return {
      roomId: roomName,
      token: tokenData.token,
      url: room.url,
      expiresAt: new Date(exp * 1000),
      provider: "daily",
    };
  }

  private async getOrCreateRoom(roomName: string): Promise<{ url: string }> {
    const getRes = await dailyFetch(`/rooms/${encodeURIComponent(roomName)}`);
    if (getRes.ok) {
      const data = (await getRes.json()) as { url: string };
      return { url: data.url };
    }

    const createRes = await dailyFetch("/rooms", {
      method: "POST",
      body: JSON.stringify({
        name: roomName,
        privacy: "private",
        properties: {
          enable_chat: false, // We have our own chat panel.
          enable_screenshare: true,
          // Reusable for a day; a fresh join always mints its own short-lived meeting token on top
          // of this, so this is just how long the Daily room itself stays provisioned.
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
        },
      }),
    });
    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(`Daily room creation failed: ${text}`);
    }
    const data = (await createRes.json()) as { url: string };
    return { url: data.url };
  }
}

/**
 * Returns the video provider to use for this call, decided fresh each time (so connecting
 * DAILY_API_KEY takes effect immediately, no redeploy needed): "daily" against a real Daily.co room
 * when VIDEO_PROVIDER_MODE is "daily" AND the secret is actually connected, otherwise the
 * development-only mock - including as a safe fallback while the credential is still being
 * connected, rather than failing every join with a 500.
 */
export function getVideoProvider(): VideoProvider {
  if (VIDEO_PROVIDER_MODE === "daily") {
    if (process.env.DAILY_API_KEY) {
      return new DailyVideoProvider();
    }
    console.warn('VIDEO_PROVIDER_MODE is "daily" but DAILY_API_KEY is not connected yet; falling back to the mock video provider.');
  }
  return new MockVideoProvider();
}
