import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCompleteOnboardingMutation } from "../helpers/useTeacherOnboarding";
import { toast } from "sonner";
import { Button } from "./Button";
import { Input } from "./Input";
import { Spinner } from "./Spinner";
import type { InputType } from "../endpoints/teacher/onboarding/complete_POST.schema";
import { ChevronRight, ChevronLeft, CheckCircle2, X } from "lucide-react";
import styles from "./TeacherOnboardingQuiz.module.css";

// --- Constants ---
const TEACHING_CATEGORIES = ["School", "College", "Government Exams", "Competitive Exams", "Skills", "Language", "Other"];
const COMMON_SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Reasoning", "Aptitude", "History", "Geography", "Political Science", "Economics", "Computer Science", "General Knowledge", "Hindi", "Accountancy"];
const TARGET_EXAMS = ["UPSC", "SSC CGL", "SSC CHSL", "NEET", "JEE Main", "JEE Advanced", "CUET", "CTET", "UGC NET", "Banking", "Railway", "State PSC", "Board Exams", "GATE", "CAT", "CLAT", "Other"];
const EXPERIENCE_LEVELS = ["Beginner", "Less than 1 year", "1–3 years", "3–5 years", "5–10 years", "10+ years"];
const OCCUPATIONS = ["School Teacher", "Coaching Teacher", "College Faculty", "Full-time Educator", "Freelancer", "Student", "Other"];
const CONTENT_TYPES = ["Mock Tests", "Practice Questions", "Study Notes", "Courses", "Live Tests", "PDFs", "E-books"];
const TEACHING_LANGUAGES = ["English", "Hindi", "Hinglish", "Bengali", "Marathi", "Tamil", "Telugu", "Kannada", "Malayalam", "Gujarati", "Punjabi", "Other"];
const GOALS = ["Earn extra income", "Build my personal brand", "Reach more students", "Sell my existing content", "Conduct live tests", "Create AI-generated mock tests"];
const DISCOVERY_SOURCES = ["YouTube", "Facebook", "Instagram", "Google", "Friend", "WhatsApp", "Workshop", "Referral", "Other"];

// --- Tags Input Component ---
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

  return (
    <div className={styles.tagsContainer} onClick={() => inputRef.current?.focus()}>
      {value.map((tag) => (
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
        placeholder={value.length === 0 ? placeholder : "Add more..."}
      />
    </div>
  );
}

// --- Other Input Component ---
interface OtherInputProps {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}

function OtherInput({ value, onChange, onCommit }: OtherInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onCommit();
    }
  };

  return (
    <div className={styles.otherInputContainer}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onCommit}
        placeholder="Please specify..."
        autoFocus
      />
    </div>
  );
}

