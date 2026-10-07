import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, Ban, CheckCircle, ExternalLink, Gift, Undo2 } from "lucide-react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { useAdminBonusClaimsQuery, useAdminBonusDecision } from "../helpers/useAdminBonusClaims";
import {
  CAMPAIGN_CONTENT_NOUNS,
  CLAIM_STATUS_LABELS,
  campaignProgress,
  formatRupees,
  videoReasonText,
  type CampaignCriteria,
  type CampaignRequirements,
} from "../helpers/teacherCampaignRules";
import type { BonusClaimAdminView, BonusClaimFilter } from "../endpoints/admin/content-reviews/bonus-claims_GET.schema";
import styles from "./admin.content-reviews.bonus-claims.module.css";

type Decision = { claim: BonusClaimAdminView; action: "credit" | "decline" | "reverse" };

const formatDate = (date: Date | null) =>
  date ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date)) : "-";

const reviewLabel = (claim: BonusClaimAdminView) => {
  if (claim.status !== "claimed") return null;
  if (claim.reviewStatus === "approved") return claim.live ? "Approved and live" : "Approved, not live now";
  if (claim.reviewStatus === "pending" || claim.reviewStatus === "senior_review") return "Still in content review";
  return "Review closed";
};

const CriteriaLine = ({ label, criteria, claim }: { label: string; criteria: CampaignCriteria; claim: BonusClaimAdminView }) => (
  <div className={styles.criteria}>
    <span className={styles.criteriaLabel}>{label}</span>
    <span className={styles.criteriaValues}>
      {campaignProgress(criteria, claim.requirements).map((p) => (
        <span key={p.label} className={p.have >= p.need ? styles.met : styles.unmet}>
          {p.have.toLocaleString("en-IN")} {p.label}
          <span className={styles.need}> / {p.need}</span>
        </span>
      ))}
    </span>
  </div>
);

