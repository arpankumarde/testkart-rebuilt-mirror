import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ImagePlus, Loader2, Video as VideoIcon, X } from "lucide-react";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { TeacherListEmpty } from "../components/TeacherListEmpty";
import { Input } from "../components/Input";
import { RichTextEditor } from "../components/RichTextEditor";
import { Button } from "../components/Button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/Select";
import { LocationPicker } from "../components/LocationPicker";
import { ImageUploader } from "../components/ImageUploader";
import { VideoUploader } from "../components/VideoUploader";
import { Skeleton } from "../components/Skeleton";
import {
  OrganizationTypeValues,
  type OrganizationTypeValue,
} from "../endpoints/teacher/organizations/create_POST.schema";
import { InstituteSizeValues, type InstituteSizeValue } from "../endpoints/teacher/organizations/update_POST.schema";
import { parseLocationString, formatLocationString } from "../helpers/indianLocationsData";
import { useOrganizationProfileQuery } from "../helpers/useOrganizationProfile";
import { useTeacherOrganizationsMineQuery, useUpdateOrganizationMutation } from "../helpers/useTeacherOrganizations";
import {
  useOrganizationGalleryQuery,
  useAddOrganizationGalleryItemMutation,
  useDeleteOrganizationGalleryItemMutation,
} from "../helpers/useOrganizationGallery";
import { deleteR2File } from "../helpers/useR2Upload";
import styles from "./teacher.organizations.$organizationId.edit.module.css";

const ORG_TYPE_LABELS: Record<OrganizationTypeValue, string> = {
  coaching: "Coaching institute",
  school: "School",
  college: "College",
  university: "University",
  other: "Other",
};

const INSTITUTE_SIZE_LABELS: Record<InstituteSizeValue, string> = {
  "1-10": "1-10 people",
  "11-50": "11-50 people",
  "51-200": "51-200 people",
  "201-500": "201-500 people",
  "501-1000": "501-1,000 people",
  "1000+": "1,000+ people",
};

