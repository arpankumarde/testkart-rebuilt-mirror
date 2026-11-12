import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  MonitorUp,
  MonitorX,
  MessageSquare,
  PenTool,
  Users,
  MoreVertical,
  PhoneOff,
  Info,
  Wifi,
  WifiOff,
  FileText,
  NotebookPen,
  SwitchCamera,
  CircleStop,
  Clock,
  X,
  Plus,
  Trash2,
  Link2,
  Crown,
  AlertTriangle,
  Hourglass,
} from "lucide-react";
import type { OutputType as ClassroomDetails } from "../endpoints/mentorship/classroom/details_GET.schema";
import type { ChatMessageOut, OutputType as ChatList } from "../endpoints/mentorship/classroom/chat/list_GET.schema";
import {
  ClassroomKind,
  useClassroomChatListQuery,
  useClassroomChatSendMutation,
  useClassroomMaterialsQuery,
  useClassroomMaterialAddMutation,
  useClassroomMaterialDeleteMutation,
  useTeacherMentorshipNotesQuery,
  useTeacherMentorshipNoteUpsertMutation,
} from "../helpers/useLiveClassroom";
import { CallParticipant, useDailyCall } from "../helpers/useDailyCall";
import { useClassroomWhiteboard } from "../helpers/useClassroomWhiteboard";
import { useMediaQuery } from "../helpers/useMediaQuery";
import { useDarkModeObserver } from "../helpers/useDarkModeObserver";
import { getBrandLogo } from "../helpers/brandAssets";
import { ClassroomVideoTile, ClassroomRemoteAudio, ClassroomAvatar } from "./ClassroomVideoTile";
import { ClassroomChat } from "./ClassroomChat";
import { ClassroomWhiteboard } from "./ClassroomWhiteboard";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./DropdownMenu";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import type { LobbyJoinPrefs } from "./LiveClassroomLobby";
import styles from "./ClassroomSession.module.css";

/* The right-hand utility panel shows one of these at a time. The first four are its tabs. */
type PanelKey = "chat" | "board" | "people" | "info" | "materials" | "notes";
const PANEL_TABS: { key: PanelKey; label: string }[] = [
  { key: "chat", label: "Chat" },
  { key: "board", label: "Whiteboard" },
  { key: "people", label: "People" },
  { key: "info", label: "Info" },
];
const PANEL_TITLES: Record<PanelKey, string> = {
  chat: "Chat",
  board: "Whiteboard",
  people: "People",
  info: "Meeting info",
  materials: "Materials",
  notes: "Private notes",
};

export type ClassroomSessionInfo = {
  attendanceId: string;
  role: "teacher" | "learner";
  provider: string;
  url: string;
  token: string;
  prefs: LobbyJoinPrefs;
  /** Who joined: the call and its token belong to this account even if the browser signs in as someone else. */
  ownerUserId: number | null;
  ownerName: string;
};

const formatElapsed = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
const dateFormat = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });

const canShareScreen = () => typeof navigator !== "undefined" && !!navigator.mediaDevices && "getDisplayMedia" in navigator.mediaDevices;

interface ControlProps {
  label: string;
  /** Visible text beside the icon; without it the control is a round icon button with a tooltip. */
  text?: string;
  onClick?: () => void;
  active?: boolean;
  off?: boolean;
  badge?: number;
  dot?: boolean;
  withTooltip: boolean;
  children: React.ReactNode;
}

/**
 * One toolbar control. Round icon buttons (mic, camera, more) or labelled pills (Present, Chat,
 * Whiteboard, People). Red when a device is off, coral-tinted while its panel is open. On phones
 * every control shows its label under the icon.
 */
const Control = React.forwardRef<HTMLButtonElement, ControlProps & React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ label, text, onClick, active, off, badge, dot, withTooltip, children, className, ...rest }, ref) => {
    const button = (
      <button
        ref={ref}
        type="button"
        className={`${styles.control} ${text ? styles.controlPill : ""} ${off ? styles.controlOff : ""} ${active ? styles.controlActive : ""} ${className ?? ""}`}
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        {...rest}
      >
        <span className={styles.controlIcon}>
          {children}
          {!!badge && <span className={styles.badge}>{badge > 9 ? "9+" : badge}</span>}
          {dot && !badge && <span className={styles.dot} aria-hidden="true" />}
        </span>
        <span className={`${styles.controlText} ${text ? "" : styles.controlTextPhoneOnly}`}>{text ?? label}</span>
      </button>
    );
    if (!withTooltip) return button;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    );
  }
);
Control.displayName = "Control";

