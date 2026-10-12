import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  Check,
  UserPlus,
  MapPin,
  Globe,
  Users,
  Star,
  Heart,
  MessageSquareText,
  CalendarDays,
  Phone,
  Info,
  GraduationCap,
  BookOpen,
  Images,
  PlayCircle,
  ClipboardList,
  FileText,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./Dialog";
import {
  getOrganizationTabPath,
  ORGANIZATION_TAB_LABELS,
  type OrganizationTabValue,
} from "../helpers/organizationRoutes";
import { FaFacebook, FaInstagram, FaLinkedin, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { useAuth } from "../helpers/useAuth";
import { sanitizeHtml } from "../helpers/sanitizeHtml";
import { wrapContentTables } from "../helpers/contentTables";
import { Avatar, AvatarImage, AvatarFallback } from "./Avatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Textarea } from "./Textarea";
import { Skeleton } from "./Skeleton";
import { TeacherProductCard } from "./HomepageContentSection";
import {
  useFollowOrganizationMutation,
  useOrganizationReviewsQuery,
  useSubmitOrganizationReviewMutation,
} from "../helpers/useOrganizationProfile";
import type { OutputType, OrgCatalogueItem } from "../endpoints/organizations/profile_GET.schema";
import type { OrganizationGalleryItem } from "../endpoints/teacher/organizations/gallery/list_GET.schema";
import styles from "./OrganizationProfileView.module.css";

const ORG_TYPE_LABELS: Record<string, string> = {
  coaching: "Coaching institute",
  school: "School",
  college: "College",
  university: "University",
  other: "Organisation",
};

const INSTITUTE_SIZE_LABELS: Record<string, string> = {
  "1-10": "1-10 people",
  "11-50": "11-50 people",
  "51-200": "51-200 people",
  "201-500": "201-500 people",
  "501-1000": "501-1,000 people",
  "1000+": "1,000+ people",
};

const CATALOGUE_COLLAPSED_COUNT = 6;

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const catalogueLink = (item: OrgCatalogueItem): string => {
  switch (item.kind) {
    case "course":
      return `/course/${item.slug}`;
    case "test":
      return `/mock-test/${item.slug}`;
    case "live_test":
      return `/mock-test/live/${item.id}`;
    case "product":
      return `/study-notes/${item.slug}`;
    case "bundle":
      return `/bundles/${item.slug}`;
    default:
      return "/";
  }
};

const catalogueStats = (item: OrgCatalogueItem): string | undefined => {
  if (item.kind === "product" && item.pageCount) return `${item.pageCount} pages`;
  if (item.rating) return `${item.rating.toFixed(1)} rating`;
  return undefined;
};

const StarPicker: React.FC<{ value: number; onChange: (value: number) => void }> = ({ value, onChange }) => (
  <div className={styles.starPicker} role="radiogroup" aria-label="Rating">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        className={styles.starButton}
        onClick={() => onChange(n)}
        aria-label={`${n} star${n > 1 ? "s" : ""}`}
        aria-checked={value === n}
        role="radio"
      >
        <Star size={22} fill={n <= value ? "currentColor" : "none"} />
      </button>
    ))}
  </div>
);

const StarDisplay: React.FC<{ value: number; size?: number }> = ({ value, size = 14 }) => (
  <span className={styles.starDisplay} aria-hidden="true">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} size={size} fill={n <= Math.round(value) ? "currentColor" : "none"} />
    ))}
  </span>
);

