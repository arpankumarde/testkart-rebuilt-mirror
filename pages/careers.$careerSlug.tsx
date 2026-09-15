import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import DOMPurify from "dompurify";
import { z } from "zod";
import { useCareerDetailsQuery, useApplyMutation } from "../helpers/useCareersQuery";
import { wrapContentTables } from "../helpers/contentTables";
import { schema as applySchema } from "../endpoints/careers/apply_POST.schema";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from "../components/Form";
import { Briefcase, MapPin, Building, Clock, Banknote, ArrowLeft, CheckCircle2, FileUp, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { postUploadResume } from "../endpoints/careers/upload-resume_POST.schema";
import styles from "./careers.$careerSlug.module.css";

const CareerDetailPage: React.FC = () => {
  const { careerSlug } = useParams<{ careerSlug: string }>();
  const { data, isLoading, isError } = useCareerDetailsQuery(careerSlug || "");
  const applyMutation = useApplyMutation();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resumeFile, setResumeFile] = useState<{ name: string; url: string; key: string } | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    schema: applySchema,
    defaultValues: {
      careerPostingId: 0,
      name: "",
      email: "",
      phone: "",
      coverLetter: "",
      resumeUrl: "",
      resumeFileId: "",
      linkedinUrl: "",
    },
  });

  // Keep hidden field for career posting ID in sync once data loads
  useEffect(() => {
    if (data && !("error" in data) && data.career) {
      form.setValues((prev) => ({
        ...prev,
        careerPostingId: data.career.id,
      }));
    }
  }, [data, form.setValues]);

  const onSubmit = (values: z.infer<typeof applySchema>) => {
    applyMutation.mutate(values, {
      onSuccess: () => {
        setIsSubmitted(true);
      },
    });
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploadingResume(true);
    setUploadProgress(0);

    try {
      const { presignedUrl, key, publicUrl } = await postUploadResume({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        fileSize: file.size,
      });

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presignedUrl, true);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(null);
          } else {
            reject(new Error("Upload failed"));
          }
        };

        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      setResumeFile({ name: file.name, url: publicUrl, key });
      form.setValues((prev) => ({
        ...prev,
        resumeUrl: publicUrl,
        resumeFileId: key,
      }));
    } catch (err) {
      toast.error("Failed to upload resume. Please try again.");
      console.error(err);
    } finally {
      setIsUploadingResume(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveResume = () => {
    setResumeFile(null);
    form.setValues((prev) => ({
      ...prev,
      resumeUrl: "",
      resumeFileId: "",
    }));
  };

  const formatEmploymentType = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (isLoading) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.backLinkWrapper}>
          <Skeleton style={{ width: "120px", height: "1.5rem" }} />
        </div>
        <div className={styles.layoutGrid}>
          <div className={styles.detailsColumn}>
            <Skeleton style={{ width: "80%", height: "3rem", marginBottom: "var(--spacing-4)" }} />
            <Skeleton style={{ width: "100%", height: "2rem", marginBottom: "var(--spacing-8)" }} />
            <Skeleton style={{ width: "100%", height: "10rem", marginBottom: "var(--spacing-4)" }} />
            <Skeleton style={{ width: "100%", height: "10rem" }} />
          </div>
          <div className={styles.formColumn}>
            <div className={styles.formCard}>
              <Skeleton style={{ width: "60%", height: "2rem", marginBottom: "var(--spacing-6)" }} />
              <Skeleton style={{ width: "100%", height: "4rem", marginBottom: "var(--spacing-4)" }} />
              <Skeleton style={{ width: "100%", height: "4rem", marginBottom: "var(--spacing-4)" }} />
              <Skeleton style={{ width: "100%", height: "4rem", marginBottom: "var(--spacing-4)" }} />
              <Skeleton style={{ width: "100%", height: "3rem" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data || "error" in data) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.notFoundState}>
          <Briefcase size={64} className={styles.notFoundIcon} />
          <h1 className={styles.notFoundTitle}>Position Not Found</h1>
          <p className={styles.notFoundText}>
            The job you are looking for does not exist or is no longer available.
          </p>
          <Button asChild size="lg">
            <Link to="/careers">View All Open Roles</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { career } = data;

  return (
    <>
      <Helmet>
        <title>{`${career.title} - Careers at Testkart`}</title>
        <meta
          name="description"
          content={`Apply for the ${career.title} position at Testkart. Join our team and build the future of education.`}
        />
      </Helmet>

      <div className={styles.pageContainer}>
        <div className={styles.backLinkWrapper}>
          <Link to="/careers" className={styles.backLink}>
            <ArrowLeft size={16} />
            Back to Careers
          </Link>
        </div>

        <div className={styles.layoutGrid}>
          {/* Left Column: Job Details */}
          <div className={styles.detailsColumn}>
            <div className={styles.jobHeader}>
              <h1 className={styles.jobTitle}>{career.title}</h1>
              
              <div className={styles.jobMetaList}>
                {career.department && (
                  <span className={styles.metaItem}>
                    <Building size={18} />
                    {career.department}
                  </span>
                )}
                {career.location && (
                  <span className={styles.metaItem}>
                    <MapPin size={18} />
                    {career.location}
                  </span>
                )}
              </div>

              <div className={styles.jobTags}>
                <Badge variant="secondary" className={styles.tag}>
                  <Clock size={14} className={styles.tagIcon} />
                  {formatEmploymentType(career.employmentType)}
                </Badge>
                {career.experienceLevel && (
                  <Badge variant="outline" className={styles.tag}>
                    <Briefcase size={14} className={styles.tagIcon} />
                    {career.experienceLevel}
                  </Badge>
                )}
                {career.salaryRange && (
                  <Badge variant="success" className={styles.tag}>
                    <Banknote size={14} className={styles.tagIcon} />
                    {career.salaryRange}
                  </Badge>
                )}
              </div>
            </div>

            <div className={styles.richTextSection}>
              <h2 className={styles.sectionHeading}>About the Role</h2>
              <div
                className={styles.richContent}
                dangerouslySetInnerHTML={{ __html: wrapContentTables(DOMPurify.sanitize(career.description)) }}
              />
            </div>

            {career.requirements && (
              <div className={styles.richTextSection}>
                <h2 className={styles.sectionHeading}>Requirements</h2>
                <div
                  className={styles.richContent}
                  dangerouslySetInnerHTML={{ __html: wrapContentTables(DOMPurify.sanitize(career.requirements)) }}
                />
              </div>
            )}
          </div>

          {/* Right Column: Application Form */}
          <div className={styles.formColumn}>
            <div className={styles.formCard}>
              {isSubmitted ? (
                <div className={styles.successState}>
                  <CheckCircle2 size={56} className={styles.successIcon} />
                  <h3 className={styles.successTitle}>Application Submitted</h3>
                  <p className={styles.successText}>
                    Thank you for applying to join the Testkart team! We have received your application and will be in touch soon.
                  </p>
                  <Button asChild variant="outline" className={styles.backButton}>
                    <Link to="/careers">View Other Roles</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className={styles.formTitle}>Apply for this position</h2>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className={styles.applicationForm}>
                      <FormItem name="name">
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Jane Doe"
                            value={form.values.name}
                            onChange={(e) => form.setValues({ ...form.values, name: e.target.value })}
                            disabled={applyMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>

                      <FormItem name="email">
                        <FormLabel>Email Address *</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="jane@example.com"
                            value={form.values.email}
                            onChange={(e) => form.setValues({ ...form.values, email: e.target.value })}
                            disabled={applyMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>

                      <FormItem name="phone">
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="+91 90000 00000"
                            value={form.values.phone}
                            onChange={(e) => form.setValues({ ...form.values, phone: e.target.value })}
                            disabled={applyMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>

                      <FormItem name="linkedinUrl">
                        <FormLabel>LinkedIn Profile URL</FormLabel>
                        <FormControl>
                          <Input
                            type="url"
                            placeholder="https://linkedin.com/in/janedoe"
                            value={form.values.linkedinUrl}
                            onChange={(e) => form.setValues({ ...form.values, linkedinUrl: e.target.value })}
                            disabled={applyMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>

                      <div className={styles.formItemLike}>
<label className={styles.formLabelText}>Resume (PDF, DOC, DOCX)</label>
                        {resumeFile ? (
                          <div className={styles.uploadedFileCard}>
                            <div className={styles.uploadedFileInfo}>
                              <FileText size={20} className={styles.fileIcon} />
                              <span className={styles.fileName} title={resumeFile.name}>
                                {resumeFile.name}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className={styles.removeFileButton}
                              onClick={handleRemoveResume}
                              disabled={applyMutation.isPending}
                            >
                              <X size={16} />
                            </Button>
                          </div>
                        ) : (
                          <div
                            className={`${styles.uploadZone} ${isUploadingResume || applyMutation.isPending ? styles.uploadZoneDisabled : ""}`}
                            onClick={() => !isUploadingResume && !applyMutation.isPending && fileInputRef.current?.click()}
                          >
                            <input
                              type="file"
                              ref={fileInputRef}
                              className={styles.hiddenFileInput}
                              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              onChange={handleResumeUpload}
                              disabled={isUploadingResume || applyMutation.isPending}
                            />
                            {isUploadingResume ? (
                              <div className={styles.uploadingState}>
                                <div className={styles.uploadProgressContainer}>
                                  <div
                                    className={styles.uploadProgressBar}
                                    style={{ width: `${uploadProgress}%` }}
                                  />
                                </div>
                                <span className={styles.uploadProgressText}>Uploading... {uploadProgress}%</span>
                              </div>
                            ) : (
                              <div className={styles.uploadPrompt}>
                                <FileUp size={24} className={styles.uploadIcon} />
                                <span>Click to upload resume (Max 10MB)</span>
                              </div>
                            )}
                          </div>
                        )}
                        <input type="hidden" name="resumeUrl" value={form.values.resumeUrl} />
                        <input type="hidden" name="resumeFileId" value={form.values.resumeFileId} />
                      </div>

                      <FormItem name="coverLetter">
                        <FormLabel>Cover Letter</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tell us why you're a great fit for this role..."
                            rows={5}
                            value={form.values.coverLetter}
                            onChange={(e) => form.setValues({ ...form.values, coverLetter: e.target.value })}
                            disabled={applyMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>

                      <Button
                        type="submit"
                        size="lg"
                        className={styles.submitButton}
                        disabled={applyMutation.isPending}
                      >
                        {applyMutation.isPending ? "Submitting..." : "Apply Now"}
                      </Button>
                    </form>
                  </Form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CareerDetailPage;