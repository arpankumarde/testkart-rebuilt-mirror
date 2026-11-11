import {
  dueBefore,
  istDay,
  noticeChargeRefusal,
  noticeDebitDate,
  noticeLeadRefusal,
  noticesDueBefore,
  noticesVoidBefore,
  noticeWindowEnd,
} from "./renewalNoticeSchedule";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// The published job runs at 06:00 IST (00:30 UTC); a few seconds of jitter either way.
const runAt = (utcDay: string, jitterMs = 0) => new Date(new Date(`${utcDay}T00:30:00Z`).getTime() + jitterMs);

type Sub = { nextChargeDate: Date; preDebitSentAt: Date | null };

/** One run of the renewal job's notice and charge phases, as the SQL plus the JS guard select them. */
function runJob(sub: Sub, now: Date): "voided" | "noticed" | "charged" | "idle" {
  if (sub.preDebitSentAt && sub.preDebitSentAt < noticesVoidBefore(now)) {
    sub.preDebitSentAt = null;
    return "voided";
  }
  if (!sub.preDebitSentAt && sub.nextChargeDate < noticeWindowEnd(now)) {
    sub.preDebitSentAt = now;
    return "noticed";
  }
  if (
    sub.preDebitSentAt &&
    sub.nextChargeDate < dueBefore(now) &&
    sub.preDebitSentAt < noticesDueBefore(now) &&
    noticeChargeRefusal(sub.preDebitSentAt, now) === null
  ) {
    return "charged";
  }
  return "idle";
}

describe("renewalNoticeSchedule", () => {
  it("reads calendar days in IST", () => {
    expect(istDay(new Date("2026-11-17T00:30:06Z"))).toBe("2026-11-17");
    expect(istDay(new Date("2026-11-16T18:30:00Z"))).toBe("2026-11-17");
    expect(istDay(new Date("2026-11-16T18:29:59Z"))).toBe("2026-11-16");
    expect(istDay("2026-08-14T14:29:11.643Z")).toBe("2026-08-14");
  });

  it("names the debit date three IST days after the notice", () => {
    expect(noticeDebitDate(new Date("2026-11-17T00:30:06Z"))).toBe("2026-11-20");
    expect(noticeDebitDate(new Date("2026-11-29T00:30:00Z"))).toBe("2026-12-02");
  });

  it("charges every renewal on its notice's debit date, at least 48 hours after the notice", () => {
    // Charge times across a whole month, every 37 minutes, with run-time jitter.
    const start = new Date("2026-11-20T00:00:00Z").getTime();
    for (let t = start; t < start + 30 * DAY; t += 37 * 60 * 1000) {
      const sub: Sub = { nextChargeDate: new Date(t), preDebitSentAt: null };
      let noticeAt: Date | null = null;
      let chargedAt: Date | null = null;
      for (let d = 0; d < 40 && !chargedAt; d++) {
        const day = new Date(new Date("2026-11-15T00:00:00Z").getTime() + d * DAY).toISOString().slice(0, 10);
        const now = runAt(day, ((d * 7919) % 9000) - 4500);
        const outcome = runJob(sub, now);
        if (outcome === "noticed") noticeAt = now;
        if (outcome === "charged") chargedAt = now;
        expect(outcome).not.toBe("voided");
      }
      expect(noticeAt).not.toBeNull();
      expect(chargedAt).not.toBeNull();
      const lead = chargedAt!.getTime() - noticeAt!.getTime();
      expect(lead).toBeGreaterThanOrEqual(48 * HOUR);
      expect(lead).toBeLessThan(30 * DAY);
      expect(istDay(chargedAt!)).toBe(noticeDebitDate(noticeAt!));
      // On time: the charge lands on the renewal's own IST day, never after it.
      expect(istDay(chargedAt!)).toBe(istDay(sub.nextChargeDate));
    }
  });

  it("never charges sub 11477 on the notice sent by the old 24-hour code before its derived debit date", () => {
    const sub: Sub = {
      nextChargeDate: new Date("2026-11-17T03:21:05.804Z"),
      preDebitSentAt: new Date("2026-11-17T00:30:06.063Z"),
    };
    expect(runJob(sub, runAt("2026-11-18"))).toBe("idle");
    expect(runJob(sub, runAt("2026-11-19"))).toBe("idle");
    expect(runJob(sub, runAt("2026-11-20"))).toBe("charged");
  });

  it("voids a notice whose debit date passed without a charge, then re-notices with a fresh lead", () => {
    const sub: Sub = {
      nextChargeDate: new Date("2026-11-20T10:00:00Z"),
      preDebitSentAt: new Date("2026-11-17T00:30:00Z"),
    };
    // The charge on 2026-11-20 failed; the next run voids the notice.
    expect(runJob(sub, runAt("2026-11-21"))).toBe("voided");
    expect(runJob(sub, runAt("2026-11-21", 2000))).toBe("noticed");
    const noticedAt = sub.preDebitSentAt!;
    expect(noticeDebitDate(noticedAt)).toBe("2026-11-24");
    expect(runJob(sub, runAt("2026-11-23"))).toBe("idle");
    expect(runJob(sub, runAt("2026-11-24"))).toBe("charged");
  });

  it("refuses a manual charge inside 48 hours of the notice", () => {
    const sent = new Date("2026-11-17T00:30:00Z");
    expect(noticeLeadRefusal(null, new Date())).toBe("The pre-debit notice for this renewal has not been sent yet.");
    expect(noticeLeadRefusal(sent, new Date(sent.getTime() + 47 * HOUR))).toBe(
      "PayU needs the pre-debit notice at least 48 hours before the charge."
    );
    expect(noticeLeadRefusal(sent, new Date(sent.getTime() + 48 * HOUR))).toBeNull();
  });
});