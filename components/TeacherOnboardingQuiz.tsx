import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCompleteOnboardingMutation } from "../helpers/useTeacherOnboarding";
import { useAuth } from "../helpers/useAuth";
import { sanitizeMobileInput } from "../helpers/normalizePhoneNumber";
import { toast } from "sonner";
import { Button } from "./Button";
import { Input } from "./Input";
import { Spinner } from "./Spinner";
import { TeacherKindTile } from "./TeacherKindTile";
import type { InputType } from "../endpoints/teacher/onboarding/complete_POST.schema";
import type { ExamFocusItem } from "../helpers/examFocusShared";
import { teacherContentKind, type TeacherContentKind } from "../helpers/teacherContentKinds";
import { ExamFocusPicker } from "./ExamFocusPicker";
import { Check, ChevronLeft, X } from "lucide-react";
import styles from "./TeacherOnboardingQuiz.module.css";

const TEACHING_CATEGORIES = ["School", "College", "Government Exams", "Competitive Exams", "Skills", "Language", "Other"];
const COMMON_SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Reasoning", "Aptitude", "History", "Geography", "Political Science", "Economics", "Computer Science", "General Knowledge", "Hindi", "Accountancy"];
const TEACHING_LANGUAGES = ["English", "Hindi", "Hinglish", "Bengali", "Marathi", "Tamil", "Telugu", "Kannada", "Malayalam", "Gujarati", "Punjabi", "Other"];
const MOBILE_PATTERN = /^[6-9]\d{9}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/*
 * The answer is saved to product_interest under the labels the earlier quiz
 * used, which the Overview reads (overview_GET firstContentTypeFrom) to pick
 * the first thing it asks the teacher to create.
 */
const FIRST_LISTING_OPTIONS: { kind: TeacherContentKind; value: string }[] = [
  { kind: "mock_test", value: "Mock Tests" },
  { kind: "digital_product", value: "Study Notes" },
  { kind: "course", value: "Courses" },
  { kind: "live_test", value: "Live Tests" },
];

interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

