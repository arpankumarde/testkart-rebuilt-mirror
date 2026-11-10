import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Copyright,
  FileQuestion,
  Flag,
  HelpCircle,
  Info,
  Loader2,
  MoreHorizontal,
  Quote,
  RotateCcw,
  ShieldCheck,
  SpellCheck,
  Unlink,
  X,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "./Dialog";
import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { TurnstileWidget, type TurnstileWidgetHandle } from "./TurnstileWidget";
import { useDarkModeObserver } from "../helpers/useDarkModeObserver";
import {
  CONTENT_REPORT_CATEGORIES,
  COPYRIGHT_CATEGORY,
  COPYRIGHT_MATERIAL_TYPES,
  classifyContentReportPath,
  isValidReportPhone,
} from "../helpers/contentReportTypes";
import { ContentReportError, postContentReport, type InputType } from "../endpoints/content-reports/submit_POST.schema";
import type { ContentReportCategory, ContentReportCopyrightMaterial } from "../helpers/schema";
import styles from "./ContentReportBar.module.css";

const SUCCESS_MESSAGE = "Thanks for helping us improve Testkart! Your report has been submitted successfully.";
const COPYRIGHT_NOTE =
  "Please submit a report only if you believe your copyrighted work has been used without permission. Providing the original source or proof of ownership will help us review your request.";
const HEADING_SELECTOR = "main h1, main h2, main h3";
const MAX_HEADINGS = 40;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** A check that has neither passed nor shown a challenge by then is treated as failed to load. */
const CAPTCHA_LOAD_TIMEOUT_MS = 25_000;

const CATEGORY_ICONS: Record<ContentReportCategory, LucideIcon> = {
  incorrect_information: AlertCircle,
  outdated_information: CalendarClock,
  typo: SpellCheck,
  broken_link: Unlink,
  incorrect_answer: HelpCircle,
  missing_information: FileQuestion,
  copyright_violation: Copyright,
  other: MoreHorizontal,
};

type PageContext = {
  pageTitle: string;
  pageHref: string;
  headings: string[];
  selectedText: string | null;
  detectedSection: string | null;
};

type FieldName = "category" | "description" | "email" | "phone" | "materialType" | "materialLocation";
type FieldErrors = Partial<Record<FieldName, string>>;
type CaptchaState = "loading" | "interactive" | "verified" | "expired" | "error";

const newToken = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.slice(0, 40);
};

const headingText = (el: Element): string => (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120);

const pageHeadings = (): Element[] =>
  Array.from(document.querySelectorAll(HEADING_SELECTOR)).filter(
    (el) => !el.closest("[data-content-report]") && headingText(el)
  );

/** The text a reader highlighted in the page content, and the heading of the section it sits in. */
function readSelection(headings: Element[]): Pick<PageContext, "selectedText" | "detectedSection"> {
  const selection = typeof window !== "undefined" ? window.getSelection() : null;
  const text = selection?.toString().replace(/\s+/g, " ").trim() ?? "";
  const anchor = selection?.anchorNode ?? null;
  const main = document.querySelector("main");
  if (!text || !anchor || !main?.contains(anchor)) return { selectedText: null, detectedSection: null };
  let section: string | null = null;
  for (const heading of headings) {
    if (heading.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING) section = headingText(heading);
  }
  return { selectedText: text.slice(0, 1000), detectedSection: section };
}

function capturePageContext(): PageContext {
  const headings = pageHeadings();
  const unique = Array.from(new Set(headings.map(headingText))).slice(0, MAX_HEADINGS);
  return {
    pageTitle: document.title.slice(0, 300),
    pageHref: `${window.location.origin}${window.location.pathname}`,
    headings: unique,
    ...readSelection(headings),
  };
}

const Section: React.FC<{ step: number; title: string; children: React.ReactNode; aside?: React.ReactNode }> = ({
  step,
  title,
  children,
  aside,
}) => {
  const id = useId();
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.sectionHead}>
        <h3 id={id} className={styles.sectionTitle}>
          <span className={styles.step} aria-hidden="true">
            {step}
          </span>
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
};

