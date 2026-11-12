import { useCallback, useEffect, useRef, useState } from "react";
import DailyIframe, { DailyCall, DailyParticipant } from "@daily-co/daily-js";

/*
 * One Daily call object (no Prebuilt iframe) for the live classroom. Daily carries the media;
 * the classroom draws every tile and control itself from the participant state kept here.
 *
 * Lifecycle rules, each one a past bug:
 * - One call per mount. Teardown is awaited before any new call is created (module-level
 *   pendingTeardown), so a quick remount (React StrictMode, a page re-render) never collides with
 *   an instance that is still being destroyed and fails the join.
 * - Remote participants joining or leaving only update the participant list. Nothing here calls
 *   leave() or destroy() because of someone else.
 * - "left-meeting" ends the session only when it is our own departure that we did not start
 *   ourselves (an intentional leave is reported through leave(), a teardown or rejoin is ignored).
 * - A fatal "error" ends the session only for reasons that cannot recover (ejected, room or token
 *   expired or not yet valid, room missing, meeting full, not allowed). Anything else, such as a
 *   lost connection, rejoins the same room with the same token, up to MAX_REJOINS times.
 * Every step is logged as one "[classroom]" JSON line so teacher and student logs can be compared.
 */

export type CallParticipant = {
  sessionId: string;
  /** The identity the join endpoint put in the meeting token, "user-<id>". */
  userId: string | null;
  name: string;
  local: boolean;
  owner: boolean;
  audioOn: boolean;
  videoOn: boolean;
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  screenVideoTrack: MediaStreamTrack | null;
  screenAudioTrack: MediaStreamTrack | null;
};

export type CallStatus = "idle" | "joining" | "joined" | "reconnecting";
export type NetworkQuality = "good" | "low" | "very-low" | "unknown";

export type CallLogContext = {
  userId: number | null;
  role: "teacher" | "learner";
  kind: string;
  lessonId: string;
};

type TrackLike = { state?: string; persistentTrack?: MediaStreamTrack } | undefined;

const playable = (t: TrackLike) => (t && t.state === "playable" && t.persistentTrack ? t.persistentTrack : null);
const switchedOn = (t: TrackLike) => !!t && t.state !== "off" && t.state !== "blocked";

const toParticipant = (p: DailyParticipant): CallParticipant => {
  const tracks = p.tracks as unknown as Record<string, TrackLike>;
  return {
    sessionId: p.session_id,
    userId: p.user_id ?? null,
    name: p.user_name || "Guest",
    local: p.local,
    owner: !!p.owner,
    audioOn: switchedOn(tracks.audio),
    videoOn: switchedOn(tracks.video),
    videoTrack: playable(tracks.video),
    audioTrack: playable(tracks.audio),
    screenVideoTrack: playable(tracks.screenVideo),
    screenAudioTrack: playable(tracks.screenAudio),
  };
};

/** Fatal error types after which rejoining cannot help; the session ends with this message. */
const FINAL_ERRORS: Record<string, string> = {
  ejected: "You were removed from the call.",
  "exp-room": "This classroom has expired.",
  "exp-token": "Your access to this call has expired. Join again from the classroom.",
  "nbf-room": "This classroom is not open yet.",
  "nbf-token": "Your access to this call is not valid yet.",
  "no-room": "This classroom no longer exists.",
  "meeting-full": "This classroom is full.",
  "not-allowed": "You are not allowed to join this call.",
  "end-of-life": "This browser version is no longer supported for calls.",
};

const MAX_REJOINS = 3;
const TIME_UP_MESSAGE = "The class time is over, so the call has ended.";
/** A join that has neither succeeded nor failed by then is dropped and tried again. */
const JOIN_TIMEOUT_MS = 20000;

/** The previous call's teardown; a new call is only created once it has finished. */
let pendingTeardown: Promise<void> | null = null;

export interface UseDailyCallOptions {
  enabled: boolean;
  url: string;
  token: string;
  startAudioOff: boolean;
  startVideoOff: boolean;
  audioSource?: string;
  videoSource?: string;
  outputDeviceId?: string;
  logContext: CallLogContext;
  /** When the room's join window closes. After it nothing is retried: the call has simply run its time. */
  endsAt?: Date | string;
  onAppMessage: (data: unknown, fromId: string) => void;
  /** The call ended without the viewer asking: a final error, or Daily left us. */
  onEnded: (message?: string) => void;
  onJoined?: () => void;
  onParticipantJoined?: (name: string) => void;
  onParticipantLeft?: (name: string) => void;
  onNonFatalError?: (type: string) => void;
}