function TagsInput({ value, onChange, placeholder }: TagsInputProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTags = (raw: string) => {
    const seen = new Set(value.map((t) => t.toLowerCase()));
    const next = [...value];
    for (const piece of raw.split(/[,\n]/)) {
      const tag = piece.trim();
      if (!tag || seen.has(tag.toLowerCase())) continue;
      seen.add(tag.toLowerCase());
      next.push(tag);
    }
    if (next.length > value.length) onChange(next);
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTags(inputValue);
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parts = e.target.value.split(",");
    const pending = parts.pop() ?? "";
    if (parts.length === 0) {
      setInputValue(pending);
      return;
    }
    addTags(parts.join(","));
    setInputValue(pending.trimStart());
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!/[,\n]/.test(pasted)) return;
    e.preventDefault();
    const { selectionStart, selectionEnd } = e.currentTarget;
    addTags(
      inputValue.slice(0, selectionStart ?? inputValue.length) + pasted + inputValue.slice(selectionEnd ?? inputValue.length)
    );
    setInputValue("");
  };

  // Chips cover the common subjects; the field lists only the ones typed in.
  const custom = value.filter((tag) => !COMMON_SUBJECTS.includes(tag));

  return (
    <div className={styles.tagsContainer} onClick={() => inputRef.current?.focus()}>
      {custom.map((tag) => (
        <span key={tag} className={styles.tag}>
          {tag}
          <button
            type="button"
            className={styles.tagRemove}
            onClick={(e) => {
              e.stopPropagation();
              removeTag(tag);
            }}
            aria-label={`Remove ${tag}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className={styles.tagInput}
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={() => {
          if (!inputValue.trim()) return;
          addTags(inputValue);
          setInputValue("");
        }}
        aria-label="Add another subject"
        placeholder={placeholder}
      />
    </div>
  );
}

interface OtherInputProps {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  label: string;
}

function OtherInput({ value, onChange, onCommit, label }: OtherInputProps) {
  return (
    <div className={styles.otherInputContainer}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit();
          }
        }}
        onBlur={onCommit}
        aria-label={label}
        placeholder="Type it here"
        autoFocus
      />
    </div>
  );
}

const Chips = ({
  options,
  selected,
  onToggle,
  label,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  label: string;
}) => (
  <div className={styles.chips} role="group" aria-label={label}>
    {options.map((option) => {
      const on = selected.includes(option);
      return (
        <button
          key={option}
          type="button"
          className={`${styles.chip} ${on ? styles.chipOn : ""}`}
          aria-pressed={on}
          onClick={() => onToggle(option)}
        >
          {on && <Check size={14} strokeWidth={3} aria-hidden="true" />}
          {option}
        </button>
      );
    })}
  </div>
);

/**
 * Four questions between signup and the dashboard: what you teach, which
 * exams, what you will publish first and which language. Experience,
 * occupation and social links are asked later from the profile checklist.
 */
export function TeacherOnboardingQuiz() {
  const { authState } = useAuth();
  const authUser = authState.type === "authenticated" ? authState.user : null;
  // Fixed at mount so the step count cannot shift mid-quiz. Google signups
  // arrive without a mobile number, so they get a contact step first.
  const [contactNeeds] = useState(() => ({
    mobile: !authUser?.mobileNumber,
    email: !authUser?.email,
  }));
  const hasContactStep = contactNeeds.mobile || contactNeeds.email;
  const stepLabels = [...(hasContactStep ? ["Contact"] : []), "What you teach", "Exams", "First listing", "Language"];
  const contactOffset = hasContactStep ? 1 : 0;

  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = stepLabels.length;
  const quizStep = currentStep - contactOffset;
  const navigate = useNavigate();
  const completeMutation = useCompleteOnboardingMutation();

  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [teachingCategories, setTeachingCategories] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [examFocus, setExamFocus] = useState<ExamFocusItem[]>([]);
  const [firstListing, setFirstListing] = useState<string>("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [otherCategory, setOtherCategory] = useState("");
  const [otherLanguage, setOtherLanguage] = useState("");

  const toggle = (state: string[], setter: (v: string[]) => void) => (value: string) =>
    setter(state.includes(value) ? state.filter((v) => v !== value) : [...state, value]);

  const commitOther = (value: string, list: string[], setList: (v: string[]) => void, clear: () => void) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
      clear();
    }
  };

  const stepError = (): string | null => {
    if (hasContactStep && currentStep === 0) {
      if (contactNeeds.mobile && !MOBILE_PATTERN.test(mobileNumber)) return "Enter a valid 10-digit mobile number";
      if (contactNeeds.email && !EMAIL_PATTERN.test(email.trim())) return "Enter a valid email address";
      return null;
    }
    if (quizStep === 0) {
      if (teachingCategories.filter((c) => c !== "Other").length === 0) return "Pick at least one thing you teach";
      if (subjects.length === 0) return "Pick or type at least one subject";
    }
    if (quizStep === 1 && examFocus.length === 0) return "Pick at least one exam";
    if (quizStep === 2 && !firstListing) return "Pick what you will publish first";
    if (quizStep === 3 && languages.filter((l) => l !== "Other").length === 0) return "Pick at least one language";
    return null;
  };

  const onSubmit = async () => {
    const signupSource = localStorage.getItem("testkart_signup_source") || undefined;
    const payload: InputType = {
      teachingCategories: teachingCategories.filter((c) => c !== "Other"),
      subjects,
      examIds: examFocus.map((exam) => exam.id),
      contentTypes: [firstListing],
      languages: languages.filter((l) => l !== "Other"),
      signupSource,
      mobileNumber: contactNeeds.mobile ? mobileNumber : undefined,
      email: contactNeeds.email ? email.trim().toLowerCase() : undefined,
    };

    try {
      await completeMutation.mutateAsync(payload);
      toast.success("Welcome to Testkart. Your dashboard is ready.");
      localStorage.removeItem("testkart_signup_source");
      navigate("/teacher/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your answers were not saved. Try again.");
    }
  };

  const isLastStep = currentStep === totalSteps - 1;

  const handleContinue = () => {
    const error = stepError();
    if (error) {
      toast.error(error);
      return;
    }
    if (isLastStep) {
      void onSubmit();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  return (
    <div className={styles.quizContainer}>
      <ol className={styles.track} aria-label={`Step ${currentStep + 1} of ${totalSteps}`}>
        {stepLabels.map((label, index) => (
          <li
            key={label}
            className={`${styles.trackStep} ${index < currentStep ? styles.trackDone : ""} ${index === currentStep ? styles.trackCurrent : ""}`}
            aria-current={index === currentStep ? "step" : undefined}
          >
            <span className={styles.trackBar} aria-hidden="true" />
            <span className={styles.trackLabel}>{label}</span>
          </li>
        ))}
      </ol>

      <div className={styles.card}>
        {hasContactStep && currentStep === 0 && (
          <div className={styles.question} key="contact">
            <h2 className={styles.questionTitle}>How can we reach you?</h2>
            <p className={styles.questionHint}>We need this to set up your teacher account.</p>
            <div className={styles.fields}>
              {contactNeeds.mobile && (
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Mobile number</span>
                  <Input
                    type="tel"
                    autoComplete="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(sanitizeMobileInput(e.target.value))}
                    placeholder="10-digit mobile number"
                  />
                </label>
              )}
              {contactNeeds.email && (
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Email address</span>
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
              )}
            </div>
          </div>
        )}

        {quizStep === 0 && (
          <div className={styles.question} key="teach">
            <h2 className={styles.questionTitle}>What do you teach?</h2>
            <p className={styles.questionHint}>Pick all that fit. Students use these to find you.</p>
            <Chips
              label="Where you teach"
              options={TEACHING_CATEGORIES}
              selected={teachingCategories}
              onToggle={toggle(teachingCategories, setTeachingCategories)}
            />
            {teachingCategories.includes("Other") && (
              <OtherInput
                label="Something else you teach"
                value={otherCategory}
                onChange={setOtherCategory}
                onCommit={() => commitOther(otherCategory, teachingCategories, setTeachingCategories, () => setOtherCategory(""))}
              />
            )}
            <h3 className={styles.subTitle}>Subjects</h3>
            <Chips
              label="Subjects"
              options={COMMON_SUBJECTS}
              selected={subjects}
              onToggle={toggle(subjects, setSubjects)}
            />
            <TagsInput value={subjects} onChange={setSubjects} placeholder="Another subject? Type it and press Enter" />
          </div>
        )}

        {quizStep === 1 && (
          <div className={styles.question} key="exams">
            <h2 className={styles.questionTitle}>Which exams do you prepare students for?</h2>
            <p className={styles.questionHint}>Your listings show up on these exams' pages.</p>
            <ExamFocusPicker value={examFocus} onChange={setExamFocus} />
          </div>
        )}

        {quizStep === 2 && (
          <div className={styles.question} key="first">
            <h2 className={styles.questionTitle}>What will you publish first?</h2>
            <p className={styles.questionHint}>Your dashboard starts you on this. You can make any of them later.</p>
            <div className={styles.kindGrid} role="radiogroup" aria-label="First listing">
              {FIRST_LISTING_OPTIONS.map((option) => {
                const meta = teacherContentKind(option.kind);
                const on = firstListing === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={`${styles.kindCard} ${on ? styles.kindCardOn : ""}`}
                    onClick={() => setFirstListing(option.value)}
                  >
                    <TeacherKindTile kind={option.kind} />
                    <span className={styles.kindText}>
                      <span className={styles.kindLabel}>{meta.label}</span>
                      <span className={styles.kindPitch}>{meta.pitch}</span>
                    </span>
                    {on && (
                      <span className={styles.kindCheck} aria-hidden="true">
                        <Check size={14} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {quizStep === 3 && (
          <div className={styles.question} key="language">
            <h2 className={styles.questionTitle}>Which language do you teach in?</h2>
            <p className={styles.questionHint}>Pick all you use.</p>
            <Chips
              label="Teaching languages"
              options={TEACHING_LANGUAGES}
              selected={languages}
              onToggle={toggle(languages, setLanguages)}
            />
            {languages.includes("Other") && (
              <OtherInput
                label="Another language"
                value={otherLanguage}
                onChange={setOtherLanguage}
                onCommit={() => commitOther(otherLanguage, languages, setLanguages, () => setOtherLanguage(""))}
              />
            )}
          </div>
        )}

        <div className={styles.actions}>
          {currentStep > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setCurrentStep((s) => s - 1)}>
              <ChevronLeft size={18} /> Back
            </Button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className={styles.continue}
            onClick={handleContinue}
            disabled={completeMutation.isPending}
          >
            {completeMutation.isPending ? (
              <>
                <Spinner size="sm" /> Saving
              </>
            ) : isLastStep ? (
              "Go to my dashboard"
            ) : (
              "Continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
