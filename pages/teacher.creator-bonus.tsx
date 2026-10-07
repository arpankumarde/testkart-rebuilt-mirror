import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  Gift,
  Hammer,
  ListChecks,
  Send,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { useCreatorBonusOverview } from "../helpers/useCreatorBonus";
import { formatRupees, shortfallText, type CampaignContentType } from "../helpers/teacherCampaignRules";
import type {
  CampaignItem,
  CampaignItemState,
  CampaignSlots,
} from "../endpoints/teacher/creator-bonus/overview_GET.schema";
import styles from "./teacher.creator-bonus.module.css";

type Filter = "all" | "ready" | "building" | "claimed" | "done";

const FILTERS: { value: Filter; label: string; states: CampaignItemState[] }[] = [
  { value: "all", label: "Everything", states: [] },
  { value: "ready", label: "Ready to claim", states: ["ready"] },
  { value: "building", label: "Still building", states: ["building"] },
  { value: "claimed", label: "Claimed", states: ["claimed"] },
  { value: "done", label: "Decided", states: ["credited", "reversed", "final"] },
];

const STATE_STICKERS: Record<CampaignItemState, { label: string; tone: string }> = {
  ready: { label: "Ready to claim", tone: "peach" },
  building: { label: "Keep building", tone: "butter" },
  claimed: { label: "Claimed", tone: "sky" },
  credited: { label: "Credited", tone: "mint" },
  reversed: { label: "Reversed", tone: "pink" },
  final: { label: "Not selected", tone: "grey" },
  excluded: { label: "Live before the bonus", tone: "grey" },
  full: { label: "No slots left", tone: "grey" },
};

const TRACKS: Record<CampaignContentType, { title: string; icon: typeof ListChecks; accent: string; createHref: string }> = {
  mock_test: { title: "Test series", icon: ListChecks, accent: "#a9dcc8", createHref: "/teacher/create-test" },
  course: { title: "Courses", icon: BookOpenCheck, accent: "#c8b6f2", createHref: "/teacher/courses/create" },
};

const editHref = (item: CampaignItem) =>
  item.type === "mock_test" ? `/teacher/create-test/${item.id}/review` : `/teacher/courses/${item.id}/edit`;

const buildHref = (item: CampaignItem) =>
  item.type === "mock_test" ? `/teacher/create-test/${item.id}/test-items` : `/teacher/courses/${item.id}/edit`;

/** What the teacher should do next with one item, in plain words. */
function nextStep(item: CampaignItem, slots: CampaignSlots): { text: string; action?: { label: string; to: string } } {
  const amount = formatRupees(slots.amount);
  switch (item.state) {
    case "ready":
      if (item.inReview) {
        return { text: "In review without the bonus. Take it back from review, then submit again with the bonus ticked." };
      }
      if (item.live) {
        return { text: "It went live without the bonus. To claim it, unpublish it and submit it again with the bonus ticked." };
      }
      return {
        text: `Tick the ${amount} bonus when you submit it for review.`,
        action: { label: "Submit with bonus", to: editHref(item) },
      };
    case "building": {
      const missing = item.progress.filter((p) => p.have < p.need).map(shortfallText);
      const skipped =
        item.uncountedVideos > 0
          ? ` ${item.uncountedVideos} of its ${item.uncountedVideos === 1 ? "videos does" : "videos do"} not count yet; open the course to see why.`
          : "";
      return { text: `Add ${missing.join(" and ")} to unlock ${amount}.${skipped}`, action: { label: "Keep building", to: buildHref(item) } };
    }
    case "claimed":
      return {
        text: item.approved
          ? "Approved. Our team is deciding on the bonus."
          : "Waiting for content review. The bonus is decided after approval.",
      };
    case "credited":
      return { text: `${amount} is in your wallet.` };
    case "reversed":
      return { text: item.note ? `Reversed: ${item.note}` : "This bonus was reversed." };
    case "final":
      return { text: item.note ? `Not selected: ${item.note}` : "Not selected for the bonus." };
    case "excluded":
      return { text: "This went live before the Creator Bonus started, so it cannot claim it." };
    case "full":
      return { text: `You have used all ${slots.limit} bonuses for this type.` };
  }
}

const CoinSlots = ({ slots, accent }: { slots: CampaignSlots; accent: string }) => {
  const waiting = slots.used - slots.credited;
  return (
    <ol className={styles.coins} aria-label={`${slots.credited} credited, ${waiting} waiting, ${slots.limit - slots.used} free`}>
      {Array.from({ length: slots.limit }).map((_, i) => {
        const state = i < slots.credited ? "paid" : i < slots.used ? "waiting" : "free";
        return (
          <li
            key={i}
            className={`${styles.coin} ${styles[`coin_${state}`]}`}
            style={{ "--coin-accent": accent, "--coin-tilt": `${[-8, 6, -4, 9, -11][i % 5]}deg` } as React.CSSProperties}
          >
            {state === "paid" ? formatRupees(slots.amount) : state === "waiting" ? <Clock size={16} aria-hidden="true" /> : i + 1}
          </li>
        );
      })}
    </ol>
  );
};

