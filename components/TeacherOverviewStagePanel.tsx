import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import type { OutputType } from "../endpoints/teacher/dashboard/overview_GET.schema";
import type { TeacherStage } from "../helpers/teacherStage";
import { publishedCount, teacherStageSteps } from "../helpers/teacherStage";
import {
  TEACHER_CONTENT_KINDS,
  teacherContentEditPath,
  teacherContentKind,
  type TeacherContentKind,
} from "../helpers/teacherContentKinds";
import { adminFormat } from "../helpers/adminFormat";
import { TeacherKindTile } from "./TeacherKindTile";
import { contentToneClass } from "./TeacherConsoleTheme";
import { useTeacherCreateChooser } from "./TeacherCreateChooser";
import styles from "./TeacherOverviewStagePanel.module.css";

type Props = {
  stage: Exclude<TeacherStage, "selling">;
  data: OutputType;
  /** The owner's public profile slug; null for managers, whose own record is not the academy's page. */
  profileSlug: string | null;
};

type Action = { label: string; to?: string; onClick?: () => void; icon?: React.ReactNode };

type StageCopy = {
  headline: string;
  /** One short line at most; the reviewer's note is the only longer text. */
  line?: string;
  note?: string;
  primary: Action;
  secondary?: Action;
  kind?: TeacherContentKind;
};

const relativeDays = (at: Date) => {
  const days = Math.floor((Date.now() - new Date(at).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
};

/* A bundle needs two published items, so a teacher with nothing yet is not offered one. */
const FIRST_KINDS = TEACHER_CONTENT_KINDS.filter((meta) => meta.kind !== "bundle");

const FirstItemTiles = ({ suggested }: { suggested: TeacherContentKind }) => {
  const ordered = [...FIRST_KINDS].sort((a, b) => Number(b.kind === suggested) - Number(a.kind === suggested));
  return (
    <ul className={styles.tiles}>
      {ordered.map((meta) => (
        <li key={meta.kind}>
          <Link to={meta.createPath} className={`${styles.tile} ${contentToneClass(meta.kind)}`}>
            <TeacherKindTile kind={meta.kind} size="lg" />
            <span className={styles.tileLabel}>{meta.label}</span>
            <span className={styles.tileHint}>{meta.hint}</span>
            {meta.kind === suggested && <span className={styles.tilePick}>Your pick</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
};

/** The Overview's one bold element: where the teacher is, and the single next step. */
export const TeacherOverviewStagePanel = ({ stage, data, profileSlug }: Props) => {
  const { openChooser } = useTeacherCreateChooser();
  const [copied, setCopied] = useState(false);
  const steps = teacherStageSteps(data);
  const createNew: Action = { label: "Create new", onClick: openChooser };

  const copyProfileLink = async () => {
    if (!profileSlug) return;
    const url = `${window.location.origin}/expert/${profileSlug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Profile link copied");
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error(`Copy this link: ${url}`);
    }
  };

  const copy = ((): StageCopy | null => {
    switch (stage) {
      case "start":
        return null;
      case "drafting": {
        const draft = data.lastDraft;
        if (!draft) {
          return {
            headline: "Finish your draft",
            primary: { label: "Open drafts", to: teacherContentKind(data.firstContentType).listPath },
            secondary: createNew,
          };
        }
        return {
          headline: `Finish ${draft.title}`,
          line: `Last edited ${relativeDays(draft.at)}`,
          primary: { label: "Continue", to: teacherContentEditPath(draft.kind, draft.id) },
          secondary: createNew,
          kind: draft.kind,
        };
      }
      case "review": {
        const sentBack = data.rejected[0];
        if (sentBack) {
          return {
            headline: `Fix ${sentBack.title}`,
            note: sentBack.note ?? undefined,
            primary: { label: "Fix and resubmit", to: teacherContentEditPath(sentBack.kind, sentBack.id) },
            secondary: createNew,
            kind: sentBack.kind,
          };
        }
        const waiting = data.inReview[0];
        return {
          headline: waiting ? `${waiting.title} is in review` : "Your listing is in review",
          line: "We will email you once it is live",
          primary: { label: "Create another", onClick: openChooser },
          kind: waiting?.kind,
        };
      }
      case "live": {
        const live = publishedCount(data.totals);
        return {
          headline: "You are live. Get your first student",
          line: `${adminFormat.count(live)} ${live === 1 ? "listing" : "listings"} live`,
          primary: profileSlug
            ? {
                label: copied ? "Copied" : "Copy profile link",
                onClick: copyProfileLink,
                icon: copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />,
              }
            : { label: "Make a promo code", to: "/teacher/promo-codes" },
          secondary: profileSlug ? { label: "Promo code", to: "/teacher/promo-codes" } : createNew,
        };
      }
      case "learners": {
        const students = data.totals.students;
        return {
          headline: "Add a paid listing",
          line: `${adminFormat.count(students)} ${students === 1 ? "student" : "students"}, no sales yet`,
          primary: { label: "Create paid listing", onClick: openChooser },
          secondary: { label: "Students", to: "/teacher/students" },
        };
      }
    }
  })();

  const renderAction = (action: Action, className: string, withArrow = false) => {
    const content = (
      <>
        {action.icon}
        {action.label}
        {withArrow && !action.icon && <ArrowRight size={18} aria-hidden="true" />}
      </>
    );
    return action.to ? (
      <Link to={action.to} className={className}>
        {content}
      </Link>
    ) : (
      <button type="button" className={className} onClick={action.onClick}>
        {content}
      </button>
    );
  };

  const currentIndex = steps.findIndex((step) => !step.done);

  return (
    <section className={styles.panel} aria-labelledby="teacher-stage-headline">
      <ol className={styles.track} aria-label="Your progress">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className={`${styles.step} ${step.done ? styles.stepDone : ""} ${index === currentIndex ? styles.stepCurrent : ""}`}
            aria-current={index === currentIndex ? "step" : undefined}
          >
            <span className={styles.stepMark} aria-hidden="true">
              {step.done ? <Check size={14} strokeWidth={3} /> : index + 1}
            </span>
            <span className={styles.stepLabel}>
              {step.label}
              <span className={styles.visuallyHidden}>{step.done ? ", done" : ""}</span>
            </span>
          </li>
        ))}
      </ol>

      {copy === null ? (
        <>
          <h2 id="teacher-stage-headline" className={styles.headline}>
            What will you make first?
          </h2>
          <FirstItemTiles suggested={data.firstContentType} />
        </>
      ) : (
        <div className={styles.row}>
          <div className={styles.body}>
            <h2 id="teacher-stage-headline" className={styles.headline}>
              {copy.headline}
            </h2>
            {copy.line && <p className={styles.line}>{copy.line}</p>}
            {copy.note && (
              <p className={styles.note}>
                <span className={styles.noteLabel}>Reviewer: </span>
                {copy.note}
              </p>
            )}
            <div className={styles.actions}>
              {renderAction(copy.primary, styles.primary, true)}
              {copy.secondary && renderAction(copy.secondary, styles.secondary)}
            </div>
          </div>
          {copy.kind && <TeacherKindTile kind={copy.kind} size="lg" className={styles.kindTile} />}
        </div>
      )}
    </section>
  );
};
