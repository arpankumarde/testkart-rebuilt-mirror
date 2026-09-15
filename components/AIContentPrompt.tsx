import React, { useState, KeyboardEvent } from "react";
import { Sparkles, ArrowUp, AlertCircle } from "lucide-react";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { useTeacherAIGenerateAll } from "../helpers/useTeacherAIGenerateAll";
import styles from "./AIContentPrompt.module.css";

interface AIContentPromptProps {
  contentType: "product" | "test" | "liveTest" | "course" | "bundle";
  teacherName?: string;
  bundleItemTitles?: string[];
  onGenerated: (data: {
    title: string;
    shortDescription?: string;
    description: string;
    examName?: string;
    category?: string;
    language?: string;
    tags?: string[];
    suggestedPrice?: number;
    level?: string;
    durationMinutes?: number;
  }) => void;
  onSkip: () => void;
}

type Template = {
  icon: string;
  title: string;
  prompt: string;
};

type ContentConfig = {
  headingWord: string;
  placeholder: string;
  chips: string[];
  featuredTemplate: Template;
  templates: Template[];
};

const CONTENT_CONFIGS: Record<string, ContentConfig> = {
  product: {
    headingWord: "product",
    placeholder:
      "e.g., I have prepared comprehensive Physics notes for IIT JAM covering electrodynamics and classical mechanics in Hindi...",
    chips: [
      "📝 Title",
      "📋 Description",
      "🎯 Exam Name",
      "📂 Category",
      "🌐 Language",
      "💰 Price",
      "🏷️ Tags",
    ],
    featuredTemplate: {
      icon: "📚",
      title: "UPSC Study Notes",
      prompt:
        "I have prepared comprehensive study notes for UPSC CSE Prelims covering General Studies Paper 1 (History, Geography, Polity) in Hindi",
    },
    templates: [
      {
        icon: "📝",
        title: "SSC CGL Question Bank",
        prompt:
          "Question bank for SSC CGL Tier 1 exam covering Quantitative Aptitude, English, General Knowledge and Reasoning in English",
      },
      {
        icon: "🧪",
        title: "NEET Biology Notes",
        prompt:
          "Chapter-wise biology notes for NEET covering all topics from NCERT with diagrams and key points in English",
      },
      {
        icon: "⚡",
        title: "IIT JEE Formula Sheet",
        prompt:
          "Complete formula and concept sheet for IIT JEE Main and Advanced covering Physics, Chemistry and Mathematics in English",
      },
      {
        icon: "🏦",
        title: "Banking Exam Material",
        prompt:
          "Study material for IBPS PO and SBI PO covering Reasoning, Quantitative Aptitude, English and General Awareness in Hindi and English",
      },
    ],
  },
  test: {
    headingWord: "mock test",
    placeholder:
      "e.g., I want to create a full mock test series for SSC CGL Tier 1 with 100 questions covering all subjects in English...",
    chips: [
      "📝 Title",
      "📋 Description",
      "🎯 Exam Name",
      "🌐 Language",
      "💰 Price",
    ],
    featuredTemplate: {
      icon: "📋",
      title: "SSC CGL Mock Tests",
      prompt:
        "Full-length mock test series for SSC CGL Tier 1 with 100 questions covering all 4 sections as per latest pattern in English and Hindi",
    },
    templates: [
      {
        icon: "🎯",
        title: "UPSC Prelims Tests",
        prompt:
          "Practice test series for UPSC CSE Prelims covering General Studies and CSAT as per UPSC pattern in English and Hindi",
      },
      {
        icon: "🔬",
        title: "NEET Mock Tests",
        prompt:
          "Full syllabus mock test series for NEET covering Physics, Chemistry and Biology with 180 questions each in English",
      },
      {
        icon: "⚙️",
        title: "GATE Mock Tests",
        prompt:
          "Mock test series for GATE Computer Science covering all topics as per latest GATE syllabus in English",
      },
    ],
  },
  course: {
    headingWord: "course",
    placeholder:
      "e.g., I'm creating a complete video course for UPSC CSE Prelims covering Indian Geography and Economy in Hindi...",
    chips: [
      "📝 Title",
      "📋 Description",
      "📂 Category",
      "📊 Level",
      "🌐 Language",
      "💰 Price",
    ],
    featuredTemplate: {
      icon: "🎓",
      title: "UPSC Preparation",
      prompt:
        "Complete video course for UPSC CSE covering all subjects of Prelims and Mains with current affairs updates in Hindi",
    },
    templates: [
      {
        icon: "📊",
        title: "SSC CGL Course",
        prompt:
          "Crash course for SSC CGL Tier 1 and Tier 2 covering all subjects with practice sessions in Hindi",
      },
      {
        icon: "🧬",
        title: "NEET Course",
        prompt:
          "Complete NEET preparation course covering Physics, Chemistry and Biology from basics to advanced level in English",
      },
    ],
  },
  liveTest: {
    headingWord: "live test",
    placeholder:
      "e.g., I want to host a live practice test for NEET with 180 questions, 3 hours duration, covering Physics, Chemistry and Biology...",
    chips: [
      "📝 Title",
      "📋 Description",
      "🎯 Exam Name",
      "🌐 Language",
      "💰 Price",
      "⏱️ Duration",
    ],
    featuredTemplate: {
      icon: "🔴",
      title: "SSC CGL Live Test",
      prompt:
        "Live mock test for SSC CGL Tier 1 with 100 questions, 60 minutes duration, real exam experience with live leaderboard",
    },
    templates: [
      {
        icon: "🔴",
        title: "UPSC Live Practice",
        prompt:
          "Live UPSC CSE Prelims practice test with 100 questions, 120 minutes duration, covering General Studies",
      },
      {
        icon: "🔴",
        title: "NEET Live Test",
        prompt:
          "NEET full syllabus live test with 180 questions, 180 minutes duration, covering Physics, Chemistry and Biology",
      },
    ],
  },
  bundle: {
    headingWord: "bundle",
    placeholder:
      "e.g., I want to create a complete preparation package combining notes, tests and courses for Banking exams...",
    chips: ["📝 Title", "📋 Description", "💰 Price"],
    featuredTemplate: {
      icon: "📦",
      title: "Exam Prep Bundle",
      prompt:
        "Complete exam preparation bundle combining study notes, mock tests and practice papers for comprehensive preparation",
    },
    templates: [
      {
        icon: "📦",
        title: "All-in-One Package",
        prompt:
          "All-in-one study package with notes, tests and courses for complete exam preparation",
      },
    ],
  },
};

