import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  ChevronDown,
  Clock,
  DoorOpen,
  Lock,
  Mic,
  MicOff,
  MoreVertical,
  RefreshCw,
  SwitchCamera,
  Timer,
  Users,
  Video as VideoIcon,
  VideoOff,
  Volume2,
  Wifi,
} from "lucide-react";
import type { OutputType as ClassroomDetails } from "../endpoints/mentorship/classroom/details_GET.schema";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { Sheet, SheetContent, SheetTitle } from "./Sheet";
import { useMediaQuery } from "../helpers/useMediaQuery";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import { useDarkModeObserver } from "../helpers/useDarkModeObserver";
import { getBrandLogo } from "../helpers/brandAssets";
import { JOIN_WINDOW_MINUTES_BEFORE } from "../helpers/liveLessonConfig";
import styles from "./LiveClassroomLobby.module.css";

export type LobbyJoinPrefs = {
  micOn: boolean;
  camOn: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
  outputDeviceId?: string;
};

type DeviceState = "requesting" | "ready" | "off" | "denied" | "missing" | "busy" | "unsupported" | "error";
type StatusTone = "good" | "warn" | "bad" | "muted";

interface LiveClassroomLobbyProps {
  details: ClassroomDetails;
  viewerId: number | null;
  /** When the details request last finished, so the connection check reads its real timing. */
  detailsUpdatedAt: number;
  isJoining: boolean;
  /** Resolves to an error message when the join was refused, or null once the call opens. */
  onJoin: (prefs: LobbyJoinPrefs) => Promise<string | null>;
  onBack: () => void;
}

const DETAILS_PATH = "/_api/mentorship/classroom/details";

const errorToState = (err: unknown): DeviceState => {
  const name = err instanceof DOMException || err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "missing";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  return "error";
};

const videoConstraints = (deviceId?: string): MediaTrackConstraints => ({
  ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  width: { ideal: 1280 },
  height: { ideal: 720 },
});

const audioConstraints = (deviceId?: string): MediaTrackConstraints | boolean =>
  deviceId ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true } : true;

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";

const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
const dateFormat = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

const zoneName = (date: Date) =>
  new Intl.DateTimeFormat("en-IN", { timeZoneName: "short" }).formatToParts(date).find((p) => p.type === "timeZoneName")
    ?.value ?? "";