export function useDailyCall(options: UseDailyCallOptions) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [network, setNetwork] = useState<NetworkQuality>("unknown");
  const callRef = useRef<DailyCall | null>(null);
  const leavingRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const log = useCallback((event: string, extra: Record<string, unknown> = {}) => {
    const o = optionsRef.current;
    const roomName = o.url.split("/").pop() ?? "";
    const sessionId = callRef.current?.participants().local?.session_id ?? null;
    // console.log, not console.info: the preview build drops console.info.
    console.log(
      "[classroom]",
      JSON.stringify({
        at: new Date().toISOString(),
        event,
        userId: o.logContext.userId,
        role: o.logContext.role,
        lesson: `${o.logContext.kind}:${o.logContext.lessonId}`,
        room: roomName,
        sessionId,
        ...extra,
      })
    );
  }, []);

  useEffect(() => {
    if (!options.enabled) return;
    let closed = false;
    let call: DailyCall | null = null;
    let rejoining = false;
    let rejoins = 0;
    leavingRef.current = false;

    const sync = () => {
      if (!call || closed) return;
      setParticipants(Object.values(call.participants()).map(toParticipant));
    };

    const end = (message?: string, reason?: string) => {
      if (closed) return;
      closed = true;
      log("session-ended", { reason: reason ?? "left-meeting", message: message ?? null });
      optionsRef.current.onEnded(message);
    };

    const timeIsUp = () => {
      const endsAt = optionsRef.current.endsAt;
      return !!endsAt && Date.now() >= new Date(endsAt).getTime();
    };

    const teardown = (instance: DailyCall, why: string) => {
      log("destroy", { why });
      const done = instance
        .destroy()
        .catch(() => undefined)
        .then(() => {
          if (pendingTeardown === done) pendingTeardown = null;
        });
      pendingTeardown = done;
      return done;
    };

    const connect = async () => {
      if (pendingTeardown) await pendingTeardown;
      const stray = DailyIframe.getCallInstance();
      if (stray) await teardown(stray, "stray-instance");
      if (closed) return;

      const o = optionsRef.current;
      const instance = DailyIframe.createCallObject({
        url: o.url,
        token: o.token,
        startVideoOff: o.startVideoOff,
        startAudioOff: o.startAudioOff,
        ...(o.videoSource ? { videoSource: o.videoSource } : {}),
        ...(o.audioSource ? { audioSource: o.audioSource } : {}),
      });
      call = instance;
      callRef.current = instance;

      // Handlers ignore events from an instance that has been replaced (a rejoin) or closed.
      const current = () => call === instance && !closed;

      instance
        .on("joined-meeting", (ev) => {
          if (!current()) return;
          rejoining = false;
          setStatus("joined");
          sync();
          log("joined-meeting", { sessionId: ev?.participants?.local?.session_id ?? null, rejoins });
          optionsRef.current.onJoined?.();
        })
        .on("participant-joined", (ev) => {
          if (!current() || !ev) return;
          sync();
          log("participant-joined", { remoteSessionId: ev.participant.session_id, remoteUserId: ev.participant.user_id ?? null });
          if (!ev.participant.local) optionsRef.current.onParticipantJoined?.(ev.participant.user_name || "Someone");
        })
        .on("participant-updated", () => {
          if (current()) sync();
        })
        .on("participant-left", (ev) => {
          if (!current() || !ev) return;
          sync();
          log("participant-left", { remoteSessionId: ev.participant.session_id, remoteUserId: ev.participant.user_id ?? null });
          optionsRef.current.onParticipantLeft?.(ev.participant.user_name || "Someone");
        })
        .on("track-started", () => {
          if (current()) sync();
        })
        .on("track-stopped", () => {
          if (current()) sync();
        })
        .on("active-speaker-change", (ev) => {
          if (current()) setActiveSpeakerId(ev?.activeSpeaker?.peerId ?? null);
        })
        .on("network-quality-change", (ev) => {
          if (!current()) return;
          const threshold = ev?.threshold;
          setNetwork(threshold === "good" || threshold === "low" || threshold === "very-low" ? threshold : "unknown");
        })
        .on("network-connection", (ev) => {
          if (!current() || !ev) return;
          log("network-connection", { type: ev.type, state: ev.event });
          // Only the signaling link says whether we are still in the call. Media links (sfu, peer)
          // drop and come back as Daily moves between peer-to-peer and server routing, and that
          // is not a lost connection.
          if (ev.type !== "signaling") return;
          if (ev.event === "interrupted") setStatus("reconnecting");
          else if (ev.event === "connected" && instance.meetingState() === "joined-meeting") setStatus("joined");
        })
        .on("app-message", (ev) => {
          if (current() && ev) optionsRef.current.onAppMessage(ev.data, ev.fromId);
        })
        .on("nonfatal-error", (ev) => {
          if (!current() || !ev) return;
          log("nonfatal-error", { type: ev.type, message: ev.errorMsg });
          optionsRef.current.onNonFatalError?.(ev.type);
        })
        .on("error", (ev) => {
          if (!current()) return;
          const type = (ev as { error?: { type?: string } } | undefined)?.error?.type ?? "unknown";
          const message = ev?.errorMsg ?? "";
          log("error", { type, message: message || null, timeIsUp: timeIsUp() });
          if (timeIsUp()) {
            end(TIME_UP_MESSAGE, `error:${type}:time-up`);
            return;
          }
          // Older Daily builds put the reason only in the message text.
          const expired = /exp|expired|meeting has ended|ended/i.test(message);
          const final = FINAL_ERRORS[type] ?? (expired ? "This call has ended because its access expired." : undefined);
          if (final) {
            end(final, `error:${type}`);
            return;
          }
          void rejoin(`error:${type}`);
        })
        .on("left-meeting", () => {
          if (!current()) return;
          log("left-meeting", { intentional: leavingRef.current, rejoining });
          if (leavingRef.current || rejoining) return;
          void rejoin("left-meeting");
        });

      setStatus((s) => (s === "reconnecting" ? s : "joining"));
      log("join", { attempt: rejoins });
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        instance.join(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`join timed out after ${JOIN_TIMEOUT_MS / 1000}s`)), JOIN_TIMEOUT_MS);
        }),
      ]).finally(() => clearTimeout(timer));
      if (!current()) return;
      setStatus("joined");
      sync();
      if (o.outputDeviceId) await instance.setOutputDeviceAsync({ outputDeviceId: o.outputDeviceId }).catch(() => undefined);
    };

    /** Drops the broken instance and joins the same room again with the same token. */
    const rejoin = async (why: string) => {
      if (closed || rejoining) return;
      if (timeIsUp()) {
        end(TIME_UP_MESSAGE, `time-up:${why}`);
        return;
      }
      if (rejoins >= MAX_REJOINS) {
        end("We lost the connection to the call. Join again from the classroom.", `gave-up:${why}`);
        return;
      }
      rejoining = true;
      rejoins += 1;
      setStatus("reconnecting");
      log("rejoin", { why, attempt: rejoins });
      const old = call;
      call = null;
      callRef.current = null;
      if (old) await teardown(old, `rejoin:${why}`);
      await new Promise((r) => setTimeout(r, 800 * rejoins));
      if (closed) return;
      try {
        await connect();
      } catch (err) {
        rejoining = false;
        log("rejoin-failed", { message: err instanceof Error ? err.message : String(err) });
        void rejoin("rejoin-failed");
      }
    };

    connect().catch((err) => {
      log("join-failed", { message: err instanceof Error ? err.message : String(err) });
      void rejoin("join-failed");
    });

    return () => {
      closed = true;
      const instance = call;
      call = null;
      callRef.current = null;
      setParticipants([]);
      setStatus("idle");
      setActiveSpeakerId(null);
      if (instance) void teardown(instance, leavingRef.current ? "left" : "unmount");
    };
    // The call is created once per join; a new token means a new join.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.enabled, options.token]);

  const toggleMic = useCallback(() => {
    const call = callRef.current;
    if (call) call.setLocalAudio(!call.localAudio());
  }, []);

  const toggleCam = useCallback(() => {
    const call = callRef.current;
    if (call) call.setLocalVideo(!call.localVideo());
  }, []);

  const toggleScreenShare = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    const local = call.participants().local;
    const state = (local?.tracks as unknown as Record<string, TrackLike> | undefined)?.screenVideo?.state;
    if (state === "playable" || state === "loading" || state === "sendable") call.stopScreenShare();
    else call.startScreenShare();
  }, []);

  const cycleCamera = useCallback(async () => {
    const call = callRef.current;
    if (call) await call.cycleCamera().catch(() => undefined);
  }, []);

  /** Sends to everyone, or to one session id. App messages are not delivered back to the sender. */
  const sendAppMessage = useCallback((data: unknown, to: string = "*") => {
    const call = callRef.current;
    if (!call) return;
    try {
      call.sendAppMessage(data, to);
    } catch {
      // The call is reconnecting or closing; the message is dropped.
    }
  }, []);

  /** The viewer's own, intentional leave. Only this call leaves; everyone else stays connected. */
  const leave = useCallback(async () => {
    leavingRef.current = true;
    const call = callRef.current;
    log("leave", { intentional: true });
    if (call) await call.leave().catch(() => undefined);
  }, [log]);

  return { status, participants, activeSpeakerId, network, toggleMic, toggleCam, toggleScreenShare, cycleCamera, sendAppMessage, leave, log };
}
