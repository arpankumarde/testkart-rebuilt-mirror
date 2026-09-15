import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { CheckCircle2, GraduationCap, X } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import { R2_PUBLIC_URL } from "../helpers/_publicConfigs";
import { useBookDemoDialog } from "../helpers/useBookDemoDialog";
import { useBookDemoMutation, getBookDemoErrorMessage } from "../helpers/useBookDemo";
import {
  schema as demoRequestSchema,
  DEMO_EXPERTISE_OPTIONS,
  DEMO_CALL_SLOT_LABELS,
  DEMO_CALL_SLOT_VALUES,
  DemoCallSlot,
  dateKeyToDate,
  demoCallSlotStartMinutes,
  formatDemoCallSlot,
  istDateKey,
  istMinutesOfDay,
  shiftDateKey,
  InputType as DemoRequestInput,
} from "../endpoints/demo-request/submit_POST.schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./Dialog";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./Select";
import styles from "./BookDemoPopup.module.css";

const STORAGE_KEY = "tk_demo_popup_v1";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Host comes from the shared R2 config so it follows the CDN, not this file. */
const DEMO_IMAGE_URL = `https://${R2_PUBLIC_URL}/marketing-assets/home-demo-cta-popup.png`;
/** Intrinsic size of the asset — set on the <img> so the card reserves space. */
const DEMO_IMAGE_WIDTH = 400;
const DEMO_IMAGE_HEIGHT = 300;

/**
 * How long the popup stays away after a dismissal or a booking. This is a hard
 * ceiling: readHiddenUntil clamps to it, so any longer suppression written by an
 * earlier build expires within a week rather than lingering.
 */
const HIDE_DAYS = 7;

/**
 * Effectively immediate. The real floor is the auth check: the card only renders
 * once the session query resolves to "unauthenticated" (~1s, two attempts), so a
 * longer timer here just stacks on top of that with nothing to gain.
 */
const SHOW_DELAY_MS = 300;
/** …or as soon as the visitor has scrolled this far, whichever happens first. */
const SHOW_SCROLL_RATIO = 0.35;

/**
 * Where the teaser is allowed to appear. An ALLOW list, so a route nobody has
 * thought about is opted OUT by default — which is the opposite of the deny
 * list this replaced, under which the whole student marketplace was showing a
 * teacher-acquisition ask.
 *
 * These are the teacher-facing pages outright: the /sell landing pages, their
 * legacy /teachers aliases, and the competitor comparisons. The home page joins
 * them separately below — it is the top of the funnel for teachers as much as
 * for students. Everything past it (courses, exams, notes, cart, the student
 * dashboards, the test portals) never matches.
 *
 * `/teacher/*` (the signed-in console) is deliberately absent: the teaser only
 * ever renders for signed-out visitors, so the only routes it could reach there
 * are login, signup and onboarding — where a floating card would sit on top of
 * the very form it is asking people to fill in.
 *
 * The modal itself stays available everywhere. Only the teaser is gated, so the
 * inline BookDemoButtons and the TeacherCtaBanner keep working off-list.
 */
const TEASER_PATH_PREFIXES = ["/sell", "/teachers", "/compare"];

const isTeaserPath = (pathname: string) =>
  // Matched exactly and separately: "/" as a prefix would allow every route on
  // the site, which is the bug this list exists to prevent.
  pathname === "/" ||
  TEASER_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

const readHiddenUntil = (): number => {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { hiddenUntil?: number };
    if (typeof parsed.hiddenUntil !== "number") return 0;
    // Clamp on read, so a longer suppression written by an earlier build (or a
    // hand-edited value) still expires within HIDE_DAYS.
    return Math.min(parsed.hiddenUntil, Date.now() + HIDE_DAYS * DAY_MS);
  } catch {
    return 0;
  }
};

const writeHiddenFor = (days: number) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ hiddenUntil: Date.now() + days * DAY_MS })
    );
  } catch {
    // Private mode / blocked storage: the popup simply reappears next visit.
  }
};

/** How many days the visitor can choose between. Kept short: a chip row, not a calendar. */
const DAY_CHOICE_COUNT = 5;

