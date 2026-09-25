import {
  onboardingDueDates,
  planOnboarding,
  type OnboardingSendRecord,
  type OnboardingState,
} from "./teacherOnboardingSchedule";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// 10:00 IST, so whole-day offsets land inside the 09:00-20:00 IST send window.
const SIGNUP = new Date("2026-10-01T04:30:00Z");
const at = (days: number, hours = 0) => new Date(SIGNUP.getTime() + days * DAY + hours * HOUR);

const state = (overrides: Partial<OnboardingState> = {}): OnboardingState => ({
  signedUpAt: SIGNUP,
  enrolledAt: at(0, 0.1),
  firstPublishedAt: null,
  profileComplete: false,
  hasBankDetails: false,
  sends: [],
  ...overrides,
});

const sent = (emailKey: string, when: Date): OnboardingSendRecord => ({
  emailKey,
  status: "sent",
  attempts: 1,
  updatedAt: when,
});

const sentAll = (keys: string[], days: number[]) => keys.map((key, index) => sent(key, at(days[index])));

describe("teacherOnboardingSchedule", () => {
  it("times the plan's days for a teacher who never publishes", () => {
    const due = onboardingDueDates(state());
    const days = (["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8"] as const).map(
      (key) => (due[key].getTime() - SIGNUP.getTime()) / DAY
    );
    expect(days).toEqual([0, 1, 2, 4, 6, 8, 10, 13]);
  });

  it("sends the welcome right after sign-up, even at night and even after an early publish", () => {
    const night = new Date("2026-10-01T20:00:00Z"); // 01:30 IST
    const plan = planOnboarding(
      state({ signedUpAt: night, enrolledAt: night, firstPublishedAt: night }),
      new Date(night.getTime() + 10 * 60 * 1000)
    );
    expect(plan.send).toBe("e1");
  });

  it("does not send the welcome to a teacher who joined over 45 minutes after signing up", () => {
    const plan = planOnboarding(state({ enrolledAt: at(0, 1) }), at(0, 1.1));
    expect(plan.skip).toContain({ key: "e1", reason: "before_start" });
    expect(plan.send).toBeNull();
  });

  it("skips email 2 when the profile is already complete", () => {
    const plan = planOnboarding(state({ profileComplete: true, sends: [sent("e1", at(0))] }), at(1, 0.1));
    expect(plan.skip).toContain({ key: "e2", reason: "profile_complete" });
    expect(plan.send).toBeNull();
  });

  it("ends the activation track on publish and starts the post-publish track the day after", () => {
    const published = at(0, 2);
    const s = state({ firstPublishedAt: published, sends: [sent("e1", at(0, 0.1))] });

    const onPublish = planOnboarding(s, at(0, 2.2));
    expect(onPublish.skip.map((item) => item.key).sort()).toEqual(["e2", "e3", "e4"]);
    expect(onPublish.skip.every((item) => item.reason === "published")).toBeTrue();
    expect(onPublish.send).toBeNull();

    const nextDay = planOnboarding(s, new Date(published.getTime() + DAY + 60 * 1000));
    expect(nextDay.send).toBe("e5");
  });

  it("times emails 6-8 from when email 5 actually went out", () => {
    const e5SentAt = at(6, 10); // held overnight
    const due = onboardingDueDates(
      state({ sends: [...sentAll(["e1", "e2", "e3", "e4"], [0, 1, 2, 4]), sent("e5", e5SentAt)] })
    );
    expect(due.e6.getTime()).toBe(e5SentAt.getTime() + 2 * DAY);
    expect(due.e8.getTime()).toBe(e5SentAt.getTime() + 7 * DAY);
  });

  it("keeps a late publisher on the day 6 schedule without repeating anything", () => {
    const s = state({
      firstPublishedAt: at(9),
      sends: [...sentAll(["e1", "e2", "e3", "e4", "e5", "e6"], [0, 1, 2, 4, 6, 8])],
    });
    const plan = planOnboarding(s, at(10, 0.1));
    expect(plan.skip).toEqual([]);
    expect(plan.send).toBe("e7");
  });

  it("gives a teacher who joins late only the emails still ahead", () => {
    const s = state({ enrolledAt: at(5) });
    const now = planOnboarding(s, at(5, 0.1));
    expect(now.skip.map((item) => item.key).sort()).toEqual(["e1", "e2", "e3", "e4"]);
    expect(now.skip.every((item) => item.reason === "before_start")).toBeTrue();
    expect(planOnboarding(s, at(6, 0.1)).send).toBe("e5");
  });

  it("waits 20 hours after the last email, and drops one more than 36 hours overdue", () => {
    const s = state({ sends: [sent("e1", at(0, 12))] });
    expect(planOnboarding(s, at(1, 1)).send).toBeNull();
    expect(planOnboarding(s, at(1, 8)).send).toBe("e2");

    const late = planOnboarding(state({ sends: sentAll(["e1", "e2"], [0, 1]) }), at(3, 13));
    expect(late.skip).toContain({ key: "e3", reason: "expired" });
  });

  it("holds emails after the welcome until 09:00 IST", () => {
    const evening = new Date("2026-10-01T17:30:00Z"); // 23:00 IST
    const s = state({ signedUpAt: evening, enrolledAt: evening, sends: [sent("e1", evening)] });
    expect(planOnboarding(s, new Date(evening.getTime() + DAY + 60 * 1000)).send).toBeNull();
    expect(planOnboarding(s, new Date("2026-10-03T03:31:00Z")).send).toBe("e2");
  });

  it("skips the bank email when bank details are on file", () => {
    const s = state({
      hasBankDetails: true,
      sends: sentAll(["e1", "e2", "e3", "e4", "e5", "e6"], [0, 1, 2, 4, 6, 8]),
    });
    const plan = planOnboarding(s, at(10, 0.1));
    expect(plan.skip).toContain({ key: "e7", reason: "bank_on_file" });
    expect(plan.send).toBeNull();
  });

  it("retries a failed send up to 3 attempts", () => {
    const failed = (attempts: number): OnboardingSendRecord => ({
      emailKey: "e2",
      status: "failed",
      attempts,
      updatedAt: at(1),
    });
    expect(planOnboarding(state({ sends: [sent("e1", at(0)), failed(1)] }), at(1, 1)).send).toBe("e2");
    expect(planOnboarding(state({ sends: [sent("e1", at(0)), failed(3)] }), at(1, 1)).send).toBeNull();
  });
});
