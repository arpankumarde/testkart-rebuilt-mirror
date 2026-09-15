import React, { useState, useMemo } from "react";
import { Helmet } from "react-helmet";
import {
  useAdminEmailTemplatesQuery,
  useUpdateEmailTemplateMutation,
  useSendTestEmailMutation,
} from "../helpers/useAdminEmailTemplates";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/Tabs";
import { Skeleton } from "../components/Skeleton";
import {
  AlertCircle,
  AlertTriangle,
  Edit,
  Copy,
  ArrowLeft,
  Eye,
  Code,
  Save,
  Send,
  Search,
  Info,
  Zap,
  ZapOff,
  Monitor,
  Smartphone,
} from "lucide-react";
import { Dialog } from "../components/Dialog";
import {
  ConsoleDialogContent,
  ConsoleDialogHeader,
  ConsoleDialogBody,
  ConsoleDialogFooter,
} from "../components/ConsoleDialog";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import {
  ConsoleListToolbar,
  consoleToolbarControlClass,
} from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleFilterNotice } from "../components/ConsoleFilterNotice";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/Select";
import {
  useForm,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "../components/Form";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Textarea } from "../components/Textarea";
import { Switch } from "../components/Switch";
import { Badge } from "../components/Badge";
import { schema as updateSchema } from "../endpoints/admin/email-templates/update_POST.schema";
import { EmailTemplate } from "../endpoints/admin/email-templates/list_GET.schema";
import {
  getEmailTemplateWiring,
  WIRING_LABELS,
  UNMANAGED_EMAILS,
  type EmailTemplateWiringStatus,
} from "../helpers/emailTemplateWiring";
import {
  fillWithSamples,
  extractPlaceholders,
  getSampleValue,
} from "../helpers/emailPreviewSamples";
import { EmailPreview } from "../components/EmailPreview";
import { toast } from "sonner";
import { z } from "zod";
import styles from "./admin.email-templates.module.css";

// Helper to categorize templates based on their key or name
const getCategory = (template: EmailTemplate): string => {
  const key = template.templateKey.toLowerCase();
  
  // Registration & Account
  if (key.includes("welcome") || key.includes("register") || key.includes("signup") || key.includes("verify") || key.includes("password_reset") || key.includes("account_closure") || key.includes("account_suspended") || key.includes("account_reactivated") || key.includes("verified_badge"))
    return "Account & Auth";
  
  // Orders & Payments
  if (key.includes("order") || key.includes("payment") || key.includes("refund") || key.includes("promo_code"))
    return "Orders & Payments";
  
  // Enrollments
  if (key.includes("enroll") || key.includes("course_enrollment") || key.includes("test_enrollment") || key.includes("bundle") || key.includes("live_test_enrollment") || key.includes("sponsored") || key.includes("digital_product") || key.includes("free_test") || key.includes("free_course"))
    return "Enrollments";
  
  // Tests & Results
  if (key.includes("test_completed") || key.includes("certificate") || key.includes("live_test_reminder") || key.includes("live_test_results") || key.includes("review_reminder"))
    return "Tests & Results";
  
  // Student Wallet & Bank (check before Teacher to avoid student_bank matching bank_details)
if (key.includes("student_bank") || key.includes("student_withdrawal") || key.includes("wallet_credit"))
return "Student Wallet";

// Teacher
if (key.includes("subscription") || key.includes("mandate") || key.includes("withdrawal") || key.includes("new_purchase") || key.includes("new_student") || key.includes("new_review") || key.includes("bank_details_verified") || key.includes("bank_details_rejected"))
return "Teacher & Earnings";
  
  // Support & Contact
  if (key.includes("support") || key.includes("contact") || key.includes("content_submitted") || key.includes("content_review"))
    return "Support & Admin";
  
  return "Other";
};

const sendTestSchema = z.object({
  recipientEmail: z.string().email("Invalid email address"),
});

