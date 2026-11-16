import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Clock,
  Gift,
  Hammer,
  ListChecks,
  Newspaper,
  Send,
  Sparkles,
  Trophy,
  Wallet,
} from "lucide-react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { useCreatorBonusOverview } from "../helpers/useCreatorBonus";
import {
  CAMPAIGN_CONTENT_NOUNS,
  bonusWord,
  contentListText,
  creatorBonusLeft,
  formatRupees,
  shortfallText,
  type CampaignContentType,
} from "../helpers/teacherCampaignRules";
import type {
  CampaignItem,
  CampaignItemState,
  CampaignSlots,
  ExamCampaignCard,
} from "../endpoints/teacher/creator-bonus/overview_GET.schema";
import { cardTapProps } from "../helpers/cardTap";
import styles from "./teacher.creator-bonus.module.css";

type Tab = "apply" | "applied";

/*
 * Apply: drafts that can still claim, only for a type with a slot left (or an
 * Exam Bonus open to it). Applied: everything submitted with a claim, in the
 * order the teacher cares about.
 */
const APPLY_ORDER: Partial<Record<CampaignItemState, number>> = { ready: 0, building: 1 };
const APPLIED_ORDER: Partial<Record<CampaignItemState, number>> = { claimed: 0, credited: 1, reversed: 2, final: 3 };

const TABS: { value: Tab; label: string; tone: string }[] = [
  { value: "apply", label: "Apply", tone: "var(--cb-peach)" },
  { value: "applied", label: "Applied", tone: "var(--cb-mint)" },
];

const STATE_STICKERS: Record<CampaignItemState, { label: string; tone: string }> = {
  ready: { label: "Ready to claim", tone: "peach" },
  building: { label: "Keep building", tone: "butter" },
  claimed: { label: "In review", tone: "sky" },
  credited: { label: "Credited", tone: "mint" },
  reversed: { label: "Reversed", tone: "pink" },
  final: { label: "Not selected", tone: "grey" },
  excluded: { label: "Live before the bonus", tone: "grey" },
  full: { label: "Limit reached", tone: "grey" },
};

const TRACKS: Record<CampaignContentType, { title: string; icon: typeof ListChecks; accent: string; createHref: string }> = {
  mock_test: { title: "Test series", icon: ListChecks, accent: "#a9dcc8", createHref: "/teacher/create-test" },
  course: { title: "Courses", icon: BookOpenCheck, accent: "#c8b6f2", createHref: "/teacher/courses/create" },
};

const editHref = (item: CampaignItem) =>
  item.type === "mock_test" ? `/teacher/create-test/${item.id}/review` : `/teacher/courses/${item.id}/edit`;

const buildHref = (item: CampaignItem) =>
  item.type === "mock_test" ? `/teacher/create-test/${item.id}/test-items` : `/teacher/courses/${item.id}/edit`;

/**
 * Published or sent for review without a claim: the bonus cannot be ticked now, so
 * the list leaves it out. A rejected review brings it back.
 */
const isSubmittedUnclaimed = (item: CampaignItem) =>
  (item.live || item.inReview) && (item.state === "ready" || item.state === "building" || item.state === "full");

