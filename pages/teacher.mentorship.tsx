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
  Search,
  MapPin,
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
  useWithdrawLiveTeachingMutation,
} from "../helpers/useLiveTeaching";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
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
              ? "Set your prices and hours. Students start with a trial, then book classes every week."
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
              <WhereYouShowCard />
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

type PriceKey = "trial25" | "trial50" | "class25" | "class50";
const PRICE_FIELDS: { key: PriceKey; label: string; hint: string }[] = [
  { key: "trial25", label: "Trial, 25 min", hint: "First class with you" },
  { key: "trial50", label: "Trial, 50 min", hint: "First class with you" },
  { key: "class25", label: "Class, 25 min", hint: "Each class in a package" },
  { key: "class50", label: "Class, 50 min", hint: "Each class in a package" },
];

/* applying: before approval the prices are saved but 1:1 bookings stay off. */
const RateCard: React.FC<{ applying?: boolean }> = ({ applying = false }) => {
  const { data, isFetching } = useTeacherMentorshipRateQuery();
  const setRateMutation = useSetTeacherMentorshipRateMutation();
  const [enabled, setEnabled] = useState(false);
  const [prices, setPrices] = useState<Record<PriceKey, string>>({ trial25: "", trial50: "", class25: "", class50: "" });

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    const p = data.prices;
    setPrices({
      trial25: String(p?.trial25 ?? data.minClassPrice25),
      trial50: String(p?.trial50 ?? data.minClassPrice50),
      class25: String(p?.class25 ?? data.minClassPrice25),
      class50: String(p?.class50 ?? data.minClassPrice50),
    });
  }, [data]);

  if (isFetching && !data) {
    return (
      <section className={styles.card}>
        <Skeleton style={{ height: "9rem", width: "100%" }} />
      </section>
    );
  }

  const min25 = data?.minClassPrice25 ?? 49;
  const min50 = data?.minClassPrice50 ?? 98;
  const values = {
    trial25: Number(prices.trial25),
    trial50: Number(prices.trial50),
    class25: Number(prices.class25),
    class50: Number(prices.class50),
  };
  const problem =
    Object.values(values).some((v) => !Number.isInteger(v) || v < 0)
      ? "Use whole rupees for every price."
      : values.class25 < min25
        ? `A 25-minute class must cost at least ₹${min25}.`
        : values.class50 < min50
          ? `A 50-minute class must cost at least ₹${min50}.`
          : null;
  const isLive = !!data?.enabled;

  const handleSave = () => {
    if (problem) {
      toast.error(problem);
      return;
    }
    setRateMutation.mutate(
      { enabled: applying ? false : enabled, prices: values },
      {
        onSuccess: () => toast.success(applying ? "Prices saved." : "1:1 prices saved."),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save this."),
      }
    );
  };

  const showRate = applying || enabled;

  return (
    <section className={styles.card}>
      <CardHead
        icon={<IndianRupee size={18} />}
        tone="lavender"
        title="Your prices"
        hint="Students start with a trial, then take 1 to 6 classes a week, paid every 4 weeks."
      >
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
        <>
          <div className={styles.priceGrid}>
            {PRICE_FIELDS.map((f) => (
              <div key={f.key} className={styles.field}>
                <label className={styles.label} htmlFor={`price-${f.key}`}>
                  {f.label}
                </label>
                <div className={styles.moneyInput}>
                  <span className={styles.moneyPrefix} aria-hidden="true">
                    ₹
                  </span>
                  <Input
                    id={`price-${f.key}`}
                    type="number"
                    min={0}
                    step={1}
                    value={prices[f.key]}
                    onChange={(e) => setPrices((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                </div>
                <span className={styles.fieldHint}>
                  {f.key === "class25" ? `${f.hint}. Minimum ₹${min25}` : f.key === "class50" ? `${f.hint}. Minimum ₹${min50}` : `${f.hint}. Can be ₹0`}
                </span>
              </div>
            ))}
          </div>

          <div className={styles.pricePreview} aria-label="What a package costs">
            {[1, 3, 6].map((perWeek) => (
              <div key={perWeek} className={styles.priceTile}>
                <span className={styles.priceTileLabel}>{perWeek} a week, 50 min</span>
                <span className={styles.priceTileValue}>
                  {problem ? "-" : `₹${(values.class50 * perWeek * 4).toLocaleString("en-IN")}`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className={styles.saveRow}>
        <Button onClick={handleSave} disabled={setRateMutation.isPending}>
          {setRateMutation.isPending ? "Saving..." : applying ? "Save prices" : "Save"}
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
    setWindows((prev) => [...prev, { id: `new-${Date.now()}`, dayOfWeek, startTime: "09:00", endTime: "17:00", isActive: true }]);
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
  if (live.withdrawnAt) {
    return (
      <div className={`${styles.notice} ${styles.notice_pending}`} role="status">
        <Hourglass size={18} aria-hidden="true" />
        <div>
          <p className={styles.noticeTitle}>You withdrew your application</p>
          <p className={styles.noticeText}>On {formatDay(live.withdrawnAt)}. Apply again whenever you are ready.</p>
        </div>
      </div>
    );
  }
  return null;
};

const SAMPLE_INTRO_VIDEO_URL = "https://cdn.testkart.in/platform/marketing/live-onboarding-sample.mp4";

const SHOW_PLACES = [
  {
    icon: <UserRound size={16} />,
    tone: "mint",
    title: "Your public profile",
    text: "A \"Learn live\" section with your intro video, 1:1 prices and a button to see your open times.",
  },
  {
    icon: <Search size={16} />,
    tone: "lavender",
    title: "Tutor list",
    text: "Students looking for a 1:1 tutor see your card and can book a trial session.",
  },
  {
    icon: <Users size={16} />,
    tone: "blue",
    title: "Group classes",
    text: "Classes you create show on your profile and in the live classes list, where students join them.",
  },
] as const;

/* Shown on the application until approval: where an approved teacher appears, plus a sample intro video. */
const WhereYouShowCard: React.FC = () => (
  <section className={styles.card}>
    <CardHead
      icon={<MapPin size={18} />}
      tone="butter"
      title="Where students will see you"
      hint="Once you are approved, your live teaching shows up in these places."
    />
    <ul className={styles.placeList}>
      {SHOW_PLACES.map((place) => (
        <li key={place.title} className={styles.placeItem}>
          <span className={`${styles.placeIcon} ${styles[`icon_${place.tone}`]}`} aria-hidden="true">
            {place.icon}
          </span>
          <span className={styles.placeText}>
            <span className={styles.placeTitle}>{place.title}</span>
            <span className={styles.placeHint}>{place.text}</span>
          </span>
        </li>
      ))}
    </ul>
    <div className={styles.sample}>
      <p className={styles.sampleLabel}>Sample intro video</p>
      <video
        className={styles.introVideo}
        src={SAMPLE_INTRO_VIDEO_URL}
        controls
        preload="metadata"
        playsInline
        aria-label="Sample intro video"
      />
      <p className={styles.fieldHint}>This is how an intro video plays at the top of the Learn live section on a profile.</p>
    </div>
  </section>
);

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

/*
 * Before applying the video changes at once; in review it replaces the one in the application;
 * once approved a new video waits for our team and the current one stays on the profile.
 */
const IntroVideoCard: React.FC<LiveProps> = ({ live }) => {
  const saveVideo = useSaveLiveTeachingVideoMutation();
  const withdraw = useWithdrawLiveTeachingMutation();
  const approved = live.status === "approved";
  const pending = live.status === "pending";
  const canEdit = live.isOwner;
  const [uploaderKey, setUploaderKey] = useState(0);

  const save = (url: string | null, fileId: string | null) => {
    if (!url && (approved || pending)) return;
    saveVideo.mutate(
      { introVideoUrl: url, introVideoFileId: fileId },
      {
        onSuccess: (res) => {
          toast.success(
            res.inReview
              ? "New video sent for review. Your current video stays on your profile until it is approved."
              : !url
                ? "Intro video removed."
                : pending
                  ? "Video updated in your application."
                  : "Intro video saved."
          );
          setUploaderKey((k) => k + 1);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save the video."),
      }
    );
  };

  const cancelChange = () =>
    withdraw.mutate(
      { what: "video" },
      {
        onSuccess: () => toast.success("New video withdrawn. Your current video stays on your profile."),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not withdraw the video."),
      }
    );

  const uploader = (label: string, current: string | undefined, removable: boolean) => (
    <VideoUploader
      key={uploaderKey}
      folder={LIVE_TEACHING_VIDEO_FOLDER}
      maxSizeInMB={LIVE_TEACHING_VIDEO_MAX_MB}
      currentVideoUrl={current}
      label={label}
      onSuccess={({ url, videoFileId }) => save(url || null, url ? videoFileId : null)}
      onRemove={removable ? () => save(null, null) : undefined}
      onError={(err) => toast.error(err.message)}
    />
  );

  return (
    <section className={styles.card}>
      <CardHead
        icon={<Video size={18} />}
        tone="blue"
        title="Intro video"
        hint={
          approved
            ? "On your profile. A new video goes live once our team approves it."
            : pending
              ? "Changing it updates your application in review."
              : "1 to 2 minutes. Say hello, what you teach and how a class with you goes."
        }
      />

      {approved ? (
        <>
          {live.introVideoUrl && (
            <video className={styles.introVideo} src={live.introVideoUrl} controls preload="metadata" playsInline />
          )}
          {live.pendingVideo ? (
            <div className={styles.videoReview}>
              <p className={styles.videoReviewTitle}>New video in review since {formatDay(live.pendingVideo.sentAt)}</p>
              <video className={styles.introVideo} src={live.pendingVideo.url} controls preload="metadata" playsInline />
              {canEdit && (
                <div className={styles.videoReviewActions}>
                  <Button variant="outline" size="sm" disabled={withdraw.isPending} onClick={cancelChange}>
                    {withdraw.isPending ? "Withdrawing..." : "Withdraw new video"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              {live.videoRejection && (
                <p className={styles.videoRejected}>
                  Your last new video was not approved{live.videoRejection.reason ? `: ${live.videoRejection.reason}` : "."}
                </p>
              )}
              {canEdit && uploader("Upload a new video", undefined, false)}
            </>
          )}
        </>
      ) : canEdit ? (
        uploader("Upload your intro video", live.introVideoUrl ?? undefined, !pending)
      ) : live.introVideoUrl ? (
        <video className={styles.introVideo} src={live.introVideoUrl} controls preload="metadata" playsInline />
      ) : (
        <p className={styles.emptyStateSmall}>Only the account owner can add the intro video.</p>
      )}

      {canEdit && !live.pendingVideo && (
        <ul className={styles.tips}>
          <li>Film in landscape, in a quiet room with good light.</li>
          <li>MP4, MOV or WebM, up to {LIVE_TEACHING_VIDEO_MAX_MB} MB.</li>
        </ul>
      )}
    </section>
  );
};

const ApplyCard: React.FC<LiveProps> = ({ live }) => {
  const apply = useApplyLiveTeachingMutation();
  const withdraw = useWithdrawLiveTeachingMutation();
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
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
        <>
          <p className={styles.fieldHint}>In review. Your prices, hours and video can still change.</p>
          {live.isOwner && (
            <Button variant="outline" onClick={() => setConfirmWithdraw(true)} disabled={withdraw.isPending}>
              Withdraw application
            </Button>
          )}
        </>
      ) : !live.isOwner ? (
        <p className={styles.fieldHint}>Only the account owner can apply.</p>
      ) : (
        <Button onClick={submit} disabled={!ready || !canApply || apply.isPending}>
          {apply.isPending ? "Sending..." : live.status === "none" && !live.withdrawnAt ? "Send application" : "Apply again"}
        </Button>
      )}
      <ConsoleConfirmDialog
        open={confirmWithdraw}
        onOpenChange={setConfirmWithdraw}
        title="Withdraw your application?"
        description="It leaves the review queue. Your profile, prices, hours and video stay saved, and you can apply again any time."
        tone="destructive"
        confirmLabel="Withdraw"
        pendingLabel="Withdrawing..."
        isPending={withdraw.isPending}
        onConfirm={() =>
          withdraw.mutate(
            { what: "application" },
            {
              onSuccess: () => {
                setConfirmWithdraw(false);
                toast.success("Application withdrawn. You can apply again any time.");
              },
              onError: (err) => toast.error(err instanceof Error ? err.message : "Could not withdraw the application."),
            }
          )
        }
      />
    </section>
  );
};
