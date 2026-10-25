import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  CalendarX2,
  CircleCheck,
  Clock,
  GraduationCap,
  History,
  Sparkles,
  Video,
} from "lucide-react";
import { useMasterclassesListQuery } from "../helpers/useMasterclasses";
import { MasterclassListItem } from "../endpoints/masterclasses/list_GET.schema";
import {
  formatMasterclassDay,
  formatMasterclassDuration,
  formatMasterclassTime,
  getMasterclassPhase,
  hostInitials,
  MasterclassPhase,
} from "../helpers/masterclassDisplay";
import { MasterclassStatusBadge } from "../components/MasterclassStatusBadge";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import styles from "./masterclass.module.css";

const ctaLabel = (phase: MasterclassPhase) => (phase === "upcoming" ? "Register now" : "View details");

const HostLine = ({ m }: { m: MasterclassListItem }) => (
  <div className={styles.host}>
    {m.hostImageUrl ? (
      <img src={m.hostImageUrl} alt="" className={styles.hostAvatar} loading="lazy" />
    ) : (
      <span className={styles.hostAvatar} aria-hidden="true">
        {hostInitials(m.hostName)}
      </span>
    )}
    <span className={styles.hostText}>
      <span className={styles.hostName}>{m.hostName || "Testkart team"}</span>
      {m.hostTitle && <span className={styles.hostTitle}>{m.hostTitle}</span>}
    </span>
  </div>
);

const Cover = ({ m, phase, className }: { m: MasterclassListItem; phase: MasterclassPhase; className: string }) => (
  <div className={className}>
    {m.coverImageUrl ? (
      <img src={m.coverImageUrl} alt="" className={styles.coverImage} loading="lazy" />
    ) : (
      <div className={styles.coverPlaceholder}>
        <GraduationCap size={36} aria-hidden="true" />
      </div>
    )}
    <MasterclassStatusBadge phase={phase} onMedia className={styles.coverBadge} />
  </div>
);

const Fact = ({ icon, tone, children }: { icon: React.ReactNode; tone: string; children: React.ReactNode }) => (
  <li>
    <span className={`${styles.factIcon} ${styles[`tile_${tone}`]}`} aria-hidden="true">
      {icon}
    </span>
    <span className={styles.factText}>{children}</span>
  </li>
);

