import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CalendarX,
  ExternalLink,
  IndianRupee,
  Megaphone,
  Power,
  Users,
  Video,
} from "lucide-react";
import { Button } from "./Button";
import { Switch } from "./Switch";
import { Skeleton } from "./Skeleton";
import { SegmentedControl } from "./SegmentedControl";
import { LiveCard } from "./LiveField";
import { LivePriceEditor } from "./LivePriceEditor";
import { LiveHoursEditor } from "./LiveHoursEditor";
import { LiveIntroVideo } from "./LiveIntroVideo";
import { LiveDaysOff } from "./LiveDaysOff";
import { useAuth } from "../helpers/useAuth";
import {
  useSetAvailabilityMutation,
  useSetTeacherMentorshipRateMutation,
  useTeacherAvailabilityQuery,
  useTeacherMentorshipRateQuery,
} from "../helpers/useTeacherMentorship";
import {
  formatDay,
  hoursProblem,
  hoursSnapshot,
  priceDraftFrom,
  priceFieldErrors,
  priceRulesFrom,
  priceSnapshot,
  priceValues,
  type HoursDraft,
  type PriceDraft,
} from "../helpers/liveTeachingForms";
import type { OutputType as LiveStatus } from "../endpoints/teacher/live-teaching/status_GET.schema";
import field from "./LiveField.module.css";
import styles from "./LiveSettingsView.module.css";

type Tab = "bookings" | "availability" | "video";
const TABS: { value: Tab; label: string }[] = [
  { value: "bookings", label: "Bookings and prices" },
  { value: "availability", label: "Availability" },
  { value: "video", label: "Intro video" },
];
const isTab = (v: string | null): v is Tab => TABS.some((t) => t.value === v);

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/*
 * Live settings for an approved teacher: three tabs so bookings and prices,
 * availability and the intro video are each one short screen, beside a status
 * card (approval, at a glance, public profile) and shortcuts. Drafts live here,
 * so switching tabs keeps unsaved edits.
 */
