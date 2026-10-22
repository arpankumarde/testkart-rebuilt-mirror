import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, Gift, Newspaper, Pencil, Play, Plus, Square } from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/Dialog";
import { useDebounce } from "../helpers/useDebounce";
import { useAdminExamCampaignSave, useAdminExamCampaignsQuery, useAdminExamSearchQuery } from "../helpers/useAdminExamBonus";
import { EXAM_BONUS_DEFAULTS, examBonusTitle, formatRupees } from "../helpers/teacherCampaignRules";
import type {
  ExamCampaignAdminView,
  ExamCampaignSuggestion,
} from "../endpoints/admin/content-reviews/exam-campaigns_GET.schema";
import styles from "./admin.content-reviews.exam-bonus.module.css";

type PickedExam = { id: number; name: string };
type StartDraft = { mode: "start"; exam: PickedExam | null; newsPostId: number | null; newsTitle: string | null };
type EditDraft = { mode: "edit"; campaign: ExamCampaignAdminView };
type Draft = StartDraft | EditDraft;

const NEW_DRAFT: StartDraft = { mode: "start", exam: null, newsPostId: null, newsTitle: null };

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));

/** yyyy-mm-dd of a moment in India, for a date input. */
const toDateInput = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(date));

/** The end of that day in India. */
const fromDateInput = (value: string) => new Date(`${value}T23:59:59+05:30`);