const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} h ${m} min`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const supportsSinkId = () => typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

type AudioContextCtor = typeof AudioContext;
const getAudioContextCtor = (): AudioContextCtor | null =>
  typeof window === "undefined"
    ? null
    : window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ?? null;

/** Owns the preview camera and microphone tracks, device lists and permission states. */
function useLobbyMedia(startCam: boolean, startMic: boolean) {
  const supported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  const [camState, setCamState] = useState<DeviceState>(!supported ? "unsupported" : startCam ? "requesting" : "off");
  const [micState, setMicState] = useState<DeviceState>(!supported ? "unsupported" : startMic ? "requesting" : "off");
  const [camOn, setCamOn] = useState(startCam);
  const [micOn, setMicOn] = useState(startMic);
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [audioTrack, setAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [devices, setDevices] = useState<{ video: MediaDeviceInfo[]; audio: MediaDeviceInfo[]; output: MediaDeviceInfo[] }>({
    video: [],
    audio: [],
    output: [],
  });
  const [videoDeviceId, setVideoDeviceId] = useState("");
  const [audioDeviceId, setAudioDeviceId] = useState("");
  const [outputDeviceId, setOutputDeviceId] = useState("");

  const videoRef = useRef<MediaStreamTrack | null>(null);
  const audioRef = useRef<MediaStreamTrack | null>(null);
  const camOnRef = useRef(startCam);
  const micOnRef = useRef(startMic);
  const mountedRef = useRef(true);

  const refreshDevices = useCallback(async () => {
    if (!supported || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      if (!mountedRef.current) return;
      setDevices({
        video: list.filter((d) => d.kind === "videoinput" && d.deviceId),
        audio: list.filter((d) => d.kind === "audioinput" && d.deviceId),
        output: list.filter((d) => d.kind === "audiooutput" && d.deviceId),
      });
    } catch {
      // The lists stay as they were; the selectors fall back to the default device.
    }
  }, [supported]);

  const replaceVideo = (track: MediaStreamTrack | null) => {
    if (videoRef.current && videoRef.current !== track) videoRef.current.stop();
    videoRef.current = track;
    setVideoTrack(track);
  };

  const replaceAudio = (track: MediaStreamTrack | null) => {
    if (audioRef.current && audioRef.current !== track) audioRef.current.stop();
    audioRef.current = track;
    setAudioTrack(track);
  };

  const adoptVideo = (track: MediaStreamTrack) => {
    if (!camOnRef.current) {
      track.stop();
      setCamState("off");
      return;
    }
    track.addEventListener("ended", () => {
      if (videoRef.current !== track || !mountedRef.current) return;
      videoRef.current = null;
      setVideoTrack(null);
      setCamState("error");
    });
    replaceVideo(track);
    setCamState("ready");
    setVideoDeviceId(track.getSettings().deviceId ?? "");
  };

  const adoptAudio = (track: MediaStreamTrack) => {
    track.enabled = micOnRef.current;
    track.addEventListener("ended", () => {
      if (audioRef.current !== track || !mountedRef.current) return;
      audioRef.current = null;
      setAudioTrack(null);
      setMicState("error");
    });
    replaceAudio(track);
    setMicState("ready");
    setAudioDeviceId(track.getSettings().deviceId ?? "");
  };

  const acquire = useCallback(
    async (want: { video: boolean; audio: boolean }, ids: { video?: string; audio?: string } = {}): Promise<void> => {
      if (!supported || (!want.video && !want.audio)) return;
      if (want.video) setCamState("requesting");
      if (want.audio) setMicState("requesting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: want.video ? videoConstraints(ids.video) : false,
          audio: want.audio ? audioConstraints(ids.audio) : false,
        });
        if (!mountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const [v] = stream.getVideoTracks();
        const [a] = stream.getAudioTracks();
        if (v) adoptVideo(v);
        if (a) adoptAudio(a);
      } catch (err) {
        if (!mountedRef.current) return;
        // One combined request fails as a whole, so ask again per device to find out which one is the problem.
        if (want.video && want.audio) {
          await acquire({ video: true, audio: false }, ids);
          await acquire({ video: false, audio: true }, ids);
          return;
        }
        const state = errorToState(err);
        if (want.video) setCamState(state);
        if (want.audio) setMicState(state);
      }
      void refreshDevices();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supported, refreshDevices]
  );

  useEffect(() => {
    mountedRef.current = true;
    void acquire({ video: startCam, audio: startMic });
    void refreshDevices();
    const onDeviceChange = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
    return () => {
      mountedRef.current = false;
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
      videoRef.current?.stop();
      audioRef.current?.stop();
      videoRef.current = null;
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCam = () => {
    if (camOnRef.current) {
      camOnRef.current = false;
      setCamOn(false);
      replaceVideo(null);
      setCamState("off");
      return;
    }
    camOnRef.current = true;
    setCamOn(true);
    void acquire({ video: true, audio: false }, { video: videoDeviceId || undefined });
  };

  const toggleMic = () => {
    const next = !micOnRef.current;
    micOnRef.current = next;
    setMicOn(next);
    if (audioRef.current) {
      audioRef.current.enabled = next;
      return;
    }
    if (next) void acquire({ video: false, audio: true }, { audio: audioDeviceId || undefined });
    else setMicState("off");
  };

  const selectVideo = (id: string) => {
    setVideoDeviceId(id);
    if (camOnRef.current) void acquire({ video: true, audio: false }, { video: id || undefined });
  };

  const selectAudio = (id: string) => {
    setAudioDeviceId(id);
    if (micOnRef.current || audioRef.current) void acquire({ video: false, audio: true }, { audio: id || undefined });
  };

  const retry = () => {
    const wantVideo = camOnRef.current && !videoRef.current;
    const wantAudio = micOnRef.current && !audioRef.current;
    void acquire({ video: wantVideo, audio: wantAudio }, { video: videoDeviceId || undefined, audio: audioDeviceId || undefined });
  };

  return {
    supported,
    camState,
    micState,
    camOn,
    micOn,
    videoTrack,
    audioTrack,
    devices,
    videoDeviceId,
    audioDeviceId,
    outputDeviceId,
    setOutputDeviceId,
    toggleCam,
    toggleMic,
    selectVideo,
    selectAudio,
    retry,
  };
}

/** Drives the level bars straight from the microphone track, and reports once real sound was picked up. */
function useMicLevel(track: MediaStreamTrack | null, active: boolean, meterRef: React.RefObject<HTMLElement | null>) {
  const [heard, setHeard] = useState(false);
  const heardRef = useRef(false);

  useEffect(() => {
    const meter = meterRef.current;
    const Ctor = getAudioContextCtor();
    if (!track || !active || !Ctor) {
      meter?.style.setProperty("--level", "0");
      return;
    }
    const ctx = new Ctor();
    const source = ctx.createMediaStreamSource(new MediaStream([track]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let frame = 0;

    const resume = () => {
      if (ctx.state === "suspended") void ctx.resume();
    };
    resume();
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const level = Math.min(1, Math.sqrt(sum / data.length) * 5);
      meterRef.current?.style.setProperty("--level", level.toFixed(3));
      if (level > 0.12 && !heardRef.current) {
        heardRef.current = true;
        setHeard(true);
      }
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      source.disconnect();
      void ctx.close();
      meter?.style.setProperty("--level", "0");
    };
  }, [track, active, meterRef]);

  return heard;
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Online state from the browser, and the measured round trip of the classroom details request. */
function useConnection(detailsUpdatedAt: number) {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const latencyMs = useMemo(() => {
    if (typeof performance === "undefined" || !performance.getEntriesByType) return null;
    const entries = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter((e) =>
      e.name.includes(DETAILS_PATH)
    );
    const last = entries[entries.length - 1];
    if (!last) return null;
    const rtt = last.responseStart > 0 && last.requestStart > 0 ? last.responseStart - last.requestStart : last.duration;
    return rtt > 0 ? Math.round(rtt) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsUpdatedAt]);

  const effectiveType =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType
      : undefined;

  return { online, latencyMs, effectiveType };
}

/**
 * True once the camera has sent a near-uniform picture for a few seconds in a row. A closed
 * privacy shutter or an OS camera block still delivers a live track, only with a flat or
 * placeholder image, so the track alone cannot tell the lobby the picture is unusable.
 */
function useBlankFeed(videoRef: React.RefObject<HTMLVideoElement | null>, track: MediaStreamTrack | null) {
  const [blank, setBlank] = useState(false);
  useEffect(() => {
    setBlank(false);
    if (!track || typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 18;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    let streak = 0;
    const id = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      try {
        ctx.drawImage(video, 0, 0, 32, 18);
        const px = ctx.getImageData(0, 0, 32, 18).data;
        let sum = 0;
        let sq = 0;
        const n = px.length / 4;
        for (let i = 0; i < px.length; i += 4) {
          const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          sum += l;
          sq += l * l;
        }
        const mean = sum / n;
        const spread = Math.sqrt(Math.max(0, sq / n - mean * mean));
        streak = spread < 8 ? streak + 1 : 0;
        setBlank(streak >= 3);
      } catch {
        // A frame that cannot be read is not evidence either way.
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [track, videoRef]);
  return blank;
}

type StatusRow = { key: string; icon: React.ReactNode; label: string; value: string; tone: StatusTone; hint?: string };

const DeviceSelect: React.FC<{
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  options: MediaDeviceInfo[];
  fallback: string;
  disabled?: boolean;
  onChange: (id: string) => void;
}> = ({ id, label, icon, value, options, fallback, disabled, onChange }) => (
  <div className={styles.field}>
    <label htmlFor={id} className={styles.fieldLabel}>
      {label}
    </label>
    <div className={styles.selectWrap}>
      <span className={styles.selectIcon} aria-hidden="true">
        {icon}
      </span>
      <select
        id={id}
        className={styles.select}
        value={options.some((o) => o.deviceId === value) ? value : ""}
        disabled={disabled || options.length === 0}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.length === 0 && <option value="">{fallback}</option>}
        {options.length > 0 && !options.some((o) => o.deviceId === value) && <option value="">{fallback}</option>}
        {options.map((o, i) => (
          <option key={o.deviceId} value={o.deviceId}>
            {o.label || `${label} ${i + 1}`}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className={styles.selectChevron} aria-hidden="true" />
    </div>
  </div>
);

const ControlButton: React.FC<{
  label: string;
  off?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, off, disabled, onClick, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        className={`${styles.control} ${off ? styles.controlOff : ""}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={off === undefined ? undefined : !off}
      >
        {children}
      </button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