/** What the teacher should do next with one item, in plain words. */
function nextStep(item: CampaignItem, slots: CampaignSlots): { text: string; action?: { label: string; to: string } } {
  const amount = formatRupees(slots.amount);
  switch (item.state) {
    case "ready":
      if (item.examBonus && slots.used >= slots.limit) {
        return {
          text: `Pick the ${item.examBonus.title} when you submit.`,
          action: { label: "Submit with bonus", to: editHref(item) },
        };
      }
      return {
        text: `Tick the ${amount} bonus when you submit.`,
        action: { label: "Submit with bonus", to: editHref(item) },
      };
    case "building": {
      const missing = item.progress.filter((p) => p.have < p.need).map(shortfallText);
      const skipped =
        item.uncountedVideos > 0
          ? ` ${item.uncountedVideos} ${item.uncountedVideos === 1 ? "video does" : "videos do"} not count yet.`
          : "";
      return { text: `Add ${missing.join(" and ")} to unlock ${amount}.${skipped}`, action: { label: "Keep building", to: buildHref(item) } };
    }
    case "claimed":
      return {
        text: item.approved
          ? "Approved. Our team is deciding on the bonus."
          : "Submitted with the bonus. We email you once it is reviewed.",
      };
    case "credited":
      return { text: item.claimedExamBonus ? `The ${item.claimedExamBonus} is in your wallet.` : `${amount} is in your wallet.` };
    case "reversed":
      return { text: item.note ? `Reversed: ${item.note}` : "Bonus reversed." };
    case "final":
      return { text: item.note ? `Not selected: ${item.note}` : "Not selected for the bonus." };
    case "excluded":
      return { text: "Live before the bonus started." };
    case "full":
      return {
        text:
          slots.limit === 1
            ? `Your ${CAMPAIGN_CONTENT_NOUNS[item.type]} bonus is already claimed.`
            : `All ${slots.limit} ${CAMPAIGN_CONTENT_NOUNS[item.type]} bonuses are claimed.`,
      };
  }
}