const LAST_SLOT_START_MINUTES = demoCallSlotStartMinutes(
  DEMO_CALL_SLOT_VALUES[DEMO_CALL_SLOT_VALUES.length - 1]
);

type DemoCallDay = { key: string; label: string; subLabel: string };

const formatDayPart = (key: string, options: Intl.DateTimeFormatOptions) =>
  dateKeyToDate(key).toLocaleDateString("en-IN", { timeZone: "UTC", ...options });

/**
 * The days on offer, in IST. Today drops off once its last slot has started, so
 * the first chip is always one the sales desk can actually honour.
 */
const buildDemoCallDays = (): DemoCallDay[] => {
  const todayKey = istDateKey();
  const firstKey =
    istMinutesOfDay() < LAST_SLOT_START_MINUTES
      ? todayKey
      : shiftDateKey(todayKey, 1);

  return Array.from({ length: DAY_CHOICE_COUNT }, (_, index) => {
    const key = shiftDateKey(firstKey, index);
    const dayOffset = Math.round(
      (dateKeyToDate(key).getTime() - dateKeyToDate(todayKey).getTime()) / DAY_MS
    );
    return {
      key,
      label:
        dayOffset === 0
          ? "Today"
          : dayOffset === 1
            ? "Tomorrow"
            : formatDayPart(key, { weekday: "short" }),
      subLabel: formatDayPart(key, { day: "numeric", month: "short" }),
    };
  });
};

/** A slot on today is only offered while it still lies ahead. */
const isSlotSelectable = (dateKey: string | undefined, slot: DemoCallSlot) =>
  dateKey !== istDateKey() ||
  demoCallSlotStartMinutes(slot) > istMinutesOfDay();

/**
 * The form is its own component so that its state lives and dies with the
 * dialog. Radix unmounts dialog content on close, so a fresh open always starts
 * with empty fields and no validation errors — if this hook sat in the parent
 * (which stays mounted for the app's lifetime), someone who submitted an
 * incomplete form, closed, and reopened would be greeted by stale red errors.
 */