export const AIContentPrompt: React.FC<AIContentPromptProps> = ({
  contentType,
  teacherName,
  bundleItemTitles,
  onGenerated,
  onSkip,
}) => {
  const [prompt, setPrompt] = useState("");
  const mutation = useTeacherAIGenerateAll();
  const config = CONTENT_CONFIGS[contentType];

  const handleSubmit = () => {
    if (!prompt.trim() || mutation.isPending) return;

    mutation.mutate(
      {
        prompt,
        contentType,
        bundleItemTitles,
      },
      {
        onSuccess: (data) => {
          onGenerated(data);
        },
      }
    );
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (mutation.isPending) {
    return (
      <div className={styles.container}>
        <div className={`${styles.loadingState} ${styles.shimmer}`}>
          <div className={styles.loadingIcon}>
            <Sparkles size={40} />
          </div>
          <h2 className={styles.loadingTitle}>✨ AI is creating your content...</h2>
          <p className={styles.loadingSubtitle}>
            This usually takes 10-15 seconds
          </p>
        </div>
      </div>
    );
  }

  if (mutation.isError) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>
            <AlertCircle size={40} />
          </div>
          <h2 className={styles.errorTitle}>Oops, something went wrong</h2>
          <p className={styles.errorSubtitle}>
            {mutation.error instanceof Error
              ? mutation.error.message
              : "Failed to generate content. Let's give it another shot."}
          </p>
          <div className={styles.errorActions}>
            <Button onClick={handleSubmit} size="lg">
              Try Again
            </Button>
            <Button variant="ghost" onClick={() => mutation.reset()}>
              Edit Prompt
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.greetingSection}>
        <p className={styles.greetingText}>
          👋 {teacherName ? `Hey ${teacherName}!` : "Hello!"}
        </p>
        <h1 className={styles.heading}>
          {contentType === "product" && "What "}
          {contentType === "test" && "Tell us about your "}
          {contentType === "course" && "What "}
          {contentType === "liveTest" && "Describe your "}
          {contentType === "bundle" && "Describe your "}
          <span className={styles.highlight}>{config.headingWord}</span>
          {(contentType === "product" || contentType === "course") &&
            " are you creating?"}
        </h1>
      </div>

      <div className={styles.promptArea}>
        <div className={styles.textareaWrapper}>
          <div className={styles.textareaInner}>
            <textarea
              className={styles.textarea}
              placeholder={config.placeholder}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={5}
              autoFocus
            />
            <div className={styles.textareaFooter}>
              <div className={styles.chipsContainer}>
                {config.chips.map((chip, idx) => (
                  <span key={idx} className={styles.chip}>
                    {chip}
                  </span>
                ))}
              </div>
              <button
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={!prompt.trim()}
                title="Generate (Cmd+Enter)"
              >
                <ArrowUp size={20} strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>

        <div className={styles.skipAction}>
          <button onClick={onSkip} className={styles.skipBtn}>
            ✏️ I'll fill the details myself
          </button>
        </div>
      </div>

      <div className={styles.templatesSection}>
        <h3 className={styles.templatesLabel}>QUICK TEMPLATES:</h3>

        <div
          className={styles.featuredTemplate}
          onClick={() => setPrompt(config.featuredTemplate.prompt)}
          role="button"
          tabIndex={0}
        >
          <div className={styles.featuredIconWrapper}>
            <Sparkles className={styles.featuredIcon} size={20} />
          </div>
          <div className={styles.featuredContent}>
            <h4 className={styles.featuredTitle}>
              {config.featuredTemplate.title}
            </h4>
            <p className={styles.featuredDesc}>
              "{config.featuredTemplate.prompt}"
            </p>
          </div>
        </div>

        <div className={styles.templatesGrid}>
          {config.templates.map((template, idx) => (
            <div
              key={idx}
              className={styles.templateCard}
              onClick={() => setPrompt(template.prompt)}
              role="button"
              tabIndex={0}
            >
              <span className={styles.templateEmoji}>{template.icon}</span>
              <span className={styles.templateTitle}>{template.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};