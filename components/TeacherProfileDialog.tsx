import React from "react";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogHeader } from "./ConsoleDialog";
import { Badge } from "./Badge";
import { TeacherAdminView } from "../endpoints/admin/teachers/list_GET.schema";
import { ExternalLink } from "lucide-react";
import styles from "./TeacherProfileDialog.module.css";

interface Props {
  teacher: TeacherAdminView | null;
  onClose: () => void;
  /* Sales contacts carry no account or verification state, so those badges
     would always read "Active" and "Not verified". */
  hideAccountStatus?: boolean;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className={styles.sectionTitle}>{children}</h3>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{children}</span>
    </div>
  );
}

function parseSocialLinks(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, string>;
}

function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === "string");
  }
  return [];
}

export function TeacherProfileDialog({ teacher, onClose, hideAccountStatus = false }: Props) {
  const isOpen = teacher !== null;

  const teachingCategories = parseStringArray(teacher?.teachingCategories);
  const expertiseAreas = parseStringArray(teacher?.expertiseAreas);
  const targetExams = parseStringArray(teacher?.targetExams);
  const contentTypes = parseStringArray(teacher?.productInterest);
  const languages = parseStringArray(teacher?.languages);
  const socialLinks = parseSocialLinks(teacher?.socialLinks);
  const socialEntries = Object.entries(socialLinks).filter(([, url]) => url);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ConsoleDialogContent size="lg" aria-describedby={undefined}>
        <ConsoleDialogHeader title={teacher?.fullName ?? "Teacher profile"}>
          {teacher && (
            <div className={styles.statusBadges}>
              {!hideAccountStatus && (
                <>
                  <Badge variant={teacher.isActive ? "success" : "destructive"}>
                    {teacher.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant={teacher.isVerified ? "success" : "outline"}>
                    {teacher.isVerified ? "Verified" : "Not verified"}
                  </Badge>
                </>
              )}
              <Badge variant={teacher.onboardingCompleted ? "success" : "warning"}>
                {teacher.onboardingCompleted ? "Onboarding complete" : "Onboarding pending"}
              </Badge>
            </div>
          )}
        </ConsoleDialogHeader>

        {teacher && (
          <ConsoleDialogBody>
            <section className={styles.section}>
              <SectionTitle>Profile</SectionTitle>
              <div className={styles.fieldGrid}>
                <Field label="Email">{teacher.email}</Field>
                <Field label="Phone">{teacher.mobileNumber || "-"}</Field>
                <Field label="Current occupation">{teacher.currentOccupation || "-"}</Field>
                <Field label="Teaching experience">{teacher.teachingExperienceLevel || "-"}</Field>
                <Field label="Location">{teacher.location || "-"}</Field>
                <Field label="Academy name">{teacher.academyName || "-"}</Field>
                <Field label="School/college">{teacher.schoolCollegeName || "-"}</Field>
                <Field label="Website">
                  {teacher.websiteUrl ? (
                    <a
                      href={teacher.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.socialLink}
                    >
                      <ExternalLink size={14} />
                      <span>{teacher.websiteUrl}</span>
                    </a>
                  ) : "-"}
                </Field>
              </div>

              {teacher.tagline && (
                <Field label="Tagline">{teacher.tagline}</Field>
              )}

              {teacher.bio && (
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Bio</span>
                  <p className={styles.bioText}>{teacher.bio}</p>
                </div>
              )}

              {teachingCategories.length > 0 && (
                <div className={styles.tagsField}>
                  <span className={styles.fieldLabel}>Teaching categories</span>
                  <div className={styles.badgeList}>
                    {teachingCategories.map((cat) => (
                      <Badge key={cat} variant="secondary">{cat}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {expertiseAreas.length > 0 && (
                <div className={styles.tagsField}>
                  <span className={styles.fieldLabel}>Subjects / expertise</span>
                  <div className={styles.badgeList}>
                    {expertiseAreas.map((area) => (
                      <Badge key={area} variant="secondary">{area}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {targetExams.length > 0 && (
                <div className={styles.tagsField}>
                  <span className={styles.fieldLabel}>Target exams</span>
                  <div className={styles.badgeList}>
                    {targetExams.map((exam) => (
                      <Badge key={exam} variant="outline">{exam}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {contentTypes.length > 0 && (
                <div className={styles.tagsField}>
                  <span className={styles.fieldLabel}>Content types</span>
                  <div className={styles.badgeList}>
                    {contentTypes.map((type) => (
                      <Badge key={type} variant="outline">{type}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {languages.length > 0 && (
                <div className={styles.tagsField}>
                  <span className={styles.fieldLabel}>Languages</span>
                  <div className={styles.badgeList}>
                    {languages.map((lang) => (
                      <Badge key={lang} variant="outline">{lang}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {socialEntries.length > 0 && (
                <div className={styles.tagsField}>
                  <span className={styles.fieldLabel}>Social links</span>
                  <div className={styles.socialLinks}>
                    {socialEntries.map(([platform, url]) => (
                      <a
                        key={platform}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.socialLink}
                      >
                        <ExternalLink size={14} />
                        <span>{platform}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className={styles.section}>
              <SectionTitle>Onboarding details</SectionTitle>
              {teacher.goals && (
                <Field label="Goals">{teacher.goals}</Field>
              )}
              {teacher.discoverySource && (
                <Field label="Discovery source">{teacher.discoverySource}</Field>
              )}
              {teacher.signupSource && (
                <Field label="Campaign source">{teacher.signupSource}</Field>
              )}
              {!teacher.goals && !teacher.discoverySource && !teacher.signupSource && (
                <p className={styles.emptyNote}>No onboarding details provided.</p>
              )}
            </section>
          </ConsoleDialogBody>
        )}
      </ConsoleDialogContent>
    </Dialog>
  );
}