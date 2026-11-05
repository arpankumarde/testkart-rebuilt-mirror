import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import { Plus, Trash2, IndianRupee, Globe, CalendarX } from "lucide-react";
import {
  useTeacherMentorshipRateQuery,
  useSetTeacherMentorshipRateMutation,
  useTeacherAvailabilityQuery,
  useSetAvailabilityMutation,
  useAddBlockedDateMutation,
  useDeleteBlockedDateMutation,
} from "../helpers/useTeacherMentorship";
import { AvailabilityWindow } from "../endpoints/teacher/mentorship/availability/get_GET.schema";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { Button } from "../components/Button";
import { Switch } from "../components/Switch";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import styles from "./teacher.mentorship.module.css";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
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
  return (
    <>
      <Helmet>
        <title>Live Teaching: 1:1 Pricing - Testkart</title>
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader
          title="1:1 sessions"
          description="Set your rate once - every approved teacher can be booked for a 25 or 50 minute 1:1 session, no separate offering to create. A student's first session with you is automatically a trial."
        />

        <RateCard />

        <AvailabilitySection />
      </div>
    </>
  );
};

export default TeacherMentorshipPage;

const RateCard: React.FC = () => {
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
      <div className={styles.card}>
        <Skeleton style={{ height: "6rem", width: "100%" }} />
      </div>
    );
  }

  const minRate = data?.minRatePerUnit ?? 49;
  const rateNumber = Number(rate);
  const durations = data?.durations ?? [25, 50];

  const handleSave = () => {
    if (enabled && (Number.isNaN(rateNumber) || rateNumber < minRate)) {
      toast.error(`Set a rate of at least ₹${minRate} per 25 minutes.`);
      return;
    }
    setRateMutation.mutate(
      { enabled, ratePerUnit: Number.isNaN(rateNumber) ? undefined : rateNumber },
      {
        onSuccess: () => toast.success("1:1 pricing saved."),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save this."),
      }
    );
  };

  return (
    <div className={styles.card}>
      <div className={styles.switchRow}>
        <label className={styles.label}>Offer 1:1 sessions to students</label>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Offer 1:1 sessions" />
      </div>

      {enabled && (
        <>
          <div className={styles.field}>
            <label className={styles.label}>
              <IndianRupee size={14} /> Your rate per 25 minutes (min ₹{minRate})
            </label>
            <Input type="number" min={minRate} value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>

          {!Number.isNaN(rateNumber) && rateNumber >= minRate && (
            <ul className={styles.rowMeta} style={{ listStyle: "none", padding: 0, margin: 0, flexDirection: "column", gap: "0.25rem" }}>
              {durations.map((minutes) => (
                <li key={minutes}>
                  {minutes} minutes - ₹{Math.round((rateNumber * minutes) / 25).toLocaleString("en-IN")}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className={styles.saveRow}>
        <Button onClick={handleSave} disabled={setRateMutation.isPending}>
          {setRateMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
};

const AvailabilitySection: React.FC = () => {
  const { data, isFetching } = useTeacherAvailabilityQuery();
  const setAvailabilityMutation = useSetAvailabilityMutation();
  const addBlockedDateMutation = useAddBlockedDateMutation();
  const deleteBlockedDateMutation = useDeleteBlockedDateMutation();

  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [newBlockedReason, setNewBlockedReason] = useState("");

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

  if (isFetching && !data) {
    return (
      <div className={styles.card}>
        <Skeleton style={{ height: "10rem", width: "100%" }} />
      </div>
    );
  }

  return (
    <>
      <div className={styles.card}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Weekly availability</h2>
          <div className={styles.timezoneField}>
            <Globe size={14} />
            <Input
              list="common-timezones"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={styles.timezoneInput}
              placeholder="Asia/Kolkata"
            />
            <datalist id="common-timezones">
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          </div>
        </div>
        <p className={styles.sectionHint}>
          Times below are in the timezone you set above. Bookable slots are generated from these windows and shown to each
          learner in their own timezone.
        </p>

        {DAY_NAMES.map((dayName, dayIndex) => {
          const dayWindows = windows.map((w, i) => ({ w, i })).filter(({ w }) => w.dayOfWeek === dayIndex);
          return (
            <div key={dayIndex} className={styles.dayRow}>
              <span className={styles.dayName}>{dayName}</span>
              <div className={styles.dayWindows}>
                {dayWindows.length === 0 && <span className={styles.dayUnavailable}>Unavailable</span>}
                {dayWindows.map(({ w, i }) => (
                  <div key={w.id} className={styles.windowRow}>
                    <Input
                      type="time"
                      value={w.startTime.slice(0, 5)}
                      onChange={(e) => updateWindow(i, { startTime: e.target.value })}
                      className={styles.timeInput}
                    />
                    <span>to</span>
                    <Input
                      type="time"
                      value={w.endTime.slice(0, 5)}
                      onChange={(e) => updateWindow(i, { endTime: e.target.value })}
                      className={styles.timeInput}
                    />
                    <Switch checked={w.isActive} onCheckedChange={(checked) => updateWindow(i, { isActive: checked })} aria-label="Active" />
                    <Button variant="ghost" size="icon-sm" onClick={() => removeWindow(i)} aria-label="Remove window">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addWindow(dayIndex)}>
                  <Plus size={14} /> Add window
                </Button>
              </div>
            </div>
          );
        })}

        <div className={styles.saveRow}>
          <Button onClick={handleSave} disabled={setAvailabilityMutation.isPending}>
            {setAvailabilityMutation.isPending ? "Saving..." : "Save availability"}
          </Button>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Blocked dates</h2>
        <p className={styles.sectionHint}>Holidays or days off - no slots are offered on these dates regardless of your weekly availability.</p>

        <div className={styles.blockedDateForm}>
          <Input type="date" value={newBlockedDate} onChange={(e) => setNewBlockedDate(e.target.value)} className={styles.dateInput} />
          <Input
            value={newBlockedReason}
            onChange={(e) => setNewBlockedReason(e.target.value)}
            placeholder="Reason (optional)"
            className={styles.reasonInput}
          />
          <Button onClick={handleAddBlockedDate} disabled={addBlockedDateMutation.isPending}>
            <Plus size={14} /> Block date
          </Button>
        </div>

        {data && data.blockedDates.length > 0 ? (
          <div className={styles.blockedList}>
            {data.blockedDates.map((b) => (
              <div key={b.id} className={styles.blockedRow}>
                <CalendarX size={14} />
                <span>{new Date(b.blockedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                {b.reason && <span className={styles.blockedReason}>{b.reason}</span>}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => deleteBlockedDateMutation.mutate(b.id)}
                  aria-label="Remove blocked date"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.emptyStateSmall}>No blocked dates.</p>
        )}
      </div>
    </>
  );
};