const CoinSlots = ({ slots, accent }: { slots: CampaignSlots; accent: string }) => {
  const waiting = slots.used - slots.credited;
  const free = Math.max(0, slots.limit - slots.used);
  // A teacher who claimed under an earlier, higher cap keeps a coin for every bonus.
  const coins = Math.max(slots.limit, slots.used);
  return (
    <ol className={styles.coins} aria-label={`${slots.credited} credited, ${waiting} waiting, ${free} free`}>
      {Array.from({ length: coins }).map((_, i) => {
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

const EXAM_ACCENTS = ["#f9b99a", "#c8b6f2", "#aed3f2", "#f4dfa3"];
/** Above this the coin row would be a wall of stickers, so only the count shows. */
const MAX_EXAM_COINS = 20;

const daysLeftText = (endsAt: Date) => {
  const days = Math.ceil((new Date(endsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return days <= 1 ? "Last day" : `${days} days left`;
};

const ExamCard = ({ card, accent }: { card: ExamCampaignCard; accent: string }) => {
  const left = Math.max(0, card.totalSlots - card.slotsTaken);
  return (
    <article className={styles.track} style={{ "--track-accent": accent } as React.CSSProperties}>
      <span className={styles.trackStrip} aria-hidden="true" />
      <div className={styles.trackCard}>
        <div className={styles.trackHead}>
          <span className={styles.trackIcon} aria-hidden="true">
            <span className={styles.trackBlob} />
            <Newspaper size={22} />
          </span>
          <div>
            <h3 className={styles.trackTitle}>{card.examName}</h3>
            <p className={styles.trackRule}>
              {formatRupees(card.amount)} each · {card.minTests}+ tests and {card.minQuestions}+ questions
            </p>
          </div>
        </div>
        {card.news && (
          <Link to={`/exam-news/${card.news.slug}`} className={styles.examNews}>
            {card.news.title}
          </Link>
        )}
        {card.totalSlots <= MAX_EXAM_COINS && (
          <ol className={`${styles.coins} ${styles.examCoins}`} aria-label={`${left} of ${card.totalSlots} slots left`}>
            {Array.from({ length: card.totalSlots }).map((_, i) => {
              const gone = i < card.slotsTaken;
              return (
                <li
                  key={i}
                  className={`${styles.coin} ${gone ? styles.coin_paid : styles.coin_free}`}
                  style={{ "--coin-accent": accent, "--coin-tilt": `${[-8, 6, -4, 9, -11][i % 5]}deg` } as React.CSSProperties}
                >
                  {gone ? <Check size={14} aria-hidden="true" /> : i + 1}
                </li>
              );
            })}
          </ol>
        )}
        <p className={styles.examCount}>
          {left > 0 ? `${left} of ${card.totalSlots} slots left` : "All slots taken"} · {daysLeftText(card.endsAt)}
        </p>
        <p className={styles.trackFoot}>
          Your slots: {card.mine} of {card.perTeacher}
          {left > 0 && card.mine < card.perTeacher && (
            <Link to="/teacher/create-test" className={styles.trackLink}>
              Create one <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        </p>
      </div>
    </article>
  );
};

const TeacherCreatorBonusPage: React.FC = () => {
  const { data, isFetching, error, refetch } = useCreatorBonusOverview();
  const [pickedTab, setPickedTab] = useState<Tab | null>(null);

  const allItems = data && data.campaign ? data.items : [];
  const slotsLeft = data && data.campaign ? creatorBonusLeft(data.slots) : null;
  const done = slotsLeft?.done ?? false;
  const lists = useMemo(() => {
    const items = allItems.filter((i) => !isSubmittedUnclaimed(i));
    const pick = (order: Partial<Record<CampaignItemState, number>>, keep: (i: CampaignItem) => boolean) =>
      items
        .filter((i) => order[i.state] !== undefined && keep(i))
        .sort((a, b) => order[a.state]! - order[b.state]!);
    return {
      apply: pick(APPLY_ORDER, (i) => (slotsLeft?.left[i.type] ?? 0) > 0 || Boolean(i.examBonus)),
      applied: pick(APPLIED_ORDER, () => true),
    };
  }, [allItems, slotsLeft]);
  const activeTab: Tab = pickedTab ?? (done || (lists.apply.length === 0 && lists.applied.length > 0) ? "applied" : "apply");
  const visibleItems = lists[activeTab];

  const onTabKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const next: Tab = activeTab === "apply" ? "applied" : "apply";
    setPickedTab(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus();
  };

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
          <p>Bonuses you earned stay in your wallet.</p>
          <Button asChild variant="outline">
            <Link to="/teacher/earnings">Open Earnings</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { campaign, slots, earned, examEarned, examCampaigns } = data;
  const req = campaign.requirements;
  const types = ["mock_test", "course"] as const;
  const { left } = creatorBonusLeft(slots);
  const maxTotal = slots.mock_test.limit * slots.mock_test.amount + slots.course.limit * slots.course.amount;
  const leftValue = left.mock_test * slots.mock_test.amount + left.course * slots.course.amount;
  // Bonuses credited under an earlier, higher cap can exceed today's maximum.
  const meterMax = Math.max(maxTotal, earned);
  const earnedShare = meterMax > 0 ? Math.min(100, (earned / meterMax) * 100) : 0;
  const waitingTotal = types.reduce((sum, t) => sum + slots[t].used - slots[t].credited, 0);
  const limitsText = contentListText({ mock_test: slots.mock_test.limit, course: slots.course.limit });
  const amount = formatRupees(slots.mock_test.amount);
  const claimedTypes = types.filter((t) => slots[t].limit > 0 && left[t] === 0);
  const claimedCount = claimedTypes.reduce((sum, t) => sum + slots[t].limit, 0);
  const openTypes = types.filter((t) => left[t] > 0);

  const hero = done
    ? {
        chip: "All claimed",
        title: "All Creator Bonuses claimed",
        lead:
          waitingTotal > 0
            ? `Congratulations, every bonus is claimed. ${waitingTotal} ${waitingTotal === 1 ? "is" : "are"} with our team for review, and we email you once it is decided.`
            : "Congratulations, you have earned every Creator Bonus on offer. Thank you for building great content for Testkart students.",
      }
    : claimedTypes.length > 0
      ? {
          chip: campaign.title,
          title: `${contentListText(left)} ${bonusWord(left.mock_test + left.course)} left`,
          lead: `Your ${claimedTypes.map((t) => CAMPAIGN_CONTENT_NOUNS[t]).join(" and ")} ${bonusWord(claimedCount)} ${claimedCount === 1 ? "is" : "are"} claimed. Earn up to ${formatRupees(leftValue)} more.`,
        }
      : {
          chip: campaign.title,
          title: `Earn ${amount} each for ${limitsText}`,
          lead: `Build ${limitsText} to the rules below, tick the bonus when you submit, and earn up to ${formatRupees(maxTotal)}.`,
        };

  const steps = [
    { icon: Hammer, tone: "peach", title: "Build it", text: `Test series: ${req.minTests}+ tests, ${req.minQuestions}+ questions. Course: ${req.minVideos}+ uploaded videos of ${req.minMinutesPerVideo}+ min.` },
    { icon: Send, tone: "mint", title: "Tick the bonus", text: "Tick it when you submit." },
    { icon: Sparkles, tone: "lavender", title: "We check quality", text: "Paid only for high quality work." },
    { icon: Wallet, tone: "sky", title: "Get paid", text: "Added to your wallet." },
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
            <span className={styles.chip}>{hero.chip}</span>
            <h1 id="creator-bonus-title" className={styles.heroTitle}>
              {hero.title}
            </h1>
            <p className={styles.heroLead}>{hero.lead}</p>
            <div className={styles.meter}>
              <div className={styles.meterHead}>
                <span className={styles.meterValue}>{formatRupees(earned)}</span>
                <span className={styles.meterOf}>earned of {formatRupees(meterMax)}</span>
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
              {done ? <Trophy size={30} /> : <Gift size={30} />}
            </span>
          </div>
        </section>

        {examCampaigns.length > 0 && (
          <section className={styles.examBonus} aria-labelledby="exam-bonus-title">
            <div className={styles.examHead}>
              <div className={styles.titleRow}>
                <h2 id="exam-bonus-title" className={styles.sectionTitle}>Exam Bonus</h2>
                <span className={styles.readyBadge}>Limited slots</span>
              </div>
              <p className={styles.examLead}>
                Extra bonus for a new test series on these exams. Limited slots for all teachers.
                {examEarned > 0 && ` Earned so far: ${formatRupees(examEarned)}.`}
              </p>
            </div>
            <div className={styles.tracks}>
              {examCampaigns.map((card, i) => (
                <ExamCard key={card.id} card={card} accent={EXAM_ACCENTS[i % EXAM_ACCENTS.length]} />
              ))}
            </div>
          </section>
        )}

        <div className={styles.tracks}>
          {types.map((type) => {
            const track = TRACKS[type];
            const s = slots[type];
            const atLimit = left[type] === 0;
            const waiting = s.used - s.credited;
            const counts = [
              s.credited > 0 && `${s.credited} credited`,
              waiting > 0 && `${waiting} in review`,
              !atLimit && `${left[type]} of ${s.limit} left`,
            ].filter(Boolean);
            const Icon = track.icon;
            const rule =
              type === "mock_test"
                ? `${req.minTests}+ tests and ${req.minQuestions}+ questions`
                : `${req.minVideos}+ videos of ${req.minMinutesPerVideo}+ min, ${req.minVideoMinutes}+ min in all`;
            return (
              <article
                key={type}
                className={styles.track}
                style={{ "--track-accent": track.accent } as React.CSSProperties}
                {...(atLimit ? {} : cardTapProps)}
              >
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
                    <span>{counts.join(" · ")}</span>
                    {atLimit ? (
                      <span className={`${styles.trackStatus} ${waiting > 0 ? styles.tone_sky : styles.tone_mint}`}>
                        {waiting > 0 ? <Clock size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
                        {waiting > 0 ? "Claimed" : "Done"}
                      </span>
                    ) : (
                      <Link to={track.createHref} className={styles.trackLink} data-card-primary>
                        Create one <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    )}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        {!done && (
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
        )}

        <section className={styles.content} aria-labelledby="creator-bonus-content">
          <div className={styles.contentHead}>
            <h2 id="creator-bonus-content" className={styles.sectionTitle}>Your content</h2>
            <div className={styles.tabs} role="tablist" aria-label="Your content" onKeyDown={onTabKey}>
              {TABS.map((t) => {
                const on = t.value === activeTab;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="tab"
                    id={`bonus-tab-${t.value}`}
                    data-tab={t.value}
                    aria-selected={on}
                    aria-controls="bonus-tab-panel"
                    tabIndex={on ? 0 : -1}
                    className={`${styles.tab} ${on ? styles.tabOn : ""}`}
                    style={{ "--tab-tone": t.tone } as React.CSSProperties}
                    onClick={() => setPickedTab(t.value)}
                  >
                    {t.label}
                    <span className={styles.tabCount}>{lists[t.value].length}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === "apply" && !done && claimedTypes.length > 0 && (
            <p className={styles.applyNote}>
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>
                Your {claimedTypes.map((t) => CAMPAIGN_CONTENT_NOUNS[t]).join(" and ")} {bonusWord(claimedCount)}{" "}
                {claimedCount === 1 ? "is" : "are"} taken, so only {openTypes.map((t) => (t === "course" ? "courses" : "test series")).join(" and ")} show here.
              </span>
            </p>
          )}

          {visibleItems.length === 0 ? (
            <div className={styles.emptyList} id="bonus-tab-panel" role="tabpanel" aria-labelledby={`bonus-tab-${activeTab}`}>
              <p>
                {activeTab === "applied"
                  ? "Nothing applied yet. Tick the bonus when you submit a test series or course for review."
                  : done
                    ? "Every Creator Bonus is claimed, so there is nothing left to apply for."
                    : `No ${openTypes.map((t) => (t === "course" ? "courses" : "test series")).join(" or ")} to apply with yet. Content published or sent for review without the bonus does not count.`}
              </p>
              {activeTab === "apply" && !done && (
                <div className={styles.emptyActions}>
                  {left.mock_test > 0 && (
                    <Button asChild>
                      <Link to={TRACKS.mock_test.createHref}>Create a test series</Link>
                    </Button>
                  )}
                  {left.course > 0 && (
                    <Button asChild variant={left.mock_test > 0 ? "outline" : "primary"}>
                      <Link to={TRACKS.course.createHref}>Create a course</Link>
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <ul
              id="bonus-tab-panel"
              role="tabpanel"
              aria-labelledby={`bonus-tab-${activeTab}`}
              className={styles.itemList}
              aria-busy={isFetching}
            >
              {visibleItems.map((item) => {
                const sticker = STATE_STICKERS[item.state];
                const step = nextStep(item, slots[item.type]);
                return (
                  <li key={`${item.type}-${item.id}`} className={styles.item} {...(step.action ? cardTapProps : {})}>
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
                      {item.state !== "building" && (
                        <span className={`${styles.sticker} ${styles[`tone_${sticker.tone}`]}`}>{sticker.label}</span>
                      )}
                      {(item.claimedExamBonus || item.examBonus) && (
                        <span className={`${styles.sticker} ${styles.examSticker} ${styles.tone_lavender}`}>
                          {item.claimedExamBonus ?? "Exam Bonus open"}
                        </span>
                      )}
                      {step.action && (
                        <Button asChild size="sm" variant={item.state === "ready" ? "primary" : "outline"}>
                          <Link to={step.action.to} data-card-primary>
                            {step.action.label}
                          </Link>
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
          <h2 id="creator-bonus-rules" className={styles.sectionTitle}>Good to know</h2>
          <ul>
            <li>
              Up to {limitsText} per teacher, {amount} each.
            </li>
            <li>One bonus per test series or course.</li>
            <li>Approval does not guarantee the bonus.</li>
            <li>Content live before {new Date(campaign.startsAt).toLocaleDateString("en-IN")} does not count.</li>
            <li>Courses: only videos uploaded to Testkart count.</li>
          </ul>
        </section>
      </div>
    </>
  );
};

export default TeacherCreatorBonusPage;