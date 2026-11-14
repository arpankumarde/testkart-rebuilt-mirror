import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  IndianRupee,
  Lock,
  Mail,
  Pencil,
  Send,
  ShieldCheck,
  UserRound,
  Video,
} from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Skeleton } from "./Skeleton";
import { TeacherAvatarField } from "./TeacherAvatarField";
import { ProfileTagInput } from "./ProfileTagInput";
import { LanguageMultiPicker } from "./LanguageMultiPicker";
import { TeacherFormHeader } from "./TeacherFormHeader";
import { TeacherFlowSteps, type TeacherFlowStep } from "./TeacherFlowSteps";
import { LiveCard, FieldLabel, FieldHint, FieldError, StatusPill } from "./LiveField";
import { LivePriceEditor } from "./LivePriceEditor";
import { LiveHoursEditor } from "./LiveHoursEditor";
import { LiveIntroVideo, SampleIntroVideo } from "./LiveIntroVideo";
import { LiveDaysOff } from "./LiveDaysOff";
import { useAuth } from "../helpers/useAuth";
import { useUploadLimits } from "../helpers/useUploadLimits";
import { useTeacherProfileMutations } from "../helpers/useTeacherProfileMutations";
import {
  useSetAvailabilityMutation,
  useSetTeacherMentorshipRateMutation,
  useTeacherAvailabilityQuery,
  useTeacherMentorshipRateQuery,
} from "../helpers/useTeacherMentorship";
import { useApplyLiveTeachingMutation, useSaveLiveTeachingContactMutation } from "../helpers/useLiveTeaching";
import {
  canApplyFromStatus,
  LIVE_TEACHING_HEADLINE_MAX,
  LIVE_TEACHING_MIN_BIO_CHARS,
  type LiveTeachingChecklistKey,
} from "../helpers/liveTeachingRules";
import {
  LIVE_APPLY_STEPS as STEPS,
  checklistDone,
  DAY_NAMES,
  DAY_ORDER,
  KEY_MINUTES,
  KEY_NAME,
  PRICE_KEYS,
  contactErrors,
  expertiseList,
  hoursProblem,
  hoursSnapshot,
  priceDraftFrom,
  priceFieldErrors,
  priceRulesFrom,
  priceSnapshot,
  priceValues,
  profileErrors,
  profileSnapshot,
  type ContactDraft,
  type HoursDraft,
  type PriceDraft,
  type ProfileDraft,
  type LiveApplyStep,
} from "../helpers/liveTeachingForms";
import { trialPriceFrom } from "../helpers/livePricing";
import type { OutputType as LiveStatus } from "../endpoints/teacher/live-teaching/status_GET.schema";
import field from "./LiveField.module.css";
import styles from "./LiveApplyWizard.module.css";

const isDone = (live: LiveStatus, keys: LiveTeachingChecklistKey[]) => checklistDone(live.checklist, keys);

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const EMPTY_PROFILE: ProfileDraft = {
  avatarUrl: "",
  avatarFileId: null,
  tagline: "",
  bio: "",
  expertiseAreas: [],
  languages: [],
};

/*
 * The live teaching application as a guided form: one topic per step, the
 * same step track as the test series and study notes creators, Back and
 * Continue at the foot. Continue checks the step and saves it, so nothing is
 * lost between visits, and every draft lives here so moving between steps
 * keeps what was typed. The last step reviews everything and submits.
 */