const FieldLabel: React.FC<{ htmlFor: string; required?: boolean; children: React.ReactNode }> = ({
  htmlFor,
  required,
  children,
}) => (
  <label htmlFor={htmlFor} className={styles.label}>
    {children}
    {required && <RequiredMark />}
  </label>
);

function RequiredMark() {
  return (
    <>
      <span className={styles.required} aria-hidden="true">
        *
      </span>
      <span className={styles.srOnly}> (required)</span>
    </>
  );
}

const FieldError: React.FC<{ id: string; message?: string }> = ({ id, message }) =>
  message ? (
    <p id={id} className={styles.error}>
      {message}
    </p>
  ) : null;

const ReportForm: React.FC<{ context: PageContext; onDone: () => void }> = ({ context, onDone }) => {
  const location = useLocation();
  const isDark = useDarkModeObserver();
  const formId = useId();
  const fieldId = (name: string) => `${formId}-${name}`;
  const token = useRef(newToken());
  const openedAt = useRef(Date.now());
  const captchaRef = useRef<TurnstileWidgetHandle>(null);

  const [category, setCategory] = useState<ContentReportCategory | null>(null);
  const [description, setDescription] = useState("");
  const [locationHint, setLocationHint] = useState(context.detectedSection ?? "");
  const [suggestedCorrection, setSuggestedCorrection] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [materialType, setMaterialType] = useState<ContentReportCopyrightMaterial | null>(null);
  const [materialLocation, setMaterialLocation] = useState(context.pageHref);
  const [originalSource, setOriginalSource] = useState("");
  const [website, setWebsite] = useState("");
  const [selectedText, setSelectedText] = useState(context.selectedText);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [captcha, setCaptcha] = useState<CaptchaState>("loading");
  const [formError, setFormError] = useState<string | null>(null);

  const isCopyright = category === COPYRIGHT_CATEGORY;

  useEffect(() => {
    if (captcha !== "loading") return;
    const timer = setTimeout(() => setCaptcha("error"), CAPTCHA_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [captcha]);

  const mutation = useMutation({
    mutationFn: (body: InputType) => postContentReport(body),
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : "We could not submit your report. Please try again.");
      if (error instanceof ContentReportError && error.code === "captcha_unavailable") return;
      // The token was spent on this attempt, so the next one needs a fresh check.
      setCaptcha("loading");
      captchaRef.current?.reset();
    },
  });

  const clearError = (name: FieldName) => {
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    const trimmedEmail = email.trim();
    if (!category) next.category = "Choose what the issue is";
    if (description.trim().length < 10) next.description = "Please describe the issue in at least 10 characters";
    if (isCopyright) {
      if (!materialType) next.materialType = "Choose the type of copyrighted material";
      if (!materialLocation.trim()) next.materialLocation = "Tell us where the material appears";
    }
    if (!trimmedEmail) next.email = "Your email address is required";
    else if (!EMAIL_PATTERN.test(trimmedEmail)) next.email = "Enter a valid email address";
    if (!phone.trim()) next.phone = "Your phone number is required";
    else if (!isValidReportPhone(phone.trim())) next.phone = "Enter a valid phone number";
    return next;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mutation.isPending || captcha !== "verified") return;
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0 || !category) return;

    const turnstileToken = await captchaRef.current?.getToken();
    if (!turnstileToken) {
      setCaptcha("error");
      setFormError("The security check did not complete. Please verify again.");
      return;
    }

    mutation.mutate({
      category,
      description: description.trim(),
      email: email.trim(),
      phone: phone.trim(),
      pageUrl: `${location.pathname}${location.search}`,
      pageTitle: context.pageTitle || undefined,
      detectedSection: context.detectedSection ?? undefined,
      selectedText: selectedText ?? undefined,
      clientToken: token.current,
      fillMs: Date.now() - openedAt.current,
      website: website || undefined,
      turnstileToken,
      ...(isCopyright
        ? {
            reporterName: reporterName.trim() || undefined,
            copyrightMaterialType: materialType ?? undefined,
            copyrightMaterialLocation: materialLocation.trim() || undefined,
            copyrightOriginalSource: originalSource.trim() || undefined,
          }
        : {
            locationHint: locationHint.trim() || undefined,
            suggestedCorrection: suggestedCorrection.trim() || undefined,
          }),
    });
  };

  if (mutation.isSuccess) {
    return (
      <div className={styles.success} role="status">
        <span className={styles.successIcon} aria-hidden="true">
          <CheckCircle2 size={28} />
        </span>
        <DialogTitle className={styles.successTitle}>Report received</DialogTitle>
        <DialogDescription className={styles.successText}>{SUCCESS_MESSAGE}</DialogDescription>
        <Button className={styles.submit} onClick={onDone}>
          Done
        </Button>
      </div>
    );
  }

  const captchaStatus: Record<CaptchaState, string> = {
    loading: "Loading check...",
    interactive: "Complete the check to submit.",
    verified: "Verified",
    expired: "Check expired. Verify again.",
    error: "Check failed to load.",
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <header className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          <Flag size={18} />
        </span>
        <div className={styles.headings}>
          <DialogTitle className={styles.title}>Report an Issue</DialogTitle>
          <DialogDescription className={styles.subtitle}>No sign-in needed.</DialogDescription>
        </div>
        <DialogClose asChild>
          <button type="button" className={styles.close} aria-label="Close">
            <X size={18} />
          </button>
        </DialogClose>
      </header>

      <div className={styles.body}>
        <Section step={1} title="Issue">
          <div className={styles.field}>
            <FieldLabel htmlFor={fieldId("category")} required>
              What is the issue?
            </FieldLabel>
            <Select
              value={category ?? undefined}
              onValueChange={(value) => {
                setCategory(value as ContentReportCategory);
                clearError("category");
              }}
            >
              <SelectTrigger
                id={fieldId("category")}
                className={`${styles.categorySelect} ${category ? styles.categorySelected : ""}`}
                aria-invalid={!!errors.category}
                aria-describedby={errors.category ? fieldId("category-error") : undefined}
              >
                <SelectValue placeholder="Choose the type of issue" />
              </SelectTrigger>
              <SelectContent className={styles.categoryMenu}>
                {CONTENT_REPORT_CATEGORIES.map((option) => {
                  const Icon = CATEGORY_ICONS[option.value];
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <span className={styles.option}>
                        <Icon size={15} className={styles.optionIcon} aria-hidden="true" />
                        {option.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <FieldError id={fieldId("category-error")} message={errors.category} />
          </div>
        </Section>

        <Section step={2} title={isCopyright ? "Copyright details" : "Details"}>
          {isCopyright && (
            <div className={styles.note}>
              <Info size={16} className={styles.noteIcon} aria-hidden="true" />
              <p>{COPYRIGHT_NOTE}</p>
            </div>
          )}

          {isCopyright && (
            <fieldset
              className={styles.fieldset}
              aria-describedby={errors.materialType ? fieldId("material-error") : undefined}
            >
              <legend className={styles.label}>
                Material type
                <RequiredMark />
              </legend>
              <div className={styles.pills} role="radiogroup">
                {COPYRIGHT_MATERIAL_TYPES.map((option) => (
                  <label
                    key={option.value}
                    className={`${styles.pill} ${materialType === option.value ? styles.pillActive : ""}`}
                  >
                    <input
                      type="radio"
                      name={fieldId("material")}
                      value={option.value}
                      checked={materialType === option.value}
                      onChange={() => {
                        setMaterialType(option.value);
                        clearError("materialType");
                      }}
                      className={styles.cardInput}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <FieldError id={fieldId("material-error")} message={errors.materialType} />
            </fieldset>
          )}

          {isCopyright && (
            <div className={styles.grid}>
              <div className={styles.field}>
                <FieldLabel htmlFor={fieldId("material-location")} required>
                  Where it appears
                </FieldLabel>
                <Input
                  id={fieldId("material-location")}
                  value={materialLocation}
                  onChange={(e) => {
                    setMaterialLocation(e.target.value);
                    clearError("materialLocation");
                  }}
                  placeholder="Link or section"
                  maxLength={2000}
                  aria-invalid={!!errors.materialLocation}
                  aria-describedby={errors.materialLocation ? fieldId("material-location-error") : undefined}
                  className={styles.input}
                />
                <FieldError id={fieldId("material-location-error")} message={errors.materialLocation} />
              </div>
              <div className={styles.field}>
                <FieldLabel htmlFor={fieldId("source")}>Original source</FieldLabel>
                <Input
                  id={fieldId("source")}
                  value={originalSource}
                  onChange={(e) => setOriginalSource(e.target.value)}
                  placeholder="Link to your work"
                  maxLength={2000}
                  className={styles.input}
                />
              </div>
            </div>
          )}

          <div className={styles.field}>
            <FieldLabel htmlFor={fieldId("description")} required>
              Description
            </FieldLabel>
            <Textarea
              id={fieldId("description")}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                clearError("description");
              }}
              placeholder={isCopyright ? "What was copied?" : "What's wrong?"}
              rows={3}
              maxLength={4000}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? fieldId("description-error") : undefined}
              className={styles.textarea}
            />
            <FieldError id={fieldId("description-error")} message={errors.description} />
          </div>

          {!isCopyright && (
            <div className={styles.grid}>
              <div className={styles.field}>
                <FieldLabel htmlFor={fieldId("location")}>Location on page</FieldLabel>
                <Input
                  id={fieldId("location")}
                  value={locationHint}
                  onChange={(e) => setLocationHint(e.target.value)}
                  placeholder="Heading or question"
                  list={context.headings.length > 0 ? fieldId("headings") : undefined}
                  maxLength={500}
                  className={styles.input}
                />
                {context.headings.length > 0 && (
                  <datalist id={fieldId("headings")}>
                    {context.headings.map((heading) => (
                      <option key={heading} value={heading} />
                    ))}
                  </datalist>
                )}
              </div>
              <div className={styles.field}>
                <FieldLabel htmlFor={fieldId("correction")}>Suggested correction</FieldLabel>
                <Input
                  id={fieldId("correction")}
                  value={suggestedCorrection}
                  onChange={(e) => setSuggestedCorrection(e.target.value)}
                  placeholder="Correct text"
                  maxLength={4000}
                  className={styles.input}
                />
              </div>
            </div>
          )}

          {selectedText && (
            <div className={styles.quote}>
              <Quote size={14} className={styles.quoteIcon} aria-hidden="true" />
              <p className={styles.quoteText}>
                <span className={styles.quoteLabel}>Highlighted: </span>
                {selectedText.length > 200 ? `${selectedText.slice(0, 200)}...` : selectedText}
              </p>
              <button
                type="button"
                className={styles.quoteRemove}
                onClick={() => setSelectedText(null)}
                aria-label="Remove the highlighted text from this report"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </Section>

        <Section step={3} title="Contact">
          <div className={styles.grid}>
            {isCopyright && (
              <div className={styles.field}>
                <FieldLabel htmlFor={fieldId("name")}>Name</FieldLabel>
                <Input
                  id={fieldId("name")}
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  autoComplete="name"
                  placeholder="Your name"
                  maxLength={150}
                  className={styles.input}
                />
              </div>
            )}
            <div className={styles.field}>
              <FieldLabel htmlFor={fieldId("email")} required>
                Email
              </FieldLabel>
              <Input
                id={fieldId("email")}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError("email");
                }}
                placeholder="you@example.com"
                maxLength={255}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? fieldId("email-error") : undefined}
                className={styles.input}
              />
              <FieldError id={fieldId("email-error")} message={errors.email} />
            </div>
            <div className={styles.field}>
              <FieldLabel htmlFor={fieldId("phone")} required>
                Phone
              </FieldLabel>
              <Input
                id={fieldId("phone")}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearError("phone");
                }}
                placeholder="+91 98765 43210"
                maxLength={20}
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? fieldId("phone-error") : undefined}
                className={styles.input}
              />
              <FieldError id={fieldId("phone-error")} message={errors.phone} />
            </div>
          </div>
        </Section>

        <Section step={4} title="Verification">
          <div className={styles.captchaRow}>
            <TurnstileWidget
              ref={captchaRef}
              appearance="always"
              refreshExpired="auto"
              theme={isDark ? "dark" : "light"}
              onVerify={() => {
                setCaptcha("verified");
                setFormError(null);
              }}
              onExpire={() => setCaptcha("expired")}
              onError={() => setCaptcha("error")}
              onBeforeInteractive={() => setCaptcha((state) => (state === "verified" ? state : "interactive"))}
              className={styles.captchaWidget}
            />
            <div className={styles.captchaStatus} aria-live="polite">
              <p
                className={`${styles.captchaText} ${captcha === "verified" ? styles.captchaOk : ""} ${
                  captcha === "error" ? styles.captchaBad : ""
                }`}
              >
                {captcha === "verified" ? (
                  <ShieldCheck size={15} aria-hidden="true" />
                ) : captcha === "error" ? (
                  <AlertCircle size={15} aria-hidden="true" />
                ) : null}
                {captchaStatus[captcha]}
              </p>
              {(captcha === "error" || captcha === "expired") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCaptcha("loading");
                    captchaRef.current?.reset();
                  }}
                >
                  <RotateCcw size={14} />
                  Try again
                </Button>
              )}
            </div>
          </div>
        </Section>

        <div className={styles.honeypot} aria-hidden="true">
          <label htmlFor={fieldId("website")}>Website</label>
          <input
            id={fieldId("website")}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
      </div>

      <footer className={styles.footer}>
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}
        <div className={styles.footerActions}>
          <Button variant="ghost" onClick={onDone} disabled={mutation.isPending} className={styles.cancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending || captcha !== "verified"}
            className={styles.submit}
            aria-describedby={captcha !== "verified" ? fieldId("submit-hint") : undefined}
          >
            {mutation.isPending ? (
              <>
                <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                Submitting...
              </>
            ) : (
              "Submit Report"
            )}
          </Button>
        </div>
        {captcha !== "verified" && !mutation.isPending && (
          <span id={fieldId("submit-hint")} className={styles.srOnly}>
            Complete the security check to enable submitting.
          </span>
        )}
      </footer>
    </form>
  );
};