/**
 * Pre-meeting lobby for the live classroom. Left: a real camera and microphone preview, mic/camera
 * controls with a More menu of actions that have no control of their own (speaker test, switch
 * camera, ask for access again), device selection and device warnings. Right: the session, its
 * participants, a readiness summary and the Join button. On phones the controls float on the
 * preview, devices fold into a collapsible section and Join is docked. Every status reads the
 * actual device, network or join window;
 * nothing is shown as ready until it has been verified. The chosen devices and on/off states are
 * handed to the call on join, so the video provider does not ask for them a second time.
 */
export const LiveClassroomLobby: React.FC<LiveClassroomLobbyProps> = ({
  details,
  viewerId,
  detailsUpdatedAt,
  isJoining,
  onJoin,
  onBack,
}) => {
  const isDarkMode = useDarkModeObserver();
  const startsMuted = details.kind === "group" && details.viewerRole === "learner";
  const media = useLobbyMedia(!startsMuted, !startsMuted);
  const meterRef = useRef<HTMLSpanElement | null>(null);
  const heard = useMicLevel(media.audioTrack, media.micOn, meterRef);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const blankFeed = useBlankFeed(videoElRef, media.videoTrack);
  const connection = useConnection(detailsUpdatedAt);
  const now = useNow(1000);
  const [speakerState, setSpeakerState] = useState<"idle" | "playing" | "error">("idle");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const isPhone = useMediaQuery("(max-width: 640px)");
  const joiningRef = useRef(false);

  useEffect(() => {
    const el = videoElRef.current;
    if (!el) return;
    el.srcObject = media.videoTrack ? new MediaStream([media.videoTrack]) : null;
  }, [media.videoTrack]);

  const start = new Date(details.startTime);
  const end = new Date(start.getTime() + details.durationMinutes * 60000);
  const opensAt = new Date(details.joinWindow.opensAt);
  const closesAt = new Date(details.joinWindow.closesAt);
  const phase: "cancelled" | "closed" | "early" | "open" =
    details.status === "cancelled"
      ? "cancelled"
      : now > closesAt.getTime()
        ? "closed"
        : now < opensAt.getTime()
          ? "early"
          : "open";

  const self = details.roster.find((m) => m.id === viewerId);
  const selfName = self?.name ?? "You";
  const heading = details.title.replace(/\s*\(\d+\s*min\)\s*$/, "");
  const isPrivate = details.kind === "booking";

  const camRow: StatusRow = (() => {
    const base = { key: "camera", icon: <VideoIcon size={16} aria-hidden="true" />, label: "Camera" };
    switch (media.camState) {
      case "ready":
        return blankFeed
          ? { ...base, value: "No picture", tone: "warn", hint: "Your camera is sending a blank image. If it has a privacy shutter or switch, open it." }
          : { ...base, value: "On", tone: "good" };
      case "off":
        return { ...base, value: "Off", tone: "muted" };
      case "requesting":
        return { ...base, value: "Checking...", tone: "muted", hint: "Allow camera access when your browser asks." };
      case "denied":
        return { ...base, value: "Blocked", tone: "bad", hint: "Allow camera access in your browser's address bar, then select Try again." };
      case "missing":
        return { ...base, value: "Not found", tone: "warn", hint: "Connect a camera, or join with audio only." };
      case "busy":
        return { ...base, value: "In use", tone: "bad", hint: "Another app is using the camera. Close it and select Try again." };
      case "unsupported":
        return { ...base, value: "Unavailable", tone: "warn", hint: "This browser cannot use a camera on this page." };
      default:
        return { ...base, value: "Disconnected", tone: "bad", hint: "Select Try again or pick another camera." };
    }
  })();

  const micRow: StatusRow = (() => {
    const base = { key: "mic", icon: <Mic size={16} aria-hidden="true" />, label: "Microphone" };
    switch (media.micState) {
      case "ready":
        if (!media.micOn) return { ...base, value: "Off", tone: "muted" };
        return heard
          ? { ...base, value: "On", tone: "good" }
          : { ...base, value: "On", tone: "muted", hint: "Say something to check that you can be heard." };
      case "off":
        return { ...base, value: "Off", tone: "muted" };
      case "requesting":
        return { ...base, value: "Checking...", tone: "muted", hint: "Allow microphone access when your browser asks." };
      case "denied":
        return { ...base, value: "Blocked", tone: "bad", hint: "Allow microphone access in your browser's address bar, then select Try again." };
      case "missing":
        return { ...base, value: "Not found", tone: "bad", hint: "Connect a microphone so you can be heard." };
      case "busy":
        return { ...base, value: "In use", tone: "bad", hint: "Another app is using the microphone. Close it and select Try again." };
      case "unsupported":
        return { ...base, value: "Unavailable", tone: "warn", hint: "This browser cannot use a microphone on this page." };
      default:
        return { ...base, value: "Disconnected", tone: "bad", hint: "Select Try again or pick another microphone." };
    }
  })();

  const netRow: StatusRow = (() => {
    const base = { key: "net", icon: <Wifi size={16} aria-hidden="true" />, label: "Internet" };
    if (!connection.online) return { ...base, value: "Offline", tone: "bad", hint: "Reconnect to the internet to join." };
    const latency = connection.latencyMs;
    const weak = connection.effectiveType === "2g" || connection.effectiveType === "slow-2g";
    if (weak || (latency !== null && latency > 1500)) {
      return {
        ...base,
        value: "Slow",
        tone: "warn",
        hint: latency !== null ? `Testkart took ${latency} ms to respond. Video may be choppy.` : "Your network looks weak. Video may be choppy.",
      };
    }
    return { ...base, value: "Connected", tone: "good" };
  })();

  // Camera problems are explained inside the preview itself; microphone and network problems are
  // listed under the selectors; the room's state is in the join panel.
  const issues = [micRow, netRow].filter((r) => r.tone === "bad" || r.tone === "warn");

  const canJoin = phase === "open" && connection.online;
  const showRetry = ["denied", "busy", "error", "missing"].includes(media.camState) || ["denied", "busy", "error", "missing"].includes(media.micState);

  const playTestSound = async () => {
    const Ctor = getAudioContextCtor();
    if (!Ctor || speakerState === "playing") return;
    setSpeakerState("playing");
    let ctx: AudioContext | null = null;
    let el: HTMLAudioElement | null = null;
    try {
      ctx = new Ctor();
      await ctx.resume();
      let out: AudioNode = ctx.destination;
      if (media.outputDeviceId && supportsSinkId()) {
        const dest = ctx.createMediaStreamDestination();
        el = new Audio();
        el.srcObject = dest.stream;
        await (el as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(media.outputDeviceId);
        await el.play();
        out = dest;
      }
      const t0 = ctx.currentTime + 0.05;
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        const at = t0 + i * 0.18;
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);
        osc.connect(gain).connect(out);
        osc.start(at);
        osc.stop(at + 0.6);
      });
      window.setTimeout(() => {
        el?.pause();
        void ctx?.close();
        setSpeakerState("idle");
      }, 1300);
    } catch {
      el?.pause();
      void ctx?.close();
      setSpeakerState("error");
    }
  };

  const handleJoin = async () => {
    if (joiningRef.current || !canJoin) return;
    joiningRef.current = true;
    setJoinError(null);
    const error = await onJoin({
      micOn: media.micOn && media.micState === "ready",
      camOn: media.camOn && media.camState === "ready",
      audioDeviceId: media.audioDeviceId || undefined,
      videoDeviceId: media.videoDeviceId || undefined,
      outputDeviceId: media.outputDeviceId || undefined,
    });
    if (error) {
      setJoinError(error);
      joiningRef.current = false;
    }
  };

  const camJoinsOn = media.camOn && media.camState === "ready";
  const micJoinsOn = media.micOn && media.micState === "ready";
  const joinSummary =
    camJoinsOn === micJoinsOn
      ? `camera and microphone ${camJoinsOn ? "on" : "off"}`
      : `camera ${camJoinsOn ? "on" : "off"} and microphone ${micJoinsOn ? "on" : "off"}`;

  const joinNote =
    phase === "early"
      ? `Joining opens at ${timeFormat.format(opensAt)} (in ${formatCountdown(opensAt.getTime() - now)}), ${JOIN_WINDOW_MINUTES_BEFORE} minutes before the start. The button turns on by itself.`
      : phase === "closed"
        ? `The join window closed at ${timeFormat.format(closesAt)}.`
        : phase === "cancelled"
          ? "This session was cancelled, so the room will not open."
          : !connection.online
            ? "You are offline. Reconnect to join."
            : details.videoProvider !== "daily"
              ? `No live video provider is connected, so this joins a development preview. You'll join with ${joinSummary}.`
              : `You'll join with ${joinSummary}.`;

  const stagePlaceholder = (() => {
    if (media.camState === "requesting") {
      return (
        <>
          <Spinner size="lg" />
          <p className={styles.placeholderText}>Starting your camera...</p>
        </>
      );
    }
    if (media.camState === "ready") return null;
    const message =
      media.camState === "off"
        ? "Camera is off"
        : media.camState === "denied"
          ? "Camera access is blocked"
          : media.camState === "missing"
            ? "No camera detected"
            : media.camState === "busy"
              ? "Camera is being used by another app"
              : media.camState === "unsupported"
                ? "Camera is not available in this browser"
                : "Camera disconnected";
    return (
      <>
        <span className={styles.placeholderRing}>
          {self?.avatarUrl ? (
            <img src={self.avatarUrl} alt="" className={styles.placeholderAvatar} />
          ) : (
            <span className={styles.placeholderInitials} aria-hidden="true">
              {initialsOf(selfName)}
            </span>
          )}
        </span>
        <p className={styles.placeholderText}>{message}</p>
        {media.camState !== "off" && camRow.hint && <p className={styles.placeholderHint}>{camRow.hint}</p>}
      </>
    );
  })();

  const tz = zoneName(start);

  // Teacher first, then the viewer, then everyone else.
  const people = [...details.roster].sort((a, b) => {
    const rank = (m: (typeof details.roster)[number]) => (m.role === "teacher" ? 0 : m.id === viewerId ? 1 : 2);
    return rank(a) - rank(b);
  });

  const avatarOf = (m: (typeof details.roster)[number], className: string) => (
    <span className={`${className} ${m.role === "teacher" ? styles.ringTeacher : styles.ringStudent}`}>
      {m.avatarUrl ? <img src={m.avatarUrl} alt="" /> : <span aria-hidden="true">{initialsOf(m.name)}</span>}
    </span>
  );

  // The preview shows at most three overlapping avatars; the rest are counted as +N.
  const shownAvatars = people.slice(0, 3);
  const hiddenCount = people.length - shownAvatars.length;
  const roleOf = (m: (typeof details.roster)[number]) =>
    `${m.role === "teacher" ? "Teacher" : "Student"}${m.id === viewerId ? " · You" : ""}`;

  const roomRow: StatusRow = {
    key: "room",
    icon: <DoorOpen size={16} aria-hidden="true" />,
    label: "Meeting room",
    value:
      phase === "cancelled"
        ? "Cancelled"
        : phase === "closed"
          ? `Closed ${timeFormat.format(closesAt)}`
          : phase === "early"
            ? `Opens ${timeFormat.format(opensAt)}`
            : `Open until ${timeFormat.format(closesAt)}`,
    tone: phase === "open" ? (details.videoProvider === "daily" ? "good" : "warn") : phase === "early" ? "muted" : "bad",
  };
  const readiness = [camRow, micRow, netRow, roomRow];
  const deviceSummary = `Camera ${camRow.value.toLowerCase()} · Mic ${micRow.value.toLowerCase()} · ${netRow.value}`;

  const readinessList = (
    <ul className={styles.statusList}>
      {readiness.map((r) => (
        <li key={r.key} className={styles.statusRow}>
          <span className={styles.statusIcon}>{r.icon}</span>
          <span className={styles.statusLabel}>{r.label}</span>
          <span className={`${styles.statusValue} ${styles[`value_${r.tone}`]}`}>
            <span className={styles.statusDot} aria-hidden="true" />
            {r.value}
          </span>
        </li>
      ))}
    </ul>
  );

  const deviceFields = (
    <div className={styles.deviceBar}>
      <DeviceSelect
        id="lobby-camera"
        label="Camera"
        icon={<Camera size={15} aria-hidden="true" />}
        value={media.videoDeviceId}
        options={media.devices.video}
        fallback={media.supported ? "Default camera" : "Not available"}
        disabled={!media.camOn}
        onChange={media.selectVideo}
      />
      <DeviceSelect
        id="lobby-mic"
        label="Microphone"
        icon={<Mic size={15} aria-hidden="true" />}
        value={media.audioDeviceId}
        options={media.devices.audio}
        fallback={media.supported ? "Default microphone" : "Not available"}
        onChange={media.selectAudio}
      />
      {supportsSinkId() && media.devices.output.length > 0 && (
        <DeviceSelect
          id="lobby-speaker"
          label="Speaker"
          icon={<Volume2 size={15} aria-hidden="true" />}
          value={media.outputDeviceId}
          options={media.devices.output}
          fallback="Default speaker"
          onChange={media.setOutputDeviceId}
        />
      )}
    </div>
  );

  const cameras = media.devices.video;
  const nextCamera =
    cameras.length > 1 ? cameras[(cameras.findIndex((d) => d.deviceId === media.videoDeviceId) + 1) % cameras.length] : null;

  // The More menu only offers actions that have no control of their own on the page.
  const moreActions = (
    <ul className={styles.menu} aria-label="More options">
      <li>
        <button
          type="button"
          className={styles.menuItem}
          onClick={() => void playTestSound()}
          disabled={speakerState === "playing" || !getAudioContextCtor()}
        >
          <Volume2 size={18} aria-hidden="true" />
          <span className={styles.menuText}>
            <span className={styles.menuLabel}>{speakerState === "playing" ? "Playing test sound..." : "Test speaker"}</span>
            <span className={styles.menuHint}>
              {speakerState === "error" ? "Could not play on this device. Try again." : "Plays a short chime so you can check your volume"}
            </span>
          </span>
        </button>
      </li>
      {nextCamera && media.camOn && (
        <li>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              media.selectVideo(nextCamera.deviceId);
              setInfoOpen(false);
            }}
          >
            <SwitchCamera size={18} aria-hidden="true" />
            <span className={styles.menuText}>
              <span className={styles.menuLabel}>Switch camera</span>
              <span className={styles.menuHint}>{nextCamera.label || "Use the next camera"}</span>
            </span>
          </button>
        </li>
      )}
      {showRetry && (
        <li>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              media.retry();
              setInfoOpen(false);
            }}
          >
            <RefreshCw size={18} aria-hidden="true" />
            <span className={styles.menuText}>
              <span className={styles.menuLabel}>Try again</span>
              <span className={styles.menuHint}>Ask for camera and microphone access again</span>
            </span>
          </button>
        </li>
      )}
    </ul>
  );

  return (
    <main className={`${styles.lobby} tk-flow`}>
      <header className={styles.topBar}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Back</span>
        </button>
        <img src={getBrandLogo(isDarkMode)} alt="Testkart" className={styles.logo} />
        <span className={styles.topBarSpacer} aria-hidden="true" />
      </header>

      <div className={styles.layout}>
        <section className={styles.previewColumn} aria-label="Camera and microphone">
          <div className={styles.stageWrap}>
            <div className={styles.stage}>
              <video
                ref={videoElRef}
                className={`${styles.video} ${media.camState === "ready" ? "" : styles.videoHidden}`}
                autoPlay
                playsInline
                muted
              />
              {stagePlaceholder && <div className={styles.placeholder}>{stagePlaceholder}</div>}

              <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={`${styles.participants} ${styles.participantsButton}`}
                      aria-label={`${people.length} ${people.length === 1 ? "participant" : "participants"} in this session. Show everyone.`}
                    >
                      <span className={styles.avatarStack} aria-hidden="true">
                        {shownAvatars.map((m) => (
                          <React.Fragment key={`${m.role}-${m.id}`}>{avatarOf(m, styles.stackAvatar)}</React.Fragment>
                        ))}
                      </span>
                      <span className={styles.participantsCount} aria-hidden="true">
                        {hiddenCount > 0
                          ? `+${hiddenCount} participants`
                          : `${people.length} ${people.length === 1 ? "participant" : "participants"}`}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="start"
                    sideOffset={8}
                    collisionPadding={16}
                    removeBackgroundAndPadding
                    className={`${styles.infoPopover} ${styles.peoplePopover}`}
                    aria-label="Everyone in this session"
                  >
                    <ul className={styles.peopleList}>
                      {people.map((m) => (
                        <li key={`${m.role}-${m.id}`} className={styles.personRow}>
                          {avatarOf(m, styles.personAvatar)}
                          <span className={styles.personText}>
                            <span className={styles.personName}>{m.name}</span>
                            <span className={styles.personRole}>{roleOf(m)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </PopoverContent>
                </Popover>

              <span className={styles.stageLabel}>
                {media.camOn && media.camState === "ready" ? (
                  <VideoIcon size={14} aria-hidden="true" />
                ) : (
                  <VideoOff size={14} aria-hidden="true" />
                )}
                {media.camOn && media.camState === "ready" ? "Camera on" : "Camera off"}
              </span>

              {blankFeed && media.camState === "ready" && (
                <p className={styles.stageNotice} role="status">
                  Your camera is sending a blank picture. If it has a privacy shutter or switch, open it.
                </p>
              )}

              <div className={styles.stageBar}>
                <span className={styles.stageName}>
                  {media.micOn && media.micState === "ready" ? (
                    <span ref={meterRef} className={styles.meter} aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : (
                    <MicOff size={15} className={styles.mutedIcon} aria-hidden="true" />
                  )}
                  <span className={styles.stageNameText}>{selfName}</span>
                </span>
              </div>
            </div>

            <div className={styles.controls} role="toolbar" aria-label="Microphone, camera and more options">
                <ControlButton
                  label={media.micOn ? "Mute microphone" : "Unmute microphone"}
                  off={!media.micOn}
                  disabled={media.micState === "unsupported"}
                  onClick={media.toggleMic}
                >
                  {media.micOn ? <Mic size={20} aria-hidden="true" /> : <MicOff size={20} aria-hidden="true" />}
                </ControlButton>
                <ControlButton
                  label={media.camOn ? "Turn camera off" : "Turn camera on"}
                  off={!media.camOn}
                  disabled={media.camState === "unsupported"}
                  onClick={media.toggleCam}
                >
                  {media.camOn ? <VideoIcon size={20} aria-hidden="true" /> : <VideoOff size={20} aria-hidden="true" />}
                </ControlButton>
                <Popover open={!isPhone && infoOpen} onOpenChange={setInfoOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={`${styles.control} ${infoOpen ? styles.controlActive : ""}`}
                          aria-label="More options"
                          aria-expanded={infoOpen}
                        >
                          <MoreVertical size={20} aria-hidden="true" />
                        </button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>More options</TooltipContent>
                  </Tooltip>
                  <PopoverContent
                    side="top"
                    align="center"
                    sideOffset={12}
                    collisionPadding={16}
                    removeBackgroundAndPadding
                    className={styles.infoPopover}
                    aria-label="More options"
                  >
                    {moreActions}
                  </PopoverContent>
                </Popover>
            </div>
          </div>

          {speakerState === "error" && (
            <p className={styles.inlineError} role="alert">
              Could not play the test sound on this device.
            </p>
          )}

          {!isPhone && deviceFields}

          {startsMuted && (
            <p className={styles.groupNote}>Group classes start with your camera off and microphone muted. You can turn them on once you are in.</p>
          )}

          {issues.length > 0 && (
            <ul className={styles.issues} aria-live="polite">
              {issues.map((r) => (
                <li key={r.key} className={r.tone === "bad" ? styles.issueBad : styles.issueWarn}>
                  <AlertTriangle size={15} aria-hidden="true" />
                  <span>
                    <strong>
                      {r.label}: {r.value}.
                    </strong>{" "}
                    {r.hint}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className={styles.panel} aria-labelledby="lobby-title">
          <div className={styles.panelSection}>
            <p className={styles.sessionType}>
              {isPrivate ? <Lock size={13} aria-hidden="true" /> : <Users size={13} aria-hidden="true" />}
              {isPrivate ? "Private 1:1 session" : "Group class"}
            </p>
            <h1 id="lobby-title" className={styles.title}>
              {heading}
            </h1>
            <ul className={styles.facts}>
              <li>
                <CalendarDays size={15} aria-hidden="true" />
                {dateFormat.format(start)}
              </li>
              <li>
                <Clock size={15} aria-hidden="true" />
                {timeFormat.format(start)} - {timeFormat.format(end)}
                {tz && <span className={styles.tz}>{tz}</span>}
              </li>
              <li>
                <Timer size={15} aria-hidden="true" />
                {details.durationMinutes} min
              </li>
            </ul>
          </div>

          {isPhone ? (
            <section className={styles.panelSection}>
              <button
                type="button"
                className={styles.collapseToggle}
                aria-expanded={devicesOpen}
                aria-controls="lobby-devices"
                onClick={() => setDevicesOpen((v) => !v)}
              >
                <span className={styles.collapseText}>
                  <span className={styles.sectionTitle}>Devices</span>
                  <span className={styles.collapseSummary}>{deviceSummary}</span>
                </span>
                <ChevronDown size={18} className={`${styles.collapseChevron} ${devicesOpen ? styles.collapseChevronOpen : ""}`} aria-hidden="true" />
              </button>
              {devicesOpen && (
                <div id="lobby-devices" className={styles.collapseBody}>
                  {readinessList}
                  {deviceFields}
                </div>
              )}
            </section>
          ) : (
            <section className={styles.panelSection} aria-labelledby="lobby-status-title">
              <h2 id="lobby-status-title" className={styles.sectionTitle}>
                Readiness
              </h2>
              {readinessList}
            </section>
          )}

          <div className={styles.joinDock}>
            <Button size="lg" className={styles.joinButton} onClick={handleJoin} disabled={!canJoin || isJoining}>
              {isJoining ? (
                <>
                  <Spinner size="sm" /> Connecting...
                </>
              ) : (
                <>
                  <span>Join meeting</span>
                  <ArrowRight size={20} className={styles.joinArrow} aria-hidden="true" />
                </>
              )}
            </Button>
            {joinError ? (
              <p className={styles.joinError} role="alert">
                {joinError}
              </p>
            ) : (
              <p className={`${styles.joinNote} ${phase === "open" ? "" : styles.joinNoteBlocked}`}>{joinNote}</p>
            )}
          </div>
        </aside>
      </div>

      <Sheet open={isPhone && infoOpen} onOpenChange={setInfoOpen}>
        <SheetContent side="bottom" className={styles.infoSheet} aria-describedby={undefined}>
          <SheetTitle className={styles.srOnly}>More options</SheetTitle>
          <span className={styles.sheetGrip} aria-hidden="true" />
          {moreActions}
        </SheetContent>
      </Sheet>
    </main>
  );
};