const LessonList = ({ criteria, requirements }: { criteria: CampaignCriteria; requirements: CampaignRequirements }) => {
  if (criteria.kind !== "course" || criteria.lessons.length === 0) return null;
  const unverified = criteria.lessons.filter((l) => l.counted && l.recordedMinutes == null).length;
  return (
    <details className={styles.lessons}>
      <summary>
        Video lessons: {criteria.videos} of {criteria.lessons.length} count
        {unverified > 0 ? `, ${unverified} with no recorded length` : ""}
      </summary>
      <ol>
        {criteria.lessons.map((lesson, i) => (
          <li key={i} className={lesson.counted ? undefined : styles.lessonOut}>
            <span className={styles.lessonTitle}>
              {lesson.url ? (
                <a href={lesson.url} target="_blank" rel="noopener noreferrer">
                  {lesson.title}
                </a>
              ) : (
                lesson.title
              )}
              <span className={styles.lessonWhy}>
                {lesson.counted
                  ? lesson.recordedMinutes == null
                    ? "Counts, length typed by the teacher"
                    : "Counts"
                  : lesson.reason
                    ? videoReasonText(lesson.reason, requirements.minMinutesPerVideo)
                    : "Does not count"}
              </span>
            </span>
            <span className={styles.lessonMinutes}>
              {lesson.typedMinutes ?? lesson.minutes} min typed
              {lesson.recordedMinutes != null ? ` · ${lesson.recordedMinutes} min recorded` : ""}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
};

const AdminBonusClaimsPage: React.FC = () => {
  const [status, setStatus] = useState<BonusClaimFilter>("claimed");
  const [page, setPage] = useState(1);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const { data, isFetching, isError, error, refetch } = useAdminBonusClaimsQuery({ status, page });
  const decide = useAdminBonusDecision();

  const open = (claim: BonusClaimAdminView, action: Decision["action"]) => {
    setNote("");
    setDecision({ claim, action });
  };

  const confirm = () => {
    if (!decision) return;
    decide.mutate(
      { claimId: decision.claim.id, action: decision.action, note: note.trim() || undefined },
      { onSuccess: () => setDecision(null) }
    );
  };

  const counts = data?.counts;
  const tabs: { value: BonusClaimFilter; label: string; count?: number }[] = [
    { value: "claimed", label: "Waiting", count: counts?.claimed },
    { value: "credited", label: "Credited", count: counts?.credited },
    { value: "declined", label: "Not selected", count: counts?.declined },
    { value: "reversed", label: "Reversed", count: counts?.reversed },
    { value: "withdrawn", label: "Withdrawn" },
    { value: "all", label: "All" },
  ];

  const claims = data?.claims ?? [];
  const dialogCopy = decision
    ? {
        credit: {
          title: `Credit ${formatRupees(decision.claim.amount)} to ${decision.claim.teacherName}?`,
          description: `It is added to their wallet balance at once and they are emailed. Credit only high quality work.`,
          confirmLabel: "Credit bonus",
        },
        decline: {
          title: "Decline this bonus?",
          description: `"${decision.claim.contentTitle}" stays live. The teacher can improve it and claim once more with its next submission.`,
          confirmLabel: "Decline bonus",
        },
        reverse: {
          title: `Take back ${formatRupees(decision.claim.amount)}?`,
          description: "It comes off the teacher's balance at once. If they already withdrew it, their balance goes below zero and blocks payouts until new earnings cover it. This item cannot claim again.",
          confirmLabel: "Reverse bonus",
        },
      }[decision.action]
    : null;

  return (
    <>
      <Helmet>
        <title>Creator Bonus claims - Testkart Admin</title>
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Creator Bonus claims">
          <Button variant="outline" asChild>
            <Link to="/admin/content-reviews">
              <ArrowLeft size={16} />
              Content reviews
            </Link>
          </Button>
        </ConsolePageHeader>

        <section className={styles.intro} aria-label="How the Creator Bonus works">
          <span className={styles.introIcon} aria-hidden="true">
            <Gift size={20} />
          </span>
          <p>
            Teachers claim the bonus when they submit a test series or course for review. Approving the content does
            not pay it. Credit it here, or with "Approve and credit" in the review queue, only for high quality work.
            {data ? <strong> {formatRupees(data.creditedTotal)} credited so far.</strong> : null}
          </p>
        </section>

        <ConsoleListToolbar
          tabs={tabs}
          value={status}
          onValueChange={(v) => {
            setStatus(v as BonusClaimFilter);
            setPage(1);
          }}
          tabsLabel="Claim status"
        />

        {isError ? (
          <ConsoleListEmpty
            tone="error"
            icon={<AlertCircle size={24} />}
            title="Could not load the claims"
            description={error instanceof Error ? error.message : "Try again."}
          >
            <Button variant="outline" onClick={() => refetch()}>Try again</Button>
          </ConsoleListEmpty>
        ) : isFetching && !data ? (
          <div className={styles.list} aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} style={{ height: "9rem", borderRadius: "1rem" }} />
            ))}
          </div>
        ) : claims.length === 0 ? (
          <ConsoleListEmpty
            icon={<Gift size={24} />}
            title={status === "claimed" ? "No claims waiting" : "Nothing here yet"}
            description={
              status === "claimed"
                ? "Claims appear here when a teacher submits a test series or course with the Creator Bonus ticked."
                : "Claims with this status will be listed here."
            }
          />
        ) : (
          <ul className={styles.list}>
            {claims.map((claim) => {
              const label = reviewLabel(claim);
              const canCredit = claim.status === "claimed" && claim.reviewStatus === "approved" && claim.live && claim.meetsNow !== false;
              return (
                <li key={claim.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <div className={styles.cardTitleBlock}>
                      <span className={styles.kind}>{CAMPAIGN_CONTENT_NOUNS[claim.contentType]}</span>
                      <h2 className={styles.cardTitle}>{claim.contentTitle}</h2>
                      <p className={styles.cardMeta}>
                        {claim.teacherName}
                        {claim.teacherEmail ? ` · ${claim.teacherEmail}` : ""} · claimed {formatDate(claim.createdAt)}
                      </p>
                    </div>
                    <div className={styles.amountBlock}>
                      <span className={styles.amount}>{formatRupees(claim.amount)}</span>
                      <span className={`${styles.status} ${styles[`status_${claim.status}`]}`}>
                        {CLAIM_STATUS_LABELS[claim.status]}
                      </span>
                    </div>
                  </div>

                  <div className={styles.facts}>
                    {label && <span className={styles.fact}>{label}</span>}
                    <span className={styles.fact}>
                      {claim.slots.credited} of {claim.slots.limit} {CAMPAIGN_CONTENT_NOUNS[claim.contentType]} bonuses credited
                    </span>
                    {claim.decidedByName && claim.status !== "claimed" && (
                      <span className={styles.fact}>
                        By {claim.decidedByName} on {formatDate(claim.reversedAt ?? claim.decidedAt)}
                      </span>
                    )}
                  </div>

                  <CriteriaLine label="At claim" criteria={claim.criteriaAtClaim} claim={claim} />
                  {claim.criteriaNow && <CriteriaLine label="Now" criteria={claim.criteriaNow} claim={claim} />}
                  <LessonList criteria={claim.criteriaNow ?? claim.criteriaAtClaim} requirements={claim.requirements} />

                  {(claim.decisionNote || claim.reverseReason) && claim.status !== "claimed" && (
                    <p className={styles.note}>{claim.reverseReason ?? claim.decisionNote}</p>
                  )}

                  <div className={styles.actions}>
                    <Button variant="ghost" asChild>
                      <Link to={`/admin/preview/${claim.contentType}/${claim.contentId}?from=reviews`}>
                        <ExternalLink size={16} />
                        Open content
                      </Link>
                    </Button>
                    {claim.status === "claimed" && (
                      <>
                        <Button variant="outline" onClick={() => open(claim, "decline")} disabled={decide.isPending}>
                          <Ban size={16} />
                          Decline
                        </Button>
                        <Button
                          variant="primary"
                          onClick={() => open(claim, "credit")}
                          disabled={decide.isPending || !canCredit}
                          title={canCredit ? undefined : "Approve the content first, and it must still be live and meet the rules"}
                        >
                          <CheckCircle size={16} />
                          Credit {formatRupees(claim.amount)}
                        </Button>
                      </>
                    )}
                    {claim.status === "credited" && (
                      <Button variant="outline" onClick={() => open(claim, "reverse")} disabled={decide.isPending}>
                        <Undo2 size={16} />
                        Reverse
                      </Button>
                    )}
                  </div>
                  {claim.status === "claimed" && !canCredit && (
                    <p className={styles.blocked}>
                      {claim.reviewStatus !== "approved"
                        ? "Approve the content in the review queue before crediting."
                        : !claim.live
                          ? "The teacher took this item off the site, so it cannot be credited now."
                          : "It no longer meets the size rules, so it cannot be credited now."}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {data && data.totalPages > 1 && (
          <ConsoleListPagination page={data.currentPage} totalPages={data.totalPages} onPageChange={setPage} />
        )}
      </div>

      <ConsoleConfirmDialog
        open={!!decision}
        onOpenChange={(o) => !o && setDecision(null)}
        icon={decision?.action === "credit" ? <Gift size={20} /> : undefined}
        tone={decision?.action === "reverse" ? "destructive" : "default"}
        title={dialogCopy?.title ?? ""}
        description={dialogCopy?.description}
        confirmLabel={dialogCopy?.confirmLabel ?? "Confirm"}
        pendingLabel="Saving..."
        isPending={decide.isPending}
        onConfirm={confirm}
        note={
          decision && decision.action !== "credit"
            ? {
                label: decision.action === "decline" ? "Why it was not selected" : "Why it is being reversed",
                value: note,
                onChange: setNote,
                required: true,
                hint: "The teacher sees this in the email.",
              }
            : undefined
        }
      />
    </>
  );
};

export default AdminBonusClaimsPage;