import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Star } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import {
  ClassroomKind,
  useClassroomDetailsQuery,
  useClassroomJoinMutation,
  useClassroomLeaveMutation,
  useClassroomCompleteMutation,
  useMentorshipReviewMutation,
} from "../helpers/useLiveClassroom";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { Textarea } from "./Textarea";
import { ReviewerNameField } from "./ReviewerNameField";
import { useReviewerName } from "../helpers/useReviewerName";
import { liveBookingPath } from "../helpers/liveBookingRoutes";
import { NotFoundState } from "./NotFoundState";
import { LiveClassroomLobby, LobbyJoinPrefs } from "./LiveClassroomLobby";
import { ClassroomSession, ClassroomSessionInfo } from "./ClassroomSession";
import { ClassroomRecap } from "./ClassroomRecap";
import styles from "./LiveClassroom.module.css";

interface LiveClassroomProps {
  kind: ClassroomKind;
  id: string;
}

/**
 * Shared live classroom for 1:1 bookings and group lessons. Dashboards open it in its own tab
 * (helpers/openClassroom.tsx), and the page renders without the site navbar, footer or bottom nav,
 * so every state here owns the whole viewport and carries its own way out.
 *
 * Before joining, LiveClassroomLobby runs the real camera, microphone, speaker, network and join
 * window checks. Joining asks the join endpoint for short-lived, per-person Daily credentials (the
 * Daily API key never reaches the browser) and records attendance; ClassroomSession then runs the
 * call with Daily's call object and our own interface. When the development mock provider is
 * active there is no media connection at all and the session screen says so. Leaving, the call
 * ending, or the teacher ending the session records the leave and shows the post-session screen,
 * which also shows the class's saved chat and whiteboard (ClassroomRecap) for as long as the
 * class exists, so both stay reachable from the class lists after the class.
 *
 * Once a call is running nothing outside it may unmount it: a background refetch of the details
 * (window focus), a failed refetch, or a query reset after another account signs in to this
 * browser all keep rendering the call with the last details it had. Unmounting would destroy the
 * Daily call, and the quick remount that follows was what threw people out of the room.
 */