export const LiveSettingsView: React.FC<{ live: LiveStatus }> = ({ live }) => {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const tab: Tab = isTab(tabParam) ? tabParam : "bookings";
  const setTab = (next: Tab) =>
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next === "bookings") out.delete("tab");
        else out.set("tab", next);
        return out;
      },
      { replace: true }
    );

  const { authState } = useAuth();
  const slug = authState.type === "authenticated" && live.isOwner ? authState.user.slug : null;

  const rateQuery = useTeacherMentorshipRateQuery();
  const hoursQuery = useTeacherAvailabilityQuery();
  const saveRate = useSetTeacherMentorshipRateMutation();
  const saveHours = useSetAvailabilityMutation();
  const rate = rateQuery.data;
  const rules = priceRulesFrom(rate);
  const bookingsOn = !!rate?.enabled;

  const [prices, setPrices] = useState<PriceDraft | null>(null);
  const priceBase = useRef<string | null>(null);
  useEffect(() => {
    if (prices || !rate) return;
    const draft = priceDraftFrom(rate);
    priceBase.current = priceSnapshot(draft);
    setPrices(draft);
  }, [rate, prices]);

  const [hours, setHours] = useState<HoursDraft | null>(null);
  const hoursBase = useRef<string | null>(null);
  useEffect(() => {
    if (hours || !hoursQuery.data) return;
    const draft = { timezone: hoursQuery.data.timezone, windows: hoursQuery.data.windows };
    hoursBase.current = hoursSnapshot(draft);
    setHours(draft);
  }, [hoursQuery.data, hours]);

  const [showPriceErrors, setShowPriceErrors] = useState(false);
  const pricesDirty = !!prices && priceSnapshot(prices) !== priceBase.current;
  const hoursDirty = !!hours && hoursSnapshot(hours) !== hoursBase.current;
  const openDays = hours ? new Set(hours.windows.filter((w) => w.isActive).map((w) => w.dayOfWeek)).size : 0;

  const toggleBookings = (next: boolean) => {
    if (next && !rate?.prices) {
      toast.error("Save your prices first, then turn on bookings.");
      return;
    }
    if (next && openDays === 0 && !hoursDirty) {
      toast.message("Bookings are on, but no hours are open. Add weekly hours so students can pick a slot.");
    }
    saveRate.mutate(
      { enabled: next },
      {
        onSuccess: () =>
          toast.success(next ? "1:1 bookings are on. Students can book you now." : "1:1 bookings are off."),
        onError: (err) => toast.error(errorMessage(err, "Could not change bookings.")),
      }
    );
  };

  const savePrices = () => {
    if (!prices || !rate) return;
    if (Object.values(priceFieldErrors(prices, rules)).some(Boolean)) {
      setShowPriceErrors(true);
      toast.error("Fix the highlighted prices, then save.");
      return;
    }
    const snapshot = priceSnapshot(prices);
    saveRate.mutate(
      { enabled: rate.enabled, prices: { ...priceValues(prices), trialDiscount: prices.trialDiscount } },
      {
        onSuccess: () => {
          priceBase.current = snapshot;
          setShowPriceErrors(false);
          toast.success("Prices saved.");
        },
        onError: (err) => toast.error(errorMessage(err, "Could not save your prices.")),
      }
    );
  };

  const saveWeek = () => {
    if (!hours) return;
    const problem = hoursProblem(hours, false);
    if (problem) {
      toast.error(problem);
      return;
    }
    const snapshot = hoursSnapshot(hours);
    saveHours.mutate(
      {
        timezone: hours.timezone.trim(),
        windows: hours.windows.map((w) => ({
          dayOfWeek: w.dayOfWeek,
          startTime: w.startTime,
          endTime: w.endTime,
          isActive: w.isActive,
        })),
      },
      {
        onSuccess: () => {
          hoursBase.current = snapshot;
          toast.success("Weekly hours saved.");
        },
        onError: (err) => toast.error(errorMessage(err, "Could not save your hours.")),
      }
    );
  };

  const tabOptions = TABS.map((t) => ({
    value: t.value,
    label: (
      <span className={styles.tabLabel}>
        {t.label}
        {((t.value === "bookings" && pricesDirty) || (t.value === "availability" && hoursDirty)) && (
          <span className={styles.tabDot} aria-label="unsaved changes" />
        )}
      </span>
    ),
    ariaLabel: t.label,
  }));

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.main}>
          <SegmentedControl
            value={tab}
            onValueChange={setTab}
            options={tabOptions}
            aria-label="Live settings sections"
            className={styles.tabs}
          />

          {tab === "bookings" && (
            <>
              <LiveCard
                icon={<Power size={18} />}
                tone={bookingsOn ? "mint" : "sage"}
                title="1:1 bookings"
                hint="Adds a Book button to your public profile and lists you in the tutor list."
              >
                {rate ? (
                  <div className={styles.toggle} data-on={bookingsOn || undefined}>
                    <div className={field.switchText}>
                      <span className={styles.toggleState} id="live-bookings-label">
                        {bookingsOn ? "Taking bookings" : "Not taking bookings"}
                      </span>
                      <span className={field.switchHint}>
                        {bookingsOn
                          ? "Students can book trials and weekly packages. Booked classes stay booked if you turn this off."
                          : "Students see your profile but cannot book a new class."}
                      </span>
                    </div>
                    <Switch
                      checked={bookingsOn}
                      onCheckedChange={toggleBookings}
                      disabled={saveRate.isPending}
                      aria-labelledby="live-bookings-label"
                    />
                  </div>
                ) : (
                  <Skeleton style={{ height: "4.5rem", width: "100%", borderRadius: "0.875rem" }} />
                )}
              </LiveCard>

              <LiveCard
                icon={<IndianRupee size={18} />}
                tone="peach"
                title="Prices"
                hint="Students start with a trial, then take 1 to 6 classes a week, paid every 4 weeks."
              >
                {prices ? (
                  <>
                    <LivePriceEditor
                      value={prices}
                      onChange={setPrices}
                      rules={rules}
                      showErrors={showPriceErrors}
                      idPrefix="settings-price"
                    />
                    <div className={field.actions}>
                      {pricesDirty && <span className={field.actionsNote}>Unsaved changes</span>}
                      {pricesDirty && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            if (!rate) return;
                            setPrices(priceDraftFrom(rate));
                            setShowPriceErrors(false);
                          }}
                          disabled={saveRate.isPending}
                        >
                          Discard
                        </Button>
                      )}
                      <Button onClick={savePrices} disabled={saveRate.isPending || !pricesDirty}>
                        {saveRate.isPending ? "Saving..." : "Save prices"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <Skeleton style={{ height: "14rem", width: "100%", borderRadius: "1rem" }} />
                )}
              </LiveCard>
            </>
          )}

          {tab === "availability" && (
            <>
              <LiveCard
                icon={<CalendarClock size={18} />}
                tone="mint"
                title="Weekly hours"
                hint="Students pick a slot inside these hours."
              >
                {hours ? (
                  <>
                    <LiveHoursEditor value={hours} onChange={setHours} idPrefix="settings-hours" />
                    <div className={field.actions}>
                      {hoursDirty && <span className={field.actionsNote}>Unsaved changes</span>}
                      {hoursDirty && hoursQuery.data && (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            hoursQuery.data &&
                            setHours({ timezone: hoursQuery.data.timezone, windows: hoursQuery.data.windows })
                          }
                          disabled={saveHours.isPending}
                        >
                          Discard
                        </Button>
                      )}
                      <Button onClick={saveWeek} disabled={saveHours.isPending || !hoursDirty}>
                        {saveHours.isPending ? "Saving..." : "Save hours"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <Skeleton style={{ height: "18rem", width: "100%", borderRadius: "1rem" }} />
                )}
              </LiveCard>
              <LiveCard
                icon={<CalendarX size={18} />}
                tone="butter"
                title="Days off"
                hint="No slots are offered on these dates. Each one saves at once."
              >
                <LiveDaysOff />
              </LiveCard>
            </>
          )}

          {tab === "video" && (
            <LiveCard
              icon={<Video size={18} />}
              tone="lavender"
              title="Intro video"
              hint="On your profile. A new video goes live once our team approves it."
            >
              <LiveIntroVideo live={live} />
            </LiveCard>
          )}
        </div>

        <aside className={styles.aside}>
          <section className={styles.statusCard} aria-labelledby="live-approved-title">
            <div className={styles.statusHead}>
              <span className={styles.statusIcon} aria-hidden="true">
                <BadgeCheck size={18} />
              </span>
              <div className={styles.statusText}>
                <h2 className={styles.statusTitle} id="live-approved-title">
                  Live Teaching
                </h2>
                <p className={styles.statusMeta}>
                  {live.decidedAt ? `Approved on ${formatDay(live.decidedAt)}` : "Approved"}
                </p>
              </div>
            </div>
            <dl className={styles.summaryList}>
              <dt>Bookings</dt>
              <dd>
                {rate ? (
                  <span className={styles.bookingState} data-on={bookingsOn || undefined}>
                    <span className={styles.bookingDot} aria-hidden="true" />
                    {bookingsOn ? "On" : "Off"}
                  </span>
                ) : (
                  "-"
                )}
              </dd>
              <dt>Short session</dt>
              <dd>{rate?.prices ? `₹${rate.prices.classShort.toLocaleString("en-IN")}` : "Not set"}</dd>
              <dt>Full session</dt>
              <dd>{rate?.prices ? `₹${rate.prices.classFull.toLocaleString("en-IN")}` : "Not set"}</dd>
              <dt>Open days</dt>
              <dd>{hours ? `${openDays} a week` : "-"}</dd>
            </dl>
            {slug && (
              <a href={`/expert/${slug}`} target="_blank" rel="noreferrer" className={styles.profileLink}>
                View public profile
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            )}
          </section>
          <nav className={styles.shortcuts} aria-label="Live teaching">
            <Link to="/teacher/mentorship/bookings" className={styles.shortcut}>
              <span className={styles.shortcutIcon} data-tone="blue" aria-hidden="true">
                <Users size={16} />
              </span>
              <span className={styles.shortcutText}>
                <span className={styles.shortcutTitle}>1:1 bookings</span>
                <span className={styles.shortcutHint}>Sessions students booked</span>
              </span>
              <ArrowRight size={16} aria-hidden="true" className={styles.shortcutArrow} />
            </Link>
            <Link to="/teacher/live-courses" className={styles.shortcut}>
              <span className={styles.shortcutIcon} data-tone="lavender" aria-hidden="true">
                <Megaphone size={16} />
              </span>
              <span className={styles.shortcutText}>
                <span className={styles.shortcutTitle}>Live courses</span>
                <span className={styles.shortcutHint}>Batches of live classes</span>
              </span>
              <ArrowRight size={16} aria-hidden="true" className={styles.shortcutArrow} />
            </Link>
          </nav>
        </aside>
      </div>
    </div>
  );
};
