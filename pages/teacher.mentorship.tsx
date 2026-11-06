import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  IndianRupee,
  Globe,
  CalendarX,
  CalendarClock,
  Users,
  Video,
  ArrowRight,
  CheckCircle2,
  Circle,
  UserRound,
  Send,
  Hourglass,
  AlertTriangle,
} from "lucide-react";
import {
  useTeacherMentorshipRateQuery,
  useSetTeacherMentorshipRateMutation,
  useTeacherAvailabilityQuery,
  useSetAvailabilityMutation,
  useAddBlockedDateMutation,
  useDeleteBlockedDateMutation,
} from "../helpers/useTeacherMentorship";
import {
  useLiveTeachingStatusQuery,
  useSaveLiveTeachingVideoMutation,
  useApplyLiveTeachingMutation,
} from "../helpers/useLiveTeaching";
import { LIVE_TEACHING_VIDEO_FOLDER, LIVE_TEACHING_VIDEO_MAX_MB, canApplyFromStatus } from "../helpers/liveTeachingRules";
import { OutputType as LiveTeachingStatusOutput } from "../endpoints/teacher/live-teaching/status_GET.schema";
import { AvailabilityWindow } from "../endpoints/teacher/mentorship/availability/get_GET.schema";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { Button } from "../components/Button";
import { Switch } from "../components/Switch";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import { VideoUploader } from "../components/VideoUploader";
import styles from "./teacher.mentorship.module.css";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/* Monday first, the way teachers plan a week. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const COMMON_TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Karachi",
  "Asia/Dhaka",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];

const TeacherMentorshipPage: React.FC = () => {
  const statusQuery = useLiveTeachingStatusQuery();
  const live = statusQuery.data;
  const approved = live?.status === "approved";

  return (
    <>
      <Helmet>
        <title>Live Teaching - Testkart</title>
      </Helmet>
      <div className={`${styles.page} tk-flow`}>
        <ConsolePageHeader
          title={approved || !live ? "1:1 sessions" : "Teach live on Testkart"}
          description={
            approved || !live
              ? "Set your rate and hours. Students book a 25 or 50 minute session from your profile."
              : "Apply once. When our team approves you, students can book 1:1 sessions and join your group classes."
          }
        />

        {statusQuery.isError ? (
          <section className={styles.card}>
            <p className={styles.emptyStateSmall}>Could not load your live teaching status.</p>
            <Button variant="outline" onClick={() => statusQuery.refetch()}>
              Try again
            </Button>
          </section>
        ) : !live ? (
          <Skeleton style={{ height: "20rem", width: "100%", borderRadius: "1.25rem" }} />
        ) : approved ? (
          <div className={styles.layout}>
            <div className={styles.main}>
              <RateCard />
              <AvailabilityCard />
            </div>
            <aside className={styles.aside}>
              <ShortcutsCard />
              <IntroVideoCard live={live} />
              <BlockedDatesCard />
            </aside>
          </div>
        ) : (
          <div className={styles.layout}>
            <div className={styles.main}>
              <StatusNotice live={live} />
              <ProfileChecklistCard live={live} />
              <IntroVideoCard live={live} />
              <RateCard applying />
              <AvailabilityCard />
            </div>
            <aside className={styles.aside}>
              <ApplyCard live={live} />
              <BlockedDatesCard />
            </aside>
          </div>
        )}
      </div>
    </>
  );
};

export default TeacherMentorshipPage;

const CardHead: React.FC<{ icon: React.ReactNode; tone: "lavender" | "blue" | "butter" | "mint"; title: string; hint?: string; children?: React.ReactNode }> = ({
  icon,
  tone,
  title,
  hint,
  children,
}) => (
  <div className={styles.cardHead}>
    <span className={`${styles.cardIcon} ${styles[`icon_${tone}`]}`} aria-hidden="true">
      {icon}
    </span>
    <div className={styles.cardHeadText}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {hint && <p className={styles.sectionHint}>{hint}</p>}
    </div>
    {children}
  </div>
);

/* applying: before approval the rate is saved but 1:1 bookings stay off. */
const RateCard: React.FC<{ applying?: boolean }> = ({ applying = false }) => {
  const { data, isFetching } = useTeacherMentorshipRateQuery();
  const setRateMutation = useSetTeacherMentorshipRateMutation();
  const [enabled, setEnabled] = useState(false);
  const [rate, setRate] = useState("");

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setRate(data.ratePerUnit !== null ? String(data.ratePerUnit) : String(data.minRatePerUnit));
  }, [data]);

  if (isFetching && !data) {
    return (
      <section className={styles.card}>
        <Skeleton style={{ height: "9rem", width: "100%" }} />
      </section>
    );
  }

  const minRate = data?.minRatePerUnit ?? 49;
  const rateNumber = Number(rate);
  const rateValid = !Number.isNaN(rateNumber) && rateNumber >= minRate;
  const durations = data?.durations ?? [25, 50];
  const isLive = !!data?.enabled;

  const handleSave = () => {
    if ((enabled || applying) && !rateValid) {
      toast.error(`Set a rate of at least ₹${minRate} per 25 minutes.`);
      return;
    }
    setRateMutation.mutate(
      { enabled: applying ? false : enabled, ratePerUnit: Number.isNaN(rateNumber) ? undefined : rateNumber },
      {
        onSuccess: () => toast.success(applying ? "Rate saved." : "1:1 pricing saved."),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save this."),
      }
    );
  };

  const showRate = applying || enabled;

  return (
    <section className={styles.card}>
      <CardHead icon={<IndianRupee size={18} />} tone="lavender" title="Your rate" hint="A student's first session with you is a trial.">
        {!applying && (
          <span className={`${styles.liveChip} ${isLive ? styles.liveChipOn : ""}`}>{isLive ? "On your profile" : "Off"}</span>
        )}
      </CardHead>

      {!applying && (
        <div className={`${styles.switchRow} ${enabled ? styles.switchRowOn : ""}`}>
          <div className={styles.switchText}>
            <span className={styles.switchLabel} id="mentorship-enabled-label">
              Take 1:1 bookings
            </span>
            <span className={styles.switchHint}>Adds a Book button to your public profile.</span>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-labelledby="mentorship-enabled-label" />
        </div>
      )}

      {showRate && (
        <div className={styles.rateRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="mentorship-rate">
              Rate per 25 minutes
            </label>
            <div className={styles.moneyInput}>
              <span className={styles.moneyPrefix} aria-hidden="true">
                ₹
              </span>
              <Input id="mentorship-rate" type="number" min={minRate} value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <span className={styles.fieldHint}>Minimum ₹{minRate}</span>
          </div>

          <div className={styles.pricePreview} aria-label="What students pay">
            {durations.map((minutes) => (
              <div key={minutes} className={styles.priceTile}>
                <span className={styles.priceTileLabel}>{minutes} min</span>
                <span className={styles.priceTileValue}>
                  {rateValid ? `₹${Math.round((rateNumber * minutes) / 25).toLocaleString("en-IN")}` : "-"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.saveRow}>
        <Button onClick={handleSave} disabled={setRateMutation.isPending}>
          {setRateMutation.isPending ? "Saving..." : applying ? "Save rate" : "Save"}
        </Button>
      </div>
    </section>
  );
};

const AvailabilityCard: React.FC = () => {
  const { data, isFetching } = useTeacherAvailabilityQuery();
  const setAvailabilityMutation = useSetAvailabilityMutation();

  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);

  useEffect(() => {
    if (!data) return;
    setTimezone(data.timezone);
    setWindows(data.windows);
  }, [data]);

  const addWindow = (dayOfWeek: number) => {
    setWindows((prev) => [...prev, { id: -Date.now(), dayOfWeek, startTime: "09:00", endTime: "17:00", isActive: true }]);
  };

  const updateWindow = (idx: number, patch: Partial<AvailabilityWindow>) => {
    setWindows((prev) => prev.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  };

  const removeWindow = (idx: number) => {
    setWindows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    setAvailabilityMutation.mutate(
      {
        timezone,
        windows: windows.map((w) => ({ dayOfWeek: w.dayOfWeek, startTime: w.startTime, endTime: w.endTime, isActive: w.isActive })),
      },
      {
        onSuccess: () => toast.success("Availability saved."),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save availability."),
      }
    );
  };

  if (isFetching && !data) {
    return (
      <section className={styles.card}>
        <Skeleton style={{ height: "16rem", width: "100%" }} />
      </section>
    );
  }

  return (
    <section className={styles.card}>
      <CardHead
        icon={<CalendarClock size={18} />}
        tone="blue"
        title="Weekly hours"
        hint="Students see open slots in their own timezone."
      >
        <div className={styles.timezoneField}>
          <Globe size={14} aria-hidden="true" />
          <Input
            list="common-timezones"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className={styles.timezoneInput}
            placeholder="Asia/Kolkata"
            aria-label="Your timezone"
          />
          <datalist id="common-timezones">
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
        </div>
      </CardHead>

      <div className={styles.week}>
        {DAY_ORDER.map((dayIndex) => {
          const dayName = DAY_NAMES[dayIndex];
          const dayWindows = windows.map((w, i) => ({ w, i })).filter(({ w }) => w.dayOfWeek === dayIndex);
          const isOpen = dayWindows.some(({ w }) => w.isActive);
          return (
            <div key={dayIndex} className={styles.dayRow}>
              <span className={`${styles.dayName} ${isOpen ? styles.dayOpen : ""}`}>{dayName}</span>
              <div className={styles.dayWindows}>
                {dayWindows.length === 0 && <span className={styles.dayUnavailable}>Not available</span>}
                {dayWindows.map(({ w, i }) => (
                  <div key={w.id} className={`${styles.windowRow} ${w.isActive ? "" : styles.windowOff}`}>
                    <Input
                      type="time"
                      value={w.startTime.slice(0, 5)}
                      onChange={(e) => updateWindow(i, { startTime: e.target.value })}
                      className={styles.timeInput}
                      aria-label={`${dayName} start time`}
                    />
                    <span>to</span>
                    <Input
                      type="time"
                      value={w.endTime.slice(0, 5)}
                      onChange={(e) => updateWindow(i, { endTime: e.target.value })}
                      className={styles.timeInput}
                      aria-label={`${dayName} end time`}
                    />
                    <Switch
                      checked={w.isActive}
                      onCheckedChange={(checked) => updateWindow(i, { isActive: checked })}
                      aria-label={`${dayName} hours on`}
                    />
                    <Button variant="ghost" size="icon-sm" onClick={() => removeWindow(i)} aria-label={`Remove ${dayName} hours`}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" className={styles.addHours} onClick={() => addWindow(dayIndex)}>
                <Plus size={14} /> Add hours
              </Button>
            </div>
          );
        })}
      </div>

      <div className={styles.saveRow}>
        <Button onClick={handleSave} disabled={setAvailabilityMutation.isPending}>
          {setAvailabilityMutation.isPending ? "Saving..." : "Save hours"}
        </Button>
      </div>
    </section>
  );
};

const BlockedDatesCard: React.FC = () => {
  const { data, isFetching } = useTeacherAvailabilityQuery();
  const addBlockedDateMutation = useAddBlockedDateMutation();
  const deleteBlockedDateMutation = useDeleteBlockedDateMutation();
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [newBlockedReason, setNewBlockedReason] = useState("");

  const handleAddBlockedDate = () => {
    if (!newBlockedDate) {
      toast.error("Pick a date to block.");
      return;
    }
    addBlockedDateMutation.mutate(
      { blockedDate: new Date(newBlockedDate), reason: newBlockedReason.trim() || undefined },
      {
        onSuccess: () => {
          setNewBlockedDate("");
          setNewBlockedReason("");
          toast.success("Date blocked.");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not block this date."),
      }
    );
  };

  return (
    <section className={styles.card}>
      <CardHead icon={<CalendarX size={18} />} tone="butter" title="Days off" hint="No slots are offered on these dates." />

      <div className={styles.blockedDateForm}>
        <Input
          type="date"
          value={newBlockedDate}
          onChange={(e) => setNewBlockedDate(e.target.value)}
          aria-label="Date to block"
        />
        <Input value={newBlockedReason} onChange={(e) => setNewBlockedReason(e.target.value)} placeholder="Reason (optional)" />
        <Button variant="outline" onClick={handleAddBlockedDate} disabled={addBlockedDateMutation.isPending}>
          <Plus size={14} /> Block date
        </Button>
      </div>

      {isFetching && !data ? (
        <Skeleton style={{ height: "3rem", width: "100%" }} />
      ) : data && data.blockedDates.length > 0 ? (
        <ul className={styles.blockedList}>
          {data.blockedDates.map((b) => (
            <li key={b.id} className={styles.blockedRow}>
              <CalendarX size={14} aria-hidden="true" />
              <span className={styles.blockedText}>
                <span>{new Date(b.blockedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                {b.reason && <span className={styles.blockedReason}>{b.reason}</span>}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => deleteBlockedDateMutation.mutate(b.id)}
                aria-label="Remove blocked date"
              >
                <Trash2 size={14} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyStateSmall}>No days off planned.</p>
      )}
    </section>
  );
};

const ShortcutsCard: React.FC = () => (
  <nav className={`${styles.card} ${styles.shortcuts}`} aria-label="Live teaching">
    <Link to="/teacher/mentorship/bookings" className={styles.shortcut}>
      <span className={`${styles.cardIcon} ${styles.icon_mint}`} aria-hidden="true">
        <Video size={18} />
      </span>
      <span className={styles.shortcutText}>
        <span className={styles.shortcutTitle}>1:1 bookings</span>
        <span className={styles.shortcutHint}>Sessions students booked</span>
      </span>
      <ArrowRight size={16} aria-hidden="true" className={styles.shortcutArrow} />
    </Link>
    <Link to="/teacher/mentorship/group-lessons" className={styles.shortcut}>
      <span className={`${styles.cardIcon} ${styles.icon_blue}`} aria-hidden="true">
        <Users size={18} />
      </span>
      <span className={styles.shortcutText}>
        <span className={styles.shortcutTitle}>Group lessons</span>
        <span className={styles.shortcutHint}>Classes many can join</span>
      </span>
      <ArrowRight size={16} aria-hidden="true" className={styles.shortcutArrow} />
    </Link>
  </nav>
);

type LiveProps = { live: LiveTeachingStatusOutput };

const formatDay = (date: Date | null) =>
  date ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

const PROFILE_KEYS = new Set(["photo", "headline", "bio", "subjects", "languages"]);

const CheckRow: React.FC<{ label: string; done: boolean }> = ({ label, done }) => (
  <li className={`${styles.checkItem} ${done ? styles.checkDone : ""}`}>
    {done ? <CheckCircle2 size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
    <span>{label}</span>
    <span className={styles.srOnly}>{done ? "done" : "to do"}</span>
  </li>
);

const StatusNotice: React.FC<LiveProps> = ({ live }) => {
  if (live.status === "pending") {
    return (
      <div className={`${styles.notice} ${styles.notice_pending}`} role="status">
        <Hourglass size={18} aria-hidden="true" />
        <div>
          <p className={styles.noticeTitle}>Your application is in review</p>
          <p className={styles.noticeText}>
            Sent {formatDay(live.appliedAt)}. We will email you when it is approved.
          </p>
        </div>
      </div>
    );
  }
  if (live.status === "rejected" || live.status === "revoked") {
    return (
      <div className={`${styles.notice} ${styles.notice_changes}`} role="status">
        <AlertTriangle size={18} aria-hidden="true" />
        <div>
          <p className={styles.noticeTitle}>
            {live.status === "rejected" ? "Your application needs changes" : "Live teaching is paused"}
          </p>
          {live.decisionReason && <p className={styles.noticeText}>{live.decisionReason}</p>}
          <p className={styles.noticeText}>Fix this and apply again.</p>
        </div>
      </div>
    );
  }
  return null;
};

const ProfileChecklistCard: React.FC<LiveProps> = ({ live }) => {
  const items = live.checklist.filter((item) => PROFILE_KEYS.has(item.key));
  const allDone = items.every((item) => item.done);
  return (
    <section className={styles.card}>
      <CardHead
        icon={<UserRound size={18} />}
        tone="mint"
        title="Your profile"
        hint="Students decide from your profile, so it needs to be complete."
      >
        <Button variant={allDone ? "outline" : "primary"} size="sm" asChild>
          <Link to="/teacher/edit-profile">Edit profile</Link>
        </Button>
      </CardHead>
      <ul className={styles.checkList}>
        {items.map((item) => (
          <CheckRow key={item.key} label={item.label} done={item.done} />
        ))}
      </ul>
    </section>
  );
};

const IntroVideoCard: React.FC<LiveProps> = ({ live }) => {
  const saveVideo = useSaveLiveTeachingVideoMutation();
  const locked = live.status === "pending" || live.status === "approved";
  const canEdit = !locked && live.isOwner;

  const save = (url: string | null, fileId: string | null) => {
    saveVideo.mutate(
      { introVideoUrl: url, introVideoFileId: fileId },
      {
        onSuccess: () => toast.success(url ? "Intro video saved." : "Intro video removed."),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save the video."),
      }
    );
  };

  return (
    <section className={styles.card}>
      <CardHead
        icon={<Video size={18} />}
        tone="blue"
        title="Intro video"
        hint={locked ? "Shown on your profile once you are approved." : "1 to 2 minutes. Say hello, what you teach and how a class with you goes."}
      />
      {canEdit ? (
        <VideoUploader
          folder={LIVE_TEACHING_VIDEO_FOLDER}
          maxSizeInMB={LIVE_TEACHING_VIDEO_MAX_MB}
          currentVideoUrl={live.introVideoUrl ?? undefined}
          label="Upload your intro video"
          onSuccess={({ url, videoFileId }) => save(url || null, url ? videoFileId : null)}
          onRemove={() => save(null, null)}
          onError={(err) => toast.error(err.message)}
        />
      ) : live.introVideoUrl ? (
        <video className={styles.introVideo} src={live.introVideoUrl} controls preload="metadata" playsInline />
      ) : (
        <p className={styles.emptyStateSmall}>Only the account owner can add the intro video.</p>
      )}
      {canEdit && (
        <ul className={styles.tips}>
          <li>Film in landscape, in a quiet room with good light.</li>
          <li>MP4, MOV or WebM, up to {LIVE_TEACHING_VIDEO_MAX_MB} MB.</li>
        </ul>
      )}
      {live.status === "approved" && (
        <p className={styles.fieldHint}>To replace an approved video, write to support.</p>
      )}
    </section>
  );
};

const ApplyCard: React.FC<LiveProps> = ({ live }) => {
  const apply = useApplyLiveTeachingMutation();
  const doneCount = live.checklist.filter((item) => item.done).length;
  const total = live.checklist.length;
  const ready = doneCount === total;
  const canApply = canApplyFromStatus(live.status) && live.isOwner;

  const submit = () => {
    apply.mutate(undefined, {
      onSuccess: () => toast.success("Application sent. We will email you after the review."),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Could not send your application."),
    });
  };

  return (
    <section className={`${styles.card} ${styles.applyCard}`}>
      <CardHead icon={<Send size={18} />} tone="lavender" title="Apply" hint={`${doneCount} of ${total} ready`} />
      <div className={styles.progress} aria-hidden="true">
        <span className={styles.progressBar} style={{ width: `${Math.round((doneCount / total) * 100)}%` }} />
      </div>
      <ul className={styles.checkList}>
        {live.checklist.map((item) => (
          <CheckRow key={item.key} label={item.label} done={item.done} />
        ))}
      </ul>
      {live.status === "pending" ? (
        <p className={styles.fieldHint}>In review. Your rate and hours can still change.</p>
      ) : !live.isOwner ? (
        <p className={styles.fieldHint}>Only the account owner can apply.</p>
      ) : (
        <Button onClick={submit} disabled={!ready || !canApply || apply.isPending}>
          {apply.isPending ? "Sending..." : live.status === "none" ? "Send application" : "Apply again"}
        </Button>
      )}
    </section>
  );
};