interface ClassroomSessionProps {
  kind: ClassroomKind;
  id: string;
  details: ClassroomDetails;
  session: ClassroomSessionInfo;
  /** True when this browser's session cookie now belongs to a different account than the one in the call. */
  accountChanged: boolean;
  /** Records the leave and shows the post-session screen. */
  onLeave: () => void;
  /** Teacher only: marks the session complete for everyone, then leaves. */
  onEndSession: () => Promise<void>;
  isEnding: boolean;
}

/**
 * The in-call screen, laid out like a familiar meeting app: a slim header (title, timer, time left,
 * connection), the stage in the middle, an optional utility panel on the right (Chat, Whiteboard,
 * People, Info as tabs, one at a time) and a centred bottom toolbar ending in Leave.
 *
 * Daily's call object carries audio and video (helpers/useDailyCall.tsx); every tile and control
 * is ours. Switching panels never touches the call. Chat is saved through the chat endpoint and
 * pushed to the others as a Daily app message, with a slow poll as a fallback; the whiteboard is
 * shared over app messages. With the development mock provider there is no media at all and the
 * screen says so.
 */
export const ClassroomSession: React.FC<ClassroomSessionProps> = ({
  kind,
  id,
  details,
  session,
  accountChanged,
  onLeave,
  onEndSession,
  isEnding,
}) => {
  const viewerId = session.ownerUserId;
  const viewerName = session.ownerName;
  const isPhone = useMediaQuery("(max-width: 640px)");
  const isDark = useDarkModeObserver();
  const queryClient = useQueryClient();
  const isLive = session.provider === "daily";
  const isTeacher = session.role === "teacher";
  const selfIdentity = viewerId !== null ? `user-${viewerId}` : "user-unknown";
  const closesAt = new Date(details.joinWindow.closesAt);

  const [panel, setPanel] = useState<PanelKey | null>(null);
  const [boardExpanded, setBoardExpanded] = useState(false);
  const [boardUnseen, setBoardUnseen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [mockMic, setMockMic] = useState(session.prefs.micOn);
  const [mockCam, setMockCam] = useState(session.prefs.camOn);
  const [endOpen, setEndOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leftName, setLeftName] = useState<string | null>(null);
  const [videoInputs, setVideoInputs] = useState(0);
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const leavingRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((list) => setVideoInputs(list.filter((d) => d.kind === "videoinput").length))
      .catch(() => undefined);
  }, []);

  const openPanel = useCallback((key: PanelKey) => {
    setPanel(key);
    if (key === "board") setBoardUnseen(false);
    else setBoardExpanded(false);
  }, []);

  const togglePanel = (key: PanelKey) => {
    if (panel === key) {
      setPanel(null);
      setBoardExpanded(false);
      return;
    }
    openPanel(key);
    if (key === "board") board.announceOpen(viewerName);
  };

  /* ------------------------------------------------------------ whiteboard --- */

  const sendRef = useRef<(data: unknown, to?: string) => void>(() => undefined);

  const board = useClassroomWhiteboard({
    selfId: selfIdentity,
    storageKey: `tk-classroom-board-${kind}-${id}`,
    send: (data, to) => sendRef.current(data, to),
    onRemoteChange: () => {
      if (panelRef.current !== "board") setBoardUnseen(true);
    },
    onRemoteOpen: (name) => {
      if (panelRef.current === "board") return;
      setBoardUnseen(true);
      toast(`${name} opened the whiteboard`, { action: { label: "Open", onClick: () => openPanel("board") } });
    },
  });

  /* ------------------------------------------------------------------ chat --- */

  const chatKey = useMemo(() => ["mentorship", "classroom", "chat", kind, id], [kind, id]);
  const chatQuery = useClassroomChatListQuery(kind, id, true, isLive ? 15000 : 4000);
  const sendChat = useClassroomChatSendMutation();
  const messages = chatQuery.data?.messages ?? [];
  const [seenCount, setSeenCount] = useState<number | null>(null);

  useEffect(() => {
    if (seenCount === null && chatQuery.data) setSeenCount(chatQuery.data.messages.length);
  }, [chatQuery.data, seenCount]);

  useEffect(() => {
    if (panel === "chat") setSeenCount(messages.length);
  }, [panel, messages.length]);

  const unread = seenCount === null ? 0 : messages.slice(seenCount).filter((m) => m.senderId !== viewerId).length;

  const appendChat = useCallback(
    (m: ChatMessageOut) => {
      queryClient.setQueryData<ChatList>(chatKey, (old) =>
        !old ? { messages: [m] } : old.messages.some((x) => x.id === m.id) ? old : { messages: [...old.messages, m] }
      );
    },
    [queryClient, chatKey]
  );

  /* ----------------------------------------------------------------- daily --- */

  const handleAppMessage = useCallback(
    (data: unknown, fromId: string) => {
      if (!data || typeof data !== "object") return;
      if ((data as { t?: unknown }).t === "chat") {
        const raw = (data as { m?: ChatMessageOut }).m;
        if (!raw || typeof raw.id !== "string" || typeof raw.body !== "string") return;
        const m: ChatMessageOut = { ...raw, createdAt: new Date(raw.createdAt) };
        appendChat(m);
        if (panelRef.current !== "chat") toast(`${m.senderName}: ${m.body.length > 80 ? `${m.body.slice(0, 80)}...` : m.body}`);
        return;
      }
      board.handleMessage(data, fromId);
    },
    [appendChat, board.handleMessage]
  );

  const daily = useDailyCall({
    enabled: isLive,
    url: session.url,
    token: session.token,
    startAudioOff: !session.prefs.micOn,
    startVideoOff: !session.prefs.camOn,
    audioSource: session.prefs.audioDeviceId,
    videoSource: session.prefs.videoDeviceId,
    outputDeviceId: session.prefs.outputDeviceId,
    logContext: { userId: viewerId, role: session.role, kind, lessonId: id },
    endsAt: details.joinWindow.closesAt,
    onAppMessage: handleAppMessage,
    onEnded: (message) => {
      if (leavingRef.current) return;
      leavingRef.current = true;
      if (message) toast.info(message);
      onLeave();
    },
    onJoined: () => board.requestSync(),
    onParticipantJoined: (name) => {
      setLeftName(null);
      toast.success(`${name} joined`);
    },
    onParticipantLeft: (name) => {
      setLeftName(name);
      toast(`${name} left the call`);
    },
    onNonFatalError: (type) => {
      if (type === "screen-share-error") toast.error("Screen sharing did not start.");
    },
  });
  sendRef.current = daily.sendAppMessage;

  const handleSendChat = async (body: string) => {
    if (accountChanged) {
      toast.error("This browser is now signed in as another account, so messages would be sent under that name.");
      return false;
    }
    try {
      const result = await sendChat.mutateAsync({ kind, id, body });
      appendChat(result.message);
      daily.sendAppMessage({ t: "chat", m: result.message });
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the message.");
      return false;
    }
  };

  /* ---------------------------------------------------------- participants --- */

  const rosterById = useMemo(() => new Map(details.roster.map((m) => [m.id, m])), [details.roster]);
  const memberOf = (userId: string | null) => {
    const n = userId?.startsWith("user-") ? Number(userId.slice(5)) : NaN;
    return Number.isFinite(n) ? rosterById.get(n) ?? null : null;
  };

  const people: CallParticipant[] = isLive
    ? daily.participants
    : [
        {
          sessionId: "local",
          userId: selfIdentity,
          name: viewerName,
          local: true,
          owner: isTeacher,
          audioOn: mockMic,
          videoOn: mockCam,
          videoTrack: null,
          audioTrack: null,
          screenVideoTrack: null,
          screenAudioTrack: null,
        },
      ];
  const local = people.find((p) => p.local) ?? null;
  const remotes = people.filter((p) => !p.local);
  const micOn = isLive ? (local ? local.audioOn : session.prefs.micOn) : mockMic;
  const camOn = isLive ? (local ? local.videoOn : session.prefs.camOn) : mockCam;
  const sharer = people.find((p) => p.screenVideoTrack) ?? null;
  const isSharing = !!local?.screenVideoTrack;
  const connecting = isLive && daily.status !== "joined" && daily.status !== "reconnecting";
  const shareAllowed = isLive && !isPhone && canShareScreen() && !(kind === "group" && !isTeacher);

  const tileProps = (p: CallParticipant) => {
    const member = memberOf(p.userId);
    return {
      name: p.local ? viewerName : member?.name ?? p.name,
      avatarUrl: member?.avatarUrl ?? null,
      track: p.videoTrack,
      audioOn: p.audioOn,
      isLocal: p.local,
      isTeacher: member ? member.role === "teacher" : p.owner,
      speaking: !!daily.activeSpeakerId && daily.activeSpeakerId === p.sessionId && p.audioOn && people.length > 1,
    };
  };

  const otherLearner = details.roster.find((m) => m.id !== viewerId && m.role === "learner");
  const learnerCount = details.roster.filter((m) => m.role === "learner").length;
  const waitingFor = isTeacher
    ? kind === "booking"
      ? { name: otherLearner?.name ?? "Your student", avatarUrl: otherLearner?.avatarUrl ?? null, role: "Student" }
      : { name: `${learnerCount} enrolled student${learnerCount === 1 ? "" : "s"}`, avatarUrl: null, role: "Group class" }
    : { name: details.teacherName, avatarUrl: details.teacherAvatarUrl, role: "Teacher" };
  const waitingTitle = leftName
    ? `${leftName} left the call`
    : isTeacher
      ? kind === "booking"
        ? "Waiting for your student to join"
        : "Waiting for students to join"
      : "Waiting for your teacher to join";

  const otherName = isTeacher ? (kind === "booking" ? otherLearner?.name ?? "your student" : `${learnerCount} students`) : details.teacherName;

  /* --------------------------------------------------------------- actions --- */

  const toggleMic = () => (isLive ? daily.toggleMic() : setMockMic((v) => !v));
  const toggleCam = () => (isLive ? daily.toggleCam() : setMockCam((v) => !v));

  /** Leaves only this person's call; everyone else stays connected. */
  const leaveCall = async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    if (isLive) await daily.leave();
    onLeave();
  };

  /* -------------------------------------------------------- connection --- */

  const minutesLeft = Math.max(0, Math.ceil((closesAt.getTime() - Date.now()) / 60000));
  const connection = !isLive
    ? { label: "Preview only", tone: styles.toneMuted, icon: <WifiOff size={14} aria-hidden="true" /> }
    : daily.status === "reconnecting"
      ? { label: "Reconnecting", tone: styles.toneBad, icon: <WifiOff size={14} aria-hidden="true" /> }
      : connecting
        ? { label: "Connecting", tone: styles.toneMuted, icon: <Wifi size={14} aria-hidden="true" /> }
        : daily.network === "very-low"
          ? { label: "Poor connection", tone: styles.toneBad, icon: <Wifi size={14} aria-hidden="true" /> }
          : daily.network === "low"
            ? { label: "Weak connection", tone: styles.toneWarn, icon: <Wifi size={14} aria-hidden="true" /> }
            : { label: "Connected", tone: styles.toneGood, icon: <Wifi size={14} aria-hidden="true" /> };

  /* ------------------------------------------------------------- the stage --- */

  const startsAt = new Date(details.startTime);
  const boardFileName = `testkart-whiteboard-${dateFormat.format(new Date()).replace(/[\s,]+/g, "-")}.png`;

  const filmstrip = (
    <div className={styles.filmstrip} aria-label="Participants">
      {people.map((p) => (
        <ClassroomVideoTile key={p.sessionId} {...tileProps(p)} variant="thumb" />
      ))}
    </div>
  );

  const localTile = (variant: "stage" | "pip") =>
    local ? (
      <ClassroomVideoTile {...tileProps(local)} variant={variant} className={styles.duoLocal} />
    ) : (
      <div className={`${styles.previewPending} ${styles.duoLocal}`}>
        <span className={styles.spinner} aria-hidden="true" />
        <span>Connecting your camera...</span>
      </div>
    );

  const waitingTile = (
    <div className={`${styles.waitingTile} ${styles.duoRemote}`} role="status" aria-live="polite">
      <div className={styles.waitingAvatar}>
        <span className={styles.pulse} aria-hidden="true" />
        <ClassroomAvatar name={waitingFor.name} src={waitingFor.avatarUrl} size="lg" />
      </div>
      <span className={styles.waitingRole}>{waitingFor.role}</span>
      <p className={styles.waitingName}>{waitingFor.name}</p>
      <h2 className={styles.waitingTitle}>{waitingTitle}</h2>
      <span className={styles.dots} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <p className={styles.waitingMeta}>
        <span className={`${styles.statusDot} ${connection.tone}`} aria-hidden="true" />
        {connecting ? "Connecting to the classroom" : daily.status === "reconnecting" ? "Reconnecting" : isLive ? "You're connected" : "Preview only"}
        <span aria-hidden="true">&middot;</span>
        Class {startsAt.getTime() > Date.now() ? "starts" : "started"} at {timeFormat.format(startsAt)}
      </p>
    </div>
  );

  let stage: React.ReactNode;
  if (panel === "board" && boardExpanded) {
    stage = (
      <div className={styles.boardLayout}>
        <div className={styles.boardMain}>
          <ClassroomWhiteboard
            board={board}
            onClose={() => togglePanel("board")}
            fileName={boardFileName}
            expanded
            onToggleExpand={() => setBoardExpanded(false)}
          />
        </div>
        {filmstrip}
      </div>
    );
  } else if (sharer?.screenVideoTrack) {
    const member = memberOf(sharer.userId);
    stage = (
      <div className={styles.shareLayout}>
        <div className={styles.shareMain}>
          <ClassroomVideoTile name={sharer.local ? "You" : member?.name ?? sharer.name} track={sharer.screenVideoTrack} audioOn isScreen variant="stage" />
        </div>
        {filmstrip}
      </div>
    );
  } else if (remotes.length === 0) {
    stage = (
      <div className={`${styles.duo} ${styles.duoWaiting}`}>
        {localTile(isPhone ? "pip" : "stage")}
        {waitingTile}
      </div>
    );
  } else if (remotes.length === 1 && local) {
    stage = (
      <div className={styles.duo}>
        {localTile(isPhone ? "pip" : "stage")}
        <ClassroomVideoTile {...tileProps(remotes[0])} variant="stage" className={styles.duoRemote} />
      </div>
    );
  } else {
    const count = people.length;
    const cols = count <= 4 ? 2 : count <= 9 ? 3 : 4;
    stage = (
      <div className={styles.grid} style={{ "--cols": isPhone ? Math.min(cols, 2) : cols } as React.CSSProperties}>
        {people.map((p) => (
          <ClassroomVideoTile key={p.sessionId} {...tileProps(p)} variant="stage" />
        ))}
      </div>
    );
  }

  const notJoined = details.roster.filter((m) => m.id !== viewerId && !people.some((p) => memberOf(p.userId)?.id === m.id));
  const showPanel = panel && !(panel === "board" && boardExpanded);

  return (
    <main className={`${styles.room} tk-flow`}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <img src={getBrandLogo(isDark)} alt="Testkart" className={styles.logo} />
          <span className={styles.headerDivider} aria-hidden="true" />
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>{details.title}</h1>
            <span className={styles.subtitle}>
              {kind === "booking" ? "1:1 session" : "Group class"} with {otherName}
            </span>
          </div>
        </div>
        <div className={styles.headerRight}>
          {!isLive && (
            <span className={styles.mockBadge}>
              <AlertTriangle size={13} aria-hidden="true" /> Development preview
            </span>
          )}
          {minutesLeft <= 10 && (
            <span className={`${styles.chip} ${styles.toneWarn}`} title={`The room closes at ${timeFormat.format(closesAt)}`}>
              <Hourglass size={13} aria-hidden="true" /> {minutesLeft === 0 ? "Time is up" : `${minutesLeft} min left`}
            </span>
          )}
          <span className={styles.chip} aria-label={`Time in the room ${formatElapsed(elapsed)}`}>
            <span className={styles.liveDot} aria-hidden="true" />
            {formatElapsed(elapsed)}
          </span>
          <span className={`${styles.chip} ${connection.tone}`} role="status">
            {connection.icon}
            <span className={styles.chipLabel}>{connection.label}</span>
          </span>
        </div>
      </header>

      <div className={styles.body}>
        {(accountChanged || daily.status === "reconnecting") && (
          <div className={styles.banners}>
            {accountChanged && (
              <div className={`${styles.banner} ${styles.bannerWarn}`} role="alert">
                <AlertTriangle size={15} aria-hidden="true" /> This browser is now signed in as another account. Your call continues; use a separate
                browser or a private window for each person.
              </div>
            )}
            {daily.status === "reconnecting" && (
              <div className={styles.banner} role="alert">
                <WifiOff size={15} aria-hidden="true" /> Connection lost. Reconnecting...
              </div>
            )}
          </div>
        )}

        <section className={styles.stage} aria-label="Video">
          {stage}
        </section>

        {showPanel && panel && (
          <aside className={`${styles.panel} ${panel === "board" ? styles.panelWide : ""}`} aria-label={PANEL_TITLES[panel]}>
            <div className={styles.panelHead}>
              <span className={styles.sheetGrip} aria-hidden="true" />
              <div className={styles.panelTabs} role="tablist" aria-label="Meeting tools">
                {PANEL_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={panel === t.key}
                    className={`${styles.panelTab} ${panel === t.key ? styles.panelTabActive : ""}`}
                    onClick={() => (panel === t.key ? undefined : togglePanel(t.key))}
                  >
                    {t.label}
                    {t.key === "chat" && unread > 0 && panel !== "chat" && <span className={styles.tabBadge}>{unread}</span>}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.panelClose}
                onClick={() => {
                  setPanel(null);
                  setBoardExpanded(false);
                }}
                aria-label="Close panel"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            {(panel === "materials" || panel === "notes") && <h2 className={styles.panelTitle}>{PANEL_TITLES[panel]}</h2>}

            {panel === "chat" && (
              <ClassroomChat messages={messages} viewerId={viewerId} isLoading={chatQuery.isLoading} isSending={sendChat.isPending} onSend={handleSendChat} />
            )}

            {panel === "board" && (
              <div className={styles.panelBoard}>
                <ClassroomWhiteboard
                  board={board}
                  onClose={() => togglePanel("board")}
                  fileName={boardFileName}
                  onToggleExpand={isPhone ? undefined : () => setBoardExpanded(true)}
                />
              </div>
            )}

            {panel === "people" && (
              <div className={styles.panelBody}>
                <p className={styles.panelSection}>In the call ({people.length})</p>
                <ul className={styles.peopleList}>
                  {people.map((p) => {
                    const t = tileProps(p);
                    return (
                      <li key={p.sessionId} className={styles.personRow}>
                        <ClassroomAvatar name={t.name} src={t.avatarUrl} size="sm" />
                        <span className={styles.personText}>
                          <span className={styles.personName}>
                            {t.name}
                            {p.local && " (You)"}
                            {t.isTeacher && <Crown size={12} aria-label="Teacher" className={styles.crown} />}
                          </span>
                          <span className={styles.personRole}>{t.isTeacher ? "Teacher" : "Student"}</span>
                        </span>
                        <span className={styles.personIcons}>
                          {p.audioOn ? <Mic size={15} aria-label="Microphone on" /> : <MicOff size={15} aria-label="Microphone off" className={styles.iconOff} />}
                          {p.videoOn ? <VideoIcon size={15} aria-label="Camera on" /> : <VideoOff size={15} aria-label="Camera off" className={styles.iconOff} />}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {notJoined.length > 0 && (
                  <>
                    <p className={styles.panelSection}>Not joined yet ({notJoined.length})</p>
                    <ul className={styles.peopleList}>
                      {notJoined.map((m) => (
                        <li key={m.id} className={`${styles.personRow} ${styles.personAway}`}>
                          <ClassroomAvatar name={m.name} src={m.avatarUrl} size="sm" />
                          <span className={styles.personText}>
                            <span className={styles.personName}>{m.name}</span>
                            <span className={styles.personRole}>{m.role === "teacher" ? "Teacher" : "Student"}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {panel === "materials" && <MaterialsPanel kind={kind} id={id} isTeacher={isTeacher} />}
            {panel === "notes" && isTeacher && <NotesPanel kind={kind} id={id} />}

            {panel === "info" && (
              <div className={styles.panelBody}>
                <dl className={styles.infoList}>
                  <div>
                    <dt>Class</dt>
                    <dd>{details.title}</dd>
                  </div>
                  <div>
                    <dt>{isTeacher ? (kind === "group" ? "Students" : "Student") : "Teacher"}</dt>
                    <dd>{kind === "group" && isTeacher ? `${learnerCount} enrolled` : otherName}</dd>
                  </div>
                  <div>
                    <dt>Scheduled</dt>
                    <dd>
                      {dateFormat.format(startsAt)}, {timeFormat.format(startsAt)} &middot; {details.durationMinutes} min
                    </dd>
                  </div>
                  <div>
                    <dt>Room closes</dt>
                    <dd>{timeFormat.format(closesAt)}</dd>
                  </div>
                  <div>
                    <dt>You joined as</dt>
                    <dd>{isTeacher ? "Teacher" : "Student"}</dd>
                  </div>
                  <div>
                    <dt>Connection</dt>
                    <dd>{connection.label}</dd>
                  </div>
                </dl>
              </div>
            )}
          </aside>
        )}
      </div>

      <footer className={styles.toolbar}>
        <div className={styles.toolbarSide}>
          <span className={styles.clock}>{timeFormat.format(new Date())}</span>
          <span className={styles.clockTitle}>{details.title}</span>
        </div>

        <div className={styles.controlsWrap}>
          <div className={styles.controls} role="toolbar" aria-label="Call controls">
            <Control label={micOn ? "Turn off microphone" : "Turn on microphone"} off={!micOn} onClick={toggleMic} withTooltip={!isPhone} disabled={connecting}>
              {micOn ? <Mic size={20} aria-hidden="true" /> : <MicOff size={20} aria-hidden="true" />}
            </Control>
            <Control label={camOn ? "Turn off camera" : "Turn on camera"} off={!camOn} onClick={toggleCam} withTooltip={!isPhone} disabled={connecting}>
              {camOn ? <VideoIcon size={20} aria-hidden="true" /> : <VideoOff size={20} aria-hidden="true" />}
            </Control>
            {shareAllowed && (
              <Control
                label={isSharing ? "Stop presenting" : "Present your screen"}
                text={isSharing ? "Stop" : "Present"}
                active={isSharing}
                onClick={daily.toggleScreenShare}
                withTooltip
                disabled={connecting || (!!sharer && !isSharing)}
              >
                {isSharing ? <MonitorX size={18} aria-hidden="true" /> : <MonitorUp size={18} aria-hidden="true" />}
              </Control>
            )}
            <Control
              label={unread ? `Chat, ${unread} unread` : "Chat"}
              text="Chat"
              active={panel === "chat"}
              badge={panel === "chat" ? 0 : unread}
              onClick={() => togglePanel("chat")}
              withTooltip={false}
            >
              <MessageSquare size={18} aria-hidden="true" />
            </Control>
            <Control
              label={panel === "board" ? "Close whiteboard" : "Whiteboard"}
              text="Whiteboard"
              active={panel === "board"}
              dot={boardUnseen && panel !== "board"}
              onClick={() => togglePanel("board")}
              withTooltip={false}
            >
              <PenTool size={18} aria-hidden="true" />
            </Control>
            <Control
              label={`People, ${people.length} in the call`}
              text={String(people.length)}
              active={panel === "people"}
              onClick={() => togglePanel("people")}
              withTooltip={!isPhone}
              className={styles.controlPeople}
            >
              <Users size={18} aria-hidden="true" />
            </Control>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Control label="More options" withTooltip={false}>
                  <MoreVertical size={20} aria-hidden="true" />
                </Control>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" side="top" sideOffset={10} className={styles.menu}>
                <DropdownMenuItem className={styles.menuItem} onSelect={() => togglePanel("info")}>
                  <Info size={16} aria-hidden="true" /> Meeting info
                </DropdownMenuItem>
                <DropdownMenuItem className={styles.menuItem} onSelect={() => togglePanel("materials")}>
                  <FileText size={16} aria-hidden="true" /> Materials
                </DropdownMenuItem>
                {isTeacher && (
                  <DropdownMenuItem className={styles.menuItem} onSelect={() => togglePanel("notes")}>
                    <NotebookPen size={16} aria-hidden="true" /> Private notes
                  </DropdownMenuItem>
                )}
                {isLive && videoInputs > 1 && camOn && (
                  <DropdownMenuItem className={styles.menuItem} onSelect={() => void daily.cycleCamera()}>
                    <SwitchCamera size={16} aria-hidden="true" /> Switch camera
                  </DropdownMenuItem>
                )}
                {isTeacher && (
                  <>
                    <DropdownMenuSeparator className={styles.menuSeparator} />
                    <DropdownMenuItem className={`${styles.menuItem} ${styles.menuDanger}`} onSelect={() => setEndOpen(true)} disabled={isEnding}>
                      <CircleStop size={16} aria-hidden="true" /> End session for everyone
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <span className={styles.controlsDivider} aria-hidden="true" />
          <button type="button" className={styles.leave} onClick={() => setLeaveOpen(true)} aria-label="Leave the call">
            <PhoneOff size={18} aria-hidden="true" />
            <span className={styles.leaveLabel}>Leave</span>
          </button>
        </div>

        <div className={`${styles.toolbarSide} ${styles.toolbarRight}`} aria-hidden="true">
          <Clock size={14} />
          <span>{formatElapsed(elapsed)}</span>
        </div>
      </footer>

      {remotes.map((p) => (
        <React.Fragment key={p.sessionId}>
          {p.audioTrack && <ClassroomRemoteAudio track={p.audioTrack} outputDeviceId={session.prefs.outputDeviceId} />}
          {p.screenAudioTrack && <ClassroomRemoteAudio track={p.screenAudioTrack} outputDeviceId={session.prefs.outputDeviceId} />}
        </React.Fragment>
      ))}

      <ConsoleConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Leave the call?"
        description={
          remotes.length
            ? "Only you leave. Everyone else stays in the call, and you can rejoin while the room is open."
            : "You can rejoin from your dashboard while the room is open."
        }
        tone="destructive"
        confirmLabel="Leave"
        isPending={false}
        onConfirm={() => {
          setLeaveOpen(false);
          void leaveCall();
        }}
      />
      <ConsoleConfirmDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        title="End this session for everyone?"
        description="This marks the session as completed and closes the classroom for everyone."
        tone="destructive"
        confirmLabel="End session"
        pendingLabel="Ending..."
        isPending={isEnding}
        onConfirm={async () => {
          leavingRef.current = true;
          await onEndSession();
          setEndOpen(false);
        }}
      />
    </main>
  );
};

const MaterialsPanel: React.FC<{ kind: ClassroomKind; id: string; isTeacher: boolean }> = ({ kind, id, isTeacher }) => {
  const materialsQuery = useClassroomMaterialsQuery(kind, id);
  const addMaterial = useClassroomMaterialAddMutation();
  const deleteMaterial = useClassroomMaterialDeleteMutation();
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const materials = materialsQuery.data?.materials ?? [];

  const add = () => {
    const t = title.trim();
    const l = link.trim();
    if (!t || !l) return;
    addMaterial.mutate(
      { kind, id, title: t, linkUrl: l },
      {
        onSuccess: () => {
          setTitle("");
          setLink("");
          toast.success("Material added");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add material"),
      }
    );
  };

  return (
    <div className={styles.panelBody}>
      {materials.length === 0 ? (
        <p className={styles.panelEmpty}>No materials shared yet.</p>
      ) : (
        <ul className={styles.materialList}>
          {materials.map((m) => (
            <li key={m.id} className={styles.materialRow}>
              <Link2 size={15} aria-hidden="true" />
              <a href={m.fileUrl ?? m.linkUrl ?? "#"} target="_blank" rel="noopener noreferrer" className={styles.materialLink}>
                {m.title}
              </a>
              {isTeacher && (
                <button type="button" className={styles.iconButton} aria-label={`Delete ${m.title}`} onClick={() => deleteMaterial.mutate({ id: m.id })}>
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {isTeacher && (
        <div className={styles.materialForm}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Material title" className={styles.panelInput} />
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." aria-label="Material link" className={styles.panelInput} />
          <button type="button" className={styles.panelPrimary} onClick={add} disabled={addMaterial.isPending || !title.trim() || !link.trim()}>
            <Plus size={15} aria-hidden="true" /> Add material
          </button>
        </div>
      )}
    </div>
  );
};

const NotesPanel: React.FC<{ kind: ClassroomKind; id: string }> = ({ kind, id }) => {
  const notesQuery = useTeacherMentorshipNotesQuery(kind, id, true);
  const upsert = useTeacherMentorshipNoteUpsertMutation();
  const [draft, setDraft] = useState("");

  const save = () => {
    const note = draft.trim();
    if (!note) return;
    upsert.mutate(
      { kind, lessonId: id, note },
      {
        onSuccess: () => {
          setDraft("");
          toast.success("Note saved");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save note"),
      }
    );
  };

  return (
    <div className={styles.panelBody}>
      <p className={styles.panelHint}>Only you can see these notes.</p>
      <ul className={styles.noteList}>
        {notesQuery.data?.notes.map((n) => (
          <li key={n.id} className={styles.noteRow}>
            {n.note}
          </li>
        ))}
      </ul>
      <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a note..." className={styles.panelTextarea} />
      <button type="button" className={styles.panelPrimary} onClick={save} disabled={upsert.isPending || !draft.trim()}>
        Save note
      </button>
    </div>
  );
};
