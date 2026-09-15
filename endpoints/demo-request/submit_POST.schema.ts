import { z } from "zod";
import superjson from "superjson";

/**
 * Expertise buckets shown in the "Book a demo" popup. Deliberately the same
 * vocabulary the teacher onboarding quiz uses (TeacherOnboardingQuiz ->
 * TEACHING_CATEGORIES) so a lead's expertise is comparable with the profile
 * data we collect after signup.
 */
export const DEMO_EXPERTISE_OPTIONS = [
  "School",
  "College",
  "Government Exams",
  "Competitive Exams",
  "Skills",
  "Language",
  "Other",
] as const;

export type DemoExpertise = (typeof DEMO_EXPERTISE_OPTIONS)[number];

/**
 * Reduces anything a visitor might type (+91 98765 43210, 098765-43210, ...)
 * to the bare 10-digit Indian mobile number we store everywhere else, or null
 * when it cannot be one. Shared by the form and the endpoint so both agree.
 */
export const normalizeIndianMobile = (raw: string): string | null => {
  const digits = raw.replace(/\D/g, "");
  const last10 = digits.length > 10 ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(last10) ? last10 : null;
};

/**
 * The one-hour windows a visitor can ask to be called in, keyed by their start
 * in 24h IST. Every demo call is placed by the India sales desk, so the whole
 * feature is fixed to Asia/Kolkata rather than the visitor's own zone - a lead
 * abroad who picks "4 PM" means 4 PM for the person dialling.
 */
export const DEMO_CALL_SLOT_VALUES = [
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
] as const;

export type DemoCallSlot = (typeof DEMO_CALL_SLOT_VALUES)[number];

export const DEMO_CALL_SLOT_LABELS: Record<DemoCallSlot, string> = {
  "10:00": "10:00 AM - 11:00 AM",
  "11:00": "11:00 AM - 12:00 PM",
  "12:00": "12:00 PM - 1:00 PM",
  "13:00": "1:00 PM - 2:00 PM",
  "14:00": "2:00 PM - 3:00 PM",
  "15:00": "3:00 PM - 4:00 PM",
  "16:00": "4:00 PM - 5:00 PM",
  "17:00": "5:00 PM - 6:00 PM",
  "18:00": "6:00 PM - 7:00 PM",
};

/** How far ahead a visitor may book. Past this the date is almost certainly a typo. */
export const DEMO_BOOKING_WINDOW_DAYS = 14;

const IST_TIME_ZONE = "Asia/Kolkata";

/** Minutes past midnight at which a slot starts, e.g. "16:00" -> 960. */
export const demoCallSlotStartMinutes = (slot: DemoCallSlot): number => {
  const [hours, minutes] = slot.split(":").map(Number);
  return hours * 60 + minutes;
};

/**
 * "YYYY-MM-DD" for the given instant in IST. en-CA is used purely because its
 * short date format is already ISO order.
 */
export const istDateKey = (at: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);

/** Minutes past IST midnight for the given instant. */
export const istMinutesOfDay = (at: Date = new Date()): number => {
  const [hours, minutes] = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(at)
    .split(":")
    .map(Number);
  return hours * 60 + minutes;
};

/**
 * A date key as a UTC-midnight Date. Formatting it with timeZone "UTC" is then
 * safe in any browser - a local-midnight Date would render as the previous day
 * for anyone west of Greenwich.
 */
export const dateKeyToDate = (key: string): Date => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

/** Date key `days` later. Stays in UTC so DST elsewhere cannot skew the count. */
export const shiftDateKey = (key: string, days: number): string => {
  const shifted = dateKeyToDate(key);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
};

/** The sales desk calls Monday to Saturday, so a Sunday is never offered or accepted. */
export const isDemoCallDay = (key: string): boolean =>
  dateKeyToDate(key).getUTCDay() !== 0;

/** "Fri, 12 Sep" - the day half of a booked slot. */
export const formatDemoCallDate = (key: string): string =>
  dateKeyToDate(key).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });

/** "Fri, 12 Sep, 4:00 PM - 5:00 PM IST" - one line for notes, emails and the admin panel. */
export const formatDemoCallSlot = (
  key: string,
  slot: DemoCallSlot | string
): string => {
  const label = DEMO_CALL_SLOT_LABELS[slot as DemoCallSlot] ?? slot;
  return `${formatDemoCallDate(key)}, ${label} IST`;
};

export const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your full name")
    .max(100, "Name is too long"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .max(20, "Phone number is too long")
    .refine(
      (value) => normalizeIndianMobile(value) !== null,
      "Enter a valid 10-digit mobile number"
    ),
  // Optional: an empty string is accepted so the form can start blank.
  email: z
    .union([z.string().trim().email("Enter a valid email address").max(255), z.literal("")])
    .optional(),
  expertise: z.enum(DEMO_EXPERTISE_OPTIONS, {
    errorMap: () => ({ message: "Please select your area of expertise" }),
  }),
  // The day the visitor wants the call on, as an IST date key. Bounds are
  // checked against the caller's own clock; the endpoint re-checks them against
  // the server's, which is what actually decides.
  preferredDate: z
    .string({
      required_error: "Please pick a day for the call",
      invalid_type_error: "Please pick a day for the call",
    })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please pick a day for the call")
    .refine((value) => value >= istDateKey(), "Please pick a day that has not passed")
    .refine((value) => isDemoCallDay(value), "Please pick a day from Monday to Saturday")
    .refine(
      (value) => value <= shiftDateKey(istDateKey(), DEMO_BOOKING_WINDOW_DAYS),
      `Please pick a day within the next ${DEMO_BOOKING_WINDOW_DAYS} days`
    ),
  preferredSlot: z.enum(DEMO_CALL_SLOT_VALUES, {
    errorMap: () => ({ message: "Please pick a time for the call" }),
  }),
  // Where the popup was submitted from — stored on the lead note for context.
  pageUrl: z.string().max(500).optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  /** True when the phone/email already existed in the pipeline and we updated that lead. */
  alreadyInPipeline: boolean;
};

export const postDemoRequest = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/demo-request/submit`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const responseJson = superjson.parse(await result.text());

  if (!result.ok) {
    const errorObject = responseJson as { error: string };
    throw new Error(errorObject.error || "Failed to submit your demo request");
  }

  return responseJson as OutputType;
};
