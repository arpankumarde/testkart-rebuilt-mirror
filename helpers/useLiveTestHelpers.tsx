/**
 * Minimal structural type for live test core properties.
 * Any object with these fields can be used with these helpers.
 */
type LiveTestCore = {
  startTime: Date | null;
  endTime: Date;
  registrationDeadline: Date | null;
  maxSeats: number;
  enrolledCount: number;
};

/**
 * Calculates the current status of a live test based on its schedule and capacity.
 * @param liveTest - The live test object.
 * @returns The status of the live test.
 */
export function getLiveTestStatus(
  liveTest: LiveTestCore
): "upcoming" | "live" | "ended" | "registration_closed" | "seats_full" {
  const now = new Date();
  if (now > liveTest.endTime) return "ended";
  
  // If startTime is null, test is "live" as soon as current time is before endTime
  if (liveTest.startTime === null) {
    return now <= liveTest.endTime ? "live" : "ended";
  }
  
  if (now >= liveTest.startTime && now <= liveTest.endTime) return "live";
  if (liveTest.enrolledCount >= liveTest.maxSeats) return "seats_full";
  
  // If registrationDeadline is null, skip registration closed check
  if (liveTest.registrationDeadline !== null && now > liveTest.registrationDeadline) {
    return "registration_closed";
  }
  
  return "upcoming";
}

/**
 * Determines if a user can currently enroll in a live test.
 * @param liveTest - The live test object.
 * @param isEnrolled - Whether the current user is already enrolled.
 * @returns `true` if enrollment is possible, otherwise `false`.
 */
export function canEnrollInLiveTest(
  liveTest: LiveTestCore,
  isEnrolled: boolean
): boolean {
  const now = new Date();
  // If registrationDeadline is null, allow enrollment until endTime
  const deadline = liveTest.registrationDeadline ?? liveTest.endTime;
  return (
    !isEnrolled &&
    now < deadline &&
    liveTest.enrolledCount < liveTest.maxSeats
  );
}

/**
 * Calculates the time remaining in milliseconds until the test starts.
 * @param startTime - The start time of the test.
 * @returns Milliseconds until start, or 0 if already started.
 */
export function getTimeUntilStart(startTime: Date): number {
  const now = new Date().getTime();
  const start = startTime.getTime();
  return Math.max(0, start - now);
}

/**
 * Calculates the time remaining in milliseconds until the test ends.
 * @param endTime - The end time of the test.
 * @returns Milliseconds until end, or 0 if already ended.
 */
export function getTimeUntilEnd(endTime: Date): number {
  const now = new Date().getTime();
  const end = endTime.getTime();
  return Math.max(0, end - now);
}

/**
 * Formats a duration in milliseconds into a human-readable string.
 * e.g., "2 days 3 hours 45 minutes"
 * @param ms - The duration in milliseconds.
 * @returns A formatted string.
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) {
    return "0 minutes";
  }

  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
  if (minutes > 0 && days === 0) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);
  if (seconds > 0 && days === 0 && hours === 0) parts.push(`${seconds} second${seconds > 1 ? "s" : ""}`);

  return parts.join(" ") || "Less than a second";
}

/**
 * Checks if a live test is currently active (i.e., between its start and end times).
 * @param liveTest - The live test object with at least startTime and endTime.
 * @returns `true` if the test is currently live, otherwise `false`.
 */
export function isLiveTestActive(liveTest: Pick<LiveTestCore, "startTime" | "endTime">): boolean {
  const now = new Date();
  // If startTime is null, test is active from creation until endTime
  if (liveTest.startTime === null) {
    return now <= liveTest.endTime;
  }
  return now >= liveTest.startTime && now <= liveTest.endTime;
}