export type LiveTestStatus =
  | "upcoming"
  | "live"
  | "ended"
  | "registration_closed"
  | "seats_full";

export const LiveTestStatusArray: LiveTestStatus[] = [
  "upcoming",
  "live",
  "ended",
  "registration_closed",
  "seats_full",
];

interface GetLiveTestStatusParams {
  startTime: Date | null;
  endTime: Date;
  registrationDeadline: Date | null;
  maxSeats: number;
  enrolledCount: number;
}

/**
 * Determines the current status of a live test based on its schedule and enrollment numbers.
 * The logic is evaluated in a specific order of precedence.
 *
 * @param params - An object containing the test's scheduling and enrollment data.
 * @returns The calculated status of the live test.
 */
export const getLiveTestStatus = ({
  startTime,
  endTime,
  registrationDeadline,
  maxSeats,
  enrolledCount,
}: GetLiveTestStatusParams): LiveTestStatus => {
  const now = new Date();

  // 1. Check if the test has ended. This has the highest precedence.
  if (now > endTime) {
    return "ended";
  }

  // 2. Check if the test is currently live.
  if (startTime === null) {
    // If no start time is set, test is live as soon as now <= endTime
    if (now <= endTime) {
      return "live";
    }
  } else {
    // With a start time, test is live between start and end
    if (now >= startTime && now <= endTime) {
      return "live";
    }
  }

  // 3. Check if all seats are filled. This prevents new registrations.
  if (enrolledCount >= maxSeats) {
    return "seats_full";
  }

  // 4. Check if the registration deadline has passed.
  if (registrationDeadline && now > registrationDeadline) {
    return "registration_closed";
  }

  // 5. If none of the above conditions are met, the test is upcoming.
  return "upcoming";
};