const MasterclassCard = ({ m, now }: { m: MasterclassListItem; now: number }) => {
  const phase = getMasterclassPhase(m, now);
  return (
    <Link to={`/masterclass/${m.slug}`} className={`${styles.card} ${m.isPast ? styles.cardPast : ""}`}>
      <Cover m={m} phase={phase} className={styles.cardMedia} />
      <div className={styles.cardBody}>
        <p className={styles.cardWhen}>
          <CalendarDays size={14} aria-hidden="true" />
          <time dateTime={new Date(m.startTime).toISOString()}>
            {formatMasterclassDay(m.startTime)} · {formatMasterclassTime(m.startTime)} IST
          </time>
        </p>
        <h3 className={styles.cardTitle}>{m.title}</h3>
        {m.subtitle && <p className={styles.cardSubtitle}>{m.subtitle}</p>}
        <HostLine m={m} />
      </div>
      <div className={styles.cardFooter}>
        <span className={styles.duration}>
          <Clock size={14} aria-hidden="true" /> {formatMasterclassDuration(m.durationMinutes)}
        </span>
        <span className={styles.cardCta}>
          {ctaLabel(phase)} <ArrowRight size={16} aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
};

/** A lone upcoming session gets the full row instead of one card in a three-column grid. */
const FeaturedCard = ({ m, now }: { m: MasterclassListItem; now: number }) => {
  const phase = getMasterclassPhase(m, now);
  return (
    <Link to={`/masterclass/${m.slug}`} className={styles.featured}>
      <div className={styles.featuredFrame}>
        <Cover m={m} phase={phase} className={styles.featuredMedia} />
      </div>
      <div className={styles.featuredBody}>
        <span className={styles.kicker}>
          <Sparkles size={13} aria-hidden="true" /> Next session
        </span>
        <h3 className={styles.featuredTitle}>{m.title}</h3>
        {m.subtitle && <p className={styles.featuredSubtitle}>{m.subtitle}</p>}

        <ul className={styles.facts}>
          <Fact icon={<CalendarDays size={14} />} tone="powder">
            <time dateTime={new Date(m.startTime).toISOString()}>{formatMasterclassDay(m.startTime)}</time>
          </Fact>
          <Fact icon={<Clock size={14} />} tone="lavender">
            {formatMasterclassTime(m.startTime)} IST · {formatMasterclassDuration(m.durationMinutes)}
          </Fact>
          {m.platformLabel && (
            <Fact icon={<Video size={14} />} tone="mint">
              {m.platformLabel}
            </Fact>
          )}
        </ul>

        <div className={styles.featuredFooter}>
          <HostLine m={m} />
          <span className={styles.featuredCta}>
            {ctaLabel(phase)} <ArrowRight size={16} aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
};

const EmptyState = ({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) => (
  <div className={styles.empty}>
    <span className={`${styles.emptyIcon} ${styles.tile_powder}`} aria-hidden="true">
      {icon}
    </span>
    <div>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyText}>{text}</p>
    </div>
  </div>
);

const SectionHeader = ({
  id,
  title,
  count,
  icon,
  tone,
}: {
  id: string;
  title: string;
  count: number;
  icon: React.ReactNode;
  tone: string;
}) => (
  <div className={styles.sectionHeader}>
    <h2 id={id} className={styles.sectionTitle}>
      <span className={`${styles.sectionIcon} ${styles[`tile_${tone}`]}`} aria-hidden="true">
        {icon}
      </span>
      {title}
    </h2>
    {count > 0 && (
      <span className={styles.sectionCount}>
        {count} {count === 1 ? "session" : "sessions"}
      </span>
    )}
  </div>
);

// Two cards share a row on desktop instead of leaving a third column empty.
const gridClass = (count: number) => `${styles.grid} ${count === 2 ? styles.gridTwo : ""}`;

const MasterclassListPage: React.FC = () => {
  const { data, isFetching, isError, refetch } = useMasterclassesListQuery();
  const now = Date.now();

  const upcoming = (data?.masterclasses ?? []).filter((m) => !m.isPast);
  const past = (data?.masterclasses ?? []).filter((m) => m.isPast);

  return (
    <>
      <Helmet>
        <title>Masterclasses for Teachers | Testkart</title>
        <meta
          name="description"
          content="Free live webinars for teachers on Testkart - practical training on growing your teaching business, content, and more."
        />
        <link rel="canonical" href="https://testkart.in/masterclass" />
      </Helmet>

      <div className={styles.pageWrapper}>
        <header className={styles.hero}>
          <span className={styles.decor} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <div className={styles.heroInner}>
            <span className={styles.eyebrow}>
              <GraduationCap size={14} aria-hidden="true" /> Testkart Masterclasses
            </span>
            <h1 className={styles.heroTitle}>Free live training for teachers</h1>
            <p className={styles.heroSubtitle}>
              Join our webinars to learn how to grow your teaching business, create better content, and make the most
              of Testkart - hosted live, free to attend.
            </p>
            <ul className={styles.heroFacts}>
              <li>
                <span className={`${styles.heroFactIcon} ${styles.tile_mint}`} aria-hidden="true">
                  <CircleCheck size={14} />
                </span>
                Free to attend
              </li>
              <li>
                <span className={`${styles.heroFactIcon} ${styles.tile_powder}`} aria-hidden="true">
                  <Video size={14} />
                </span>
                Hosted live online
              </li>
              <li>
                <span className={`${styles.heroFactIcon} ${styles.tile_butter}`} aria-hidden="true">
                  <BellRing size={14} />
                </span>
                Email reminders before each session
              </li>
            </ul>
          </div>
        </header>

        <main className={styles.main}>
          {isFetching && !data ? (
            <section aria-busy="true">
              <div className={styles.sectionHeader}>
                <Skeleton style={{ height: "1.5rem", width: "14rem" }} />
              </div>
              <div className={styles.grid}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={styles.skeletonCard}>
                    <Skeleton style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: "0.875rem" }} />
                    <div className={styles.skeletonBody}>
                      <Skeleton style={{ height: "0.875rem", width: "55%" }} />
                      <Skeleton style={{ height: "1.125rem", width: "90%" }} />
                      <Skeleton style={{ height: "0.875rem", width: "75%" }} />
                      <Skeleton style={{ height: "2rem", width: "60%", marginTop: "var(--spacing-2)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : isError ? (
            <div className={styles.errorBox}>
              <p className={styles.emptyTitle}>Could not load masterclasses right now.</p>
              <p className={styles.emptyText}>Please check your connection and try again.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className={styles.retry}>
                Try again
              </Button>
            </div>
          ) : (
            <>
              <section aria-labelledby="mc-upcoming">
                <SectionHeader
                  id="mc-upcoming"
                  title="Upcoming masterclasses"
                  count={upcoming.length}
                  icon={<CalendarDays size={18} />}
                  tone="lavender"
                />
                {upcoming.length === 0 ? (
                  <EmptyState
                    icon={<CalendarX2 size={22} />}
                    title="No upcoming masterclasses right now"
                    text={
                      past.length > 0
                        ? "New sessions are announced here first. Meanwhile, browse the past sessions below."
                        : "New sessions are announced here first. Check back soon."
                    }
                  />
                ) : upcoming.length === 1 ? (
                  <FeaturedCard m={upcoming[0]} now={now} />
                ) : (
                  <div className={gridClass(upcoming.length)}>
                    {upcoming.map((m) => (
                      <MasterclassCard key={m.id} m={m} now={now} />
                    ))}
                  </div>
                )}
              </section>

              <section aria-labelledby="mc-past">
                <SectionHeader
                  id="mc-past"
                  title="Past masterclasses"
                  count={past.length}
                  icon={<History size={18} />}
                  tone="butter"
                />
                {past.length === 0 ? (
                  <EmptyState
                    icon={<History size={22} />}
                    title="No completed masterclasses yet"
                    text="Sessions move here once they have ended."
                  />
                ) : (
                  <div className={gridClass(past.length)}>
                    {past.map((m) => (
                      <MasterclassCard key={m.id} m={m} now={now} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </>
  );
};

export default MasterclassListPage;
