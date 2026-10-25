import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useParams } from "react-router-dom";
import { z } from "zod";
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage } from "../components/Form";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { MasterclassStatusBadge } from "../components/MasterclassStatusBadge";
import { useMasterclassQuery, useRegisterForMasterclassMutation } from "../helpers/useMasterclasses";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { googleCalendarUrl, masterclassIcsPath } from "../helpers/masterclassCalendarLinks";
import {
  formatMasterclassDuration,
  formatMasterclassLongDay,
  formatMasterclassTime,
  getMasterclassPhase,
  hostInitials,
  MasterclassContentBlock,
  parseMasterclassDescription,
} from "../helpers/masterclassDisplay";
import {
  ArrowLeft,
  Ban,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  History,
  ListChecks,
  Radio,
  Sparkles,
  UserCheck,
  Users,
  Video,
} from "lucide-react";
import styles from "./masterclass.$slug.module.css";
import type { MasterclassPresenter } from "../helpers/masterclassCoHosts";

// How long before start the real join link is worth showing as a big button.
// Any earlier and it's not actionable yet - the 1-hour reminder email is what
// actually hands it out, so the page defers to "check your email" until then.
const JOIN_LINK_VISIBLE_MINUTES_BEFORE = 30;

const SITE_URL = "https://testkart.in";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().optional(),
});
type RegisterValues = z.infer<typeof registerSchema>;

type RegistrationResult = { joinUrl: string | null; alreadyRegistered: boolean };

type Tone = "lavender" | "mint" | "sage" | "powder" | "butter";

// Custom "## Heading" sections take turns through these after the fixed ones.
const SECTION_TONES: Tone[] = ["powder", "butter", "lavender", "mint"];

const ContentBlocks = ({ blocks }: { blocks: MasterclassContentBlock[] }) => (
  <div className={styles.prose}>
    {blocks.map((block, i) =>
      block.type === "list" ? (
        <ul key={i}>
          {block.items.map((item, j) => (
            <li key={j}>{item}</li>
          ))}
        </ul>
      ) : (
        <p key={i}>{block.text}</p>
      )
    )}
  </div>
);

const SectionTitle = ({ icon, tone, children }: { icon: React.ReactNode; tone: Tone; children: React.ReactNode }) => (
  <h2 className={styles.sectionTitle}>
    <span className={`${styles.iconTile} ${styles[`tile_${tone}`]}`} aria-hidden="true">
      {icon}
    </span>
    {children}
  </h2>
);