const WIRING_BADGE_VARIANT = {
  live: "success",
  hardcoded: "warning",
  "no-trigger": "secondary",
} as const;

const WiringBadge = ({
  status,
  className,
}: {
  status: EmailTemplateWiringStatus;
  className?: string;
}) => (
  <Badge
    variant={WIRING_BADGE_VARIANT[status]}
    className={`${styles.wiringBadge} ${
      status === "hardcoded" ? styles.wiringBadgeHardcoded : ""
    } ${className || ""}`}
    title={WIRING_LABELS[status].description}
  >
    {status === "live" ? <Zap size={11} /> : <ZapOff size={11} />}
    {WIRING_LABELS[status].label}
  </Badge>
);

const TemplateEditForm = ({
  template,
  onCancel,
}: {
  template: EmailTemplate;
  onCancel: () => void;
}) => {
  const updateMutation = useUpdateEmailTemplateMutation();
  const sendTestMutation = useSendTestEmailMutation();
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [isTestEmailDialogOpen, setIsTestEmailDialogOpen] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<"html" | "text">("html");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "desktop"
  );
  const [useSampleValues, setUseSampleValues] = useState(true);
  const wiring = getEmailTemplateWiring(template.templateKey);

  const form = useForm({
    schema: updateSchema,
    defaultValues: {
      id: template.id,
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent || "",
      isActive: template.isActive ?? true,
    },
  });

  // Separate form for test email to avoid validation conflicts
  const testEmailForm = useForm({
    schema: sendTestSchema,
    defaultValues: {
      recipientEmail: "",
    },
  });

  const renderPreview = (content: string | null | undefined) =>
    useSampleValues ? fillWithSamples(content) : content || "";

  // Guards against the edited HTML silently losing structure or placeholders.
  const integrityWarnings = useMemo(() => {
    const warnings: string[] = [];
    const edited = form.values.htmlContent;
    const original = template.htmlContent;

    if (/<html[\s>]/i.test(original) && !/<html[\s>]/i.test(edited)) {
      warnings.push(
        "The original was a complete HTML document but the current content has no <html> tag. The body background and font will be lost in most email clients."
      );
    }

    const stillUsed = extractPlaceholders(edited, form.values.subject);
    const lost = extractPlaceholders(original, template.subject).filter(
      (p) => !stillUsed.includes(p)
    );
    if (lost.length > 0) {
      warnings.push(
        `These placeholders are no longer used: ${lost
          .map((p) => `{{${p}}}`)
          .join(", ")}. That data will not appear in the email.`
      );
    }

    if (edited.trim().length > 0 && edited.length < original.length * 0.5) {
      warnings.push(
        "The content is less than half its original length. Check nothing was removed by accident."
      );
    }

    return warnings;
  }, [
    form.values.htmlContent,
    form.values.subject,
    template.htmlContent,
    template.subject,
  ]);

  // The placeholders column is stale on some rows, so trust the content itself.
  const placeholdersInUse = useMemo(
    () =>
      extractPlaceholders(
        form.values.subject,
        form.values.htmlContent,
        form.values.textContent
      ),
    [form.values.subject, form.values.htmlContent, form.values.textContent]
  );

  const unusedPlaceholders = useMemo(
    () => template.placeholders.filter((p) => !placeholdersInUse.includes(p)),
    [template.placeholders, placeholdersInUse]
  );

  const onSubmit = (values: z.infer<typeof updateSchema>) => {
    updateMutation.mutate(values, {
      onSuccess: () => {
        onCancel();
      },
    });
  };

  const onSendTestEmail = (values: z.infer<typeof sendTestSchema>) => {
    sendTestMutation.mutate(
      {
        templateId: template.id,
        recipientEmail: values.recipientEmail,
      },
      {
        onSuccess: () => {
          setIsTestEmailDialogOpen(false);
          testEmailForm.setValues({ recipientEmail: "" });
        },
      }
    );
  };

  const copyPlaceholder = (placeholder: string) => {
    navigator.clipboard.writeText(`{{${placeholder}}}`);
    toast.success(`Copied {{${placeholder}}} to clipboard`);
  };

  return (
    <div className={styles.page}>
      <Button
        variant="ghost"
        onClick={onCancel}
        className={styles.backButton}
      >
        <ArrowLeft size={16} /> Back to templates
      </Button>

      <ConsolePageHeader title={template.name}>
        <Badge variant={template.isActive ? "success" : "secondary"}>
          {template.isActive ? "Active" : "Inactive"}
        </Badge>
        <WiringBadge status={wiring.status} />
      </ConsolePageHeader>

      {wiring.status !== "live" && (
        <div
          className={`${styles.callout} ${
            wiring.status === "hardcoded"
              ? styles.calloutWarning
              : styles.calloutNeutral
          }`}
        >
          <AlertTriangle size={18} className={styles.calloutIcon} />
          <div>
            <strong>
              {wiring.status === "hardcoded"
                ? "Changes here will not reach users"
                : "This email is never sent"}
            </strong>
            <p>{WIRING_LABELS[wiring.status].description}</p>
            <p className={styles.calloutSource}>
              {wiring.status === "hardcoded" ? "Sent from: " : "Reason: "}
              <code>{wiring.source}</code>
            </p>
          </div>
        </div>
      )}

      <Dialog
        open={isTestEmailDialogOpen}
        onOpenChange={setIsTestEmailDialogOpen}
      >
        <ConsoleDialogContent size="sm">
          <ConsoleDialogHeader
            title="Send test email"
            description="Enter an email address to send a preview of this template. Placeholders will be replaced with dummy text."
          />
          <Form {...testEmailForm}>
            <form onSubmit={testEmailForm.handleSubmit(onSendTestEmail)}>
              <ConsoleDialogBody>
                <FormItem name="recipientEmail">
                  <FormLabel>Recipient email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter email address"
                      type="email"
                      value={testEmailForm.values.recipientEmail}
                      onChange={(e) =>
                        testEmailForm.setValues({
                          recipientEmail: e.target.value,
                        })
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </ConsoleDialogBody>
              <ConsoleDialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsTestEmailDialogOpen(false)}
                  disabled={sendTestMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={sendTestMutation.isPending}>
                  {sendTestMutation.isPending ? "Sending..." : "Send test"}
                </Button>
              </ConsoleDialogFooter>
            </form>
          </Form>
        </ConsoleDialogContent>
      </Dialog>

      <div className={styles.editContent}>
        <div className={styles.mainColumn}>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "edit" | "preview")}
            className={styles.editTabs}
          >
            <TabsList>
              <TabsTrigger value="edit">
                <Code size={16} style={{ marginRight: 8 }} /> Editor
              </TabsTrigger>
              <TabsTrigger value="preview">
                <Eye size={16} style={{ marginRight: 8 }} /> Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className={styles.tabContent}>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className={styles.form}
                >
                  <div className={styles.formGrid}>
                    <FormItem name="subject">
                      <FormLabel>Email subject</FormLabel>
                      <FormControl>
                        <Input
                          value={form.values.subject}
                          onChange={(e) =>
                            form.setValues((prev) => ({
                              ...prev,
                              subject: e.target.value,
                            }))
                          }
                          placeholder="Enter email subject"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>

                    <FormItem name="isActive">
                      <div className={styles.switchContainer}>
                        <FormLabel>Sending</FormLabel>
                        <div className={styles.switchWrapper}>
                          <Switch
                            checked={form.values.isActive}
                            onCheckedChange={(checked) =>
                              form.setValues((prev) => ({
                                ...prev,
                                isActive: checked,
                              }))
                            }
                          />
                          <span className={styles.switchLabel}>
                            {form.values.isActive ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                      </div>
                    </FormItem>
                  </div>

                  <FormItem name="htmlContent">
                    <FormLabel>HTML content</FormLabel>
                    <FormDescription>
                      These are complete HTML email documents with inline styles.
                      Edit the source directly and use the Preview tab to check
                      the result.
                    </FormDescription>
                    <FormControl>
                      <Textarea
                        value={form.values.htmlContent}
                        onChange={(e) =>
                          form.setValues((prev) => ({
                            ...prev,
                            htmlContent: e.target.value,
                          }))
                        }
                        className={styles.htmlEditor}
                        spellCheck={false}
                        rows={22}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>

                  {integrityWarnings.length > 0 && (
                    <div className={`${styles.callout} ${styles.calloutWarning}`}>
                      <AlertTriangle size={18} className={styles.calloutIcon} />
                      <div>
                        <strong>Check before saving</strong>
                        <ul className={styles.warningList}>
                          {integrityWarnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  <FormItem name="textContent">
                    <FormLabel>Plain text content (optional)</FormLabel>
                    <FormDescription>
                      Used for email clients that do not support HTML.
                    </FormDescription>
                    <FormControl>
                      <Textarea
                        value={form.values.textContent || ""}
                        onChange={(e) =>
                          form.setValues((prev) => ({
                            ...prev,
                            textContent: e.target.value,
                          }))
                        }
                        rows={5}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>

                  <div className={styles.formActions}>
                    <span className={styles.lastUpdated}>
                      Last updated:{" "}
                      {template.updatedAt
                        ? new Date(template.updatedAt).toLocaleString()
                        : "Never"}
                    </span>
                    <div className={styles.actionButtons}>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsTestEmailDialogOpen(true)}
                        disabled={
                          updateMutation.isPending || sendTestMutation.isPending
                        }
                      >
                        <Send size={16} />
                        Send test
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        disabled={updateMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={updateMutation.isPending}>
                        <Save size={16} />
                        {updateMutation.isPending ? "Saving..." : "Save changes"}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="preview" className={styles.tabContent}>
              <div className={styles.previewToolbar}>
                <div className={styles.previewToggleGroup}>
                  <button
                    type="button"
                    className={`${styles.toolbarButton} ${
                      previewFormat === "html" ? styles.toolbarButtonActive : ""
                    }`}
                    onClick={() => setPreviewFormat("html")}
                    aria-pressed={previewFormat === "html"}
                  >
                    HTML
                  </button>
                  <button
                    type="button"
                    className={`${styles.toolbarButton} ${
                      previewFormat === "text" ? styles.toolbarButtonActive : ""
                    }`}
                    onClick={() => setPreviewFormat("text")}
                    aria-pressed={previewFormat === "text"}
                  >
                    Plain text
                  </button>
                </div>

                {previewFormat === "html" && (
                  <div className={styles.previewToggleGroup}>
                    <button
                      type="button"
                      className={`${styles.toolbarButton} ${
                        previewDevice === "desktop"
                          ? styles.toolbarButtonActive
                          : ""
                      }`}
                      onClick={() => setPreviewDevice("desktop")}
                      aria-pressed={previewDevice === "desktop"}
                      title="Desktop width"
                    >
                      <Monitor size={14} /> Desktop
                    </button>
                    <button
                      type="button"
                      className={`${styles.toolbarButton} ${
                        previewDevice === "mobile"
                          ? styles.toolbarButtonActive
                          : ""
                      }`}
                      onClick={() => setPreviewDevice("mobile")}
                      aria-pressed={previewDevice === "mobile"}
                      title="Mobile width (375px)"
                    >
                      <Smartphone size={14} /> Mobile
                    </button>
                  </div>
                )}

                <label className={styles.sampleToggle}>
                  <Switch
                    checked={useSampleValues}
                    onCheckedChange={setUseSampleValues}
                  />
                  <span>Fill placeholders with sample data</span>
                </label>
              </div>

              <div className={styles.previewContainer}>
                <div className={styles.previewHeader}>
                  <div className={styles.previewSubjectRow}>
                    <span className={styles.previewFrom}>
                      Testkart &lt;noreply@testkart.in&gt;
                    </span>
                    <strong className={styles.previewSubject}>
                      {renderPreview(form.values.subject) || "(no subject)"}
                    </strong>
                  </div>
                </div>

                {previewFormat === "html" ? (
                  <div className={styles.previewBody}>
                    <EmailPreview
                      html={renderPreview(form.values.htmlContent)}
                      width={previewDevice === "mobile" ? 375 : undefined}
                    />
                  </div>
                ) : form.values.textContent ? (
                  <pre className={styles.textPreview}>
                    {renderPreview(form.values.textContent)}
                  </pre>
                ) : (
                  <div className={styles.previewBody}>
                    <p className={styles.emptyText}>
                      This template has no plain text version. Email clients that
                      block HTML will show nothing.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className={styles.sidebarColumn}>
          <div className={styles.placeholdersCard}>
            <h3>Placeholders in use</h3>
            <p>Click to copy. Sample value shown below each one.</p>
            <div className={styles.placeholderList}>
              {placeholdersInUse.length > 0 ? (
                placeholdersInUse.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={styles.placeholderBadge}
                    onClick={() => copyPlaceholder(p)}
                    title={`Click to copy. Preview value: ${getSampleValue(p)}`}
                  >
                    <span className={styles.placeholderName}>
                      {`{{${p}}}`}
                      <Copy size={12} />
                    </span>
                    <span className={styles.placeholderSample}>
                      {getSampleValue(p)}
                    </span>
                  </button>
                ))
              ) : (
                <span className={styles.noPlaceholders}>
                  This template has no placeholders
                </span>
              )}
            </div>

            {unusedPlaceholders.length > 0 && (
              <p className={styles.placeholderNote}>
                Declared but not used in the content:{" "}
                {unusedPlaceholders.map((p) => `{{${p}}}`).join(", ")}
              </p>
            )}
          </div>

          <div className={styles.infoCard}>
            <h3>Template info</h3>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Key</span>
              <span className={styles.infoValue}>{template.templateKey}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Description</span>
              <span className={styles.infoValue}>
                {template.description || "No description"}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                {wiring.status === "no-trigger" ? "Status" : "Triggered by"}
              </span>
              <span className={styles.infoValue}>{wiring.source}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const TemplateCard = ({
  template,
  onSelect,
}: {
  template: EmailTemplate;
  onSelect: () => void;
}) => {
  const wiring = getEmailTemplateWiring(template.templateKey);

  return (
    <div
      className={styles.card}
      role="button"
      aria-label={`Edit ${template.name}`}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{template.name}</h3>
        <div className={styles.cardBadges}>
          <WiringBadge status={wiring.status} className={styles.statusBadge} />
          {!template.isActive && (
            <Badge variant="secondary" className={styles.statusBadge}>
              Inactive
            </Badge>
          )}
        </div>
      </div>
      <p className={styles.cardDescription}>
        {template.description || "No description available."}
      </p>
      <div className={styles.cardFooter}>
        <div className={styles.placeholderCount}>
          <Code size={14} />
          <span>{template.placeholders.length} placeholders</span>
        </div>
        <span className={styles.editLink}>
          Edit <Edit size={14} />
        </span>
      </div>
    </div>
  );
};

const AdminEmailTemplates = () => {
  const { data, isFetching, error, refetch } = useAdminEmailTemplatesQuery();
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    null
  );
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    EmailTemplateWiringStatus | "all"
  >("all");
  // ?filter=inactive comes from the content dashboard; it matches is_active = false, so a null flag is not inactive.
  const { read, write } = useListUrlParams();
  const inactiveOnly = read<"inactive" | "none">("filter", ["inactive"], "none") === "inactive";
  useRefetchOnLinkArrival(inactiveOnly, isFetching, refetch);

  const categories = ["Account & Auth", "Orders & Payments", "Enrollments", "Tests & Results", "Teacher & Earnings", "Student Wallet", "Support & Admin", "Other"];

  const wiringCounts = useMemo(() => {
    const counts = { live: 0, hardcoded: 0, "no-trigger": 0 };
    for (const t of data?.templates ?? []) {
      counts[getEmailTemplateWiring(t.templateKey).status] += 1;
    }
    return counts;
  }, [data]);

  const filteredTemplates = useMemo(() => {
    if (!data?.templates) return [];
    const query = search.trim().toLowerCase();

    return data.templates.filter((t) => {
      if (inactiveOnly && t.isActive !== false) return false;
      if (statusFilter !== "all") {
        if (getEmailTemplateWiring(t.templateKey).status !== statusFilter)
          return false;
      }
      if (activeCategory !== "all" && getCategory(t) !== activeCategory)
        return false;
      if (!query) return true;
      const haystack = `${t.name} ${t.templateKey} ${t.description ?? ""}`;
      return haystack.toLowerCase().includes(query);
    });
  }, [data, activeCategory, search, statusFilter, inactiveOnly]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setActiveCategory("all");
    write({ filter: null });
  };

  const selectedTemplate = useMemo(
    () => data?.templates.find((t) => t.id === selectedTemplateId),
    [data, selectedTemplateId]
  );

  if (selectedTemplate) {
    return (
      <>
        <Helmet>
          <title>Edit email template - Testkart Admin</title>
        </Helmet>
        <TemplateEditForm
          template={selectedTemplate}
          onCancel={() => setSelectedTemplateId(null)}
        />
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Email templates - Testkart Admin</title>
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Email templates" />

        <ConsoleListToolbar
          tabs={[
            { value: "all", label: "All", count: data?.templates.length },
            {
              value: "live",
              label: "Live",
              count: data ? wiringCounts.live : undefined,
            },
            {
              value: "hardcoded",
              label: "Not wired",
              count: data ? wiringCounts.hardcoded : undefined,
            },
            {
              value: "no-trigger",
              label: "Never sent",
              count: data ? wiringCounts["no-trigger"] : undefined,
            },
          ]}
          value={statusFilter}
          onValueChange={(value) =>
            setStatusFilter(value as EmailTemplateWiringStatus | "all")
          }
          tabsLabel="Filter by wiring status"
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search by name, key or description",
            label: "Search templates",
          }}
        >
          <Select value={activeCategory} onValueChange={setActiveCategory}>
            <SelectTrigger
              className={consoleToolbarControlClass}
              aria-label="Filter by category"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ConsoleListToolbar>

        <div className={styles.noticeCard}>
          <Info size={18} className={styles.noticeIcon} />
          <div>
            <strong>
              Only templates marked Live are read from this screen at send time.
            </strong>
            <p>
              OTP and admin password reset emails are not managed here. Login,
              signup and email-verification codes and the admin reset link are
              built in code and sent directly, so they have no row in this table
              and cannot be edited from this screen.
            </p>
            <ul className={styles.noticeList}>
              {UNMANAGED_EMAILS.map((item) => (
                <li key={item.source}>
                  {item.name} <code>{item.source}</code>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {inactiveOnly && (
          <ConsoleFilterNotice
            label="Templates switched off"
            count={data ? filteredTemplates.length : undefined}
            onClear={() => write({ filter: null })}
          />
        )}

        {isFetching && !data ? (
          <div className={styles.skeletonGrid}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className={styles.cardSkeleton} />
            ))}
          </div>
        ) : error ? (
          <ConsoleListEmpty
            tone="error"
            icon={<AlertCircle size={24} />}
            title="Failed to load templates"
            description={
              error instanceof Error
                ? error.message
                : "An unknown error occurred."
            }
          >
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </ConsoleListEmpty>
        ) : filteredTemplates.length === 0 ? (
          <ConsoleListEmpty
            icon={<Search size={24} />}
            title="No templates match"
            description="Nothing matches the current filters."
          >
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </ConsoleListEmpty>
        ) : (
          <div className={styles.grid}>
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={() => setSelectedTemplateId(template.id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default AdminEmailTemplates;