const TeacherCreatorBonusPage: React.FC = () => {
  const { data, isFetching, error, refetch } = useCreatorBonusOverview();
  const [filter, setFilter] = useState<Filter>("all");

  const items = data && data.campaign ? data.items : [];
  const visibleItems = useMemo(() => {
    const states = FILTERS.find((f) => f.value === filter)?.states ?? [];
    const shown = states.length === 0 ? items.filter((i) => i.state !== "excluded") : items.filter((i) => states.includes(i.state));
    const rank: Record<CampaignItemState, number> = {
      ready: 0, claimed: 1, building: 2, credited: 3, reversed: 4, final: 5, full: 6, excluded: 7,
    };
    return [...shown].sort((a, b) => rank[a.state] - rank[b.state]);
  }, [items, filter]);

  if (!data) {
    return (
      <div className={styles.page}>
        {error ? (
          <div className={styles.quietPanel} role="alert">
            <p>Could not load the Creator Bonus: {error instanceof Error ? error.message : "try again"}.</p>
            <Button variant="outline" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : (
          <>
            <Skeleton style={{ height: "17rem", borderRadius: "1.875rem" }} />
            <div className={styles.tracks}>
              <Skeleton style={{ height: "14rem", borderRadius: "1.875rem" }} />
              <Skeleton style={{ height: "14rem", borderRadius: "1.875rem" }} />
            </div>
          </>
        )}
      </div>
    );
  }

  if (!data.campaign) {
    return (
      <div className={styles.page}>
        <Helmet>
          <title>Creator Bonus | Testkart</title>
        </Helmet>
        <div className={styles.quietPanel}>
          <span className={`${styles.stepBlob} ${styles.tone_peach}`} aria-hidden="true">
            <Gift size={20} />
          </span>
          <h1 className={styles.quietTitle}>The Creator Bonus is not running right now</h1>
          <p>Bonuses you already earned stay in your wallet. We will let you know when the next one starts.</p>
          <Button asChild variant="outline">
            <Link to="/teacher/earnings">Open Earnings</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { campaign, slots, earned } = data;
  const req = campaign.requirements;
  const maxTotal = slots.mock_test.limit * slots.mock_test.amount + slots.course.limit * slots.course.amount;
  const earnedShare = maxTotal > 0 ? Math.min(100, (earned / maxTotal) * 100) : 0;
  const readyCount = items.filter((i) => i.state === "ready").length;

  const steps = [
    { icon: Hammer, tone: "peach", title: "Build it", text: `A test series with ${req.minTests}+ tests and ${req.minQuestions}+ questions, or a course with ${req.minVideos}+ uploaded videos of ${req.minMinutesPerVideo}+ minutes each, ${req.minVideoMinutes}+ minutes in all.` },
    { icon: Send, tone: "mint", title: "Submit and claim", text: "Tick the Creator Bonus when you submit it for review. It counts only for content that was never live before." },
    { icon: Sparkles, tone: "lavender", title: "We pick quality", text: "Approval puts it live. The bonus is a separate call: our team credits it only for high quality work." },
    { icon: Wallet, tone: "sky", title: "Money in your wallet", text: "The bonus joins your balance and is withdrawn with your earnings." },
  ];

  return (
    <>
      <Helmet>
        <title>Creator Bonus | Testkart</title>
        <meta name="description" content="Earn a bonus for every high quality test series and course you publish." />
      </Helmet>

      <div className={styles.page}>
        <section className={styles.hero} aria-labelledby="creator-bonus-title">
          <div className={styles.heroText}>
            <span className={styles.chip}>{campaign.title}</span>
            <h1 id="creator-bonus-title" className={styles.heroTitle}>
              Get paid {formatRupees(slots.mock_test.amount)} for every great test series and course
            </h1>
            <p className={styles.heroLead}>
              Up to {slots.mock_test.limit} test series and {slots.course.limit} courses, so up to {formatRupees(maxTotal)} on top of
              your sales. Each item can earn it once.
            </p>
            <div className={styles.meter}>
              <div className={styles.meterHead}>
                <span className={styles.meterValue}>{formatRupees(earned)}</span>
                <span className={styles.meterOf}>earned of {formatRupees(maxTotal)}</span>
              </div>
              <span className={styles.meterTrack}>
                <span className={styles.meterFill} style={{ width: `${earnedShare}%` }} />
              </span>
            </div>
          </div>
          <div className={styles.heroArt} aria-hidden="true">
            <span className={`${styles.bigCoin} ${styles.bigCoinA}`}>{formatRupees(slots.mock_test.amount)}</span>
            <span className={`${styles.bigCoin} ${styles.bigCoinB}`}>{formatRupees(slots.course.amount)}</span>
            <span className={`${styles.bigCoin} ${styles.bigCoinC}`}>
              <Gift size={30} />
            </span>
          </div>
        </section>

        <div className={styles.tracks}>
          {(["mock_test", "course"] as const).map((type) => {
            const track = TRACKS[type];
            const s = slots[type];
            const Icon = track.icon;
            const rule =
              type === "mock_test"
                ? `${req.minTests}+ tests and ${req.minQuestions}+ questions`
                : `${req.minVideos}+ videos of ${req.minMinutesPerVideo}+ min, ${req.minVideoMinutes}+ min in all`;
            return (
              <article key={type} className={styles.track} style={{ "--track-accent": track.accent } as React.CSSProperties}>
                <span className={styles.trackStrip} aria-hidden="true" />
                <div className={styles.trackCard}>
                  <div className={styles.trackHead}>
                    <span className={styles.trackIcon} aria-hidden="true">
                      <span className={styles.trackBlob} />
                      <Icon size={22} />
                    </span>
                    <div>
                      <h2 className={styles.trackTitle}>{track.title}</h2>
                      <p className={styles.trackRule}>
                        {formatRupees(s.amount)} each · {rule}
                      </p>
                    </div>
                  </div>
                  <CoinSlots slots={s} accent={track.accent} />
                  <p className={styles.trackFoot}>
                    {s.credited} credited · {s.used - s.credited} waiting · {Math.max(0, s.limit - s.used)} left
                    <Link to={track.createHref} className={styles.trackLink}>
                      Create one <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        <section className={styles.steps} aria-labelledby="creator-bonus-how">
          <h2 id="creator-bonus-how" className={styles.sectionTitle}>How it works</h2>
          <ol className={styles.stepList}>
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className={styles.step}>
                  <span className={`${styles.stepBlob} ${styles[`tone_${step.tone}`]}`} aria-hidden="true">
                    <Icon size={20} />
                    <span className={styles.stepNumber}>{i + 1}</span>
                  </span>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepText}>{step.text}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <section className={styles.content} aria-labelledby="creator-bonus-content">
          <div className={styles.contentHead}>
            <h2 id="creator-bonus-content" className={styles.sectionTitle}>
              Your content
              {readyCount > 0 && <span className={styles.readyBadge}>{readyCount} ready to claim</span>}
            </h2>
            <div className={styles.filters} role="group" aria-label="Show">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`${styles.filter} ${filter === f.value ? styles.filterOn : ""}`}
                  aria-pressed={filter === f.value}
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {visibleItems.length === 0 ? (
            <div className={styles.emptyList}>
              <p>
                {items.length === 0
                  ? "You have no test series or courses yet. Build one to start earning the bonus."
                  : "Nothing here for this filter."}
              </p>
              {items.length === 0 && (
                <div className={styles.emptyActions}>
                  <Button asChild>
                    <Link to="/teacher/create-test">Create a test series</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/teacher/courses/create">Create a course</Link>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <ul className={styles.itemList} aria-busy={isFetching}>
              {visibleItems.map((item) => {
                const sticker = STATE_STICKERS[item.state];
                const step = nextStep(item, slots[item.type]);
                return (
                  <li key={`${item.type}-${item.id}`} className={styles.item}>
                    <div className={styles.itemMain}>
                      <span className={styles.itemKind}>{item.type === "mock_test" ? "Test series" : "Course"}</span>
                      <h3 className={styles.itemTitle}>{item.title}</h3>
                      <div className={styles.pills}>
                        {item.progress.map((p) => {
                          const done = p.have >= p.need;
                          return (
                            <span key={p.label} className={`${styles.pill} ${done ? styles.pillDone : ""}`}>
                              {done && <CheckCircle2 size={14} aria-hidden="true" />}
                              <span>
                                {p.have.toLocaleString("en-IN")}/{p.need.toLocaleString("en-IN")} {p.label}
                              </span>
                              {!done && (
                                <span className={styles.pillTrack} aria-hidden="true">
                                  <span className={styles.pillFill} style={{ width: `${(p.have / p.need) * 100}%` }} />
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                      <p className={styles.itemNext}>{step.text}</p>
                    </div>
                    <div className={styles.itemSide}>
                      <span className={`${styles.sticker} ${styles[`tone_${sticker.tone}`]}`}>{sticker.label}</span>
                      {step.action && (
                        <Button asChild size="sm" variant={item.state === "ready" ? "primary" : "outline"}>
                          <Link to={step.action.to}>{step.action.label}</Link>
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={styles.rules} aria-labelledby="creator-bonus-rules">
          <h2 id="creator-bonus-rules" className={styles.sectionTitle}>The fine print, in plain words</h2>
          <ul>
            <li>Approval and the bonus are separate. Approved content goes live; the bonus is credited only when our team picks it for quality.</li>
            <li>Each test series or course can earn the bonus once. Unpublishing and submitting again does not earn it twice.</li>
            <li>Only content that was never live before {new Date(campaign.startsAt).toLocaleDateString("en-IN")} can claim it.</li>
            <li>If a bonus is not selected, you can improve the item and claim once more with its next submission.</li>
            <li>If content is taken down or turns out not to meet the rules, our team can reverse a bonus.</li>
            <li>
              For courses, only videos you upload to Testkart count: not YouTube or other links, each file once, and
              only videos of {req.minMinutesPerVideo} minutes or more. A video counts at the length you entered or the
              length of the uploaded file, whichever is shorter.
            </li>
          </ul>
        </section>
      </div>
    </>
  );
};

export default TeacherCreatorBonusPage;