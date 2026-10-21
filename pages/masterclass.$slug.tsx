import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useParams } from "react-router-dom";
import { z } from "zod";
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage } from "../components/Form";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { useMasterclassQuery, useRegisterForMasterclassMutation } from "../helpers/useMasterclasses";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { googleCalendarUrl, masterclassIcsPath } from "../helpers/masterclassCalendarLinks";
import {
  GraduationCap,
  Calendar,
  Clock,
  Users,
  Video,
  CheckCircle2,
  AlertTriangle,
  Ban,
  CalendarPlus,
  Download,
  Mail,
} from "lucide-react";
import styles from "./masterclass.$slug.module.css";

// How long before start the real join link is worth showing as a big button.
// Any earlier and it's not actionable yet - the 1-hour reminder email is what
// actually hands it out, so the page defers to "check your email" until then.
const JOIN_LINK_VISIBLE_MINUTES_BEFORE = 30;

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().optional(),
});
type RegisterValues = z.infer<typeof registerSchema>;

const formatDate = (date: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeZone: "Asia/Kolkata" }).format(new Date(date));
const formatTime = (date: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(date));

const MasterclassDetailPage: React.FC = () => {
  const { slug } = useParams();
  const { data, isFetching, isError } = useMasterclassQuery(slug || "");
  const registerMutation = useRegisterForMasterclassMutation();
  const [registeredJoinUrl, setRegisteredJoinUrl] = useState<string | null | undefined>(undefined);

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
      <div className={styles.page}>
        <Skeleton style={{ height: "20rem", width: "100%", borderRadius: "var(--radius-lg)" }} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.notFound}>
        <GraduationCap size={32} />
        <p>This masterclass could not be found.</p>
      </div>
    );
  }

  const m = data.masterclass;
  const alreadyRegistered = m.isRegistered || registeredJoinUrl !== undefined;
  const spotsLeft = m.capacity !== null ? Math.max(0, m.capacity - m.registrantCount) : null;
  const startsSoon =
    !m.isPast &&
    Date.now() >= new Date(m.startTime).getTime() - JOIN_LINK_VISIBLE_MINUTES_BEFORE * 60 * 1000;

  const onSubmit = (values: RegisterValues) => {
    if (!slug) return;
    registerMutation.mutate(
      { slug, name: values.name, email: values.email, phone: values.phone || undefined },
      {
        onSuccess: (res) => setRegisteredJoinUrl(res.joinUrl),
      }
    );
  };

  return (
    <>
      <Helmet>
        <title>{m.title} | Testkart Masterclass</title>
        <meta name="description" content={m.subtitle || m.title} />
        <link rel="canonical" href={`https://testkart.in/masterclass/${m.slug}`} />
      </Helmet>

      <div className={styles.page}>
        <div className={styles.layout}>
          <div>
            {m.coverImageUrl ? (
              <img src={m.coverImageUrl} alt={m.title} className={styles.cover} />
            ) : (
              <div className={styles.coverPlaceholder}>
                <GraduationCap size={48} />
              </div>
            )}

            <div className={styles.metaRow}>
              <span className={styles.metaItem}>
                <Calendar size={15} /> {formatDate(m.startTime)}
              </span>
              <span className={styles.metaItem}>
                <Clock size={15} /> {formatTime(m.startTime)} IST · {m.durationMinutes ?? 60} min
              </span>
              <span className={styles.metaItem}>
                <Users size={15} /> {m.registrantCount} registered
              </span>
            </div>

            <h1 className={styles.title}>{m.title}</h1>
            {m.subtitle && <p className={styles.subtitle}>{m.subtitle}</p>}

            {(m.hostName || m.hostTitle) && (
              <div className={styles.hostRow}>
                {m.hostImageUrl ? (
                  <img src={m.hostImageUrl} alt={m.hostName ?? ""} className={styles.hostAvatar} />
                ) : (
                  <div className={styles.hostAvatarPlaceholder}>
                    <GraduationCap size={20} />
                  </div>
                )}
                <div>
                  {m.hostName && <p className={styles.hostName}>{m.hostName}</p>}
                  {m.hostTitle && <p className={styles.hostTitle}>{m.hostTitle}</p>}
                </div>
              </div>
            )}

            {m.description && <div className={styles.description}>{m.description}</div>}
          </div>

          <aside className={styles.sidebarCard}>
            {m.status === "cancelled" ? (
              <div className={styles.noticeBox + " " + styles.noticeDanger}>
                <Ban size={16} /> This masterclass has been cancelled.
              </div>
            ) : m.isPast ? (
              <div className={styles.noticeBox + " " + styles.noticeWarning}>
                <AlertTriangle size={16} /> This masterclass has already ended.
              </div>
            ) : alreadyRegistered ? (
              <div className={styles.successState}>
                <CheckCircle2 size={36} className={styles.successIcon} />
                <p className={styles.successTitle}>You're registered!</p>
                {startsSoon ? (
                  <>
                    <p className={styles.successNote}>
                      It's almost time. Join a few minutes early to settle in.
                    </p>
                    {(registeredJoinUrl ?? m.joinUrl) && (
                      <Button asChild style={{ width: "100%" }}>
                        <a href={(registeredJoinUrl ?? m.joinUrl) || undefined} target="_blank" rel="noreferrer">
                          <Video size={16} /> Join now
                        </a>
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <p className={styles.successNote}>
                      <Mail size={14} className={styles.successNoteIcon} aria-hidden="true" />
                      We've emailed you a confirmation. The join link follows in reminders 1 day and 1 hour before
                      start — add it to your calendar so you don't miss it.
                    </p>
                    <div className={styles.calendarActions}>
                      <Button asChild variant="outline" style={{ width: "100%" }}>
                        <a
                          href={googleCalendarUrl({
                            title: m.title,
                            description: m.subtitle || "A free live masterclass for teachers, hosted on Testkart.",
                            pageUrl: `https://testkart.in/masterclass/${m.slug}`,
                            startTime: m.startTime,
                            durationMinutes: m.durationMinutes,
                          })}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <CalendarPlus size={16} /> Add to Google Calendar
                        </a>
                      </Button>
                      <Button asChild variant="outline" style={{ width: "100%" }}>
                        <a href={masterclassIcsPath(m.slug)} download>
                          <Download size={16} /> Download .ics (Outlook/Apple)
                        </a>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : m.isFull ? (
              <div className={styles.noticeBox + " " + styles.noticeWarning}>
                <AlertTriangle size={16} /> This masterclass is full. Check back for the next one.
              </div>
            ) : (
              <>
                <h2 className={styles.sidebarTitle}>Reserve your free spot</h2>
                {spotsLeft !== null && spotsLeft <= 20 && (
                  <p className={styles.successNote}>Only {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left.</p>
                )}
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}
                  >
                    <FormItem name="name">
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input
                          value={form.values.name}
                          onChange={(e) => form.setValues((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="Your name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                    <FormItem name="email">
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          value={form.values.email}
                          onChange={(e) => form.setValues((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder="you@example.com"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                    <FormItem name="phone">
                      <FormLabel>Phone (optional)</FormLabel>
                      <FormControl>
                        <Input
                          value={form.values.phone}
                          onChange={(e) => form.setValues((prev) => ({ ...prev, phone: e.target.value }))}
                          placeholder="10-digit mobile number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>

                    {registerMutation.isError && (
                      <p className={styles.formError}>{parseErrorMessage(registerMutation.error)}</p>
                    )}

                    <Button type="submit" disabled={registerMutation.isPending} style={{ width: "100%" }}>
                      {registerMutation.isPending ? "Registering..." : "Register for free"}
                    </Button>
                  </form>
                </Form>
              </>
            )}
          </aside>
        </div>
      </div>
    </>
  );
};

export default MasterclassDetailPage;
