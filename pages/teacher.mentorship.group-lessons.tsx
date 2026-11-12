import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { handleClassroomLinkClick } from "../helpers/openClassroom";
import { Plus, Edit2, Ban, Users, Video, UserMinus, MoreHorizontal, CheckCircle2 } from "lucide-react";
import {
  useTeacherGroupLessonsQuery,
  useUpsertGroupLessonMutation,
  useCancelGroupLessonMutation,
  useGroupLessonRosterQuery,
  useRemoveParticipantMutation,
  useCompleteLessonMutation,
} from "../helpers/useTeacherMentorship";
import { TeacherGroupLessonRow } from "../endpoints/teacher/group-lessons/list_GET.schema";
import { GROUP_LESSON_MIN_CAPACITY, GROUP_LESSON_MAX_CAPACITY } from "../helpers/liveLessonConfig";
import { useLiveTeachingStatusQuery } from "../helpers/useLiveTeaching";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { Button } from "../components/Button";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/DropdownMenu";
import {
  LiveSessionDateTile,
  LiveSessionStatus,
  LiveSessionTone,
  formatSessionTime,
  relativeDayLabel,
} from "../components/LiveSession";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Skeleton } from "../components/Skeleton";
import { Dialog } from "../components/Dialog";
import { ConsoleDialogContent, ConsoleDialogHeader, ConsoleDialogBody, ConsoleDialogFooter } from "../components/ConsoleDialog";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "../components/Select";
import { ImageUploader } from "../components/ImageUploader";
import styles from "./teacher.mentorship.group-lessons.module.css";

const TIME_ZONE = "Asia/Kolkata";
const TONES: LiveSessionTone[] = ["blue", "lavender", "sage", "butter", "mint"];

const lessonEnded = (g: { startTime: Date | string; durationMinutes: number }) =>
  new Date(g.startTime).getTime() + g.durationMinutes * 60_000 <= Date.now();

const lessonStatus = (g: { status: string; startTime: Date | string; durationMinutes: number }): LiveSessionStatus | null => {
  if (g.status === "cancelled") return { label: "Cancelled", tone: "peach" };
  if (g.status === "completed") return { label: "Completed", tone: "sage" };
  if (g.status === "scheduled" && lessonEnded(g)) return { label: "Not marked yet", tone: "butter" };
  return null;
};