const FollowOrgButton: React.FC<{ organizationId: number; orgSlug: string; isFollowing: boolean }> = ({
  organizationId,
  orgSlug,
  isFollowing,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authState } = useAuth();
  const mutation = useFollowOrganizationMutation(orgSlug);

  const isTeacher = authState.type === "authenticated" && authState.user.role === "teacher";
  if (isTeacher) return null;

  const handleClick = () => {
    if (authState.type !== "authenticated") {
      const currentPath = location.pathname + location.search;
      navigate(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
      return;
    }
    mutation.mutate(organizationId);
  };

  return (
    <button
      type="button"
      className={`${styles.followButton} ${isFollowing ? styles.following : ""}`}
      onClick={handleClick}
      disabled={mutation.isPending}
      aria-pressed={isFollowing}
    >
      {isFollowing ? <Check size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
};

const isYoutubeUrl = (url: string) => url.includes("youtube.com") || url.includes("youtu.be");

const extractYoutubeId = (url: string): string | null => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

const GallerySection: React.FC<{ items: OrganizationGalleryItem[] | undefined | null }> = ({ items }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const safeItems = items ?? [];

  if (safeItems.length === 0) return null;

  const activeItem = activeIndex !== null ? safeItems[activeIndex] : null;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        <Images size={17} aria-hidden="true" /> Gallery
      </h2>
      <div className={styles.galleryGrid}>
        {safeItems.map((item, index) => {
          const youtubeId = item.mediaType === "video" && isYoutubeUrl(item.url) ? extractYoutubeId(item.url) : null;
          const thumbUrl = item.mediaType === "photo" ? item.url : youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null;
          return (
            <button
              key={item.id}
              type="button"
              className={styles.galleryThumb}
              onClick={() => setActiveIndex(index)}
              aria-label={item.mediaType === "photo" ? "View photo" : "Play video"}
            >
              {thumbUrl ? (
                <img src={thumbUrl} alt={item.caption ?? ""} className={styles.galleryThumbMedia} />
              ) : (
                <video src={item.url} className={styles.galleryThumbMedia} muted preload="metadata" />
              )}
              {item.mediaType === "video" && (
                <span className={styles.galleryThumbPlay}>
                  <PlayCircle size={28} aria-hidden="true" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={activeItem !== null} onOpenChange={(open) => !open && setActiveIndex(null)}>
        <DialogContent className={styles.galleryLightboxContent}>
          <DialogTitle className={styles.visuallyHidden}>
            {activeItem?.mediaType === "photo" ? "Photo" : "Video"}
          </DialogTitle>
          {activeItem && (
            activeItem.mediaType === "photo" ? (
              <img src={activeItem.url} alt={activeItem.caption ?? ""} className={styles.galleryLightboxMedia} />
            ) : isYoutubeUrl(activeItem.url) ? (
              <iframe
                src={`https://www.youtube.com/embed/${extractYoutubeId(activeItem.url) ?? ""}`}
                className={styles.galleryLightboxIframe}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Gallery video"
              />
            ) : (
              <video src={activeItem.url} controls autoPlay className={styles.galleryLightboxMedia} />
            )
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

const ReviewsSection: React.FC<{ organizationId: number; reviewCount: number; averageRating: number | null }> = ({
  organizationId,
  reviewCount,
  averageRating,
}) => {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [page, setPage] = useState(1);
  const { data, isFetching } = useOrganizationReviewsQuery({ organizationId, page }, true);
  const submitMutation = useSubmitOrganizationReviewMutation(organizationId);

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const isStudent = authState.type === "authenticated" && authState.user.role === "student";
  const myReview = data?.myReview ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      setFormError("Pick a rating from 1 to 5 stars.");
      return;
    }
    setFormError(null);
    try {
      await submitMutation.mutateAsync({
        organizationId,
        rating,
        reviewText: reviewText.trim() || null,
      });
      setRating(0);
      setReviewText("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not submit your review.");
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>
          <MessageSquareText size={18} aria-hidden="true" /> Student reviews
        </h2>
        {averageRating !== null && (
          <span className={styles.ratingSummary}>
            <StarDisplay value={averageRating} />
            {averageRating.toFixed(1)} · {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
          </span>
        )}
      </div>

      {isStudent && !myReview && (
        <form className={styles.reviewForm} onSubmit={handleSubmit}>
          <p className={styles.reviewFormHint}>Reviews are posted anonymously - your name is never shown.</p>
          <StarPicker value={rating} onChange={setRating} />
          <Textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value.slice(0, 2000))}
            placeholder="Share your experience (optional)..."
            rows={3}
          />
          {formError && <p className={styles.formError} role="alert">{formError}</p>}
          <Button type="submit" className={styles.ctaButton} disabled={submitMutation.isPending}>
            {submitMutation.isPending ? "Posting..." : "Post review"}
          </Button>
        </form>
      )}

      {!isStudent && authState.type !== "authenticated" && (
        <button
          type="button"
          className={styles.loginPrompt}
          onClick={() => navigate(`/login?redirectTo=${encodeURIComponent(location.pathname)}`)}
        >
          Log in as a student to leave an anonymous review.
        </button>
      )}

      {isFetching && !data && (
        <div className={styles.reviewList}>
          <Skeleton style={{ height: "4rem", borderRadius: "1rem" }} />
        </div>
      )}

      {data && data.reviews.length === 0 && (
        <p className={styles.emptyNote}>No reviews yet. Be the first to share your experience.</p>
      )}

      {data && data.reviews.length > 0 && (
        <ul className={styles.reviewList}>
          {data.reviews.map((review) => (
            <li key={review.id} className={styles.reviewRow}>
              <div className={styles.reviewRowHead}>
                <StarDisplay value={review.rating} />
                <span className={styles.reviewDate}>{formatDate(review.createdAt)}</span>
                {review.isMine && <Badge variant="lavender">Your review</Badge>}
              </div>
              {review.reviewText && <p className={styles.reviewText}>{review.reviewText}</p>}
            </li>
          ))}
        </ul>
      )}

      {data && data.hasMore && (
        <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={isFetching}>
          Load more reviews
        </Button>
      )}
    </section>
  );
};

interface CatalogueSectionProps {
  catalogue: OrgCatalogueItem[];
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  hint: string;
  emptyMessage: string;
}

const CatalogueSection: React.FC<CatalogueSectionProps> = ({ catalogue, title, icon: Icon, hint, emptyMessage }) => {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? catalogue : catalogue.slice(0, CATALOGUE_COLLAPSED_COUNT);

  if (catalogue.length === 0) {
    return (
      <section className={`${styles.section} ${styles.catalogueSection}`}>
        <h2 className={styles.sectionTitleMuted}>
          <Icon size={17} aria-hidden="true" /> {title}
        </h2>
        <p className={styles.emptyNote}>{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className={`${styles.section} ${styles.catalogueSection}`}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitleMuted}>
          <Icon size={17} aria-hidden="true" /> {title}
        </h2>
        <span className={styles.catalogueCount}>{catalogue.length} items</span>
      </div>
      <p className={styles.catalogueHint}>{hint}</p>
      <div className={styles.catalogueGrid}>
        {visibleItems.map((item) => (
          <TeacherProductCard
            key={`${item.kind}-${item.id}`}
            link={catalogueLink(item)}
            teacherName={item.teacherName}
            teacherAvatarUrl={item.teacherAvatarUrl}
            teacherTagline={item.teacherTagline}
            teacherYearsOfExperience={item.teacherYearsOfExperience}
            teacherSlug={item.teacherSlug}
            teacherIsVerified={item.teacherIsVerified}
            productTitle={item.title}
            examName={item.examName}
            stats={catalogueStats(item)}
            priceLabel={item.price === 0 ? "Free" : `₹${item.price}`}
            originalPriceLabel={item.discountPrice !== null ? `₹${item.price}` : undefined}
            isFree={item.price === 0}
          />
        ))}
      </div>
      {catalogue.length > CATALOGUE_COLLAPSED_COUNT && (
        <Button variant="outline" size="sm" className={styles.showMoreButton} onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show less" : `Show all ${catalogue.length} resources`}
        </Button>
      )}
    </section>
  );
};

interface OrganizationProfileViewProps {
  data: OutputType;
  orgSlug: string;
  tab?: OrganizationTabValue;
}

const TAB_NAV_ITEMS: { value: OrganizationTabValue; icon: React.ComponentType<{ size?: number }> }[] = [
  { value: "about", icon: Info },
  { value: "courses", icon: BookOpen },
  { value: "teachers", icon: GraduationCap },
  { value: "mock-tests", icon: ClipboardList },
  { value: "study-resources", icon: FileText },
  { value: "reviews", icon: Star },
];

export const OrganizationProfileView: React.FC<OrganizationProfileViewProps> = ({ data, orgSlug, tab = "about" }) => {
  const { organization, teachers, catalogue, posts, followerCount, isFollowing, reviewCount, averageRating } = data;

  const coursesCatalogue = catalogue.filter((item) => item.kind === "course" || item.kind === "bundle");
  const mockTestsCatalogue = catalogue.filter((item) => item.kind === "test" || item.kind === "live_test");
  const studyResourcesCatalogue = catalogue.filter((item) => item.kind === "product");

  const socialLinkItems = [
    organization.socialLinks?.youtube && { key: "youtube", href: organization.socialLinks.youtube, label: "YouTube", Icon: FaYoutube },
    organization.socialLinks?.linkedin && { key: "linkedin", href: organization.socialLinks.linkedin, label: "LinkedIn", Icon: FaLinkedin },
    organization.socialLinks?.twitter && { key: "twitter", href: organization.socialLinks.twitter, label: "X", Icon: FaXTwitter },
    organization.socialLinks?.instagram && { key: "instagram", href: organization.socialLinks.instagram, label: "Instagram", Icon: FaInstagram },
    organization.socialLinks?.facebook && { key: "facebook", href: organization.socialLinks.facebook, label: "Facebook", Icon: FaFacebook },
  ].filter(Boolean) as { key: string; href: string; label: string; Icon: React.ComponentType<{ size?: number }> }[];

  const factRows = [
    { key: "type", icon: Building2, label: "Type", content: ORG_TYPE_LABELS[organization.orgType] ?? "Organisation" },
    organization.location && { key: "location", icon: MapPin, label: "Location", content: organization.location },
    organization.foundedYear && { key: "founded", icon: CalendarDays, label: "Founded", content: String(organization.foundedYear) },
    organization.instituteSize && {
      key: "size",
      icon: Users,
      label: "Size",
      content: INSTITUTE_SIZE_LABELS[organization.instituteSize] ?? organization.instituteSize,
    },
    organization.websiteUrl && {
      key: "website",
      icon: Globe,
      label: "Website",
      content: organization.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      href: organization.websiteUrl,
    },
    organization.phoneNumber && {
      key: "phone",
      icon: Phone,
      label: "Phone",
      content: organization.phoneNumber,
      href: `tel:${organization.phoneNumber}`,
    },
  ].filter(Boolean) as { key: string; icon: typeof Building2; label: string; content: string; href?: string }[];

  return (
    <div className={styles.page}>
      {organization.coverImageUrl && (
        <div className={styles.cover}>
          <img src={organization.coverImageUrl} alt="" />
        </div>
      )}

      <div className={styles.hero}>
        <Avatar className={styles.logoAvatar}>
          <AvatarImage src={organization.logoUrl ?? undefined} alt="" />
          <AvatarFallback>
            <Building2 size={28} />
          </AvatarFallback>
        </Avatar>

        <div className={styles.heroInfo}>
          <div className={styles.heroTitleRow}>
            <h1 className={styles.orgName}>{organization.name}</h1>
            <Badge variant="lavender">{ORG_TYPE_LABELS[organization.orgType] ?? "Organisation"}</Badge>
          </div>

          <div className={styles.heroMeta}>
            {organization.location && (
              <span className={styles.metaItem}>
                <MapPin size={14} aria-hidden="true" /> {organization.location}
              </span>
            )}
            <span className={styles.metaItem}>
              <Users size={14} aria-hidden="true" /> {followerCount} {followerCount === 1 ? "follower" : "followers"}
            </span>
            {reviewCount > 0 && averageRating !== null && (
              <span className={styles.metaItem}>
                <Star size={14} aria-hidden="true" fill="currentColor" /> {averageRating.toFixed(1)} ({reviewCount})
              </span>
            )}
          </div>
        </div>

        <FollowOrgButton organizationId={organization.id} orgSlug={orgSlug} isFollowing={isFollowing} />
      </div>

      <nav className={styles.tabNav} aria-label="Organisation page sections">
        {TAB_NAV_ITEMS.map(({ value, icon: Icon }) => (
          <Link
            key={value}
            to={getOrganizationTabPath(organization.orgType, orgSlug, value)}
            className={`${styles.tabLink} ${tab === value ? styles.tabLinkActive : ""}`}
            aria-current={tab === value ? "page" : undefined}
          >
            <Icon size={15} aria-hidden="true" />
            {ORGANIZATION_TAB_LABELS[value]}
          </Link>
        ))}
      </nav>

      <div className={styles.layout}>
        <div className={styles.main}>
          {tab === "about" && (
            <>
              {(organization.description || organization.specialties.length > 0) && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>
                    <Info size={17} aria-hidden="true" /> About {organization.name}
                  </h2>
                  {organization.description && (
                    <div
                      className={styles.orgDescription}
                      dangerouslySetInnerHTML={{
                        __html: wrapContentTables(sanitizeHtml(organization.description)),
                      }}
                    />
                  )}
                  {organization.specialties.length > 0 && (
                    <div className={styles.specialtyRow}>
                      {organization.specialties.map((specialty) => (
                        <Badge key={specialty} variant="outline">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <GallerySection items={data.gallery} />

              {posts.length > 0 && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>
                    <MessageSquareText size={17} aria-hidden="true" /> Community posts
                  </h2>
                  <ul className={styles.postList}>
                    {posts.map((post) => (
                      <li key={post.id} className={styles.postCard}>
                        <div className={styles.postHead}>
                          <Avatar className={styles.postAvatar}>
                            <AvatarImage src={post.teacherAvatarUrl ?? undefined} alt="" />
                            <AvatarFallback>{post.teacherName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className={styles.postHeadMeta}>
                            <span className={styles.postTeacherName}>{post.teacherName}</span>
                            <span className={styles.postDate}>{formatDate(post.createdAt)}</span>
                          </div>
                        </div>
                        <p className={styles.postBody}>{post.body}</p>
                        {post.imageUrl && <img src={post.imageUrl} alt="" className={styles.postImage} />}
                        <div className={styles.postFooter}>
                          <span className={styles.postMeta}>
                            <Heart size={14} aria-hidden="true" /> {post.likeCount}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {tab === "teachers" && (
            teachers.length > 0 ? (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  <GraduationCap size={17} aria-hidden="true" /> Teachers
                </h2>
                <div className={styles.teacherGrid}>
                  {teachers.map((teacher) => (
                    <Link
                      key={teacher.id}
                      to={teacher.slug ? `/expert/${teacher.slug}` : "#"}
                      className={styles.teacherCard}
                    >
                      <Avatar className={styles.teacherAvatar}>
                        <AvatarImage src={teacher.avatarUrl ?? undefined} alt="" />
                        <AvatarFallback>{teacher.displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className={styles.teacherMeta}>
                        <span className={styles.teacherNameRow}>
                          {teacher.displayName}
                          <VerifiedBadge isVerified={teacher.isVerified} size="sm" />
                        </span>
                        {teacher.tagline && <span className={styles.teacherTagline}>{teacher.tagline}</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  <GraduationCap size={17} aria-hidden="true" /> Teachers
                </h2>
                <p className={styles.emptyNote}>No teachers are associated with this page yet.</p>
              </section>
            )
          )}

          {tab === "courses" && (
            <CatalogueSection
              catalogue={coursesCatalogue}
              title="Courses"
              icon={BookOpen}
              hint="Courses and bundles published individually by teachers associated with this page."
              emptyMessage="No courses published yet."
            />
          )}

          {tab === "mock-tests" && (
            <CatalogueSection
              catalogue={mockTestsCatalogue}
              title="Mock Tests"
              icon={ClipboardList}
              hint="Mock tests and live test series published by teachers associated with this page."
              emptyMessage="No mock tests published yet."
            />
          )}

          {tab === "study-resources" && (
            <CatalogueSection
              catalogue={studyResourcesCatalogue}
              title="Study Resources"
              icon={FileText}
              hint="Notes and study material published by teachers associated with this page."
              emptyMessage="No study resources published yet."
            />
          )}

          {tab === "reviews" && (
            <ReviewsSection organizationId={organization.id} reviewCount={reviewCount} averageRating={averageRating} />
          )}
        </div>

        <aside className={styles.sidebar} aria-label="Organisation details">
          <div className={styles.factsCard}>
            <h3 className={styles.factsTitle}>At a glance</h3>
            <dl className={styles.factsList}>
              {factRows.map((fact) => {
                const Icon = fact.icon;
                return (
                  <div key={fact.key} className={styles.factRow}>
                    <dt className={styles.factLabel}>
                      <Icon size={14} aria-hidden="true" /> {fact.label}
                    </dt>
                    {fact.href ? (
                      <dd className={styles.factValue}>
                        <a href={fact.href} target={fact.href.startsWith("tel:") ? undefined : "_blank"} rel="noreferrer">
                          {fact.content}
                        </a>
                      </dd>
                    ) : (
                      <dd className={styles.factValue}>{fact.content}</dd>
                    )}
                  </div>
                );
              })}
            </dl>
          </div>

          {socialLinkItems.length > 0 && (
            <div className={styles.socialCard}>
              <h3 className={styles.factsTitle}>Follow us</h3>
              <div className={styles.socialRow}>
                {socialLinkItems.map(({ key, href, label, Icon }) => (
                  <a key={key} href={href} target="_blank" rel="noreferrer" aria-label={label} className={styles.socialLink}>
                    <Icon size={16} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
