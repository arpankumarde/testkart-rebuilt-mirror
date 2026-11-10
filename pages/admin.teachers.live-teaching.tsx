import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import { AlertCircle, BadgeCheck, CalendarClock, ExternalLink, IndianRupee, Languages, BookOpen, Video, Award } from "lucide-react";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useAdminLiveTeachingApplicationsQuery, useDecideLiveTeachingMutation } from "../helpers/useLiveTeaching";
import {
  ApplicationFilter,
  ApplicationFilterValues,
  LiveTeachingApplicationRow,
} from "../endpoints/admin/teachers/live-teaching/list_GET.schema";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Textarea } from "../components/Textarea";
import { Skeleton } from "../components/Skeleton";
import styles from "./admin.teachers.live-teaching.module.css";

const STATUS_LABEL: Record<LiveTeachingApplicationRow["status"], string> = {
  pending: "In review",
  approved: "Approved",
  rejected: "Rejected",
  revoked: "Revoked",
  withdrawn: "Withdrawn",
};

const STATUS_VARIANT: Record<LiveTeachingApplicationRow["status"], "warning" | "success" | "secondary" | "default"> = {
  pending: "warning",
  approved: "success",
  rejected: "secondary",
  revoked: "default",
  withdrawn: "secondary",
};

const formatDate = (date: Date | string | null) =>
  date
    ? new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
    : "";