const NumberField = ({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) => (
  <div className={styles.field}>
    <label htmlFor={id} className={styles.label}>
      {label}
    </label>
    <Input id={id} type="number" min={1} value={value} onChange={(event) => onChange(event.target.value)} />
    {hint && <p className={styles.hint}>{hint}</p>}
  </div>
);

const ExamPicker = ({ onPick }: { onPick: (exam: PickedExam) => void }) => {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search.trim(), 250);
  const { data, isFetching } = useAdminExamSearchQuery(debounced);
  const exams = debounced.length >= 2 ? (data?.exams ?? []) : [];
  return (
    <div className={styles.field}>
      <label htmlFor="exam-bonus-exam" className={styles.label}>
        Exam
      </label>
      <Input
        id="exam-bonus-exam"
        value={search}
        placeholder="Search for an exam"
        autoComplete="off"
        onChange={(event) => setSearch(event.target.value)}
      />
      {exams.length > 0 && (
        <ul className={styles.examResults}>
          {exams.map((exam) => (
            <li key={exam.id}>
              <button type="button" className={styles.examResult} onClick={() => onPick({ id: exam.id, name: exam.examName })}>
                <span className={styles.examResultName}>{exam.examName}</span>
                {exam.categoryName && <span className={styles.hint}>{exam.categoryName}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {debounced.length >= 2 && exams.length === 0 && !isFetching && <p className={styles.hint}>No exam found.</p>}
    </div>
  );
};

const CampaignDialog = ({ draft, onClose }: { draft: Draft; onClose: () => void }) => {
  const save = useAdminExamCampaignSave();
  const editing = draft.mode === "edit" ? draft.campaign : null;
  const [exam, setExam] = useState<PickedExam | null>(draft.mode === "start" ? draft.exam : null);
  const [totalSlots, setTotalSlots] = useState(String(editing?.totalSlots ?? EXAM_BONUS_DEFAULTS.totalSlots));
  const [amount, setAmount] = useState(String(editing?.amount ?? EXAM_BONUS_DEFAULTS.amount));
  const [perTeacher, setPerTeacher] = useState(String(editing?.perTeacher ?? EXAM_BONUS_DEFAULTS.maxPerTeacher));
  const [days, setDays] = useState(String(EXAM_BONUS_DEFAULTS.days));
  const [minTests, setMinTests] = useState(String(EXAM_BONUS_DEFAULTS.minTests));
  const [minQuestions, setMinQuestions] = useState(String(EXAM_BONUS_DEFAULTS.minQuestions));
  const [endDate, setEndDate] = useState(editing ? toDateInput(editing.endsAt) : "");

  const numbers = [totalSlots, amount, perTeacher, ...(editing ? [] : [days, minTests, minQuestions])].map(Number);
  const numbersValid = numbers.every((n) => Number.isFinite(n) && n > 0);
  const canSave = numbersValid && (editing ? !!endDate : !!exam);
  const most = Number(totalSlots) * Number(amount);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    const limits = { totalSlots: Number(totalSlots), amount: Number(amount), perTeacher: Number(perTeacher) };
    const input =
      draft.mode === "edit"
        ? { action: "edit" as const, id: draft.campaign.id, ...limits, endsAt: fromDateInput(endDate) }
        : {
            action: "start" as const,
            examId: exam!.id,
            examNewsPostId: draft.newsPostId,
            days: Number(days),
            minTests: Number(minTests),
            minQuestions: Number(minQuestions),
            ...limits,
          };
    save.mutate(input, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={styles.dialog}>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit the ${editing.title}` : "Start an Exam Bonus"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Claims already made keep the amount they were made at."
              : "Teachers see it as soon as you start it, with the slot count live."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className={styles.form}>
          {!editing &&
            (exam ? (
              <div className={styles.field}>
                <span className={styles.label}>Exam</span>
                <div className={styles.pickedExam}>
                  <span className={styles.examResultName}>{exam.name}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setExam(null)}>
                    Change
                  </Button>
                </div>
                <p className={styles.hint}>
                  Teachers must tag their series with this exact exam. If the same exam is listed twice, pick the one
                  teachers use.
                </p>
              </div>
            ) : (
              <ExamPicker onPick={setExam} />
            ))}
          {draft.mode === "start" && draft.newsTitle && <p className={styles.hint}>News: {draft.newsTitle}</p>}

          <div className={styles.fields}>
            <NumberField id="exam-bonus-slots" label="Slots" value={totalSlots} onChange={setTotalSlots} hint="Shared by all teachers" />
            <NumberField id="exam-bonus-amount" label="Amount (Rs)" value={amount} onChange={setAmount} hint="Per test series" />
            <NumberField id="exam-bonus-per-teacher" label="Slots per teacher" value={perTeacher} onChange={setPerTeacher} />
            {editing ? (
              <div className={styles.field}>
                <label htmlFor="exam-bonus-end" className={styles.label}>
                  Ends on
                </label>
                <Input id="exam-bonus-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
            ) : (
              <>
                <NumberField id="exam-bonus-days" label="Runs for (days)" value={days} onChange={setDays} />
                <NumberField id="exam-bonus-tests" label="Minimum tests" value={minTests} onChange={setMinTests} />
                <NumberField id="exam-bonus-questions" label="Minimum questions" value={minQuestions} onChange={setMinQuestions} />
              </>
            )}
          </div>

          {numbersValid && (
            <p className={styles.payout}>
              <Gift size={16} aria-hidden="true" />
              Can pay up to {formatRupees(most)}. Nothing is paid until you credit a claim.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave || save.isPending}>
              {save.isPending ? "Saving..." : editing ? "Save changes" : "Start the bonus"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const NewsRow = ({ item, onStart }: { item: ExamCampaignSuggestion; onStart: () => void }) => (
  <li className={styles.card}>
    <div className={styles.cardMain}>
      <span className={styles.newsType}>{item.newsType.replace(/_/g, " ")}</span>
      <h3 className={styles.cardTitle}>{item.examName}</h3>
      <p className={styles.cardMeta}>{item.title}</p>
      <p className={styles.cardMeta}>
        {item.taggedSeries.toLocaleString("en-IN")} test series tagged · published {formatDate(item.publishedAt)}
      </p>
    </div>
    <Button onClick={onStart}>
      <Play size={16} />
      Start
    </Button>
  </li>
);

const CampaignRow = ({
  campaign,
  onEdit,
  onEnd,
}: {
  campaign: ExamCampaignAdminView;
  onEdit?: () => void;
  onEnd?: () => void;
}) => (
  <li className={styles.card}>
    <div className={styles.cardMain}>
      <h3 className={styles.cardTitle}>{campaign.title}</h3>
      {campaign.newsTitle && <p className={styles.cardMeta}>{campaign.newsTitle}</p>}
      <div className={styles.facts}>
        <span className={styles.factStrong}>
          {Math.max(0, campaign.totalSlots - campaign.taken)} of {campaign.totalSlots} slots left
        </span>
        <span className={styles.fact}>{campaign.waiting} waiting</span>
        <span className={styles.fact}>
          {campaign.credited} credited ({formatRupees(campaign.creditedAmount)})
        </span>
        <span className={styles.fact}>
          {formatRupees(campaign.amount)} each · up to {campaign.perTeacher} per teacher
        </span>
        <span className={styles.fact}>
          {campaign.minTests}+ tests, {campaign.minQuestions}+ questions
        </span>
        <span className={styles.fact}>
          {campaign.running ? "Ends" : "Ended"} {formatDate(campaign.endsAt)}
        </span>
      </div>
    </div>
    {(onEdit || onEnd) && (
      <div className={styles.actions}>
        <Button variant="outline" onClick={onEdit}>
          <Pencil size={16} />
          Edit
        </Button>
        <Button variant="outline" onClick={onEnd}>
          <Square size={16} />
          End now
        </Button>
      </div>
    )}
  </li>
);

const AdminExamBonusPage: React.FC = () => {
  const { data, isFetching, isError, error, refetch } = useAdminExamCampaignsQuery();
  const save = useAdminExamCampaignSave();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ending, setEnding] = useState<ExamCampaignAdminView | null>(null);

  const confirmEnd = () => {
    if (!ending) return;
    save.mutate({ action: "end", id: ending.id }, { onSuccess: () => setEnding(null) });
  };

  return (
    <>
      <Helmet>
        <title>Exam Bonus - Testkart Admin</title>
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Exam Bonus">
          <Button variant="outline" asChild>
            <Link to="/admin/content-reviews/bonus-claims">
              <ArrowLeft size={16} />
              Bonus claims
            </Link>
          </Button>
          <Button onClick={() => setDraft(NEW_DRAFT)}>
            <Plus size={16} />
            Start for any exam
          </Button>
        </ConsolePageHeader>

        <section className={styles.intro} aria-label="How the Exam Bonus works">
          <span className={styles.introIcon} aria-hidden="true">
            <Newspaper size={20} />
          </span>
          <p>
            Start a short campaign for an exam in the news. Teachers can claim it for a new test series tagged with that
            exam, even after using their Creator Bonus slots. A slot goes when a teacher submits. You still credit each
            claim from Bonus claims, only for high quality work.
          </p>
        </section>

        {isError ? (
          <ConsoleListEmpty
            tone="error"
            icon={<AlertCircle size={24} />}
            title="Could not load the Exam Bonus"
            description={error instanceof Error ? error.message : "Try again."}
          >
            <Button variant="outline" onClick={() => refetch()}>Try again</Button>
          </ConsoleListEmpty>
        ) : isFetching && !data ? (
          <div className={styles.list} aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} style={{ height: "7rem", borderRadius: "1rem" }} />
            ))}
          </div>
        ) : data ? (
          <>
            <section className={styles.section} aria-labelledby="exam-bonus-running">
              <h2 id="exam-bonus-running" className={styles.sectionTitle}>Running now</h2>
              {data.running.length === 0 ? (
                <p className={styles.quiet}>No Exam Bonus is running.</p>
              ) : (
                <ul className={styles.list}>
                  {data.running.map((campaign) => (
                    <CampaignRow
                      key={campaign.id}
                      campaign={campaign}
                      onEdit={() => setDraft({ mode: "edit", campaign })}
                      onEnd={() => setEnding(campaign)}
                    />
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.section} aria-labelledby="exam-bonus-news">
              <h2 id="exam-bonus-news" className={styles.sectionTitle}>Exams in the news</h2>
              <p className={styles.quiet}>Published exam news from the last 7 days, for exams with no bonus running.</p>
              {data.suggestions.length === 0 ? (
                <p className={styles.quiet}>Nothing to start right now.</p>
              ) : (
                <ul className={styles.list}>
                  {data.suggestions.map((item) => (
                    <NewsRow
                      key={item.postId}
                      item={item}
                      onStart={() =>
                        setDraft({
                          mode: "start",
                          exam: { id: item.examId, name: item.examName },
                          newsPostId: item.postId,
                          newsTitle: item.title,
                        })
                      }
                    />
                  ))}
                </ul>
              )}
            </section>

            {data.past.length > 0 && (
              <section className={styles.section} aria-labelledby="exam-bonus-past">
                <h2 id="exam-bonus-past" className={styles.sectionTitle}>Past campaigns</h2>
                <ul className={styles.list}>
                  {data.past.map((campaign) => (
                    <CampaignRow key={campaign.id} campaign={campaign} />
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : null}
      </div>

      {draft && (
        <CampaignDialog
          key={draft.mode === "edit" ? `edit-${draft.campaign.id}` : `start-${draft.exam?.id ?? "any"}`}
          draft={draft}
          onClose={() => setDraft(null)}
        />
      )}

      <ConsoleConfirmDialog
        open={!!ending}
        onOpenChange={(open) => !open && setEnding(null)}
        title={ending ? `End the ${ending.title} now?` : ""}
        description="Teachers can no longer claim it. Claims already waiting stay open, and you can still credit or decline them."
        confirmLabel="End now"
        pendingLabel="Ending..."
        isPending={save.isPending}
        onConfirm={confirmEnd}
      />
    </>
  );
};

export default AdminExamBonusPage;