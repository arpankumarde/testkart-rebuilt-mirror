import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Users,
  MessageSquare,
  FileText,
  NotebookPen,
  PhoneOff,
  ScreenShare,
  Clock,
  Send,
  Plus,
  Trash2,
  Link2,
  CheckCircle2,
  AlertTriangle,
  Star,
  Crown,
} from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import {
  ClassroomKind,
  useClassroomDetailsQuery,
  useClassroomJoinMutation,
  useClassroomLeaveMutation,
  useClassroomChatListQuery,
  useClassroomChatSendMutation,
  useClassroomMaterialsQuery,
  useClassroomMaterialAddMutation,
  useClassroomMaterialDeleteMutation,
  useClassroomCompleteMutation,
  useMentorshipReviewMutation,
  useTeacherMentorshipNotesQuery,
  useTeacherMentorshipNoteUpsertMutation,
} from "../helpers/useLiveClassroom";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { Tabs, TabsList, TabsTrigger } from "./Tabs";
import { Textarea } from "./Textarea";
import { Input } from "./Input";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { NotFoundState } from "./NotFoundState";
import styles from "./LiveClassroom.module.css";

type PanelKey = "participants" | "chat" | "materials" | "notes";

const formatElapsed = (seconds: number) => {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
};

const formatWhen = (date: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));

interface LiveClassroomProps {
  kind: ClassroomKind;
  id: number;
}

/**
 * Shared live classroom experience for both 1:1 bookings and group lessons.
 *
 * Video goes through whatever helpers/videoProvider.tsx returns for this join: when a real
 * provider (Daily.co) is configured, the in-session screen embeds its Prebuilt call UI in an
 * iframe via the short-lived per-join credentials the join endpoint returns, and Daily's own
 * mic/camera/screen-share controls are used instead of this component's own. Otherwise it falls
 * back to a clearly-labeled development-only mock - no camera or microphone is actually captured
 * and no media connection is made - so every tile and the connection badge say "Preview" and this
 * is never presented as a live call. Chat polls on a short interval only while the viewer is
 * actually in the session (see useLiveClassroom.tsx) because no real-time push transport is
 * available in this environment.
 */