const EditOrganizationPage: React.FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const parsedOrgId = organizationId ? Number(organizationId) : NaN;
  const navigate = useNavigate();

  const { data: mineData, isFetching: isMineFetching } = useTeacherOrganizationsMineQuery();
  const myOrg = mineData?.organizations.find((o) => o.id === parsedOrgId) ?? null;

  const { data, isFetching: isProfileFetching } = useOrganizationProfileQuery(myOrg?.slug ?? "");
  const updateMutation = useUpdateOrganizationMutation();

  const validOrgId = Number.isFinite(parsedOrgId) ? parsedOrgId : undefined;
  const { data: galleryData, isFetching: isGalleryFetching } = useOrganizationGalleryQuery(validOrgId);
  const addGalleryItemMutation = useAddOrganizationGalleryItemMutation(validOrgId);
  const deleteGalleryItemMutation = useDeleteOrganizationGalleryItemMutation(validOrgId);
  const [isUploadingGalleryVideo, setIsUploadingGalleryVideo] = useState(false);
  const [deletingGalleryItemId, setDeletingGalleryItemId] = useState<number | null>(null);
  const galleryItems = galleryData?.items ?? [];
  const MAX_GALLERY_ITEMS = 40;

  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState<OrganizationTypeValue>("coaching");
  const [description, setDescription] = useState("");
  const [locState, setLocState] = useState("");
  const [locCity, setLocCity] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [foundedYear, setFoundedYear] = useState("");
  const [instituteSize, setInstituteSize] = useState<InstituteSizeValue | "">("");
  const [specialties, setSpecialties] = useState("");
  const [facebook, setFacebook] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");
  const [youtube, setYoutube] = useState("");
  const [logo, setLogo] = useState<{ url: string; fileId: string } | null>(null);
  const [cover, setCover] = useState<{ url: string; fileId: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!data || hydrated) return;
    const org = data.organization;
    setName(org.name);
    setOrgType(org.orgType);
    setDescription(org.description ?? "");
    const parsedLocation = parseLocationString(org.location);
    setLocState(parsedLocation.state);
    setLocCity(parsedLocation.city);
    setWebsiteUrl(org.websiteUrl ?? "");
    setPhoneNumber(org.phoneNumber ?? "");
    setFoundedYear(org.foundedYear ? String(org.foundedYear) : "");
    setInstituteSize((org.instituteSize as InstituteSizeValue) ?? "");
    setSpecialties((org.specialties ?? []).join(", "));
    setFacebook(org.socialLinks?.facebook ?? "");
    setTwitter(org.socialLinks?.twitter ?? "");
    setLinkedin(org.socialLinks?.linkedin ?? "");
    setInstagram(org.socialLinks?.instagram ?? "");
    setYoutube(org.socialLinks?.youtube ?? "");
    setLogo(org.logoUrl ? { url: org.logoUrl, fileId: "" } : null);
    setCover(org.coverImageUrl ? { url: org.coverImageUrl, fileId: "" } : null);
    setHydrated(true);
  }, [data, hydrated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setFormError("Give your page a name with at least 2 characters.");
      return;
    }
    setFormError(null);

    const specialtyList = specialties
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const socialLinks = {
      facebook: facebook.trim() || undefined,
      twitter: twitter.trim() || undefined,
      linkedin: linkedin.trim() || undefined,
      instagram: instagram.trim() || undefined,
      youtube: youtube.trim() || undefined,
    };
    const hasSocialLinks = Object.values(socialLinks).some(Boolean);

    try {
      await updateMutation.mutateAsync({
        organizationId: parsedOrgId,
        name: trimmedName,
        orgType,
        description: description.trim() || null,
        location: formatLocationString(locCity, locState),
        websiteUrl: websiteUrl.trim() || null,
        phoneNumber: phoneNumber.trim() || null,
        logoUrl: logo?.url || null,
        logoFileId: logo?.fileId || null,
        coverImageUrl: cover?.url || null,
        coverImageFileId: cover?.fileId || null,
        foundedYear: foundedYear.trim() ? Number(foundedYear) : null,
        instituteSize: instituteSize || null,
        specialties: specialtyList.length > 0 ? specialtyList : null,
        socialLinks: hasSocialLinks ? socialLinks : null,
      });
      toast.success("Organisation page saved.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save your changes.");
    }
  };

  const handleAddGalleryPhoto = async (result: { url: string; fileId: string }) => {
    if (!result.url || !validOrgId) return;
    try {
      await addGalleryItemMutation.mutateAsync({
        organizationId: validOrgId,
        mediaType: "photo",
        url: result.url,
        fileId: result.fileId || null,
      });
      toast.success("Photo added to gallery.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add photo.");
    }
  };

  const handleAddGalleryVideo = async (result: { url: string; videoFileId: string | null }) => {
    if (!result.url || !validOrgId) return;
    try {
      await addGalleryItemMutation.mutateAsync({
        organizationId: validOrgId,
        mediaType: "video",
        url: result.url,
        fileId: result.videoFileId,
      });
      toast.success("Video added to gallery.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add video.");
    }
  };

  const handleDeleteGalleryItem = async (item: { id: number; fileId: string | null }) => {
    setDeletingGalleryItemId(item.id);
    try {
      await deleteGalleryItemMutation.mutateAsync({ galleryItemId: item.id });
      if (item.fileId) {
        try {
          await deleteR2File(item.fileId);
        } catch (err) {
          console.error("Failed to clean up gallery file from storage:", err);
        }
      }
      toast.success("Removed from gallery.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove this item.");
    } finally {
      setDeletingGalleryItemId(null);
    }
  };

  const isLoading = isMineFetching && !mineData;

  if (isLoading) {
    return (
      <div className={styles.page}>
        <ConsolePageHeader title="Edit organisation page" />
        <div className={styles.loadingState}>
          <Skeleton style={{ height: "6rem", borderRadius: "1.25rem" }} />
          <Skeleton style={{ height: "16rem", borderRadius: "1.25rem" }} />
        </div>
      </div>
    );
  }

  if (!myOrg || !myOrg.isCreator) {
    return (
      <div className={styles.page}>
        <ConsolePageHeader title="Edit organisation page" />
        <TeacherListEmpty
          tone="error"
          title="You can't edit this page"
          description="Only the organisation's creator can edit its page."
        >
          <Button asChild>
            <Link to="/teacher/organizations">Back to organisations</Link>
          </Button>
        </TeacherListEmpty>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Edit {myOrg.name} - Testkart for Teachers</title>
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title={`Edit ${myOrg.name}`}>
          <Button variant="outline" asChild>
            <Link to="/teacher/organizations">
              <ArrowLeft size={16} aria-hidden="true" />
              Back
            </Link>
          </Button>
        </ConsolePageHeader>

        {!hydrated || (isProfileFetching && !data) ? (
          <div className={styles.loadingState}>
            <Skeleton style={{ height: "6rem", borderRadius: "1.25rem" }} />
            <Skeleton style={{ height: "16rem", borderRadius: "1.25rem" }} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <p className={styles.formHint}>
              This page is how students and search engines discover your institute - fill in as much as you can.
            </p>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Logo &amp; cover image</h2>
              <div className={styles.imageRow}>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Logo</span>
                  <ImageUploader
                    folder="organization-logos"
                    label="Upload logo"
                    aspectRatio="1 / 1"
                    className={styles.logoUploader}
                    currentImageUrl={logo?.url}
                    currentFileId={logo?.fileId}
                    onSuccess={(result) => setLogo(result.url ? result : null)}
                  />
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Cover image</span>
                  <ImageUploader
                    folder="organization-covers"
                    label="Upload cover image"
                    aspectRatio="3 / 1"
                    className={styles.coverUploader}
                    currentImageUrl={cover?.url}
                    currentFileId={cover?.fileId}
                    onSuccess={(result) => setCover(result.url ? result : null)}
                  />
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Basic information</h2>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Name</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Type</span>
                <Select value={orgType} onValueChange={(v) => setOrgType(v as OrganizationTypeValue)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OrganizationTypeValues.map((value) => (
                      <SelectItem key={value} value={value}>
                        {ORG_TYPE_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>About / description</span>
                <RichTextEditor
                  value={description}
                  onChange={(html) => setDescription(html.slice(0, 20000))}
                  placeholder="What does this institute offer students?"
                  hideHeadingButtons
                  hideLinkButton
                  minHeight={160}
                />
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Location &amp; contact</h2>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Location</span>
                <LocationPicker
                  state={locState}
                  city={locCity}
                  onChange={(next) => {
                    setLocState(next.state);
                    setLocCity(next.city);
                  }}
                />
              </div>

              <div className={styles.twoCol}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Website</span>
                  <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." maxLength={300} />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Phone number</span>
                  <Input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+91 98765 43210"
                    maxLength={30}
                  />
                </label>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>About your institute</h2>

              <div className={styles.twoCol}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Founded year</span>
                  <Input
                    type="number"
                    value={foundedYear}
                    onChange={(e) => setFoundedYear(e.target.value)}
                    placeholder="e.g. 2015"
                    min={1800}
                    max={2100}
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Institute size</span>
                  <Select
                    value={instituteSize || undefined}
                    onValueChange={(v) => setInstituteSize(v as InstituteSizeValue)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {InstituteSizeValues.map((value) => (
                        <SelectItem key={value} value={value}>
                          {INSTITUTE_SIZE_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Specialties (comma separated)</span>
                <Input
                  value={specialties}
                  onChange={(e) => setSpecialties(e.target.value)}
                  placeholder="JEE, NEET, Foundation courses"
                />
              </label>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Social links</h2>
              <div className={styles.twoCol}>
                <Input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="Facebook URL" />
                <Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="X / Twitter URL" />
                <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="LinkedIn URL" />
                <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram URL" />
                <Input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="YouTube URL" />
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Photo &amp; video gallery</h2>
              <p className={styles.galleryHint}>
                Showcase your campus, events and activities. These are saved immediately - no need to click "Save changes".
              </p>

              <div className={styles.galleryAddRow}>
                <ImageUploader
                  folder="organization-gallery"
                  label="Add photo"
                  aspectRatio="4 / 3"
                  className={styles.galleryAddUploader}
                  onSuccess={handleAddGalleryPhoto}
                  maxSizeInMB={8}
                />
                <VideoUploader
                  folder="organization-gallery-videos"
                  label="Add video"
                  aspectRatio="4 / 3"
                  className={styles.galleryAddUploader}
                  allowYouTube
                  onUploadingChange={setIsUploadingGalleryVideo}
                  onSuccess={handleAddGalleryVideo}
                />
              </div>

              {isGalleryFetching && galleryItems.length === 0 ? (
                <Skeleton style={{ height: "8rem", borderRadius: "0.75rem" }} />
              ) : galleryItems.length === 0 ? (
                <p className={styles.galleryEmpty}>No photos or videos yet.</p>
              ) : (
                <div className={styles.galleryGrid}>
                  {galleryItems.map((item) => (
                    <div key={item.id} className={styles.galleryItem}>
                      {item.mediaType === "photo" ? (
                        <img src={item.url} alt={item.caption ?? ""} className={styles.galleryItemMedia} />
                      ) : (
                        <>
                          {item.url.includes("youtube.com") || item.url.includes("youtu.be") ? (
                            <div className={styles.galleryItemMedia} />
                          ) : (
                            <video src={item.url} className={styles.galleryItemMedia} muted />
                          )}
                          <span className={styles.galleryItemVideoBadge}>
                            <VideoIcon size={11} /> {item.url.includes("youtube") ? "YouTube" : "Video"}
                          </span>
                        </>
                      )}
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className={styles.galleryRemoveButton}
                        onClick={() => handleDeleteGalleryItem(item)}
                        disabled={deletingGalleryItemId === item.id}
                        aria-label="Remove from gallery"
                      >
                        {deletingGalleryItemId === item.id ? <Loader2 size={14} /> : <X size={14} />}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {galleryItems.length >= MAX_GALLERY_ITEMS && (
                <p className={styles.galleryHint}>You've reached the {MAX_GALLERY_ITEMS}-item gallery limit.</p>
              )}
            </div>

            {formError && <p className={styles.formError} role="alert">{formError}</p>}

            <div className={styles.footer}>
              <Button type="button" variant="outline" asChild>
                <Link to="/teacher/organizations">Cancel</Link>
              </Button>
              <Button type="submit" className={styles.ctaButton} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
  );
};

export default EditOrganizationPage;