const DemoRequestForm = ({
  onBooked,
}: {
  onBooked: (callSlotLabel: string) => void;
}) => {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const bookDemoMutation = useBookDemoMutation();
  const dayGroupLabelId = useId();

  // Built once per open: the dialog unmounts on close, so a session left idle
  // past midnight gets a fresh set of days the next time it is opened.
  const days = useMemo(buildDemoCallDays, []);

  const form = useForm({
    schema: demoRequestSchema,
    defaultValues: {
      name: "",
      phone: "",
      email: "",
    },
  });

  const selectedDate = form.values.preferredDate;

  // Picking an earlier day can strand a slot that has already gone by today, so
  // the time clears itself rather than submitting something we cannot honour.
  const handleDaySelect = (dateKey: string) => {
    form.setValues((prev) => ({
      ...prev,
      preferredDate: dateKey,
      // Cast for the same reason the expertise field does: useForm types every
      // field as filled in, while the form legitimately starts with none of them.
      preferredSlot: (prev.preferredSlot &&
      isSlotSelectable(dateKey, prev.preferredSlot)
        ? prev.preferredSlot
        : undefined) as DemoRequestInput["preferredSlot"],
    }));
  };

  const onSubmit = async (values: DemoRequestInput) => {
    setSubmitError(null);
    try {
      await bookDemoMutation.mutateAsync({
        ...values,
        email: values.email?.trim() ? values.email.trim() : undefined,
        pageUrl:
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`.slice(0, 500)
            : undefined,
      });
      onBooked(formatDemoCallSlot(values.preferredDate, values.preferredSlot));
    } catch (error) {
      setSubmitError(getBookDemoErrorMessage(error));
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
        <div className={styles.fieldRow}>
          <FormItem name="name">
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input
                autoFocus
                placeholder="Your full name"
                value={form.values.name}
                onChange={(e) =>
                  form.setValues((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="phone">
            <FormLabel>Phone</FormLabel>
            <FormControl>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="98765 43210"
                value={form.values.phone}
                onChange={(e) =>
                  form.setValues((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <FormItem name="email">
          <FormLabel>
            Email <span className={styles.optional}>(optional)</span>
          </FormLabel>
          <FormControl>
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.values.email ?? ""}
              onChange={(e) =>
                form.setValues((prev) => ({ ...prev, email: e.target.value }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="expertise">
          <FormLabel>What do you teach?</FormLabel>
          <Select
            value={form.values.expertise ?? ""}
            onValueChange={(value) =>
              form.setValues((prev) => ({
                ...prev,
                expertise: value as DemoRequestInput["expertise"],
              }))
            }
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select your subject area" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {DEMO_EXPERTISE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>

        {/* A chip row rather than a date picker: five taps' worth of choice is
            all a callback needs, and it keeps the modal off a popover-inside-a-
            dialog. Labelled with a span, not FormLabel — a <label> cannot point
            at a group of buttons. */}
        <FormItem name="preferredDate">
          <span id={dayGroupLabelId} className={styles.groupLabel}>
            When should we call?
          </span>
          <div
            className={styles.dayRow}
            role="radiogroup"
            aria-labelledby={dayGroupLabelId}
          >
            {days.map((day) => {
              const isSelected = selectedDate === day.key;
              return (
                <button
                  key={day.key}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`${styles.dayChip} ${isSelected ? styles.dayChipSelected : ""}`}
                  onClick={() => handleDaySelect(day.key)}
                >
                  <span className={styles.dayChipLabel}>{day.label}</span>
                  <span className={styles.dayChipDate}>{day.subLabel}</span>
                </button>
              );
            })}
          </div>
          <FormMessage />
        </FormItem>

        <FormItem name="preferredSlot">
          <FormLabel>Preferred time (IST)</FormLabel>
          <Select
            value={form.values.preferredSlot ?? ""}
            onValueChange={(value) =>
              form.setValues((prev) => ({
                ...prev,
                preferredSlot: value as DemoRequestInput["preferredSlot"],
              }))
            }
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select a time slot" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {DEMO_CALL_SLOT_VALUES.map((slot) => (
                <SelectItem
                  key={slot}
                  value={slot}
                  disabled={!isSlotSelectable(selectedDate, slot)}
                >
                  {DEMO_CALL_SLOT_LABELS[slot]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>

        {submitError && <p className={styles.errorText}>{submitError}</p>}

        <Button
          type="submit"
          disabled={bookDemoMutation.isPending}
          className={styles.submitButton}
        >
          {bookDemoMutation.isPending ? "Booking..." : "Book my free demo"}
        </Button>
      </form>
    </Form>
  );
};

export const BookDemoPopup = () => {
  const { authState } = useAuth();
  const location = useLocation();

  const [isVisible, setIsVisible] = useState(false);
  // The slot that was just booked, echoed back in the confirmation. Held here
  // rather than in the dialog context because the form unmounts on success.
  const [bookedCallSlot, setBookedCallSlot] = useState<string | null>(null);
  // Dialog state is shared, so inline BookDemoButtons open this same instance.
  const {
    isOpen: isDialogOpen,
    setOpen: setIsDialogOpen,
    open: openDialog,
    isBooked: isSubmitted,
    markBooked,
  } = useBookDemoDialog();

  // `?demo=1` forces the popup open regardless of auth state or a stored
  // dismissal, so the team can preview and test the form without logging out.
  const forcePreview = new URLSearchParams(location.search).get("demo") === "1";

  const eligible =
    (forcePreview || authState.type === "unauthenticated") &&
    isTeaserPath(location.pathname);

  // Reveal after a delay, or once the visitor has scrolled a little — whichever
  // comes first. Both are torn down as soon as one of them fires.
  useEffect(() => {
    if (!eligible || isVisible) return;
    if (forcePreview) {
      setIsVisible(true);
      return;
    }
    if (Date.now() < readHiddenUntil()) return;

    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setIsVisible(true);
    };

    const timer = window.setTimeout(reveal, SHOW_DELAY_MS);

    const onScroll = () => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      if (window.scrollY / scrollable >= SHOW_SCROLL_RATIO) reveal();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [eligible, isVisible, forcePreview]);

  // Hide again if the visitor logs in or navigates somewhere the popup doesn't belong.
  useEffect(() => {
    if (!eligible && isVisible) {
      setIsVisible(false);
      setIsDialogOpen(false);
    }
  }, [eligible, isVisible]);

  const dismissTeaser = useCallback(() => {
    setIsVisible(false);
    setIsDialogOpen(false);
    // A preview dismissal shouldn't suppress the real popup for a week.
    if (!forcePreview) writeHiddenFor(HIDE_DAYS);
  }, [isSubmitted, forcePreview]);

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      setIsDialogOpen(open);
      // Closing after a successful booking retires the teaser too.
      if (!open && isSubmitted) setIsVisible(false);
    },
    [isSubmitted]
  );

  const handleBooked = useCallback(
    (callSlotLabel: string) => {
      setBookedCallSlot(callSlotLabel);
      markBooked();
      writeHiddenFor(HIDE_DAYS);
    },
    [markBooked]
  );

  // The dialog always renders: the inline BookDemoButtons and the
  // TeacherCtaBanner sit on pages the teaser never appears on, and they must
  // still be able to open it.
  //
  // Two teaser shapes, one state. Which one shows is left to CSS rather than a
  // media-query hook because the app server-renders: a hook would have to guess
  // a width on the server and then swap on hydration.
  return (
    <>
      {isVisible && (
      <>
      <aside className={styles.teaser} aria-label="Book a Testkart demo">
        <div className={styles.teaserTop}>
          <span className={styles.chip}>For teachers</span>
          <button
            type="button"
            className={styles.teaserClose}
            onClick={dismissTeaser}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>

        <h3 className={styles.teaserTitle}>Sell your courses online</h3>

        {/* Decorative: the headline already carries the message, so an empty
            alt keeps screen readers from announcing a filename. */}
        <img
          src={DEMO_IMAGE_URL}
          alt=""
          width={DEMO_IMAGE_WIDTH}
          height={DEMO_IMAGE_HEIGHT}
          loading="lazy"
          decoding="async"
          className={styles.teaserImage}
        />

        <Button size="sm" onClick={openDialog} className={styles.teaserCta}>
          Book a free demo
        </Button>
      </aside>

      {/* Phones and small tablets get this instead — the card above would eat
          about half the viewport, on the very page it is advertising. */}
      <div className={styles.bubbleWrap}>
        <button
          type="button"
          className={styles.bubble}
          onClick={openDialog}
          aria-label="Book a free demo — sell your courses on Testkart"
        >
          <GraduationCap size={18} aria-hidden="true" />
          Free demo
        </button>

        <button
          type="button"
          className={styles.bubbleClose}
          onClick={dismissTeaser}
          aria-label="Dismiss"
        >
          <X size={12} />
        </button>
      </div>
      </>
      )}

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className={styles.dialogContent} hideCloseButton>
          {/* The teaser's orange block continues into the modal, so the two
              surfaces read as one object opening rather than two components. */}
          <div className={styles.band}>
            <div className={styles.teaserTop}>
              <span className={styles.chip}>For teachers</span>
              <button
                type="button"
                className={styles.teaserClose}
                onClick={() => handleDialogOpenChange(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <DialogTitle className={styles.modalTitle}>
              {isSubmitted ? "You're booked" : "Book your free demo"}
            </DialogTitle>
            <DialogDescription className={styles.modalDescription}>
              {isSubmitted
                ? bookedCallSlot
                  ? `We'll call you on ${bookedCallSlot}.`
                  : "We'll call you at the time you picked."
                : "15 minutes with our team, at a time you pick."}
            </DialogDescription>
          </div>

          <div className={styles.modalBody}>
            {isSubmitted ? (
              <div className={styles.successState}>
                <CheckCircle2 size={32} className={styles.successIcon} />
                <p className={styles.successBody}>
                  Keep your phone handy — we'll reach out on the number you gave us.
                </p>
                <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
                  Done
                </Button>
              </div>
            ) : (
              <DemoRequestForm onBooked={handleBooked} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