export const LiveClassroom: React.FC<LiveClassroomProps> = ({ kind, id }) => {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const detailsQuery = useClassroomDetailsQuery(kind, id);
  const joinMutation = useClassroomJoinMutation();
  const leaveMutation = useClassroomLeaveMutation();
  const completeMutation = useClassroomCompleteMutation();

  const [session, setSession] = useState<ClassroomSessionInfo | null>(null);
  const [hasEnded, setHasEnded] = useState(false);
  const attendanceRef = useRef<string | null>(null);
  const leftRef = useRef(false);
  const lastDetailsRef = useRef(detailsQuery.data);
  if (detailsQuery.data) lastDetailsRef.current = detailsQuery.data;

  const reviewMutation = useMentorshipReviewMutation();
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const reviewerName = useReviewerName();
  const isReviewBusy = reviewMutation.isPending || reviewerName.isSavingName;

  useEffect(() => {
    attendanceRef.current = session?.attendanceId ?? null;
  }, [session]);

  // Best-effort leave if the viewer closes the tab or navigates away mid-session.
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (attendanceRef.current) void postLeave(attendanceRef.current);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (attendanceRef.current) leaveMutation.mutate({ attendanceId: attendanceRef.current });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const postLeave = async (attendanceId: string) => {
    try {
      await leaveMutation.mutateAsync({ attendanceId });
    } catch {
      // Best effort only.
    }
  };

  const viewerId = authState.type === "authenticated" ? authState.user.id : null;
  const viewerName = authState.type === "authenticated" ? authState.user.displayName : "You";

  const handleLeave = async () => {
    if (leftRef.current) return;
    leftRef.current = true;
    const attendanceId = attendanceRef.current;
    attendanceRef.current = null;
    console.log("[classroom]", JSON.stringify({ at: new Date().toISOString(), event: "attendance-leave", lesson: `${kind}:${id}`, attendanceId }));
    setSession(null);
    setHasEnded(true);
    if (attendanceId) await postLeave(attendanceId);
    // Picks up a status the teacher set and whether a finished trial can lead into a plan.
    void detailsQuery.refetch();
  };

  const handleEndSession = async () => {
    try {
      const result = await completeMutation.mutateAsync({ kind, id });
      toast.success(`Session marked ${result.status.replace("_", " ")}.`);
      await handleLeave();
      detailsQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not end this session");
    }
  };

  const callDetails = detailsQuery.data ?? lastDetailsRef.current;
  if (session && callDetails) {
    return (
      <ClassroomSession
        key={session.attendanceId}
        kind={kind}
        id={id}
        details={callDetails}
        session={session}
        accountChanged={viewerId !== null && session.ownerUserId !== null && viewerId !== session.ownerUserId}
        onLeave={() => void handleLeave()}
        onEndSession={handleEndSession}
        isEnding={completeMutation.isPending}
      />
    );
  }

  if (detailsQuery.isLoading) {
    return (
      <div className={`${styles.page} tk-flow`}>
        <Skeleton style={{ height: "2rem", width: "min(24rem, 90%)" }} />
        <Skeleton style={{ height: "16rem", width: "100%" }} />
      </div>
    );
  }

  if (detailsQuery.isError || !detailsQuery.data) {
    return <NotFoundState kind="page" />;
  }

  const details = detailsQuery.data;

  // Where Back and the post-session button lead: each role's own list. Group rooms are live course classes.
  const exitPath =
    details.viewerRole === "teacher"
      ? kind === "booking"
        ? "/teacher/mentorship/bookings"
        : "/teacher/live-courses"
      : kind === "booking"
        ? "/student/live-teaching"
        : "/student/live-courses";

  // Opened from a dashboard in its own tab: the dashboard is still open behind it.
  const isOwnTab = typeof window !== "undefined" && window.history.length <= 2;

  const handleJoin = async (prefs: LobbyJoinPrefs): Promise<string | null> => {
    if (joinMutation.isPending) return null;
    try {
      const result = await joinMutation.mutateAsync({ kind, id });
      leftRef.current = false;
      console.log(
        "[classroom]",
        JSON.stringify({ at: new Date().toISOString(), event: "join-credentials", userId: viewerId, role: result.role, lesson: `${kind}:${id}`, room: result.roomId, provider: result.provider, attendanceId: result.attendanceId, tokenExpiresAt: result.expiresAt })
      );
      setSession({
        attendanceId: result.attendanceId,
        role: result.role,
        provider: result.provider,
        url: result.url,
        token: result.token,
        prefs,
        ownerUserId: viewerId,
        ownerName: viewerName,
      });
      if (result.provider !== "daily") {
        toast.info("Development preview: no live camera or microphone is connected.");
      }
      return null;
    } catch (err) {
      detailsQuery.refetch();
      return err instanceof Error ? err.message : "Could not join this session";
    }
  };

  const handleSubmitReview = async () => {
    if (reviewRating < 1) {
      toast.error("Pick a star rating first");
      return;
    }
    if (!(await reviewerName.ensureName())) return;
    reviewMutation.mutate(
      { kind, id, rating: reviewRating, reviewText: reviewText.trim() || undefined },
      {
        onSuccess: () => toast.success("Thanks for the feedback!"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not submit review"),
      }
    );
  };

  // Post-session screen: left the call, or the lesson is already over (marked, or its join window has closed).
  const windowClosed = !details.joinWindow.isOpen && Date.now() > new Date(details.joinWindow.closesAt).getTime();
  const isOver = details.status === "completed" || details.status === "no_show" || details.status === "cancelled" || windowClosed;
  if (hasEnded || (isOver && !session)) {
    return (
      <main className={`${styles.page} tk-flow`}>
        <div className={styles.postSessionCard}>
          <CheckCircle2 size={32} className={styles.postSessionIcon} aria-hidden="true" />
          <h1 className={styles.postSessionTitle}>
            {details.status === "cancelled" ? "This session was cancelled" : hasEnded && !isOver ? "You left the call" : "Session ended"}
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
              {reviewerName.needsName && (
                <ReviewerNameField
                  value={reviewerName.name}
                  onChange={reviewerName.setName}
                  error={reviewerName.nameError}
                  disabled={isReviewBusy}
                />
              )}
              <Button onClick={() => void handleSubmitReview()} disabled={isReviewBusy}>
                {isReviewBusy ? "Submitting..." : "Submit review"}
              </Button>
            </div>
          )}

          {details.viewerRole === "learner" && details.trialFollowUp && (
            <div className={styles.planBox}>
              <p className={styles.planTitle}>Keep learning with {details.teacherName}</p>
              <p className={styles.planText}>Pick 1 to 6 classes a week and lock in your times for the next 4 weeks.</p>
              <div className={styles.postSessionActions}>
                <Button asChild>
                  <Link to={liveBookingPath({ slug: details.trialFollowUp.teacherSlug })}>Choose a plan</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/expert">Try another tutor</Link>
                </Button>
              </div>
            </div>
          )}

          {details.status !== "cancelled" && (
            <ClassroomRecap kind={kind} id={id} viewerId={viewerId} fileName={`class-whiteboard-${id.slice(0, 8)}.png`} />
          )}

          <div className={styles.postSessionActions}>
            {hasEnded && !isOver && details.joinWindow.isOpen && (
              <Button
                onClick={() => {
                  setHasEnded(false);
                  detailsQuery.refetch();
                }}
              >
                Rejoin
              </Button>
            )}
            {isOwnTab ? (
              <Button variant="outline" onClick={() => window.close()}>
                Close this tab
              </Button>
            ) : (
              <Button variant="outline" onClick={() => navigate(exitPath)}>
                Back to my sessions
              </Button>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <LiveClassroomLobby
        details={details}
        viewerId={viewerId}
        detailsUpdatedAt={detailsQuery.dataUpdatedAt}
        isJoining={joinMutation.isPending}
        onJoin={handleJoin}
        onBack={() => navigate(exitPath)}
      />
    );
  }

  // A session with no details yet cannot happen: joining needs the details first.
  return null;
};