const formatPrice = (price: number) => (price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Free");

/* Seats taken, as a mint meter with a label. */
const SeatsMeter: React.FC<{ enrolled: number; capacity: number }> = ({ enrolled, capacity }) => {
  const pct = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0;
  return (
    <div className={styles.seats}>
      <div className={styles.seatsLabel}>
        <span>
          <strong>{enrolled}</strong> of {capacity} seats taken
        </span>
      </div>
      <div
        className={styles.meter}
        role="meter"
        aria-label="Seats taken"
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={enrolled}
      >
        <span className={styles.meterFill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const toDateTimeLocal = (date: Date | string | null): string => {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const TeacherGroupLessonsPage: React.FC = () => {
  const { data, isFetching } = useTeacherGroupLessonsQuery();
  const [editingRow, setEditingRow] = useState<TeacherGroupLessonRow | null | "new">(null);
  const [cancelTarget, setCancelTarget] = useState<TeacherGroupLessonRow | null>(null);
  const [rosterTarget, setRosterTarget] = useState<TeacherGroupLessonRow | null>(null);
  const [completeTarget, setCompleteTarget] = useState<TeacherGroupLessonRow | null>(null);
  const completeMutation = useCompleteLessonMutation();
  const statusQuery = useLiveTeachingStatusQuery();
  // New classes need an approved live teaching application; scheduled ones stay manageable.
  const canCreate = statusQuery.data?.status === "approved";
  const createButton = canCreate ? (
    <Button onClick={() => setEditingRow("new")}>
      <Plus size={16} /> Create group lesson
    </Button>
  ) : statusQuery.data ? (
    <Button asChild>
      <Link to="/teacher/mentorship">Apply to teach live</Link>
    </Button>
  ) : null;

  return (
    <>
      <Helmet>
        <title>Group Lessons - Testkart</title>
      </Helmet>
      <div className={`${styles.page} tk-flow`}>
        <ConsolePageHeader
          title="Group lessons"
          description={
            canCreate || !statusQuery.data
              ? "Scheduled classes multiple learners can enroll in."
              : "Group classes open once your live teaching application is approved."
          }
        >
          {createButton}
        </ConsolePageHeader>

        {isFetching && !data ? (
          <div className={styles.grid}>
            <Skeleton style={{ height: "13rem", width: "100%", borderRadius: "1.25rem" }} />
            <Skeleton style={{ height: "13rem", width: "100%", borderRadius: "1.25rem" }} />
          </div>
        ) : !data || data.groupLessons.length === 0 ? (
          <ConsoleListEmpty
            icon={<Users size={28} />}
            title="No group lessons yet"
            description={
              canCreate ? "Schedule a class once and many learners can join it." : "Apply to teach live to schedule classes."
            }
          >
            {createButton}
          </ConsoleListEmpty>
        ) : (
          (() => {
            const now = Date.now();
            const isUpcoming = (g: TeacherGroupLessonRow) =>
              g.status === "scheduled" && new Date(g.startTime).getTime() + g.durationMinutes * 60_000 > now;
            const upcoming = data.groupLessons
              .filter(isUpcoming)
              .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
            const earlier = data.groupLessons
              .filter((g) => !isUpcoming(g))
              .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

            const card = (g: TeacherGroupLessonRow, i: number) => {
              const status = lessonStatus(g);
              const isScheduled = g.status === "scheduled";
              const started = new Date(g.startTime).getTime() <= now;
              const awaiting = isScheduled && lessonEnded(g);
              return (
                <article key={g.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <LiveSessionDateTile
                      date={g.startTime}
                      tone={isScheduled ? TONES[i % TONES.length] : "muted"}
                      timeZone={TIME_ZONE}
                    />
                    <div className={styles.cardHead}>
                      <div className={styles.cardChips}>
                        {g.subject && <span className={styles.subject}>{g.subject}</span>}
                        {status && <span className={`${styles.status} ${styles[`status_${status.tone}`]}`}>{status.label}</span>}
                      </div>
                      <h3 className={styles.cardTitle}>{g.title}</h3>
                      <p className={styles.cardMeta}>
                        {relativeDayLabel(g.startTime, TIME_ZONE) ? `${relativeDayLabel(g.startTime, TIME_ZONE)}, ` : ""}
                        {formatSessionTime(g.startTime, TIME_ZONE)} &middot; {g.durationMinutes} min
                      </p>
                    </div>
                    {isScheduled && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-md" aria-label={`More options for ${g.title}`}>
                            <MoreHorizontal size={18} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditingRow(g)}>
                            <Edit2 size={14} /> Edit details
                          </DropdownMenuItem>
                          {started && (
                            <DropdownMenuItem onSelect={() => setCompleteTarget(g)}>
                              <CheckCircle2 size={14} /> Mark completed
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onSelect={() => setCancelTarget(g)}>
                            <Ban size={14} /> Cancel lesson
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <SeatsMeter enrolled={g.enrolledCount} capacity={g.maxCapacity} />

                  {awaiting && (
                    <div className={styles.completeRow}>
                      <span>This lesson has ended. Mark it completed so learners and your earnings show it correctly.</span>
                      <Button size="sm" onClick={() => setCompleteTarget(g)}>
                        <CheckCircle2 size={14} aria-hidden="true" /> Mark completed
                      </Button>
                    </div>
                  )}

                  {g.cancellationReason && <p className={styles.reason}>{g.cancellationReason}</p>}

                  <div className={styles.cardFoot}>
                    <span className={`${styles.price} ${g.pricePerLearner > 0 ? "" : styles.free}`}>
                      {formatPrice(g.pricePerLearner)}
                      {g.pricePerLearner > 0 && <span className={styles.priceUnit}> per learner</span>}
                    </span>
                    <div className={styles.cardActions}>
                      <Button variant="ghost" size="sm" onClick={() => setRosterTarget(g)}>
                        <Users size={14} /> Learners
                      </Button>
                      {isScheduled && (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={`/mentorship/classroom/group/${g.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => handleClassroomLinkClick(e, `/mentorship/classroom/group/${g.id}`)}
                          >
                            <Video size={14} /> Classroom
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            };

            return (
              <>
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>
                    Upcoming <span className={styles.count}>{upcoming.length}</span>
                  </h2>
                  {upcoming.length > 0 ? (
                    <div className={styles.grid}>{upcoming.map(card)}</div>
                  ) : (
                    <p className={styles.emptyState}>Nothing scheduled. Create a lesson to open enrollments.</p>
                  )}
                </section>
                {earlier.length > 0 && (
                  <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                      Earlier <span className={styles.count}>{earlier.length}</span>
                    </h2>
                    <div className={styles.grid}>{earlier.map(card)}</div>
                  </section>
                )}
              </>
            );
          })()
        )}
      </div>

      <GroupLessonDialog open={editingRow !== null} onOpenChange={(open) => !open && setEditingRow(null)} row={editingRow === "new" ? null : editingRow} />
      <CancelDialog row={cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)} />
      <RosterDialog row={rosterTarget} onOpenChange={(open) => !open && setRosterTarget(null)} />
      <ConsoleConfirmDialog
        open={!!completeTarget}
        onOpenChange={(open) => !open && setCompleteTarget(null)}
        icon={<CheckCircle2 />}
        title={`Mark "${completeTarget?.title ?? ""}" completed?`}
        description="Confirm the lesson took place. It moves to Completed for you, your learners and the Testkart team."
        confirmLabel="Mark completed"
        pendingLabel="Saving..."
        isPending={completeMutation.isPending}
        onConfirm={() => {
          if (!completeTarget) return;
          completeMutation.mutate(
            { kind: "group", id: completeTarget.id },
            {
              onSuccess: (r) => {
                toast.success(r.changed ? "Lesson marked completed." : "This lesson was already completed.");
                setCompleteTarget(null);
              },
              onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update status."),
            }
          );
        }}
      />
    </>
  );
};

export default TeacherGroupLessonsPage;

const GroupLessonDialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void; row: TeacherGroupLessonRow | null }> = ({
  open,
  onOpenChange,
  row,
}) => {
  const upsertMutation = useUpsertGroupLessonMutation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [pricePerLearner, setPricePerLearner] = useState("");
  const [maxCapacity, setMaxCapacity] = useState("10");
  const [minEnrollment, setMinEnrollment] = useState("");
  const [minEnrollmentPolicy, setMinEnrollmentPolicy] = useState<"run_anyway" | "cancel_if_not_met">("run_anyway");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageFileId, setCoverImageFileId] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(row?.title ?? "");
    setDescription("");
    setSubject(row?.subject ?? "");
    setLevel(row?.level ?? "");
    setStartTime(toDateTimeLocal(row?.startTime ?? null));
    setDurationMinutes(row ? String(row.durationMinutes) : "60");
    setPricePerLearner(row ? String(row.pricePerLearner) : "");
    setMaxCapacity(row ? String(row.maxCapacity) : "10");
    setMinEnrollment(row?.minEnrollment ? String(row.minEnrollment) : "");
    setMinEnrollmentPolicy((row?.minEnrollmentPolicy as any) ?? "run_anyway");
    setCoverImageUrl(row?.coverImageUrl ?? "");
    setCoverImageFileId("");
  }, [open, row?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) {
      toast.error("Give this lesson a title.");
      return;
    }
    if (!startTime) {
      toast.error("Pick a start time.");
      return;
    }
    upsertMutation.mutate(
      {
        id: row?.id,
        title: title.trim(),
        description: description.trim() || undefined,
        subject: subject.trim() || undefined,
        level: level.trim() || undefined,
        startTime: new Date(startTime),
        durationMinutes: Number(durationMinutes),
        pricePerLearner: Number(pricePerLearner) || 0,
        maxCapacity: Number(maxCapacity),
        minEnrollment: minEnrollment ? Number(minEnrollment) : undefined,
        minEnrollmentPolicy,
        coverImageUrl: coverImageUrl || undefined,
        coverImageFileId: coverImageFileId || undefined,
      },
      {
        onSuccess: () => {
          toast.success(row ? "Group lesson updated." : "Group lesson created.");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save this lesson."),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="lg">
        <ConsoleDialogHeader title={row ? "Edit group lesson" : "Create group lesson"} description="Learners enroll until capacity or the start time." />
        <form onSubmit={handleSubmit}>
          <ConsoleDialogBody className={styles.dialogFields}>
            <div className={styles.field}>
              <label className={styles.label}>Thumbnail (optional)</label>
              <ImageUploader
                folder="group-lessons"
                label="Upload thumbnail"
                aspectRatio="16 / 9"
                currentImageUrl={coverImageUrl || undefined}
                currentFileId={coverImageFileId || undefined}
                onSuccess={({ url, fileId }) => {
                  setCoverImageUrl(url);
                  setCoverImageFileId(fileId);
                }}
                onError={(err) => toast.error(err.message)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Algebra crash course" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Description (optional)</label>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>Subject (optional)</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Mathematics" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Level (optional)</label>
                <Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Beginner" />
              </div>
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>Starts at</label>
                <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Duration (minutes)</label>
                <Input type="number" min="15" max="240" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
              </div>
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>Price per learner (&#8377;, 0 for free)</label>
                <Input type="number" min="0" value={pricePerLearner} onChange={(e) => setPricePerLearner(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Max capacity</label>
                <Input
                  type="number"
                  min={GROUP_LESSON_MIN_CAPACITY}
                  max={GROUP_LESSON_MAX_CAPACITY}
                  value={maxCapacity}
                  onChange={(e) => setMaxCapacity(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>Minimum enrollment (optional)</label>
                <Input type="number" min="1" value={minEnrollment} onChange={(e) => setMinEnrollment(e.target.value)} placeholder="No minimum" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>If minimum isn't met</label>
                <Select value={minEnrollmentPolicy} onValueChange={(v: any) => setMinEnrollmentPolicy(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="run_anyway">Run it anyway</SelectItem>
                      <SelectItem value="cancel_if_not_met">Cancel the lesson</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ConsoleDialogBody>
          <ConsoleDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? "Saving..." : row ? "Save changes" : "Create lesson"}
            </Button>
          </ConsoleDialogFooter>
        </form>
      </ConsoleDialogContent>
    </Dialog>
  );
};

const CancelDialog: React.FC<{ row: TeacherGroupLessonRow | null; onOpenChange: (open: boolean) => void }> = ({ row, onOpenChange }) => {
  const [reason, setReason] = useState("");
  const cancelMutation = useCancelGroupLessonMutation();

  return (
    <ConsoleConfirmDialog
      open={!!row}
      onOpenChange={(open) => {
        if (!open) setReason("");
        onOpenChange(open);
      }}
      title={`Cancel "${row?.title ?? ""}"?`}
      description="Everyone enrolled is notified by email. Refund/credit, if any, follows the existing order rules."
      tone="destructive"
      confirmLabel="Cancel lesson"
      pendingLabel="Cancelling..."
      isPending={cancelMutation.isPending}
      note={{ label: "Reason", value: reason, onChange: setReason, required: true }}
      onConfirm={() => {
        if (!row) return;
        cancelMutation.mutate(
          { id: row.id, reason: reason.trim() },
          {
            onSuccess: () => {
              toast.success("Lesson cancelled.");
              setReason("");
              onOpenChange(false);
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : "Could not cancel this lesson."),
          }
        );
      }}
    />
  );
};

const RosterDialog: React.FC<{ row: TeacherGroupLessonRow | null; onOpenChange: (open: boolean) => void }> = ({ row, onOpenChange }) => {
  const { data, isFetching } = useGroupLessonRosterQuery(row?.id ?? null);
  const removeMutation = useRemoveParticipantMutation();
  const [removeTarget, setRemoveTarget] = useState<{ studentId: number; name: string } | null>(null);
  const [removeReason, setRemoveReason] = useState("");

  return (
    <>
      <Dialog open={!!row} onOpenChange={onOpenChange}>
        <ConsoleDialogContent size="md">
          <ConsoleDialogHeader title={`Roster - ${row?.title ?? ""}`} description="Everyone currently enrolled." />
          <ConsoleDialogBody>
            {isFetching && !data ? (
              <Skeleton style={{ height: "6rem", width: "100%" }} />
            ) : !data || data.roster.filter((r) => r.status === "enrolled").length === 0 ? (
              <p className={styles.emptyStateSmall}>No one enrolled yet.</p>
            ) : (
              <div className={styles.rosterList}>
                {data.roster
                  .filter((r) => r.status === "enrolled")
                  .map((r) => (
                    <div key={r.enrollmentId} className={styles.rosterRow}>
                      <span>{r.studentName}</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${r.studentName}`}
                        onClick={() => setRemoveTarget({ studentId: r.studentId, name: r.studentName })}
                      >
                        <UserMinus size={14} />
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </ConsoleDialogBody>
          <ConsoleDialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </ConsoleDialogFooter>
        </ConsoleDialogContent>
      </Dialog>

      <ConsoleConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveTarget(null);
            setRemoveReason("");
          }
        }}
        title={`Remove ${removeTarget?.name ?? ""}?`}
        description="They are notified by email and their seat opens up for someone else."
        tone="destructive"
        confirmLabel="Remove"
        pendingLabel="Removing..."
        isPending={removeMutation.isPending}
        note={{ label: "Reason", value: removeReason, onChange: setRemoveReason, required: true }}
        onConfirm={() => {
          if (!row || !removeTarget) return;
          removeMutation.mutate(
            { groupLessonId: row.id, studentId: removeTarget.studentId, reason: removeReason.trim() },
            {
              onSuccess: () => {
                toast.success("Removed.");
                setRemoveTarget(null);
                setRemoveReason("");
              },
              onError: (err) => toast.error(err instanceof Error ? err.message : "Could not remove this participant."),
            }
          );
        }}
      />
    </>
  );
};