// --- Main Quiz Component ---
export function TeacherOnboardingQuiz() {
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 10;
  const navigate = useNavigate();
  const completeMutation = useCompleteOnboardingMutation();

  // State
  const [teachingCategories, setTeachingCategories] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [targetExams, setTargetExams] = useState<string[]>([]);
  const [teachingExperienceLevel, setTeachingExperienceLevel] = useState<string>("");
  const [currentOccupation, setCurrentOccupation] = useState<string>("");
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [goals, setGoals] = useState<string>("");
  const [discoverySource, setDiscoverySource] = useState<string>("");

  // Step 9 (Optional) form fields
  const [academyName, setAcademyName] = useState("");
  const [schoolCollegeName, setSchoolCollegeName] = useState("");
  const [location, setLocation] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [youtube, setYoutube] = useState("");
  const [telegram, setTelegram] = useState("");
  const [instagram, setInstagram] = useState("");
  const [linkedin, setLinkedin] = useState("");

  // "Other" input states
  const [otherCategory, setOtherCategory] = useState("");
  const [otherExam, setOtherExam] = useState("");
  const [otherOccupation, setOtherOccupation] = useState("");
  const [otherLanguage, setOtherLanguage] = useState("");
  const [otherDiscovery, setOtherDiscovery] = useState("");

  const toggleMulti = (state: string[], setter: (v: string[]) => void, value: string) => {
    if (state.includes(value)) {
      setter(state.filter((v) => v !== value));
    } else {
      setter([...state, value]);
    }
  };

  const commitOtherCategory = () => {
    const trimmed = otherCategory.trim();
    if (trimmed && !teachingCategories.includes(trimmed)) {
      setTeachingCategories([...teachingCategories, trimmed]);
      setOtherCategory("");
    }
  };

  const commitOtherExam = () => {
    const trimmed = otherExam.trim();
    if (trimmed && !targetExams.includes(trimmed)) {
      setTargetExams([...targetExams, trimmed]);
      setOtherExam("");
    }
  };

  const commitOtherOccupation = () => {
    const trimmed = otherOccupation.trim();
    if (trimmed) {
      setCurrentOccupation(`Other: ${trimmed}`);
      setOtherOccupation(trimmed);
    }
  };

  const commitOtherLanguage = () => {
    const trimmed = otherLanguage.trim();
    if (trimmed && !languages.includes(trimmed)) {
      setLanguages([...languages, trimmed]);
      setOtherLanguage("");
    }
  };

  const commitOtherDiscovery = () => {
    const trimmed = otherDiscovery.trim();
    if (trimmed) {
      setDiscoverySource(`Other: ${trimmed}`);
      setOtherDiscovery(trimmed);
    }
  };

  const handleNext = () => {
    if (currentStep === 0 && teachingCategories.length === 0) {
      toast.error("Please select at least one option");
      return;
    }
    if (currentStep === 1 && subjects.length === 0) {
      toast.error("Please select at least one option");
      return;
    }
    if (currentStep === 2 && targetExams.length === 0) {
      toast.error("Please select at least one option");
      return;
    }
    if (currentStep === 3 && !teachingExperienceLevel) {
      toast.error("Please select an option");
      return;
    }
    if (currentStep === 4 && !currentOccupation) {
      toast.error("Please select an option");
      return;
    }
    if (currentStep === 5 && contentTypes.length === 0) {
      toast.error("Please select at least one option");
      return;
    }
    if (currentStep === 6 && languages.length === 0) {
      toast.error("Please select at least one option");
      return;
    }
    if (currentStep === 7 && !goals) {
      toast.error("Please select an option");
      return;
    }
    // Step 8 (Social Proof) is optional, no validation required

    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const onSubmit = async () => {
    if (!discoverySource) {
      toast.error("Please select an option");
      return;
    }

    const signupSource = localStorage.getItem("testkart_signup_source") || undefined;

    const payload: InputType = {
      teachingCategories,
      subjects,
      targetExams,
      teachingExperienceLevel,
      currentOccupation,
      contentTypes,
      languages,
      goals,
      discoverySource,
      academyName: academyName || undefined,
      schoolCollegeName: schoolCollegeName || undefined,
      location: location || undefined,
      websiteUrl: websiteUrl || undefined,
      socialLinks: (youtube || telegram || instagram || linkedin) ? {
        youtube: youtube || undefined,
        telegram: telegram || undefined,
        instagram: instagram || undefined,
        linkedin: linkedin || undefined,
      } : undefined,
      signupSource,
    };

    try {
      await completeMutation.mutateAsync(payload);
      toast.success("Profile set up successfully! Welcome to Testkart 🎉");
      localStorage.removeItem("testkart_signup_source");
      navigate("/teacher/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      toast.error(message);
    }
  };

  const isLastStep = currentStep === totalSteps - 1;

  const formLabelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "var(--spacing-1)",
    fontWeight: 500,
    fontSize: "0.875rem",
    color: "var(--foreground)",
  };

  return (
    <div className={styles.quizContainer}>
      <div className={styles.progressContainer}>
        <div className={styles.progressText}>
          Question {currentStep + 1} of {totalSteps}
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }} />
        </div>
      </div>

      <div className={styles.card}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          
          {/* Step 1: What do you teach? */}
          {currentStep === 0 && (
            <div className={styles.questionContainer} key="step1">
              <h2 className={styles.questionTitle}>What do you teach?</h2>
              <div className={styles.languageChips}>
                {TEACHING_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`${styles.languageChip} ${teachingCategories.includes(cat) ? styles.selected : ""}`}
                    onClick={() => toggleMulti(teachingCategories, setTeachingCategories, cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {teachingCategories.includes("Other") && (
                <OtherInput
                  value={otherCategory}
                  onChange={setOtherCategory}
                  onCommit={commitOtherCategory}
                />
              )}
            </div>
          )}

          {/* Step 2: Select Subjects */}
          {currentStep === 1 && (
            <div className={styles.questionContainer} key="step2">
              <h2 className={styles.questionTitle}>Select Subjects</h2>
              <div className={styles.languageChips} style={{ marginBottom: "var(--spacing-6)" }}>
                {COMMON_SUBJECTS.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    className={`${styles.languageChip} ${subjects.includes(sub) ? styles.selected : ""}`}
                    onClick={() => toggleMulti(subjects, setSubjects, sub)}
                  >
                    {sub}
                  </button>
                ))}
              </div>
              <TagsInput
                value={subjects}
                onChange={setSubjects}
                placeholder="Type a custom subject and press Enter..."
              />
            </div>
          )}

          {/* Step 3: Target Exams */}
          {currentStep === 2 && (
            <div className={styles.questionContainer} key="step3">
              <h2 className={styles.questionTitle}>Target Exams</h2>
              <div className={styles.languageChips}>
                {TARGET_EXAMS.map((exam) => (
                  <button
                    key={exam}
                    type="button"
                    className={`${styles.languageChip} ${targetExams.includes(exam) ? styles.selected : ""}`}
                    onClick={() => toggleMulti(targetExams, setTargetExams, exam)}
                  >
                    {exam}
                  </button>
                ))}
              </div>
              {targetExams.includes("Other") && (
                <OtherInput
                  value={otherExam}
                  onChange={setOtherExam}
                  onCommit={commitOtherExam}
                />
              )}
            </div>
          )}

          {/* Step 4: Teaching Experience */}
          {currentStep === 3 && (
            <div className={styles.questionContainer} key="step4">
              <h2 className={styles.questionTitle}>Teaching Experience</h2>
              <div className={styles.languageChips}>
                {EXPERIENCE_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`${styles.languageChip} ${teachingExperienceLevel === level ? styles.selected : ""}`}
                    onClick={() => setTeachingExperienceLevel(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Current Occupation */}
          {currentStep === 4 && (
            <div className={styles.questionContainer} key="step5">
              <h2 className={styles.questionTitle}>Current Occupation</h2>
              <div className={styles.languageChips}>
                {OCCUPATIONS.map((occ) => (
                  <button
                    key={occ}
                    type="button"
                    className={`${styles.languageChip} ${currentOccupation === occ || currentOccupation.startsWith("Other:") ? styles.selected : ""}`}
                    onClick={() => setCurrentOccupation(occ)}
                  >
                    {occ}
                  </button>
                ))}
              </div>
              {(currentOccupation === "Other" || currentOccupation.startsWith("Other:")) && (
                <OtherInput
                  value={otherOccupation}
                  onChange={setOtherOccupation}
                  onCommit={commitOtherOccupation}
                />
              )}
            </div>
          )}

          {/* Step 6: What would you like to publish first? */}
          {currentStep === 5 && (
            <div className={styles.questionContainer} key="step6">
              <h2 className={styles.questionTitle}>
                What would you like to publish first?
                <span style={{ display: "block", fontSize: "0.875rem", fontWeight: 400, color: "var(--muted-foreground)", marginTop: "var(--spacing-2)" }}>
                  This lets us personalize your dashboard
                </span>
              </h2>
              <div className={styles.languageChips}>
                {CONTENT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`${styles.languageChip} ${contentTypes.includes(type) ? styles.selected : ""}`}
                    onClick={() => toggleMulti(contentTypes, setContentTypes, type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 7: Which language do you teach in? */}
          {currentStep === 6 && (
            <div className={styles.questionContainer} key="step7">
              <h2 className={styles.questionTitle}>Which language do you teach in?</h2>
              <div className={styles.languageChips}>
                {TEACHING_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    className={`${styles.languageChip} ${languages.includes(lang) ? styles.selected : ""}`}
                    onClick={() => toggleMulti(languages, setLanguages, lang)}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              {languages.includes("Other") && (
                <OtherInput
                  value={otherLanguage}
                  onChange={setOtherLanguage}
                  onCommit={commitOtherLanguage}
                />
              )}
            </div>
          )}

          {/* Step 8: What do you want to achieve with Testkart? */}
          {currentStep === 7 && (
            <div className={styles.questionContainer} key="step8">
              <h2 className={styles.questionTitle}>What do you want to achieve with Testkart?</h2>
              <div className={styles.languageChips}>
                {GOALS.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    className={`${styles.languageChip} ${goals === goal ? styles.selected : ""}`}
                    onClick={() => setGoals(goal)}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 9: Social Proof (Optional) */}
          {currentStep === 8 && (
            <div className={styles.questionContainer} key="step9">
              <h2 className={styles.questionTitle}>
                Social Proof <span style={{ fontSize: "1rem", color: "var(--muted-foreground)", fontWeight: 400 }}>(Optional)</span>
                <span style={{ display: "block", fontSize: "0.875rem", fontWeight: 400, color: "var(--muted-foreground)", marginTop: "var(--spacing-2)" }}>
                  These increase student trust
                </span>
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
                <div>
                  <label style={formLabelStyle}>Coaching Institute Name</label>
                  <Input value={academyName} onChange={(e) => setAcademyName(e.target.value)} placeholder="e.g. Testkart Academy" />
                </div>
                <div>
                  <label style={formLabelStyle}>School/College Name</label>
                  <Input value={schoolCollegeName} onChange={(e) => setSchoolCollegeName(e.target.value)} placeholder="e.g. Delhi Public School" />
                </div>
                <div>
                  <label style={formLabelStyle}>City</label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. New Delhi" />
                </div>
                <div>
                  <label style={formLabelStyle}>Website</label>
                  <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://yourwebsite.com" type="url" />
                </div>
                <div>
                  <label style={formLabelStyle}>YouTube Channel</label>
                  <Input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="https://youtube.com/@yourchannel" type="url" />
                </div>
                <div>
                  <label style={formLabelStyle}>Telegram</label>
                  <Input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="https://t.me/yourchannel" type="url" />
                </div>
                <div>
                  <label style={formLabelStyle}>Instagram</label>
                  <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/yourhandle" type="url" />
                </div>
                <div>
                  <label style={formLabelStyle}>LinkedIn</label>
                  <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/yourprofile" type="url" />
                </div>
              </div>
            </div>
          )}

          {/* Step 10: How did you hear about Testkart? */}
          {currentStep === 9 && (
            <div className={styles.questionContainer} key="step10">
              <h2 className={styles.questionTitle}>How did you hear about Testkart?</h2>
              <div className={styles.languageChips}>
                {DISCOVERY_SOURCES.map((source) => (
                  <button
                    key={source}
                    type="button"
                    className={`${styles.languageChip} ${discoverySource === source || discoverySource.startsWith("Other:") ? styles.selected : ""}`}
                    onClick={() => setDiscoverySource(source)}
                  >
                    {source}
                  </button>
                ))}
              </div>
              {(discoverySource === "Other" || discoverySource.startsWith("Other:")) && (
                <OtherInput
                  value={otherDiscovery}
                  onChange={setOtherDiscovery}
                  onCommit={commitOtherDiscovery}
                />
              )}
            </div>
          )}

          {/* Navigation Actions */}
          <div className={styles.cardActions}>
            <div className={styles.cardActionsLeft}>
              {currentStep > 0 && (
                <Button type="button" variant="ghost" onClick={handleBack}>
                  <ChevronLeft size={18} /> Back
                </Button>
              )}
            </div>
            <div className={styles.cardActionsRight}>
              {!isLastStep ? (
                <Button type="button" size="lg" onClick={handleNext}>
                  Continue <ChevronRight size={18} />
                </Button>
              ) : (
                <Button type="button" size="lg" disabled={completeMutation.isPending} onClick={onSubmit}>
                  {completeMutation.isPending ? (
                    <>
                      <Spinner size="sm" /> Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} /> Complete Setup
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}