const ApplicationCard: React.FC<{ application: LiveTeachingApplicationRow }> = ({ application }) => {
  const decide = useDecideLiveTeachingMutation();
  const [mode, setMode] = useState<"reject" | "revoke" | null>(null);
  const [reason, setReason] = useState("");
  const [bioOpen, setBioOpen] = useState(false);
  const t = application.teacher;
  const rate = application.ratePerUnit;
  const isVideo = application.kind === "video";

  const run = (action: "approve" | "reject" | "revoke") => {
    decide.mutate(
      { applicationId: application.id, action, reason: action === "approve" ? undefined : reason.trim() },
      {
        onSuccess: (res) => {
          const done = action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "Revoked";
          toast.success(res.emailed ? `${done}. ${t.displayName} was emailed.` : `${done}. No email on file.`);
          setMode(null);
          setReason("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save this decision."),
      }
    );
  };

  return (
    <article className={styles.card}>
      <div className={styles.videoCol}>
        {isVideo && <p className={styles.videoLabel}>New video</p>}
        <video className={styles.video} src={application.introVideoUrl} controls preload="metadata" playsInline />
        {isVideo && application.currentVideoUrl && (
          <>
            <p className={styles.videoLabel}>On the profile now</p>
            <video className={styles.video} src={application.currentVideoUrl} controls preload="metadata" playsInline />
          </>
        )}
      </div>

      <div className={styles.infoCol}>
        <div className={styles.headRow}>
          {t.avatarUrl ? (
            <img src={t.avatarUrl} alt="" className={styles.avatar} />
          ) : (
            <span className={styles.avatarFallback} aria-hidden="true">
              {t.displayName.charAt(0).toUpperCase()}
            </span>
          )}
          <div className={styles.headText}>
            <h3 className={styles.name}>
              {t.displayName}
              {t.isVerified && <BadgeCheck size={16} className={styles.verified} aria-label="Verified teacher" />}
            </h3>
            <span className={styles.email}>{t.email}</span>
          </div>
          {isVideo && <Badge variant="default">New intro video</Badge>}
          <Badge variant={STATUS_VARIANT[application.status]}>{STATUS_LABEL[application.status]}</Badge>
        </div>

        {t.tagline && <p className={styles.tagline}>{t.tagline}</p>}
        {t.bio && (
          <p className={`${styles.bio} ${bioOpen ? styles.bioOpen : ""}`}>
            {t.bio}
          </p>
        )}
        {t.bio && t.bio.length > 220 && (
          <button type="button" className={styles.linkButton} onClick={() => setBioOpen((v) => !v)}>
            {bioOpen ? "Show less" : "Read full bio"}
          </button>
        )}

        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt><BookOpen size={14} aria-hidden="true" /> Subjects</dt>
            <dd>{t.subjects.join(", ") || "None"}</dd>
          </div>
          <div className={styles.fact}>
            <dt><Languages size={14} aria-hidden="true" /> Languages</dt>
            <dd>{t.languages.join(", ") || "None"}</dd>
          </div>
          <div className={styles.fact}>
            <dt><IndianRupee size={14} aria-hidden="true" /> Rate</dt>
            <dd>{rate !== null ? `₹${rate.toLocaleString("en-IN")} / 25 min, ₹${(rate * 2).toLocaleString("en-IN")} / 50 min` : "Not set"}</dd>
          </div>
          <div className={styles.fact}>
            <dt><CalendarClock size={14} aria-hidden="true" /> Weekly hours</dt>
            <dd>{t.weeklyHourWindows > 0 ? `${t.weeklyHourWindows} time window${t.weeklyHourWindows === 1 ? "" : "s"}` : "None set"}</dd>
          </div>
          {t.yearsOfExperience !== null && (
            <div className={styles.fact}>
              <dt><Award size={14} aria-hidden="true" /> Experience</dt>
              <dd>{t.yearsOfExperience} years</dd>
            </div>
          )}
        </dl>

        <p className={styles.meta}>
          {isVideo ? "Sent" : "Applied"} {formatDate(application.createdAt)}
          {application.decidedAt && application.decidedBy
            ? ` · ${STATUS_LABEL[application.status]} by ${application.decidedBy === "teacher" ? "the teacher" : application.decidedBy} on ${formatDate(application.decidedAt)}`
            : ""}
        </p>
        {application.decisionReason && (
          <p className={styles.reason}>
            <strong>Reason given:</strong> {application.decisionReason}
          </p>
        )}

        {mode && (
          <div className={styles.reasonBox}>
            <label className={styles.reasonLabel} htmlFor={`reason-${application.id}`}>
              {mode === "reject" ? (isVideo ? "What is wrong with the new video?" : "What should they fix?") : "Why is live teaching being turned off?"}
            </label>
            <Textarea
              id={`reason-${application.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="This goes to the teacher by email."
            />
          </div>
        )}

        <div className={styles.actions}>
          {t.slug && (
            <Button variant="ghost" size="sm" asChild>
              <a href={`/expert/${t.slug}`} target="_blank" rel="noreferrer">
                Profile <ExternalLink size={14} />
              </a>
            </Button>
          )}
          {application.status === "pending" && application.isLatest && !mode && (
            <>
              <Button variant="outline" onClick={() => setMode("reject")} disabled={decide.isPending}>
                Reject
              </Button>
              <Button onClick={() => run("approve")} disabled={decide.isPending}>
                {decide.isPending ? "Saving..." : isVideo ? "Approve video" : "Approve"}
              </Button>
            </>
          )}
          {!isVideo && application.status === "approved" && application.isLatest && !mode && (
            <Button variant="outline" onClick={() => setMode("revoke")} disabled={decide.isPending}>
              Revoke
            </Button>
          )}
          {mode && (
            <>
              <Button variant="ghost" onClick={() => { setMode(null); setReason(""); }} disabled={decide.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => run(mode)}
                disabled={decide.isPending || reason.trim().length < 5}
              >
                {decide.isPending ? "Saving..." : mode === "reject" ? "Reject and email" : "Revoke and email"}
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  );
};

const AdminLiveTeachingPage: React.FC = () => {
  const { read, write } = useListUrlParams();
  const status = read<ApplicationFilter>("status", ApplicationFilterValues, "pending");
  const { data, isFetching, isError, error, refetch } = useAdminLiveTeachingApplicationsQuery(status);
  const counts = data?.counts;

  const tabs = [
    { value: "pending", label: "In review", count: counts?.pending },
    { value: "approved", label: "Approved", count: counts?.approved },
    { value: "rejected", label: "Rejected", count: counts?.rejected },
    { value: "revoked", label: "Revoked", count: counts?.revoked },
    { value: "all", label: "All" },
  ];

  const renderBody = () => {
    if (isFetching && !data) {
      return (
        <div className={styles.list}>
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} style={{ height: "16rem", width: "100%", borderRadius: "var(--radius-md)" }} />
          ))}
        </div>
      );
    }
    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load applications"
          description={error instanceof Error ? error.message : "Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }
    if (!data || data.applications.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<Video size={24} />}
          title={status === "pending" ? "No applications waiting" : "Nothing here"}
          description={
            status === "pending"
              ? "Teachers who apply for 1:1 sessions and group classes show up here."
              : "No application has this status."
          }
        />
      );
    }
    return (
      <div className={styles.list}>
        {data.applications.map((a) => (
          <ApplicationCard key={a.id} application={a} />
        ))}
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Live teaching applications - Testkart Admin</title>
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader
          title="Live teaching applications"
          description="Approve teachers before they can take 1:1 bookings or create group classes."
        />
        <ConsoleListToolbar
          tabs={tabs}
          value={status}
          onValueChange={(value) => write({ status: value === "pending" ? null : value })}
          tabsLabel="Application status"
        />
        {renderBody()}
      </div>
    </>
  );
};

export default AdminLiveTeachingPage;