const StateBlock = ({
  tone,
  icon,
  title,
  children,
}: {
  tone: "success" | "neutral" | "danger" | "live";
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) => (
  <div className={styles.state}>
    <span className={`${styles.stateIcon} ${styles[`tone_${tone}`]}`} aria-hidden="true">
      {icon}
    </span>
    <h2 className={styles.stateTitle}>{title}</h2>
    {children}
  </div>
);

const BrowseOthers = () => (
  <Button asChild variant="outline" className={styles.outlineAction}>
    <Link to="/masterclass">See upcoming masterclasses</Link>
  </Button>
);

const PresenterAvatar = ({
  name,
  imageUrl,
  large = false,
}: {
  name: string;
  imageUrl: string | null;
  large?: boolean;
}) => {
  const className = large ? styles.hostAvatar : styles.presenterAvatar;
  return imageUrl ? (
    <img src={imageUrl} alt="" className={className} loading="lazy" />
  ) : (
    <span className={className} aria-hidden="true">
      {hostInitials(name)}
    </span>
  );
};

const ROLE_TONE: Record<string, Tone> = { Host: "lavender", "Co-host": "sage", Guest: "butter" };

const PresenterCard = ({
  presenter,
  role,
  primary = false,
}: {
  presenter: MasterclassPresenter;
  role: string;
  primary?: boolean;
}) => (
  <li className={`${styles.presenterCard} ${primary ? styles.presenterPrimary : ""}`}>
    <PresenterAvatar name={presenter.name} imageUrl={presenter.profileImage} />
    <div className={styles.hostInfo}>
      <span className={`${styles.roleChip} ${styles[`chip_${ROLE_TONE[role] ?? "sage"}`]}`}>{role}</span>
      <p className={styles.presenterName}>{presenter.name}</p>
      {presenter.title && <p className={styles.hostTitle}>{presenter.title}</p>}
      {presenter.organization && <p className={styles.hostTitle}>{presenter.organization}</p>}
      {presenter.website && (
        <a
          href={presenter.website}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={styles.presenterWebsite}
        >
          <ExternalLink size={13} aria-hidden="true" />
          {presenter.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
        </a>
      )}
    </div>
  </li>
);

const MasterclassDetailPage: React.FC = () => {
  const { slug } = useParams();
  const { data, isFetching, isError } = useMasterclassQuery(slug || "");
  const registerMutation = useRegisterForMasterclassMutation();
  const [registration, setRegistration] = useState<RegistrationResult | null>(null);

  const form = useForm({
    schema: registerSchema,
    defaultValues: { name: "", email: "", phone: "" } as RegisterValues,
  });

  useEffect(() => {
    if (data?.masterclass.prefill) {
      form.setValues({
        name: data.masterclass.prefill.name,
        email: data.masterclass.prefill.email,
        phone: data.masterclass.prefill.phone || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.masterclass.id]);

  if (isFetching && !data) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.page} aria-busy="true">
          <Skeleton style={{ height: "1rem", width: "9rem", marginBottom: "1.25rem" }} />
          <div className={styles.layout}>
            <div className={styles.header}>
              <Skeleton style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: "var(--radius-lg)" }} />
              <Skeleton style={{ height: "1rem", width: "60%", marginTop: "1.5rem" }} />
              <Skeleton style={{ height: "2.25rem", width: "85%", marginTop: "var(--spacing-4)" }} />
            </div>
            <aside className={styles.aside}>
              <Skeleton style={{ height: "26rem", width: "100%", borderRadius: "var(--radius-lg)" }} />
            </aside>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.notFound}>
          <span className={`${styles.stateIcon} ${styles.tone_neutral}`} aria-hidden="true">
            <GraduationCap size={22} />
          </span>
          <h1 className={styles.notFoundTitle}>This masterclass could not be found</h1>
          <p className={styles.stateText}>It may have been moved or is no longer available.</p>
          <Button asChild variant="outline" className={styles.outlineAction}>
            <Link to="/masterclass">
              <ArrowLeft size={16} /> All masterclasses
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const m = data.masterclass;
  const pageUrl = `${SITE_URL}/masterclass/${m.slug}`;
  const phase = getMasterclassPhase(m);
  const content = parseMasterclassDescription(m.description);
  const isRegistered = m.isRegistered || registration !== null;
  // The local result wins: registering refetches this query, which flips
  // isRegistered for a signed-in user who has only just signed up.
  const registeredBefore = registration ? registration.alreadyRegistered : m.isRegistered;
  const joinUrl = registration?.joinUrl ?? m.joinUrl;
  const spotsLeft = m.capacity !== null ? Math.max(0, m.capacity - m.registrantCount) : null;
  const startsSoon =
    !m.isPast && Date.now() >= new Date(m.startTime).getTime() - JOIN_LINK_VISIBLE_MINUTES_BEFORE * 60 * 1000;
  const timeLabel = `${formatMasterclassTime(m.startTime)} IST`;
  const durationLabel = formatMasterclassDuration(m.durationMinutes);
  const endTime = new Date(new Date(m.startTime).getTime() + (m.durationMinutes ?? 60) * 60 * 1000);

  const onSubmit = (values: RegisterValues) => {
    if (!slug) return;
    registerMutation.mutate(
      { slug, name: values.name, email: values.email, phone: values.phone || undefined },
      {
        onSuccess: (res) => setRegistration({ joinUrl: res.joinUrl, alreadyRegistered: res.alreadyRegistered }),
      }
    );
  };

  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: m.title,
    description: m.subtitle || m.title,
    startDate: new Date(m.startTime).toISOString(),
    endDate: endTime.toISOString(),
    eventStatus:
      m.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: { "@type": "VirtualLocation", url: pageUrl },
    ...(m.coverImageUrl ? { image: [m.coverImageUrl] } : {}),
    ...(m.hostName ? { performer: { "@type": "Person", name: m.hostName } } : {}),
    organizer: { "@type": "Organization", name: "Testkart", url: SITE_URL },
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
      url: pageUrl,
      availability: m.isFull ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
    },
  };

  const renderRegistration = () => {
    if (phase === "cancelled") {
      return (
        <StateBlock tone="danger" icon={<Ban size={20} />} title="This masterclass was cancelled">
          <p className={styles.stateText}>Registrations are closed. New sessions are announced on the masterclasses page.</p>
          <BrowseOthers />
        </StateBlock>
      );
    }
    if (phase === "completed") {
      return (
        <StateBlock tone="neutral" icon={<History size={20} />} title="This masterclass has ended">
          <p className={styles.stateText}>
            {isRegistered ? "Thanks for registering. " : ""}Registrations are closed for this session.
          </p>
          <BrowseOthers />
        </StateBlock>
      );
    }
    if (isRegistered) {
      return (
        <StateBlock
          tone={phase === "live" ? "live" : "success"}
          icon={phase === "live" ? <Radio size={20} /> : registeredBefore ? <UserCheck size={20} /> : <CheckCircle2 size={20} />}
          title={phase === "live" ? "This session is live" : registeredBefore ? "You're already registered" : "You're registered"}
        >
          {startsSoon ? (
            <>
              <p className={styles.stateText}>
                {phase === "live" ? "Join now from the link below." : "It's almost time. Join a few minutes early to settle in."}
              </p>
              {joinUrl && (
                <Button asChild size="lg" className={styles.cta}>
                  <a href={joinUrl} target="_blank" rel="noreferrer">
                    <Video size={18} /> Join now
                  </a>
                </Button>
              )}
            </>
          ) : (
            <>
              <p className={styles.stateText}>
                {registeredBefore
                  ? "Your spot is saved under this email. Your confirmation email has the details."
                  : "We've emailed you a confirmation. The join link follows in your reminder 1 hour before the start."}
              </p>
              <div className={styles.calendarActions}>
                <Button asChild variant="outline" className={styles.outlineAction}>
                  <a
                    href={googleCalendarUrl({
                      title: m.title,
                      description: m.subtitle || "A free live masterclass for teachers, hosted on Testkart.",
                      pageUrl,
                      startTime: m.startTime,
                      durationMinutes: m.durationMinutes,
                    })}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <CalendarPlus size={16} /> Add to Google Calendar
                  </a>
                </Button>
                <Button asChild variant="outline" className={styles.outlineAction}>
                  <a href={masterclassIcsPath(m.slug)} download>
                    <Download size={16} /> Download .ics (Outlook/Apple)
                  </a>
                </Button>
              </div>
            </>
          )}
        </StateBlock>
      );
    }
    if (phase === "live") {
      return (
        <StateBlock tone="live" icon={<Radio size={20} />} title="Registration is closed">
          <p className={styles.stateText}>This session has already started, so new registrations are closed.</p>
          <BrowseOthers />
        </StateBlock>
      );
    }
    if (m.isFull) {
      return (
        <StateBlock tone="neutral" icon={<Users size={20} />} title="This masterclass is fully booked">
          <p className={styles.stateText}>All spots have been taken. Check back for the next session.</p>
          <BrowseOthers />
        </StateBlock>
      );
    }

    return (
      <>
        <div className={styles.cardHead}>
          <span className={`${styles.iconTile} ${styles.tile_lavender} ${styles.cardIcon}`} aria-hidden="true">
            <CalendarCheck size={20} />
          </span>
          <div>
            <h2 className={styles.cardTitle}>Reserve your free spot</h2>
            <p className={styles.cardSub}>
              Free · {m.platformLabel ? `Live on ${m.platformLabel}` : "Live online"} · {durationLabel}
            </p>
          </div>
        </div>
        {spotsLeft !== null && spotsLeft <= 20 && (
          <p className={styles.spotsNote}>
            Only {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left
          </p>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form} noValidate>
            <FormItem name="name">
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input
                  value={form.values.name}
                  onChange={(e) => form.setValues((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            <FormItem name="email">
              <FormLabel>Email address</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  value={form.values.email}
                  onChange={(e) => form.setValues((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            <FormItem name="phone">
              <FormLabel>Phone number (optional)</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  inputMode="tel"
                  value={form.values.phone}
                  onChange={(e) => form.setValues((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="10-digit mobile number"
                  autoComplete="tel"
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            {registerMutation.isError && (
              <p className={styles.formError} role="alert">
                {parseErrorMessage(registerMutation.error)}
              </p>
            )}

            <Button type="submit" size="lg" disabled={registerMutation.isPending} className={styles.cta}>
              {registerMutation.isPending ? "Registering..." : "Register for free"}
            </Button>
          </form>
        </Form>
      </>
    );
  };

  return (
    <>
      <Helmet>
        <title>{m.title} | Testkart Masterclass</title>
        <meta name="description" content={m.subtitle || m.title} />
        <link rel="canonical" href={pageUrl} />
        <script type="application/ld+json">{JSON.stringify(eventJsonLd)}</script>
      </Helmet>

      <div className={styles.pageWrapper}>
        <div className={styles.page}>
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link to="/masterclass">
              <ArrowLeft size={16} aria-hidden="true" /> All masterclasses
            </Link>
          </nav>

          <div className={styles.layout}>
            <div className={styles.header}>
              <div className={styles.coverFrame}>
                {m.coverImageUrl ? (
                  <img src={m.coverImageUrl} alt={m.title} className={styles.cover} />
                ) : (
                  <div className={styles.coverPlaceholder}>
                    <GraduationCap size={48} aria-hidden="true" />
                  </div>
                )}
                <span className={styles.coverDot} aria-hidden="true" />
              </div>

              <div className={styles.metaRow}>
                <MasterclassStatusBadge phase={phase} className={styles.statusBadge} />
                <span className={styles.metaItem}>
                  <span className={`${styles.metaIcon} ${styles.tile_powder}`} aria-hidden="true">
                    <CalendarDays size={14} />
                  </span>
                  <time dateTime={new Date(m.startTime).toISOString()}>{formatMasterclassLongDay(m.startTime)}</time>
                </span>
                <span className={styles.metaItem}>
                  <span className={`${styles.metaIcon} ${styles.tile_lavender}`} aria-hidden="true">
                    <Clock size={14} />
                  </span>
                  {timeLabel} · {durationLabel}
                </span>
              </div>

              <h1 className={styles.title}>{m.title}</h1>
              {m.subtitle && <p className={styles.subtitle}>{m.subtitle}</p>}
            </div>

            <aside className={styles.aside} aria-label="Registration">
              <div className={styles.registerCard}>{renderRegistration()}</div>
            </aside>

            <div className={styles.body}>
              {content.about.length > 0 && (
                <section className={styles.section}>
                  <SectionTitle icon={<BookOpen size={18} />} tone="lavender">
                    About this masterclass
                  </SectionTitle>
                  <ContentBlocks blocks={content.about} />
                </section>
              )}

              {content.learnings.length > 0 && (
                <section className={styles.section}>
                  <SectionTitle icon={<Sparkles size={18} />} tone="mint">
                    What you'll learn
                  </SectionTitle>
                  <ul className={styles.learnList}>
                    {content.learnings.map((item, i) => (
                      <li key={i}>
                        <span className={styles.learnCheck} aria-hidden="true">
                          <Check size={14} strokeWidth={2.5} />
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {(m.hostName || m.hostTitle) && (
                <section className={styles.section}>
                  {m.coHosts.length === 0 ? (
                    <>
                      <SectionTitle icon={<GraduationCap size={18} />} tone="butter">
                        Your host
                      </SectionTitle>
                      <div className={styles.hostCard}>
                        <PresenterAvatar name={m.hostName ?? ""} imageUrl={m.hostImageUrl} large />
                        <div className={styles.hostInfo}>
                          <span className={`${styles.roleChip} ${styles.chip_lavender}`}>Host</span>
                          {m.hostName && <p className={styles.hostName}>{m.hostName}</p>}
                          {m.hostTitle && <p className={styles.hostTitle}>{m.hostTitle}</p>}
                          {content.hostBio.length > 0 && <ContentBlocks blocks={content.hostBio} />}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <SectionTitle icon={<Users size={18} />} tone="butter">
                        Your presenters
                      </SectionTitle>
                      <ul className={styles.presenterGrid}>
                        <PresenterCard
                          role="Host"
                          primary
                          presenter={{
                            type: "admin",
                            name: m.hostName ?? "",
                            title: m.hostTitle,
                            profileImage: m.hostImageUrl,
                            organization: null,
                            website: null,
                          }}
                        />
                        {m.coHosts.map((coHost, i) => (
                          <PresenterCard
                            key={`${coHost.name}-${i}`}
                            role={coHost.type === "guest" ? "Guest" : "Co-host"}
                            presenter={coHost}
                          />
                        ))}
                      </ul>
                      {content.hostBio.length > 0 && (
                        <div className={styles.presenterBio}>
                          <ContentBlocks blocks={content.hostBio} />
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}

              {content.sections.map((section, i) => (
                <section key={i} className={styles.section}>
                  <SectionTitle icon={<FileText size={18} />} tone={SECTION_TONES[i % SECTION_TONES.length]}>
                    {section.title}
                  </SectionTitle>
                  <ContentBlocks blocks={section.blocks} />
                </section>
              ))}

              {(phase === "upcoming" || phase === "live") && (
                <section className={styles.section}>
                  <SectionTitle icon={<ListChecks size={18} />} tone="sage">
                    How it works
                  </SectionTitle>
                  <ol className={styles.steps}>
                    <li className={styles.step}>
                      <span className={`${styles.stepNum} ${styles.tile_powder}`}>1</span>
                      <div>
                        <p className={styles.stepTitle}>Register for free</p>
                        <p className={styles.stepText}>Reserve your spot with your name and email. Get instant confirmation.</p>
                      </div>
                    </li>
                    <li className={styles.step}>
                      <span className={`${styles.stepNum} ${styles.tile_lavender}`}>2</span>
                      <div>
                        <p className={styles.stepTitle}>Get reminders</p>
                        <p className={styles.stepText}>Receive email reminders 1 day and 1 hour before the session.</p>
                      </div>
                    </li>
                    <li className={styles.step}>
                      <span className={`${styles.stepNum} ${styles.tile_mint}`}>3</span>
                      <div>
                        <p className={styles.stepTitle}>Join live</p>
                        <p className={styles.stepText}>
                          Join the {m.platformLabel ? `${m.platformLabel} ` : "live "}session at the scheduled time.
                        </p>
                      </div>
                    </li>
                  </ol>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MasterclassDetailPage;
