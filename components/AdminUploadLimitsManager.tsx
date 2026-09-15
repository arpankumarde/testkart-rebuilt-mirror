import React, { useState, useEffect } from "react";
import { useUploadLimitsQuery, useUpdateUploadLimitsMutation } from "../helpers/useUploadLimits";
import { Input } from "./Input";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { toast } from "sonner";
import { OutputType as UploadLimitsType } from "../endpoints/upload-limits_GET.schema";
import { STUDY_NOTES_PDF_MAX_MB } from "../helpers/digitalProductRules";
import styles from "./AdminUploadLimitsManager.module.css";

const DEFAULT_MAX_MB = 10240;

const LIMIT_FIELDS: { key: keyof UploadLimitsType; label: string; description: string; maxMb?: number }[] = [
  { key: "thumbnailMaxMb", label: "Thumbnail Images", description: "Test, course, live test, and bundle thumbnails" },
  { key: "profilePictureMaxMb", label: "Profile Pictures", description: "Teacher and student profile photos" },
  { key: "kycDocumentMaxMb", label: "KYC Documents", description: "PAN card and identity verification documents" },
  { key: "coursePdfMaxMb", label: "Course PDF Attachments", description: "PDF attachments in course lessons" },
  { key: "courseIntroVideoMaxMb", label: "Course Intro Video", description: "Course introduction/preview video" },
  { key: "lessonVideoMaxMb", label: "Lesson Videos", description: "Course lesson video uploads" },
  { key: "digitalProductPdfMaxMb", label: "Digital Product PDFs", description: `Study notes and digital product PDFs, at most ${STUDY_NOTES_PDF_MAX_MB} MB`, maxMb: STUDY_NOTES_PDF_MAX_MB },
  { key: "richTextImageMaxMb", label: "Rich Text Images", description: "Images embedded in rich text editor" },
];

export const AdminUploadLimitsManager: React.FC = () => {
  const { data, isLoading } = useUploadLimitsQuery();
  const { mutate, isPending } = useUpdateUploadLimitsMutation();
  const [localValues, setLocalValues] = useState<Partial<UploadLimitsType>>({});

  useEffect(() => {
    if (data) {
      setLocalValues(data);
    }
  }, [data]);

  const handleChange = (key: keyof UploadLimitsType, value: string) => {
    const numValue = parseInt(value, 10);
    setLocalValues(prev => ({ ...prev, [key]: isNaN(numValue) ? undefined : numValue }));
  };

  const handleSave = () => {
    const submitData: Partial<UploadLimitsType> = {};
    let hasError = false;
    
    for (const field of LIMIT_FIELDS) {
      const val = localValues[field.key];
      if (typeof val === 'number') {
        const maxMb = field.maxMb ?? DEFAULT_MAX_MB;
        if (val < 1 || val > maxMb) {
          hasError = true;
          toast.error(`Value for ${field.label} must be between 1 and ${maxMb} MB`);
          return;
        }
        submitData[field.key] = val;
      }
    }

    if (hasError) return;

    mutate(submitData, {
      onSuccess: () => {
        toast.success("Upload limits updated successfully");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update upload limits");
      }
    });
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.list}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={styles.row}>
              <div className={styles.rowInfo}>
                <Skeleton style={{ height: "1.25rem", width: "150px" }} />
                <Skeleton style={{ height: "1rem", width: "250px", marginTop: "var(--spacing-1)" }} />
              </div>
              <Skeleton style={{ height: "2.5rem", width: "100px" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasChanges = data && LIMIT_FIELDS.some(field => localValues[field.key] !== data[field.key]);

  return (
    <div className={styles.container}>
      <div className={styles.list}>
        {LIMIT_FIELDS.map(field => (
          <div key={field.key} className={styles.row}>
            <div className={styles.rowInfo}>
              <label className={styles.label}>{field.label}</label>
              <span className={styles.description}>{field.description}</span>
            </div>
            <div className={styles.inputWrapper}>
              <Input
                type="number"
                min={1}
                max={field.maxMb ?? DEFAULT_MAX_MB}
                value={localValues[field.key] === undefined ? "" : localValues[field.key]}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className={styles.input}
              />
              <span className={styles.unit}>MB</span>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.footer}>
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || isPending}
        >
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};