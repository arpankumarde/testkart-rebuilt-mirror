import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useMutation } from "@tanstack/react-query";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { useUploadLimits } from "../helpers/useUploadLimits";
import { postAdminProfileUpdate } from "../endpoints/admin/profile/update_POST.schema";
import { AdminRole, ADMIN_ROLE_LABELS } from "../helpers/AdminTypes";
import { R2FileUploader } from "../components/R2FileUploader";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { toast } from "sonner";
import { Save, Lock, RotateCcw } from "lucide-react";
import styles from "./admin.profile.module.css";

const BIO_MAX_LENGTH = 1000;

const ROLE_BADGE_VARIANTS: Record<AdminRole, "default" | "secondary" | "outline"> = {
  super_admin: "default",
  admin: "secondary",
  billing_manager: "outline",
  manager: "outline",
};

const AdminProfilePage: React.FC = () => {
  const { authState, onLogin } = useAdminAuth();
  const limits = useUploadLimits();

  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [avatarFileId, setAvatarFileId] = useState<string | undefined>(undefined);

  const admin = authState.type === "authenticated" ? authState.admin : null;
  const adminId = admin?.id ?? null;

  useEffect(() => {
    if (!admin) return;
    setFullName(admin.fullName);
    setBio(admin.bio ?? "");
    setAvatarUrl(admin.avatarUrl ?? undefined);
    setAvatarFileId(admin.avatarFileId ?? undefined);
    // Only reseed the form when a different admin is loaded, never on every
    // session refetch — that would discard whatever is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId]);

  const updateMutation = useMutation({
    mutationFn: postAdminProfileUpdate,
    onSuccess: (result) => {
      onLogin(result.admin);
      setFullName(result.admin.fullName);
      setBio(result.admin.bio ?? "");
      setAvatarUrl(result.admin.avatarUrl ?? undefined);
      setAvatarFileId(result.admin.avatarFileId ?? undefined);
      toast.success("Profile updated.");
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Could not save your profile.";
      toast.error(message);
    },
  });

  const handleAvatarUploadSuccess = (result: { filePath: string; fileId: string; url: string }) => {
    // The uploader reports removal as empty strings; keep those out of state so
    // they never reach the endpoint, which validates avatarUrl as a URL.
    setAvatarUrl(result.url === "" ? undefined : result.url);
    setAvatarFileId(result.fileId === "" ? undefined : result.fileId);
  };

  const handleReset = () => {
    if (!admin) return;
    setFullName(admin.fullName);
    setBio(admin.bio ?? "");
    setAvatarUrl(admin.avatarUrl ?? undefined);
    setAvatarFileId(admin.avatarFileId ?? undefined);
  };

  const handleSave = () => {
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      toast.error("Enter your full name.");
      return;
    }
    if (bio.length > BIO_MAX_LENGTH) {
      toast.error(`Your bio is over the ${BIO_MAX_LENGTH} character limit.`);
      return;
    }

    const nextAvatarUrl = avatarUrl && avatarUrl.trim() !== "" ? avatarUrl : null;
    const trimmedBio = bio.trim();

    updateMutation.mutate({
      fullName: trimmedName,
      avatarUrl: nextAvatarUrl,
      avatarFileId: nextAvatarUrl ? avatarFileId ?? null : null,
      bio: trimmedBio === "" ? null : trimmedBio,
    });
  };

  if (authState.type === "loading") {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton style={{ height: "2rem", width: "10rem" }} />
        <div className={styles.layout}>
          <Skeleton style={{ height: "340px", borderRadius: "var(--radius-md)" }} />
          <Skeleton style={{ height: "480px", borderRadius: "var(--radius-md)" }} />
        </div>
      </div>
    );
  }

  if (!admin) {
    return null;
  }

  const isDirty =
    fullName !== admin.fullName ||
    bio !== (admin.bio ?? "") ||
    (avatarUrl ?? "") !== (admin.avatarUrl ?? "");

  const bioLength = bio.length;
  const isBioOverLimit = bioLength > BIO_MAX_LENGTH;
  const canSave = isDirty && !isBioOverLimit && fullName.trim() !== "" && !updateMutation.isPending;

  return (
    <>
      <Helmet>
        <title>Profile - Testkart Admin</title>
        <meta name="description" content="Your admin profile." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Profile" />

        <div className={styles.layout}>
          <aside className={styles.identityCard}>
            <div className={styles.uploaderWrap}>
              <R2FileUploader
                folder="avatars/admin"
                onSuccess={handleAvatarUploadSuccess}
                currentImageUrl={avatarUrl}
                currentFileId={avatarFileId}
                acceptedTypes=".jpg,.jpeg,.png"
                maxSizeInMB={limits.profilePictureMaxMb}
                aspectRatio="1/1"
                label="Upload photo"
                enableCrop={true}
                cropAspect={1}
                cropShape="round"
              />
            </div>
            <div className={styles.identityBody}>
              <div className={styles.identityMeta}>
                <span className={styles.identityName}>{fullName.trim() || admin.fullName}</span>
                <Badge variant={ROLE_BADGE_VARIANTS[admin.role] ?? "secondary"}>
                  {ADMIN_ROLE_LABELS[admin.role] ?? admin.role}
                </Badge>
              </div>
              <p className={styles.uploadHint}>
                JPG or PNG, up to {limits.profilePictureMaxMb}MB. Square images look best.
              </p>
            </div>
          </aside>

          <div className={styles.formCard}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Account details</h2>
                <p className={styles.sectionSubtitle}>
                  Only your display name can be changed here.
                </p>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="admin-full-name">
                    Full name
                  </label>
                  <Input
                    id="admin-full-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    autoComplete="name"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="admin-email">
                    Email
                  </label>
                  <Input id="admin-email" value={admin.email} readOnly disabled />
                  <span className={styles.helpText}>
                    <Lock size={12} />
                    Contact a super admin to change your email.
                  </span>
                </div>
              </div>
            </section>

            <div className={styles.divider} />

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Author bio</h2>
                <p className={styles.sectionSubtitle}>
                  Your photo, name and bio appear as the byline on posts you publish.
                </p>
              </div>

              <div className={styles.fieldFull}>
                <label className={styles.label} htmlFor="admin-bio">
                  Bio
                </label>
                <Textarea
                  id="admin-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A sentence or two about you"
                  rows={5}
                />
                <span
                  className={`${styles.counter} ${isBioOverLimit ? styles.counterError : ""}`}
                >
                  {bioLength} / {BIO_MAX_LENGTH}
                </span>
              </div>
            </section>

            <div className={styles.footer}>
              <span className={styles.footerStatus}>
                {isDirty ? "You have unsaved changes." : "All changes saved."}
              </span>
              <div className={styles.footerActions}>
                <Button
                  variant="ghost"
                  onClick={handleReset}
                  disabled={!isDirty || updateMutation.isPending}
                >
                  <RotateCcw size={16} />
                  Reset
                </Button>
                <Button onClick={handleSave} disabled={!canSave}>
                  <Save size={16} />
                  {updateMutation.isPending ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminProfilePage;