export const LiveApplyWizard: React.FC<{
  live: LiveStatus;
  step: LiveApplyStep;
  onStep: (step: LiveApplyStep) => void;
  onExit: () => void;
}> = ({ live, step, onStep, onExit }) => {
  const qc = useQueryClient();
  const { authState } = useAuth();
  const user = authState.type === "authenticated" ? authState.user : null;
  const isOwner = live.isOwner;
  const limits = useUploadLimits();

  const rateQuery = useTeacherMentorshipRateQuery();
  const hoursQuery = useTeacherAvailabilityQuery();
  const { useUpdateProfileMutation } = useTeacherProfileMutations();
  const saveProfile = useUpdateProfileMutation();
  const saveContact = useSaveLiveTeachingContactMutation();
  const saveRate = useSetTeacherMentorshipRateMutation();
  const saveHours = useSetAvailabilityMutation();
  const apply = useApplyLiveTeachingMutation();

  const lockedEmail = !!live.contact.email;
  const lockedPhone = !!live.contact.mobileNumber;
  const [contact, setContact] = useState<ContactDraft>({
    email: live.contact.email ?? "",
    mobileNumber: live.contact.mobileNumber ?? "",
  });

  const extraSubjects = (user?.teachingCategories ?? []).length;
  const [profileDraft, setProfileDraft] = useState<ProfileDraft | null>(null);
  const profile = profileDraft ?? EMPTY_PROFILE;
  const setProfile = (update: (p: ProfileDraft) => ProfileDraft) =>
    setProfileDraft((prev) => update(prev ?? EMPTY_PROFILE));
  const profileBase = useRef<string | null>(null);
  // The signed-in user can arrive after the form mounts; prefill once it does.
  useEffect(() => {
    if (profileDraft || !user) return;
    const draft: ProfileDraft = {
      avatarUrl: user.avatarUrl ?? "",
      avatarFileId: user.avatarFileId ?? null,
      tagline: user.tagline ?? "",
      bio: user.bio ?? "",
      expertiseAreas: expertiseList(user.expertiseAreas),
      languages: user.languages ?? [],
    };
    profileBase.current = profileSnapshot(draft);
    setProfileDraft(draft);
  }, [user, profileDraft]);

  const [prices, setPrices] = useState<PriceDraft | null>(null);
  const priceBase = useRef<string | null>(null);
  useEffect(() => {
    if (prices || !rateQuery.data) return;
    const draft = priceDraftFrom(rateQuery.data);
    priceBase.current = priceSnapshot(draft);
    setPrices(draft);
  }, [rateQuery.data, prices]);

  const [hours, setHours] = useState<HoursDraft | null>(null);
  const hoursBase = useRef<string | null>(null);
  useEffect(() => {
    if (hours || !hoursQuery.data) return;
    const draft = { timezone: hoursQuery.data.timezone, windows: hoursQuery.data.windows };
    hoursBase.current = hoursSnapshot(draft);
    setHours(draft);
  }, [hoursQuery.data, hours]);

  const [showErrors, setShowErrors] = useState<Partial<Record<LiveApplyStep, boolean>>>({});
  const [focusTick, setFocusTick] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const index = STEPS.findIndex((s) => s.key === step);
  const meta = STEPS[index];
  const rules = priceRulesFrom(rateQuery.data);
  const doneCount = live.checklist.filter((item) => item.done).length;
  const total = live.checklist.length;
  const ready = doneCount === total;
  const canSubmit = canApplyFromStatus(live.status) && isOwner;
  const busy = saveProfile.isPending || saveContact.isPending || saveRate.isPending || saveHours.isPending || apply.isPending;

  useEffect(() => {
    setVideoError(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    if (!focusTick) return;
    const invalid = bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]');
    invalid?.scrollIntoView({ block: "center" });
    if (invalid?.matches("input, textarea")) invalid.focus({ preventScroll: true });
  }, [focusTick]);

  const refreshStatus = () => qc.invalidateQueries({ queryKey: ["teacher", "live-teaching", "status"] });

  const fail = (key: LiveApplyStep) => {
    setShowErrors((prev) => ({ ...prev, [key]: true }));
    setFocusTick((n) => n + 1);
  };

  const goTo = (target: LiveApplyStep) => {
    if (busy) return;
    onStep(target);
  };
  const next = () => onStep(STEPS[Math.min(index + 1, STEPS.length - 1)].key);
  const back = () => (index === 0 ? onExit() : onStep(STEPS[index - 1].key));

  const continueContact = () => {
    if (!isOwner) return next();
    const errors = contactErrors(contact);
    if ((!lockedEmail && errors.email) || (!lockedPhone && errors.mobileNumber)) return fail("contact");
    const payload = {
      ...(lockedEmail ? {} : { email: contact.email.trim() }),
      ...(lockedPhone ? {} : { mobileNumber: contact.mobileNumber.trim() }),
    };
    if (Object.keys(payload).length === 0) return next();
    saveContact.mutate(payload, {
      onSuccess: () => {
        toast.success("Contact details saved.");
        next();
      },
      onError: (err) => toast.error(errorMessage(err, "Could not save your contact details.")),
    });
  };

  const continueProfile = () => {
    if (!isOwner) return next();
    if (!profileDraft) return;
    const errors = profileErrors(profile, extraSubjects);
    if (Object.values(errors).some(Boolean)) return fail("profile");
    const snapshot = profileSnapshot(profile);
    if (snapshot === profileBase.current && isDone(live, STEPS[1].items)) return next();
    saveProfile.mutate(
      {
        avatarUrl: profile.avatarUrl,
        avatarFileId: profile.avatarFileId,
        tagline: profile.tagline.trim(),
        bio: profile.bio.trim(),
        expertiseAreas: profile.expertiseAreas,
        languages: profile.languages,
      },
      {
        onSuccess: () => {
          profileBase.current = snapshot;
          refreshStatus();
          toast.success("Profile saved.");
          next();
        },
        onError: (err) => toast.error(errorMessage(err, "Could not save your profile.")),
      }
    );
  };

  const continuePrices = () => {
    if (!prices) return;
    if (!isOwner) return next();
    if (Object.values(priceFieldErrors(prices, rules)).some(Boolean)) return fail("prices");
    const snapshot = priceSnapshot(prices);
    if (snapshot === priceBase.current && isDone(live, ["rate"])) return next();
    saveRate.mutate(
      { enabled: false, prices: { ...priceValues(prices), trialDiscount: prices.trialDiscount } },
      {
        onSuccess: () => {
          priceBase.current = snapshot;
          toast.success("Prices saved.");
          next();
        },
        onError: (err) => toast.error(errorMessage(err, "Could not save your prices.")),
      }
    );
  };

  const continueHours = () => {
    if (!hours) return;
    const problem = hoursProblem(hours, true);
    if (problem) {
      toast.error(problem);
      return fail("hours");
    }
    const snapshot = hoursSnapshot(hours);
    if (snapshot === hoursBase.current && isDone(live, ["hours"])) return next();
    saveHours.mutate(
      {
        timezone: hours.timezone.trim(),
        windows: hours.windows.map((w) => ({
          dayOfWeek: w.dayOfWeek,
          startTime: w.startTime,
          endTime: w.endTime,
          isActive: w.isActive,
        })),
      },
      {
        onSuccess: () => {
          hoursBase.current = snapshot;
          toast.success("Weekly hours saved.");
          next();
        },
        onError: (err) => toast.error(errorMessage(err, "Could not save your hours.")),
      }
    );
  };

  const continueVideo = () => {
    if (!isDone(live, ["video"]) && isOwner) {
      setVideoError("Upload your intro video to continue.");
      setFocusTick((n) => n + 1);
      return;
    }
    next();
  };

  const submit = () => {
    if (!ready) {
      toast.error("Finish the items marked missing first.");
      return;
    }
    apply.mutate(undefined, {
      onSuccess: () => toast.success("Application submitted. We will email you after the review."),
      onError: (err) => toast.error(errorMessage(err, "Could not submit your application.")),
    });
  };

  const onContinue = () => {
    switch (step) {
      case "contact":
        return continueContact();
      case "profile":
        return continueProfile();
      case "prices":
        return continuePrices();
      case "hours":
        return continueHours();
      case "video":
        return continueVideo();
      case "review":
        return submit();
    }
  };

  const flowSteps: TeacherFlowStep[] = STEPS.map((s, i) => ({
    key: s.key,
    label: s.label,
    hint: s.hint,
    state: i === index ? "current" : s.items.length > 0 && isDone(live, s.items) ? "done" : "todo",
    onSelect: i === index ? undefined : () => goTo(s.key),
  }));

  const continueLabel =
    step === "review"
      ? apply.isPending
        ? "Submitting..."
        : live.status === "none" && !live.withdrawnAt
          ? "Submit application"
          : "Resubmit application"
      : busy
        ? "Saving..."
        : isOwner && ["contact", "profile", "prices", "hours"].includes(step)
          ? "Save and continue"
          : "Continue";
  const hideContinue = step === "review" && !canSubmit;

  return (
    <div className={styles.page}>
      <TeacherFormHeader
        onBack={onExit}
        backLabel="Application"
        title={live.status === "pending" ? "Your application" : "Apply to teach live"}
        subtitle={
          live.status === "pending"
            ? "In review. You can still change your prices, hours and video."
            : "Six short steps. Each one saves when you continue, so you can stop and pick up later."
        }
      />

      <TeacherFlowSteps label="Application steps" steps={flowSteps} />

      <div className={styles.layout}>
        <div className={styles.main} ref={bodyRef}>
          <p className={styles.stepCount}>
            Step {index + 1} of {STEPS.length}
          </p>
          <h2 className={styles.srOnly} ref={headingRef} tabIndex={-1}>
            {meta.label}
          </h2>

          {step === "contact" && (
            <LiveCard
              icon={<Mail size={18} />}
              tone="blue"
              title="How we reach you"
              hint="Our team uses these for your application and for booking alerts. Students never see them."
            >
              {!isOwner && <OwnerOnlyNote />}
              <div className={styles.fieldStack}>
                <div>
                  <FieldLabel htmlFor="apply-email" need="required">
                    Email address
                  </FieldLabel>
                  {lockedEmail ? (
                    <LockedValue value={live.contact.email ?? ""} />
                  ) : (
                    <Input
                      id="apply-email"
                      type="email"
                      autoComplete="email"
                      value={contact.email}
                      onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                      placeholder="you@example.com"
                      className={field.input}
                      disabled={!isOwner}
                      aria-invalid={(showErrors.contact && !!contactErrors(contact).email) || undefined}
                      aria-describedby="apply-email-hint"
                    />
                  )}
                  <FieldHint id="apply-email-hint">
                    {lockedEmail
                      ? "Saved on your account. Change it in Settings."
                      : "We send the result of your application here."}
                  </FieldHint>
                  {!lockedEmail && showErrors.contact && <FieldError message={contactErrors(contact).email} />}
                </div>

                <div>
                  <FieldLabel htmlFor="apply-phone" need="required">
                    Phone number
                  </FieldLabel>
                  {lockedPhone ? (
                    <LockedValue value={`+91 ${live.contact.mobileNumber ?? ""}`} />
                  ) : (
                    <div className={styles.phone}>
                      <span className={styles.phonePrefix} aria-hidden="true">
                        +91
                      </span>
                      <Input
                        id="apply-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        maxLength={10}
                        value={contact.mobileNumber}
                        onChange={(e) =>
                          setContact((c) => ({ ...c, mobileNumber: e.target.value.replace(/\D/g, "").slice(0, 10) }))
                        }
                        placeholder="98765 43210"
                        className={`${field.input} ${styles.phoneInput}`}
                        disabled={!isOwner}
                        aria-invalid={(showErrors.contact && !!contactErrors(contact).mobileNumber) || undefined}
                        aria-describedby="apply-phone-hint"
                      />
                    </div>
                  )}
                  <FieldHint id="apply-phone-hint">
                    {lockedPhone
                      ? "Saved on your account. Change it in Settings."
                      : "10-digit Indian mobile number. Our team may call about your application."}
                  </FieldHint>
                  {!lockedPhone && showErrors.contact && <FieldError message={contactErrors(contact).mobileNumber} />}
                </div>
              </div>
              <p className={styles.privacy}>
                <ShieldCheck size={16} aria-hidden="true" />
                Private to your account. Public contact details are set in your Profile.
              </p>
            </LiveCard>
          )}

          {step === "profile" &&
            (isOwner && !profileDraft ? (
              <Skeleton style={{ height: "28rem", width: "100%", borderRadius: "1.25rem" }} />
            ) : isOwner ? (
              <LiveCard
                icon={<UserRound size={18} />}
                tone="lavender"
                title="Your teaching profile"
                hint="Students decide from your profile, so these show on your public page. Already filled? Check and continue."
              >
                <div className={styles.fieldStack}>
                  <div>
                    <FieldLabel need="required">Profile photo</FieldLabel>
                    <TeacherAvatarField
                      avatarUrl={profile.avatarUrl}
                      avatarFileId={profile.avatarFileId}
                      displayName={user?.displayName}
                      maxSizeInMB={limits.profilePictureMaxMb}
                      onChange={(next) => setProfile((p) => ({ ...p, ...next }))}
                    />
                    {showErrors.profile && <FieldError message={profileErrors(profile, extraSubjects).avatarUrl} />}
                  </div>

                  <div>
                    <FieldLabel
                      htmlFor="apply-headline"
                      need="required"
                      counter={`${profile.tagline.length}/${LIVE_TEACHING_HEADLINE_MAX}`}
                    >
                      Headline
                    </FieldLabel>
                    <Input
                      id="apply-headline"
                      value={profile.tagline}
                      onChange={(e) => setProfile((p) => ({ ...p, tagline: e.target.value }))}
                      maxLength={LIVE_TEACHING_HEADLINE_MAX}
                      placeholder="e.g. SSC Maths made simple - 12 years, 40,000+ students"
                      className={field.input}
                      aria-invalid={(showErrors.profile && !!profileErrors(profile, extraSubjects).tagline) || undefined}
                    />
                    <FieldHint>One line under your name. Say who you help and how.</FieldHint>
                    {showErrors.profile && <FieldError message={profileErrors(profile, extraSubjects).tagline} />}
                  </div>

                  <div>
                    <FieldLabel
                      htmlFor="apply-bio"
                      need="required"
                      counter={
                        profile.bio.trim().length < LIVE_TEACHING_MIN_BIO_CHARS
                          ? `${profile.bio.trim().length}/${LIVE_TEACHING_MIN_BIO_CHARS}`
                          : `${profile.bio.trim().length} characters`
                      }
                    >
                      About you
                    </FieldLabel>
                    <Textarea
                      id="apply-bio"
                      rows={6}
                      value={profile.bio}
                      onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                      placeholder="What you teach, how long you have taught, and how a class with you goes."
                      className={field.input}
                      aria-invalid={(showErrors.profile && !!profileErrors(profile, extraSubjects).bio) || undefined}
                    />
                    <FieldHint>At least {LIVE_TEACHING_MIN_BIO_CHARS} characters.</FieldHint>
                    {showErrors.profile && <FieldError message={profileErrors(profile, extraSubjects).bio} />}
                  </div>

                  <div className={styles.fieldPair}>
                    <div>
                      <FieldLabel need="required">Subjects you teach</FieldLabel>
                      <ProfileTagInput
                        label="Subjects you teach"
                        value={profile.expertiseAreas}
                        onChange={(next) => setProfile((p) => ({ ...p, expertiseAreas: next }))}
                        placeholder="e.g. Quantitative Aptitude, then Enter"
                      />
                      <FieldHint>Press Enter or a comma after each one.</FieldHint>
                      {showErrors.profile && (
                        <FieldError message={profileErrors(profile, extraSubjects).expertiseAreas} />
                      )}
                    </div>
                    <div>
                      <FieldLabel need="required">Languages you teach in</FieldLabel>
                      <LanguageMultiPicker
                        value={profile.languages}
                        onChange={(next) => setProfile((p) => ({ ...p, languages: next }))}
                        placeholder="Add a language"
                      />
                      {showErrors.profile && <FieldError message={profileErrors(profile, extraSubjects).languages} />}
                    </div>
                  </div>
                </div>
              </LiveCard>
            ) : (
              <LiveCard icon={<UserRound size={18} />} tone="lavender" title="Your teaching profile">
                <OwnerOnlyNote />
                <ChecklistRows live={live} keys={STEPS[1].items} />
              </LiveCard>
            ))}

          {step === "prices" && (
            <LiveCard
              icon={<IndianRupee size={18} />}
              tone="peach"
              title="Set your 1:1 prices"
              hint="Students start with a trial, then take 1 to 6 classes a week, paid every 4 weeks. Bookings open only after approval."
            >
              {!isOwner && <OwnerOnlyNote />}
              {prices ? (
                <LivePriceEditor
                  value={prices}
                  onChange={setPrices}
                  rules={rules}
                  showErrors={!!showErrors.prices}
                  idPrefix="apply-price"
                />
              ) : (
                <Skeleton style={{ height: "14rem", width: "100%", borderRadius: "1rem" }} />
              )}
            </LiveCard>
          )}

          {step === "hours" && (
            <>
              <LiveCard
                icon={<CalendarClock size={18} />}
                tone="mint"
                title="Your weekly hours"
                hint="Add the times you can teach. Students pick a slot inside these hours."
              >
                {hours ? (
                  <LiveHoursEditor value={hours} onChange={setHours} idPrefix="apply-hours" />
                ) : (
                  <Skeleton style={{ height: "18rem", width: "100%", borderRadius: "1rem" }} />
                )}
                {showErrors.hours && hours && <FieldError message={hoursProblem(hours, true)} />}
              </LiveCard>
              <LiveCard
                icon={<CalendarX size={18} />}
                tone="butter"
                title="Days off"
                hint="Optional. No slots are offered on these dates. Each one saves at once."
              >
                <LiveDaysOff />
              </LiveCard>
            </>
          )}

          {step === "video" && (
            <LiveCard
              icon={<Video size={18} />}
              tone="sage"
              title="Record your intro video"
              hint="It plays at the top of the Learn live section on your profile. The strongest applications keep it short and warm."
            >
              <div className={styles.videoGrid}>
                <div className={styles.videoMain}>
                  <LiveIntroVideo live={live} />
                  <FieldError message={videoError} />
                </div>
                <div className={styles.videoAside}>
                  <p className={styles.asideLabel}>See an example</p>
                  <SampleIntroVideo caption="How an intro video plays on a teacher profile." />
                </div>
              </div>
            </LiveCard>
          )}

          {step === "review" && (
            <ReviewStep
              live={live}
              contact={contact}
              profile={profile}
              prices={prices}
              hours={hours}
              discountPercent={rules.discountPercent}
              onEdit={goTo}
            />
          )}

          <div className={styles.actionBar}>
            <Button variant="outline" onClick={back} disabled={busy}>
              <ArrowLeft size={16} aria-hidden="true" />
              {index === 0 ? "Overview" : "Back"}
            </Button>
            <span className={styles.actionNote}>
              {step === "review"
                ? ready
                  ? "Everything is in place."
                  : `${total - doneCount} ${total - doneCount === 1 ? "item" : "items"} missing`
                : `${doneCount} of ${total} ready`}
            </span>
            {!hideContinue && (
              <Button onClick={onContinue} disabled={busy || (step === "review" && !ready)}>
                {continueLabel}
                {step === "review" ? <Send size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
              </Button>
            )}
          </div>
        </div>

        <aside className={styles.aside} aria-label="Application progress">
          <div className={styles.progressCard}>
            <p className={styles.progressTitle}>Your progress</p>
            <div className={styles.progressTrack} aria-hidden="true">
              <span className={styles.progressFill} style={{ width: `${Math.round((doneCount / total) * 100)}%` }} />
            </div>
            <p className={styles.progressText}>
              {doneCount} of {total} ready
            </p>
            <ul className={styles.progressList}>
              {STEPS.filter((s) => s.items.length > 0).map((s) => {
                const done = isDone(live, s.items);
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      className={styles.progressItem}
                      data-done={done || undefined}
                      data-current={s.key === step || undefined}
                      onClick={() => goTo(s.key)}
                    >
                      {done ? <CheckCircle2 size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
                      <span>{s.label}</span>
                      <span className={styles.srOnly}>{done ? ", done" : ", to do"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className={styles.progressFoot}>Each step saves when you continue.</p>
          </div>
        </aside>
      </div>
    </div>
  );
};

const OwnerOnlyNote: React.FC = () => (
  <p className={styles.ownerNote}>
    <Lock size={15} aria-hidden="true" />
    Only the academy owner can change these and submit the application.
  </p>
);

const LockedValue: React.FC<{ value: string }> = ({ value }) => (
  <div className={styles.locked}>
    <span className={styles.lockedValue}>{value}</span>
    <StatusPill tone="mint">On your account</StatusPill>
  </div>
);

const ChecklistRows: React.FC<{ live: LiveStatus; keys: LiveTeachingChecklistKey[] }> = ({ live, keys }) => (
  <ul className={styles.checkRows}>
    {live.checklist
      .filter((item) => keys.includes(item.key))
      .map((item) => (
        <li key={item.key} className={styles.checkRow} data-done={item.done || undefined}>
          {item.done ? <CheckCircle2 size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
          <span>{item.label}</span>
          <span className={styles.checkState}>{item.done ? "Done" : "Missing"}</span>
        </li>
      ))}
  </ul>
);

const ReviewStep: React.FC<{
  live: LiveStatus;
  contact: ContactDraft;
  profile: ProfileDraft;
  prices: PriceDraft | null;
  hours: HoursDraft | null;
  discountPercent: Record<"classShort" | "classFull", number>;
  onEdit: (step: LiveApplyStep) => void;
}> = ({ live, contact, profile, prices, hours, discountPercent, onEdit }) => {
  const openDays = hours
    ? DAY_ORDER.filter((d) => hours.windows.some((w) => w.isActive && w.dayOfWeek === d)).map((d) =>
        DAY_NAMES[d].slice(0, 3)
      )
    : [];

  const section = (key: LiveApplyStep, title: string, children: React.ReactNode) => {
    const meta = STEPS.find((s) => s.key === key)!;
    const done = isDone(live, meta.items);
    return (
      <div className={styles.reviewSection}>
        <div className={styles.reviewHead}>
          <h3 className={styles.reviewTitle}>{title}</h3>
          <StatusPill tone={done ? "mint" : "peach"}>{done ? "Ready" : "Missing"}</StatusPill>
          <Button variant="ghost" size="sm" onClick={() => onEdit(key)} className={styles.reviewEdit}>
            <Pencil size={14} aria-hidden="true" />
            Edit<span className={styles.srOnly}> {title}</span>
          </Button>
        </div>
        {children}
        {!done && <ChecklistRows live={live} keys={meta.items.filter((k) => !live.checklist.find((i) => i.key === k)?.done)} />}
      </div>
    );
  };

  return (
    <LiveCard
      icon={<ClipboardCheck size={18} />}
      tone="peach"
      title="Review your application"
      hint="Check each part. Our team reviews it and emails you the result, usually within a few working days."
    >
      <div className={styles.review}>
        {section(
          "contact",
          "Contact",
          <dl className={styles.facts}>
            <dt>Email</dt>
            <dd>{live.contact.email || contact.email || "-"}</dd>
            <dt>Phone</dt>
            <dd>{live.contact.mobileNumber ? `+91 ${live.contact.mobileNumber}` : "-"}</dd>
          </dl>
        )}
        {section(
          "profile",
          "Profile",
          live.isOwner ? (
            <div className={styles.profileSummary}>
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className={styles.avatar} />
              ) : (
                <span className={styles.avatarEmpty} aria-hidden="true">
                  <UserRound size={20} />
                </span>
              )}
              <div className={styles.profileText}>
                <p className={styles.profileHeadline}>{profile.tagline || "No headline yet"}</p>
                <p className={styles.profileBio}>{profile.bio || "No bio yet"}</p>
                <div className={styles.chips}>
                  {[...profile.expertiseAreas, ...profile.languages].map((tag) => (
                    <span key={tag} className={styles.chip}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null
        )}
        {section(
          "prices",
          "Prices",
          prices ? (
            <dl className={styles.facts}>
              {PRICE_KEYS.map((key) => {
                const amount = Number(prices[key]);
                return (
                  <React.Fragment key={key}>
                    <dt>
                      {KEY_NAME[key]}, {KEY_MINUTES[key]} min
                    </dt>
                    <dd>
                      ₹{Number.isFinite(amount) ? amount.toLocaleString("en-IN") : "-"} a class, trial ₹
                      {Number.isFinite(amount)
                        ? trialPriceFrom(amount, KEY_MINUTES[key], prices.trialDiscount).toLocaleString("en-IN")
                        : "-"}
                      {prices.trialDiscount ? ` (${discountPercent[key]}% off)` : ""}
                    </dd>
                  </React.Fragment>
                );
              })}
            </dl>
          ) : null
        )}
        {section(
          "hours",
          "Weekly hours",
          hours ? (
            <dl className={styles.facts}>
              <dt>Timezone</dt>
              <dd>{hours.timezone}</dd>
              <dt>Open days</dt>
              <dd>{openDays.length ? openDays.join(", ") : "None yet"}</dd>
            </dl>
          ) : null
        )}
        {section(
          "video",
          "Intro video",
          live.introVideoUrl ? (
            <video className={styles.reviewVideo} src={live.introVideoUrl} controls preload="metadata" playsInline />
          ) : null
        )}
      </div>

      {live.status === "pending" ? (
        <p className={styles.reviewNote}>Already submitted and in review. Changes you save here update it.</p>
      ) : !live.isOwner ? (
        <p className={styles.reviewNote}>Only the academy owner can submit the application.</p>
      ) : (
        <p className={styles.reviewNote}>
          By submitting you agree that Testkart may show these details on your public profile once you are approved.
        </p>
      )}
    </LiveCard>
  );
};