/**
 * The "Report an Issue" strip at the foot of every public content page. SharedLayout mounts it
 * once below the page; classifyContentReportPath decides which routes show it, so pages need no
 * changes of their own and dynamically rendered pages are covered by their URL. It shows to
 * everyone, signed in or not, whatever their role.
 */
export const ContentReportBar: React.FC = () => {
  const { pathname } = useLocation();
  const target = useMemo(() => classifyContentReportPath(pathname), [pathname]);
  const [context, setContext] = useState<PageContext | null>(null);
  const pending = useRef<PageContext | null>(null);

  if (!target) return null;

  const open = () => {
    setContext(pending.current ?? capturePageContext());
    pending.current = null;
  };

  return (
    <section className={styles.bar} aria-label="Report an issue with this page" data-content-report>
      <div className={styles.barInner}>
        <p className={styles.prompt}>
          <span className={styles.promptIcon} aria-hidden="true">
            <Flag size={14} />
          </span>
          Spotted a mistake or something out of date on this page?
        </p>
        <button
          type="button"
          className={styles.trigger}
          onPointerDown={() => {
            pending.current = capturePageContext();
          }}
          onClick={open}
          aria-haspopup="dialog"
        >
          <Flag size={15} aria-hidden="true" />
          Report an Issue
        </button>
      </div>
      <Dialog open={!!context} onOpenChange={(isOpen) => !isOpen && setContext(null)}>
        <DialogContent hideCloseButton className={styles.dialog} data-content-report>
          {context && <ReportForm key={pathname} context={context} onDone={() => setContext(null)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
};