export const LiveClassroom: React.FC<LiveClassroomProps> = ({ kind, id }) => {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const detailsQuery = useClassroomDetailsQuery(kind, id);
  const joinMutation = useClassroomJoinMutation();
  const leaveMutation = useClassroomLeaveMutation();
  const completeMutation = useClassroomCompleteMutation();

  const [session, setSession] = useState<{
    attendanceId: number;
    role: "teacher" | "learner";
    provider: string;
    url: string;
    token: string;
  } | null>(null);
  const isLiveProvider = session?.provider === "daily";
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [activePanel, setActivePanel] = useState<PanelKey>("participants");
  const [elapsed, setElapsed] = useState(0);
  const [endOpen, setEndOpen] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const attendanceRef = useRef<number | null>(null);

  const chatQuery = useClassroomChatListQuery(kind, id, !!session);
  const sendChatMutation = useClassroomChatSendMutation();
  const [chatDraft, setChatDraft] = useState("");

  const materialsQuery = useClassroomMaterialsQuery(kind, id);
  const addMaterialMutation = useClassroomMaterialAddMutation();
  const deleteMaterialMutation = useClassroomMaterialDeleteMutation();
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialLink, setMaterialLink] = useState("");

  const isTeacherViewer = detailsQuery.data?.viewerRole === "teacher";
  const notesQuery = useTeacherMentorshipNotesQuery(kind, id, isTeacherViewer && !!session);
  const noteUpsertMutation = useTeacherMentorshipNoteUpsertMutation();
  const [noteDraft, setNoteDraft] = useState("");

  const reviewMutation = useMentorshipReviewMutation();
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  useEffect(() => {
    attendanceRef.current = session?.attendanceId ?? null;
  }, [session]);

  // Best-effort leave if the viewer navigates away or closes the tab mid-session.
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (attendanceRef.current) {
        void postLeaveBeacon(attendanceRef.current);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (attendanceRef.current) {
        leaveMutation.mutate({ attendanceId: attendanceRef.current });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [session]);

  const postLeaveBeacon = async (attendanceId: number) => {
    try {
      await leaveMutation.mutateAsync({ attendanceId });
    } catch {
      // Best effort only.
    }
  };

  if (detailsQuery.isLoading) {
    return (
      <div className={styles.page}>
        <Skeleton style={{ height: "2rem", width: "min(24rem, 90%)" }} />
        <Skeleton style={{ height: "16rem", width: "100%" }} />
      </div>
    );
  }

  if (detailsQuery.isError || !detailsQuery.data) {
    return <NotFoundState kind="page" />;
  }

  const details = detailsQuery.data;
  const viewerId = authState.type === "authenticated" ? authState.user.id : null;

  const handleJoin = async () => {
    try {
      const result = await joinMutation.mutateAsync({ kind, id });
      setSession({
        attendanceId: result.attendanceId,
        role: result.role,
        provider: result.provider,
        url: result.url,
        token: result.token,
      });
      setElapsed(0);
      toast.success(
        result.provider === "daily"
          ? "You're in."
          : "You're in. This is a development preview - no live camera or mic is connected."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join this session");
    }
  };

  const handleLeave = async () => {
    if (session) {
      try {
        await leaveMutation.mutateAsync({ attendanceId: session.attendanceId });
      } catch {
        // Ignore: leaving the UI is more important than this call succeeding.
      }
    }
    setSession(null);
    setHasEnded(true);
  };

  const handleEndSession = async () => {
    try {
      const result = await completeMutation.mutateAsync({ kind, id });
      toast.success(`Session marked ${result.status.replace("_", " ")}.`);
      setEndOpen(false);
      await handleLeave();
      detailsQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not end this session");
    }
  };

  const handleSendChat = () => {
    const body = chatDraft.trim();
    if (!body) return;
    sendChatMutation.mutate(
      { kind, id, body },
      {
        onSuccess: () => setChatDraft(""),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not send message"),
      }
    );
  };

  const handleAddMaterial = () => {
    const title = materialTitle.trim();
    const link = materialLink.trim();
    if (!title || !link) return;
    addMaterialMutation.mutate(
      { kind, id, title, linkUrl: link },
      {
        onSuccess: () => {
          setMaterialTitle("");
          setMaterialLink("");
          toast.success("Material added");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add material"),
      }
    );
  };

  const handleSaveNote = () => {
    const note = noteDraft.trim();
    if (!note) return;
    noteUpsertMutation.mutate(
      { kind, lessonId: id, note },
      {
        onSuccess: () => {
          setNoteDraft("");
          toast.success("Note saved");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save note"),
      }
    );
  };

  const handleSubmitReview = () => {
    if (reviewRating < 1) {
      toast.error("Pick a star rating first");
      return;
    }
    reviewMutation.mutate(
      { kind, id, rating: reviewRating, reviewText: reviewText.trim() || undefined },
      {
        onSuccess: () => toast.success("Thanks for the feedback!"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not submit review"),
      }
    );
  };

  // Post-session screen: left after the call, or the lesson is already over.
  const isOver = details.status === "completed" || details.status === "no_show" || details.status === "cancelled";
  if (hasEnded || (isOver && !session)) {
    return (
      <div className={styles.page}>
        <div className={styles.postSessionCard}>
          <CheckCircle2 size={32} className={styles.postSessionIcon} aria-hidden="true" />
          <h1 className={styles.postSessionTitle}>
            {details.status === "cancelled" ? "This session was cancelled" : "Session ended"}
          </h1>
          <p className={styles.postSessionText}>{details.title}</p>

          {details.viewerRole === "learner" && details.status === "completed" && (
            <div className={styles.reviewBox}>
              <p className={styles.reviewPrompt}>How was your session with {details.teacherName}?</p>
              <div className={styles.starRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={styles.starButton}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onClick={() => setReviewRating(n)}
                  >
                    <Star size={22} className={n <= reviewRating ? styles.starFilled : styles.starEmpty} />
                  </button>
                ))}
              </div>
              <Textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Optional: share more about your experience..."
                className={styles.reviewTextarea}
              />
              <Button onClick={handleSubmitReview} disabled={reviewMutation.isPending}>
                {reviewMutation.isPending ? "Submitting..." : "Submit review"}
              </Button>
            </div>
          )}

          <Button variant="outline" onClick={() => navigate(kind === "booking" ? "/student/live-teaching" : "/live-teaching")}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  // Pre-join screen.
  if (!session) {
    return (
      <div className={styles.page}>
        <div className={styles.preJoinCard}>
          <h1 className={styles.title}>{details.title}</h1>
          <p className={styles.subtitle}>
            with {details.teacherName} &middot; {formatWhen(details.startTime)} &middot; {details.durationMinutes} min
          </p>

          <div className={styles.devicePreview}>
            <div className={styles.deviceTile}>
              <span className={styles.deviceTileLabel}>{camOn ? <VideoIcon size={28} /> : <VideoOff size={28} />}</span>
              <span className={styles.previewBadge}>Preview - no camera connected</span>
            </div>
            <div className={styles.deviceControls}>
              <Button variant={micOn ? "outline" : "secondary"} size="icon-md" onClick={() => setMicOn((v) => !v)} aria-label="Toggle microphone">
                {micOn ? <Mic size={18} /> : <MicOff size={18} />}
              </Button>
              <Button variant={camOn ? "outline" : "secondary"} size="icon-md" onClick={() => setCamOn((v) => !v)} aria-label="Toggle camera">
                {camOn ? <VideoIcon size={18} /> : <VideoOff size={18} />}
              </Button>
            </div>
          </div>

          <div className={styles.rosterPreview}>
            <Users size={14} aria-hidden="true" /> {details.roster.length} {details.roster.length === 1 ? "participant" : "participants"}
            {details.materialsCount > 0 && (
              <>
                <span className={styles.dot} aria-hidden="true">·</span>
                <FileText size={14} aria-hidden="true" /> {details.materialsCount} material{details.materialsCount === 1 ? "" : "s"}
              </>
            )}
          </div>

          {!details.joinWindow.isOpen ? (
            <p className={styles.joinWindowMessage}>
              <AlertTriangle size={15} aria-hidden="true" />{" "}
              {new Date() < new Date(details.joinWindow.opensAt)
                ? `You can join starting ${formatWhen(details.joinWindow.opensAt)}.`
                : "This session's join window has closed."}
            </p>
          ) : (
            <Button size="lg" onClick={handleJoin} disabled={joinMutation.isPending}>
              {joinMutation.isPending ? "Joining..." : "Join now"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // In-session screen.
  return (
    <div className={styles.sessionPage}>
      <div className={styles.sessionTopBar}>
        <div className={styles.sessionTitleBlock}>
          <span className={styles.sessionTitle}>{details.title}</span>
          {!isLiveProvider && (
            <span className={styles.mockBadge}>
              <AlertTriangle size={12} aria-hidden="true" /> Development preview - no live video
            </span>
          )}
        </div>
        <span className={styles.timer}>
          <Clock size={14} aria-hidden="true" /> {formatElapsed(elapsed)}
        </span>
      </div>

      <div className={styles.sessionBody}>
        <div className={styles.videoArea}>
          {isLiveProvider ? (
            <iframe
              src={`${session.url}?t=${encodeURIComponent(session.token)}`}
              className={styles.dailyFrame}
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              title="Live classroom video call"
            />
          ) : (
            <div className={styles.videoGrid}>
              {details.roster.map((member) => {
                const isSelf = member.id === viewerId;
                return (
                  <div key={member.id} className={styles.videoTile}>
                    {isSelf && !camOn ? (
                      <VideoOff size={28} className={styles.tileIcon} aria-hidden="true" />
                    ) : member.avatarUrl ? (
                      <img src={member.avatarUrl} alt="" className={styles.tileAvatar} />
                    ) : (
                      <span className={styles.tileAvatarFallback}>{member.name.charAt(0).toUpperCase()}</span>
                    )}
                    <div className={styles.tileFooter}>
                      <span className={styles.tileName}>
                        {member.role === "teacher" && <Crown size={12} aria-hidden="true" />}
                        {member.name} {isSelf && "(you)"}
                      </span>
                      {isSelf && !micOn && <MicOff size={13} aria-hidden="true" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className={styles.controlsBar}>
            {!isLiveProvider && (
              <>
                <Button variant={micOn ? "outline" : "secondary"} size="icon-md" onClick={() => setMicOn((v) => !v)} aria-label="Toggle microphone">
                  {micOn ? <Mic size={18} /> : <MicOff size={18} />}
                </Button>
                <Button variant={camOn ? "outline" : "secondary"} size="icon-md" onClick={() => setCamOn((v) => !v)} aria-label="Toggle camera">
                  {camOn ? <VideoIcon size={18} /> : <VideoOff size={18} />}
                </Button>
                <Button
                  variant="outline"
                  size="icon-md"
                  disabled
                  aria-label="Screen share (not available in this preview)"
                  title="Screen share is not available in this preview"
                >
                  <ScreenShare size={18} />
                </Button>
              </>
            )}
            {session.role === "teacher" && (
              <Button variant="secondary" onClick={() => setEndOpen(true)} disabled={completeMutation.isPending}>
                End session
              </Button>
            )}
            <Button variant="destructive" onClick={handleLeave}>
              <PhoneOff size={18} aria-hidden="true" /> Leave
            </Button>
          </div>
        </div>

        <div className={styles.sidePanel}>
          <Tabs value={activePanel} onValueChange={(v) => setActivePanel(v as PanelKey)}>
            <TabsList>
              <TabsTrigger value="participants">
                <Users size={14} />
              </TabsTrigger>
              <TabsTrigger value="chat">
                <MessageSquare size={14} />
              </TabsTrigger>
              <TabsTrigger value="materials">
                <FileText size={14} />
              </TabsTrigger>
              {session.role === "teacher" && (
                <TabsTrigger value="notes">
                  <NotebookPen size={14} />
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>

          {activePanel === "participants" && (
            <ul className={styles.panelList}>
              {details.roster.map((member) => (
                <li key={member.id} className={styles.panelRow}>
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt="" className={styles.panelAvatar} />
                  ) : (
                    <span className={styles.panelAvatarFallback}>{member.name.charAt(0).toUpperCase()}</span>
                  )}
                  <span className={styles.panelRowText}>
                    {member.name} {member.role === "teacher" && <Crown size={12} aria-hidden="true" />}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {activePanel === "chat" && (
            <div className={styles.chatPanel}>
              <div className={styles.chatMessages}>
                {(chatQuery.data?.messages ?? []).map((m) => (
                  <div key={m.id} className={`${styles.chatMessage} ${m.senderId === viewerId ? styles.chatMessageSelf : ""}`}>
                    <span className={styles.chatSender}>{m.senderName}</span>
                    <p className={styles.chatBody}>{m.body}</p>
                  </div>
                ))}
                {(chatQuery.data?.messages.length ?? 0) === 0 && <p className={styles.panelEmpty}>No messages yet.</p>}
              </div>
              <div className={styles.chatInputRow}>
                <Input
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder="Type a message..."
                  aria-label="Chat message"
                />
                <Button size="icon-md" onClick={handleSendChat} disabled={!chatDraft.trim() || sendChatMutation.isPending} aria-label="Send">
                  <Send size={16} />
                </Button>
              </div>
            </div>
          )}

          {activePanel === "materials" && (
            <div className={styles.materialsPanel}>
              {(materialsQuery.data?.materials.length ?? 0) === 0 ? (
                <p className={styles.panelEmpty}>No materials shared yet.</p>
              ) : (
                <ul className={styles.panelList}>
                  {materialsQuery.data?.materials.map((m) => (
                    <li key={m.id} className={styles.panelRow}>
                      <Link2 size={14} aria-hidden="true" />
                      <a href={m.fileUrl ?? m.linkUrl ?? "#"} target="_blank" rel="noopener noreferrer" className={styles.materialLink}>
                        {m.title}
                      </a>
                      {session.role === "teacher" && (
                        <Button
                          variant="ghost"
                          size="icon-md"
                          aria-label="Delete material"
                          onClick={() => deleteMaterialMutation.mutate({ id: m.id })}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {session.role === "teacher" && (
                <div className={styles.addMaterialForm}>
                  <Input value={materialTitle} onChange={(e) => setMaterialTitle(e.target.value)} placeholder="Title" aria-label="Material title" />
                  <Input value={materialLink} onChange={(e) => setMaterialLink(e.target.value)} placeholder="https://..." aria-label="Material link" />
                  <Button size="sm" onClick={handleAddMaterial} disabled={addMaterialMutation.isPending}>
                    <Plus size={14} aria-hidden="true" /> Add
                  </Button>
                </div>
              )}
            </div>
          )}

          {activePanel === "notes" && session.role === "teacher" && (
            <div className={styles.notesPanel}>
              <p className={styles.panelHint}>Private - only you can see these notes.</p>
              <ul className={styles.panelList}>
                {notesQuery.data?.notes.map((n) => (
                  <li key={n.id} className={styles.noteRow}>
                    {n.note}
                  </li>
                ))}
              </ul>
              <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Add a note..." className={styles.noteTextarea} />
              <Button size="sm" onClick={handleSaveNote} disabled={noteUpsertMutation.isPending}>
                Save note
              </Button>
            </div>
          )}
        </div>
      </div>

      <ConsoleConfirmDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        title="End this session?"
        description="This marks the session as completed for everyone and closes the classroom."
        confirmLabel="End session"
        onConfirm={handleEndSession}
        isPending={completeMutation.isPending}
      />
    </div>
  );
};
