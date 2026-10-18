import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Megaphone,
  Library,
  UserRound,
  X,
} from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "./Dialog";
import {
  getOrganizationTabPath,
  getOrganizationProfilePath,
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
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import {
  useFollowOrganizationMutation,
  useLikeOrganizationPostMutation,
  useOrganizationReviewsQuery,
  useSubmitOrganizationReviewMutation,
  useOrganizationClaimOptionsQuery,
  useStartOrganizationClaimMutation,
  useVerifyOrganizationClaimMutation,
} from "../helpers/useOrganizationProfile";
import type {
  OutputType,
  OrgCatalogueItem,
  OrgCatalogueKind,
  OrganizationPost,
} from "../endpoints/organizations/profile_GET.schema";
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
      return `/live-test/${item.slug}`;
    case "product":
      return `/study-notes/${item.slug}`;
    case "bundle":
      return `/bundles/${item.slug}`;
    default:
      return "/";
  }
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

const FollowOrgButton: React.FC<{ organizationId: string; orgSlug: string; isFollowing: boolean }> = ({
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

/**
 * Self-serve claim flow for an auto-imported ("unclaimed") organisation. A
 * teacher picks one of the listing's OWN scraped contact methods (never a
 * value they type themselves), we send a one-time code to it, and entering
 * it correctly proves they actually control that phone/inbox - no human
 * review needed on our end.
 */
const ClaimOrganizationButton: React.FC<{
  organizationId: string;
  orgSlug: string;
  claimStatus: "unclaimed" | "pending_verification" | "claimed";
}> = ({ organizationId, orgSlug, claimStatus }) => {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (claimStatus === "claimed") return null;
  const [step, setStep] = useState<"choose" | "code" | "done">("choose");
  const [selected, setSelected] = useState<{ method: "phone" | "email"; value: string; masked: string } | null>(null);
  const [code, setCode] = useState("");
  const [maskedDestination, setMaskedDestination] = useState("");

  const isTeacher = authState.type === "authenticated" && authState.user.role === "teacher";
  const optionsQuery = useOrganizationClaimOptionsQuery(organizationId, open && isTeacher);
  const startMutation = useStartOrganizationClaimMutation();
  const verifyMutation = useVerifyOrganizationClaimMutation(orgSlug);

  const resetAndClose = () => {
    setOpen(false);
    setStep("choose");
    setSelected(null);
    setCode("");
    startMutation.reset();
    verifyMutation.reset();
  };

  const handleClick = () => {
    if (authState.type !== "authenticated") {
      const currentPath = location.pathname + location.search;
      navigate(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
      return;
    }
    setOpen(true);
  };

  const handleSendCode = () => {
    if (!selected) return;
    startMutation.mutate(
      { organizationId, method: selected.method, contactValue: selected.value },
      {
        onSuccess: (data) => {
          setMaskedDestination(data.maskedDestination);
          setStep("code");
        },
      }
    );
  };

  const handleVerify = () => {
    if (!code.trim()) return;
    verifyMutation.mutate(
      { organizationId, code: code.trim() },
      { onSuccess: () => setStep("done") }
    );
  };

  return (
    <>
      <Button type="button" variant="outline" className={styles.claimButton} onClick={handleClick}>
        Claim this profile
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : resetAndClose())}>
        <DialogContent className={styles.modalContent}>
          <DialogTitle>Claim this organisation</DialogTitle>

          {!isTeacher && (
            <div className={styles.claimStepBody}>
              <p className={styles.claimHelpText}>
                Only teacher accounts can claim an organisation profile. Sign in with a teacher account to
                continue.
              </p>
            </div>
          )}

          {isTeacher && step === "choose" && (
            <div className={styles.claimStepBody}>
              {optionsQuery.isLoading && <p className={styles.claimHelpText}>Loading contact options…</p>}
              {optionsQuery.data && optionsQuery.data.claimStatus === "claimed" && (
                <p className={styles.claimHelpText}>This organisation has already been claimed by its owner.</p>
              )}
              {optionsQuery.data && optionsQuery.data.claimStatus !== "claimed" && (
                <p className={styles.claimHelpText}>
                  This profile was created automatically from public listing data and has no owner yet. To
                  manage it, verify that you control one of its own listed contact details below.
                </p>
              )}
              {optionsQuery.data && optionsQuery.data.claimStatus !== "claimed" && optionsQuery.data.options.length === 0 && (
                <p className={styles.formError} role="alert">
                  This listing has no phone or email on file, so it can't be verified automatically. Please
                  contact support to claim it manually.
                </p>
              )}
              {optionsQuery.data && optionsQuery.data.claimStatus !== "claimed" && optionsQuery.data.options.length > 0 && (
                <div className={styles.claimOptionList}>
                  {optionsQuery.data.options.map((opt) => (
                    <button
                      key={`${opt.method}-${opt.value}`}
                      type="button"
                      className={`${styles.claimOptionButton} ${selected?.value === opt.value ? styles.claimOptionButtonSelected : ""}`}
                      onClick={() => setSelected(opt)}
                    >
                      {opt.method === "phone" ? <Phone size={16} aria-hidden="true" /> : <MessageSquareText size={16} aria-hidden="true" />}
                      Send code to {opt.masked}
                    </button>
                  ))}
                </div>
              )}
              {optionsQuery.data && optionsQuery.data.claimStatus !== "claimed" && optionsQuery.data.options.length > 0 && (
                <>
                  {startMutation.isError && (
                    <p className={styles.formError} role="alert">
                      {startMutation.error instanceof Error ? startMutation.error.message : "Could not send the code."}
                    </p>
                  )}
                  <Button
                    type="button"
                    onClick={handleSendCode}
                    disabled={!selected || startMutation.isPending}
                  >
                    {startMutation.isPending ? "Sending…" : "Send verification code"}
                  </Button>
                </>
              )}
            </div>
          )}

          {step === "code" && (
            <div className={styles.claimStepBody}>
              <p className={styles.claimHelpText}>
                We sent a verification code to <strong>{maskedDestination}</strong>. It expires in 10 minutes.
              </p>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter code"
                inputMode="numeric"
                maxLength={6}
                autoFocus
              />
              {verifyMutation.isError && (
                <p className={styles.formError} role="alert">
                  {verifyMutation.error instanceof Error ? verifyMutation.error.message : "Could not verify the code."}
                </p>
              )}
              <Button type="button" onClick={handleVerify} disabled={!code.trim() || verifyMutation.isPending}>
                {verifyMutation.isPending ? "Verifying…" : "Verify and claim"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep("choose")}>
                Use a different contact
              </Button>
            </div>
          )}

          {step === "done" && (
            <div className={styles.claimStepBody}>
              <p className={styles.claimHelpText}>
                You now own this organisation's profile. You can edit its details from your teacher dashboard.
              </p>
              <Button type="button" onClick={resetAndClose}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const isYoutubeUrl = (url: string) => url.includes("youtube.com") || url.includes("youtu.be");

const extractYoutubeId = (url: string): string | null => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

const galleryThumbUrl = (item: OrganizationGalleryItem): string | null => {
  if (item.mediaType === "photo") return item.url;
  const youtubeId = isYoutubeUrl(item.url) ? extractYoutubeId(item.url) : null;
  return youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null;
};

const SWIPE_THRESHOLD_PX = 40;

/**
 * Horizontal carousel: native scroll-snap handles touch swiping, the arrow
 * buttons page the track, and each arrow disables at its end. Arrows are
 * hidden entirely when every item already fits. Clicking an item opens a
 * lightbox that pages through the same list with arrows, keys or swipes.
 */
const GallerySection: React.FC<{ items: OrganizationGalleryItem[] | undefined | null }> = ({ items }) => {
  const safeItems = items ?? [];
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [scrollState, setScrollState] = useState({ overflow: false, canPrev: false, canNext: false });

  const updateScrollState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    setScrollState({
      overflow: maxScroll > 2,
      canPrev: track.scrollLeft > 2,
      canNext: track.scrollLeft < maxScroll - 2,
    });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateScrollState();
    track.addEventListener("scroll", updateScrollState, { passive: true });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScrollState) : null;
    observer?.observe(track);
    return () => {
      track.removeEventListener("scroll", updateScrollState);
      observer?.disconnect();
    };
  }, [updateScrollState, safeItems.length]);

  if (safeItems.length === 0) return null;

  const scrollTrack = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: "smooth" });
  };

  const activeItem = activeIndex !== null ? safeItems[activeIndex] : null;
  const hasLightboxPrev = activeIndex !== null && activeIndex > 0;
  const hasLightboxNext = activeIndex !== null && activeIndex < safeItems.length - 1;

  const stepLightbox = (direction: 1 | -1) => {
    setActiveIndex((current) => {
      if (current === null) return current;
      const next = current + direction;
      return next < 0 || next >= safeItems.length ? current : next;
    });
  };

  const handleLightboxKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") stepLightbox(-1);
    if (e.key === "ArrowRight") stepLightbox(1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    stepLightbox(delta < 0 ? 1 : -1);
  };

  return (
    <section className={`${styles.panel} ${styles.section}`} aria-roledescription="carousel" aria-label="Gallery">
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>
          <span className={`${styles.titleIcon} ${styles.titleIconSage}`}>
            <Images size={16} aria-hidden="true" />
          </span>
          Gallery
          <span className={styles.sectionCount}>{safeItems.length}</span>
        </h2>
        {scrollState.overflow && (
          <div className={styles.carouselControls}>
            <button
              type="button"
              className={styles.carouselArrow}
              onClick={() => scrollTrack(-1)}
              disabled={!scrollState.canPrev}
              aria-label="Previous gallery items"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.carouselArrow}
              onClick={() => scrollTrack(1)}
              disabled={!scrollState.canNext}
              aria-label="Next gallery items"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div ref={trackRef} className={styles.galleryTrack}>
        {safeItems.map((item, index) => {
          const thumbUrl = galleryThumbUrl(item);
          return (
            <button
              key={item.id}
              type="button"
              className={styles.galleryItem}
              onClick={() => setActiveIndex(index)}
              aria-label={`${item.mediaType === "photo" ? "View photo" : "Play video"} ${index + 1} of ${safeItems.length}`}
            >
              <span className={styles.galleryFrame}>
                {thumbUrl ? (
                  <img src={thumbUrl} alt={item.caption ?? ""} className={styles.galleryMedia} loading="lazy" />
                ) : (
                  <video src={item.url} className={styles.galleryMedia} muted preload="metadata" />
                )}
                {item.mediaType === "video" && (
                  <span className={styles.galleryPlay}>
                    <PlayCircle size={30} aria-hidden="true" />
                  </span>
                )}
              </span>
              {item.caption && <span className={styles.galleryCaption}>{item.caption}</span>}
            </button>
          );
        })}
      </div>

      <Dialog open={activeItem !== null} onOpenChange={(open) => !open && setActiveIndex(null)}>
        <DialogContent
          className={`${styles.modalContent} ${styles.lightboxContent}`}
          hideCloseButton
          onKeyDown={handleLightboxKeyDown}
        >
          <DialogTitle className={styles.visuallyHidden}>
            {activeItem?.mediaType === "photo" ? "Photo" : "Video"}
          </DialogTitle>
          {activeItem && (
            <>
              <div className={styles.lightboxBody}>
                {safeItems.length > 1 && (
                  <button
                    type="button"
                    className={`${styles.modalArrow} ${styles.modalArrowPrev}`}
                    onClick={() => stepLightbox(-1)}
                    disabled={!hasLightboxPrev}
                    aria-label="Previous photo"
                  >
                    <ChevronLeft size={20} aria-hidden="true" />
                  </button>
                )}
                <div className={styles.lightboxStage} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                  {activeItem.mediaType === "photo" ? (
                    <img src={activeItem.url} alt={activeItem.caption ?? ""} className={styles.lightboxMedia} />
                  ) : isYoutubeUrl(activeItem.url) ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${extractYoutubeId(activeItem.url) ?? ""}`}
                      className={styles.lightboxIframe}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Gallery video"
                    />
                  ) : (
                    <video src={activeItem.url} controls autoPlay className={styles.lightboxMedia} />
                  )}
                </div>
                {safeItems.length > 1 && (
                  <button
                    type="button"
                    className={`${styles.modalArrow} ${styles.modalArrowNext}`}
                    onClick={() => stepLightbox(1)}
                    disabled={!hasLightboxNext}
                    aria-label="Next photo"
                  >
                    <ChevronRight size={20} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className={styles.modalFooter}>
                {activeItem.caption && <span className={styles.lightboxCaption}>{activeItem.caption}</span>}
                {safeItems.length > 1 && (
                  <span className={styles.modalCounter} aria-live="polite">
                    {(activeIndex ?? 0) + 1} / {safeItems.length}
                  </span>
                )}
              </div>
            </>
          )}
          <DialogClose className={styles.modalClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </DialogClose>
        </DialogContent>
      </Dialog>
    </section>
  );
};

const PostLikeButton: React.FC<{ post: OrganizationPost; orgSlug: string }> = ({ post, orgSlug }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authState } = useAuth();
  const mutation = useLikeOrganizationPostMutation(orgSlug);

  const isStudent = authState.type === "authenticated" && authState.user.role === "student";
  const label = `${post.likeCount} ${post.likeCount === 1 ? "like" : "likes"}`;

  if (authState.type === "authenticated" && !isStudent) {
    return (
      <span className={styles.postMeta}>
        <Heart size={15} aria-hidden="true" /> {label}
      </span>
    );
  }

  const handleClick = () => {
    if (!isStudent) {
      navigate(`/login?redirectTo=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    mutation.mutate(post.id);
  };

  return (
    <div className={styles.likeWrap}>
      <button
        type="button"
        className={`${styles.likeButton} ${post.likedByMe ? styles.liked : ""}`}
        onClick={handleClick}
        disabled={mutation.isPending}
        aria-pressed={post.likedByMe}
      >
        <Heart size={15} aria-hidden="true" fill={post.likedByMe ? "currentColor" : "none"} />
        {post.likedByMe ? "Liked" : "Like"}
      </button>
      <span className={styles.postMeta}>{label}</span>
      {mutation.isError && (
        <span className={styles.formError} role="alert">
          {mutation.error instanceof Error ? mutation.error.message : "Could not update like."}
        </span>
      )}
    </div>
  );
};

/**
 * Post cards open the full post in a dialog on this tab - there is no
 * separate post URL. The dialog reads the post by id from the live list, so
 * a like refetches the profile and the dialog updates in place.
 */
const CommunityPostsSection: React.FC<{ posts: OrganizationPost[]; orgSlug: string; orgName: string }> = ({
  posts,
  orgSlug,
  orgName,
}) => {
  const [openPostId, setOpenPostId] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const openIndex = openPostId !== null ? posts.findIndex((post) => post.id === openPostId) : -1;
  const openPost = openIndex >= 0 ? posts[openIndex] : null;

  const stepPost = (direction: 1 | -1) => {
    const next = posts[openIndex + direction];
    if (next) setOpenPostId(next.id);
  };

  const handlePostKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") stepPost(-1);
    if (e.key === "ArrowRight") stepPost(1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    stepPost(delta < 0 ? 1 : -1);
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>
          <span className={`${styles.titleIcon} ${styles.titleIconLavender}`}>
            <Megaphone size={16} aria-hidden="true" />
          </span>
          Posts
        </h2>
      {posts.length > 0 && (
        <span className={styles.catalogueCount}>
          {posts.length} {posts.length === 1 ? "post" : "posts"}
        </span>
      )}
      </div>
      <p className={styles.sectionHint}>Updates shared by teachers at {orgName}.</p>

      {posts.length === 0 ? (
        <div className={styles.emptyPanel}>
          <Megaphone size={22} aria-hidden="true" />
          <p className={styles.emptyNote}>No community posts yet. Check back soon for updates.</p>
        </div>
      ) : (
        <ul className={styles.postGrid}>
          {posts.map((post) => (
            <li key={post.id}>
              <button
                type="button"
                className={styles.postCard}
                onClick={() => setOpenPostId(post.id)}
                aria-haspopup="dialog"
              >
                <div className={styles.postHead}>
                  <Avatar className={styles.postAvatar}>
                    <AvatarImage src={post.teacherAvatarUrl ?? undefined} alt="" />
                    <AvatarFallback>{post.teacherName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className={styles.postHeadMeta}>
                    <span className={styles.postTeacherName}>{post.teacherName}</span>
                    <time className={styles.postDate} dateTime={new Date(post.createdAt).toISOString()}>
                      {formatDate(post.createdAt)}
                    </time>
                  </div>
                </div>
                <p className={styles.postBody}>{post.body}</p>
                {post.imageUrl && (
                  <span className={styles.postImageFrame}>
                    <img src={post.imageUrl} alt="" className={styles.postImage} loading="lazy" />
                  </span>
                )}
                <div className={styles.postFooter}>
                  <span className={`${styles.postMeta} ${post.likedByMe ? styles.postMetaLiked : ""}`}>
                    <Heart size={14} aria-hidden="true" fill={post.likedByMe ? "currentColor" : "none"} />
                    {post.likeCount} {post.likeCount === 1 ? "like" : "likes"}
                  </span>
                  <span className={styles.postReadMore}>
                    View post <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={openPost !== null} onOpenChange={(open) => !open && setOpenPostId(null)}>
        <DialogContent
          className={`${styles.modalContent} ${styles.postModal}`}
          hideCloseButton
          onKeyDown={handlePostKeyDown}
        >
          {openPost && (
            <>
              <div className={styles.postModalBody}>
                {posts.length > 1 && (
                  <button
                    type="button"
                    className={`${styles.modalArrow} ${styles.modalArrowPrev}`}
                    onClick={() => stepPost(-1)}
                    disabled={openIndex <= 0}
                    aria-label="Previous post"
                  >
                    <ChevronLeft size={20} aria-hidden="true" />
                  </button>
                )}
                <article className={styles.postDialogBody} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                  <header className={styles.postHead}>
                    <Avatar className={styles.postDialogAvatar}>
                      <AvatarImage src={openPost.teacherAvatarUrl ?? undefined} alt="" />
                      <AvatarFallback>{openPost.teacherName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className={styles.postHeadMeta}>
                      <DialogTitle className={styles.postDialogAuthor}>
                        {openPost.teacherSlug ? (
                          <Link to={`/expert/${openPost.teacherSlug}`}>{openPost.teacherName}</Link>
                        ) : (
                          openPost.teacherName
                        )}
                      </DialogTitle>
                      <time className={styles.postDate} dateTime={new Date(openPost.createdAt).toISOString()}>
                        {formatDate(openPost.createdAt)}
                      </time>
                    </div>
                  </header>
                  <p className={styles.postDialogText}>{openPost.body}</p>
                  {openPost.imageUrl && (
                    <a href={openPost.imageUrl} target="_blank" rel="noreferrer" className={styles.postDialogImageFrame}>
                      <img src={openPost.imageUrl} alt="" className={styles.postDialogImage} />
                    </a>
                  )}
                  <footer className={styles.postDialogFooter}>
                    <PostLikeButton post={openPost} orgSlug={orgSlug} />
                  </footer>
                </article>
                {posts.length > 1 && (
                  <button
                    type="button"
                    className={`${styles.modalArrow} ${styles.modalArrowNext}`}
                    onClick={() => stepPost(1)}
                    disabled={openIndex >= posts.length - 1}
                    aria-label="Next post"
                  >
                    <ChevronRight size={20} aria-hidden="true" />
                  </button>
                )}
              </div>
              {posts.length > 1 && (
                <div className={styles.modalFooter}>
                  <span className={styles.modalCounter} aria-live="polite">
                    {openIndex + 1} / {posts.length}
                  </span>
                </div>
              )}
            </>
          )}
          <DialogClose className={styles.modalClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </DialogClose>
        </DialogContent>
      </Dialog>
    </section>
  );
};

const ReviewsSection: React.FC<{ organizationId: string; reviewCount: number; averageRating: number | null }> = ({
  organizationId,
  reviewCount,
  averageRating,
}) => {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage } = useOrganizationReviewsQuery(
    organizationId,
    true
  );
  const submitMutation = useSubmitOrganizationReviewMutation(organizationId);

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const isStudent = authState.type === "authenticated" && authState.user.role === "student";
  const firstPage = data?.pages[0];
  const reviews = data?.pages.flatMap((page) => page.reviews) ?? [];
  const myReview = firstPage?.myReview ?? null;
  const totalCount = firstPage?.totalCount ?? reviewCount;
  const overallRating = firstPage ? firstPage.averageRating : averageRating;
  const distribution = firstPage?.distribution ?? [];

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
          <span className={`${styles.titleIcon} ${styles.titleIconPeach}`}>
            <MessageSquareText size={16} aria-hidden="true" />
          </span>
          Student reviews
        </h2>
      </div>

      {totalCount > 0 && overallRating !== null && (
        <div className={styles.ratingOverview}>
          <div className={styles.ratingScore}>
            <span className={styles.ratingValue}>{overallRating.toFixed(1)}</span>
            <StarDisplay value={overallRating} size={16} />
            <span className={styles.ratingTotal}>
              {totalCount} {totalCount === 1 ? "review" : "reviews"}
            </span>
          </div>
          {distribution.length > 0 && (
            <ul className={styles.ratingBars} aria-label="Rating breakdown">
              {distribution.map(({ stars, count }) => {
                const percent = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                return (
                  <li
                    key={stars}
                    className={styles.ratingBarRow}
                    aria-label={`${stars} star${stars > 1 ? "s" : ""}: ${count} ${count === 1 ? "review" : "reviews"}`}
                  >
                    <span className={styles.ratingBarLabel} aria-hidden="true">
                      {stars} <Star size={12} fill="currentColor" />
                    </span>
                    <span className={styles.ratingBarTrack} aria-hidden="true">
                      <span className={styles.ratingBarFill} style={{ width: `${percent}%` }} />
                    </span>
                    <span className={styles.ratingBarCount} aria-hidden="true">
                      {count}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

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

      {data && reviews.length === 0 && (
        <div className={styles.emptyPanel}>
          <MessageSquareText size={22} aria-hidden="true" />
          <p className={styles.emptyNote}>No reviews yet. Be the first to share your experience.</p>
        </div>
      )}

      {reviews.length > 0 && (
        <ul className={styles.reviewList}>
          {reviews.map((review) => (
            <li key={review.id} className={styles.reviewRow}>
              <div className={styles.reviewRowHead}>
                <span className={styles.reviewAuthor}>
                  <span className={styles.reviewAvatar} aria-hidden="true">
                    <UserRound size={15} />
                  </span>
                  Anonymous student
                </span>
                {review.isMine && <Badge variant="lavender">Your review</Badge>}
                <time className={styles.reviewDate} dateTime={new Date(review.createdAt).toISOString()}>
                  {formatDate(review.createdAt)}
                </time>
              </div>
              <span className={styles.reviewStars} aria-label={`${review.rating} out of 5 stars`}>
                <StarDisplay value={review.rating} />
              </span>
              {review.reviewText && <p className={styles.reviewText}>{review.reviewText}</p>}
            </li>
          ))}
        </ul>
      )}

      {hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          className={styles.showMoreButton}
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? "Loading..." : "Load more reviews"}
        </Button>
      )}
    </section>
  );
};

const RESOURCE_KIND_LABELS: Record<OrgCatalogueKind, string> = {
  course: "Course",
  bundle: "Bundle",
  test: "Mock test",
  live_test: "Live test",
  product: "Study notes",
};

const RESOURCE_KIND_ICONS: Record<OrgCatalogueKind, React.ComponentType<{ size?: number }>> = {
  course: BookOpen,
  bundle: Library,
  test: ClipboardList,
  live_test: ClipboardList,
  product: FileText,
};

const RESOURCE_KIND_TONES: Record<OrgCatalogueKind, string> = {
  course: styles.resourceFallbackPeach,
  bundle: styles.resourceFallbackPeach,
  test: styles.resourceFallbackLavender,
  live_test: styles.resourceFallbackLavender,
  product: styles.resourceFallbackSage,
};

const THUMB_RATIO = 16 / 9;

const formatRupees = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

/**
 * Thumbnails sit in a fixed 16:9 frame. An image close to that shape fills
 * it; any other shape is shown whole (contain) so text on posters and covers
 * is never cut. Missing or broken images get a tinted placeholder.
 */
const ResourceThumb: React.FC<{ item: OrgCatalogueItem }> = ({ item }) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  const [contain, setContain] = useState(false);

  const checkShape = useCallback((img: HTMLImageElement | null) => {
    if (!img?.naturalWidth || !img.naturalHeight) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    setContain(Math.abs(ratio - THUMB_RATIO) / THUMB_RATIO > 0.08);
  }, []);

  useEffect(() => {
    if (imageRef.current?.complete) checkShape(imageRef.current);
  }, [item.thumbnailUrl, checkShape]);

  if (!item.thumbnailUrl || failed) {
    const Icon = RESOURCE_KIND_ICONS[item.kind];
    return (
      <span className={`${styles.resourceThumb} ${styles.resourceFallback} ${RESOURCE_KIND_TONES[item.kind]}`}>
        <Icon size={28} />
      </span>
    );
  }

  return (
    <span className={styles.resourceThumb}>
      <img
        ref={imageRef}
        src={item.thumbnailUrl}
        alt=""
        loading="lazy"
        className={contain ? styles.resourceImageContain : styles.resourceImageCover}
        onLoad={(e) => checkShape(e.currentTarget)}
        onError={() => setFailed(true)}
      />
    </span>
  );
};

const ResourceCard: React.FC<{ item: OrgCatalogueItem }> = ({ item }) => {
  const sellingPrice = item.discountPrice ?? item.price;
  const originalPrice = item.discountPrice !== null ? item.price : null;
  const percentOff = originalPrice ? Math.round((1 - sellingPrice / originalPrice) * 100) : 0;

  return (
    <Link to={catalogueLink(item)} className={styles.resourceCard}>
      <span className={styles.resourceMedia}>
        <ResourceThumb item={item} />
      </span>

      <span className={styles.resourceBody}>
        <span className={styles.resourceTags}>
          <span className={styles.resourceKind}>{RESOURCE_KIND_LABELS[item.kind]}</span>
          {item.examName && <span className={styles.resourceExam}>{item.examName}</span>}
        </span>
        <h3 className={styles.resourceTitle}>{item.title}</h3>
        <span className={styles.resourceTeacher}>
          <Avatar className={styles.resourceAvatar}>
            <AvatarImage src={item.teacherAvatarUrl ?? undefined} alt="" />
            <AvatarFallback>{item.teacherName.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className={styles.resourceTeacherName}>{item.teacherName}</span>
          <VerifiedBadge isVerified={item.teacherIsVerified} size="sm" />
        </span>
      </span>

      <span className={styles.resourceFooter}>
        <span className={styles.resourceMeta}>
          {item.rating ? (
            <span className={styles.resourceRating}>
              <Star size={13} fill="currentColor" aria-hidden="true" />
              {item.rating.toFixed(1)}
            </span>
          ) : null}
          {item.kind === "product" && item.pageCount ? <span>{item.pageCount} pages</span> : null}
          {percentOff > 0 && <span className={styles.resourceOff}>{percentOff}% off</span>}
        </span>
        <span className={styles.resourcePrice}>
          {sellingPrice === 0 ? (
            <span className={styles.resourceFree}>Free</span>
          ) : (
            <>
              {originalPrice !== null && <s className={styles.resourceOriginal}>{formatRupees(originalPrice)}</s>}
              <span className={styles.resourceSelling}>{formatRupees(sellingPrice)}</span>
            </>
          )}
        </span>
      </span>
    </Link>
  );
};

const ResourceGrid: React.FC<{ items: OrgCatalogueItem[]; emptyMessage: string; icon: React.ComponentType<{ size?: number }> }> = ({
  items,
  emptyMessage,
  icon: Icon,
}) => {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, CATALOGUE_COLLAPSED_COUNT);

  if (items.length === 0) {
    return (
      <div className={styles.emptyPanel}>
        <Icon size={22} />
        <p className={styles.emptyNote}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.resourceGrid}>
        {visibleItems.map((item) => (
          <ResourceCard key={`${item.kind}-${item.id}`} item={item} />
        ))}
      </div>
      {items.length > CATALOGUE_COLLAPSED_COUNT && (
        <Button variant="outline" size="sm" className={styles.showMoreButton} onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show less" : `Show all ${items.length}`}
        </Button>
      )}
    </>
  );
};

type ResourceTab = "courses" | "mock-tests" | "study-resources";

const RESOURCE_TAB_COPY: Record<ResourceTab, { hint: string; empty: string }> = {
  courses: {
    hint: "Courses and bundles published by teachers associated with this page.",
    empty: "No courses published yet.",
  },
  "mock-tests": {
    hint: "Mock tests and live test series published by teachers associated with this page.",
    empty: "No mock tests published yet.",
  },
  "study-resources": {
    hint: "Notes and study material published by teachers associated with this page.",
    empty: "No study resources published yet.",
  },
};

/**
 * One section for Courses, Mock Tests and Study Resources. The tabs keep their
 * own routes (/courses, /mock-tests, /study-resources) so links, refresh and
 * back/forward still work, but switch in place without scrolling the page.
 */
const LearningResourcesSection: React.FC<{
  tab: ResourceTab;
  orgType: OutputType["organization"]["orgType"];
  orgSlug: string;
  lists: Record<ResourceTab, OrgCatalogueItem[]>;
}> = ({ tab, orgType, orgSlug, lists }) => {
  const items = lists[tab];

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>
          <span className={`${styles.titleIcon} ${styles.titleIconBlue}`}>
            <Library size={16} aria-hidden="true" />
          </span>
          Learning Resources
        </h2>
        {items.length > 0 && (
          <span className={styles.catalogueCount}>
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        )}
      </div>

      <nav className={styles.resourceTabs} aria-label="Learning resource types">
        {RESOURCE_TABS.map((value) => {
          const Icon = TAB_ICONS[value];
          const isActive = tab === value;
          return (
            <Link
              key={value}
              to={getOrganizationTabPath(orgType, orgSlug, value)}
              state={{ preserveScroll: true }}
              className={`${styles.resourceTab} ${isActive ? styles.resourceTabActive : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={15} />
              {ORGANIZATION_TAB_LABELS[value]}
            </Link>
          );
        })}
      </nav>

      <p className={styles.sectionHint}>{RESOURCE_TAB_COPY[tab].hint}</p>
      <ResourceGrid key={tab} items={items} emptyMessage={RESOURCE_TAB_COPY[tab].empty} icon={TAB_ICONS[tab]} />
    </section>
  );
};

interface OrganizationProfileViewProps {
  data: OutputType;
  orgSlug: string;
  tab?: OrganizationTabValue;
}

const TAB_ICONS: Record<OrganizationTabValue, React.ComponentType<{ size?: number }>> = {
  about: Info,
  teachers: GraduationCap,
  courses: BookOpen,
  "mock-tests": ClipboardList,
  "study-resources": FileText,
  reviews: Star,
  posts: Megaphone,
};

const RESOURCE_TABS: ResourceTab[] = ["courses", "mock-tests", "study-resources"];

const isResourceTab = (tab: OrganizationTabValue): tab is ResourceTab =>
  (RESOURCE_TABS as OrganizationTabValue[]).includes(tab);

interface SectionNavProps {
  orgType: OutputType["organization"]["orgType"];
  orgSlug: string;
  tab: OrganizationTabValue;
}

// Learning Resources opens on Courses and stays active for all three
// resource routes; its own tabs live in the content area.
const NAV_ENTRIES: {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  target: OrganizationTabValue;
  tone: string;
  isActive: (tab: OrganizationTabValue) => boolean;
}[] = [
  { key: "about", label: ORGANIZATION_TAB_LABELS.about, icon: Info, target: "about", tone: styles.navTonePeach, isActive: (t) => t === "about" },
  { key: "teachers", label: ORGANIZATION_TAB_LABELS.teachers, icon: GraduationCap, target: "teachers", tone: styles.navToneMint, isActive: (t) => t === "teachers" },
  { key: "resources", label: "Learning Resources", icon: Library, target: "courses", tone: styles.navToneLavender, isActive: isResourceTab },
  { key: "reviews", label: ORGANIZATION_TAB_LABELS.reviews, icon: Star, target: "reviews", tone: styles.navToneSky, isActive: (t) => t === "reviews" },
  { key: "posts", label: ORGANIZATION_TAB_LABELS.posts, icon: Megaphone, target: "posts", tone: styles.navToneButter, isActive: (t) => t === "posts" },
];

const SectionNavLinks: React.FC<SectionNavProps & { className: string; activeClassName: string; showChevron?: boolean }> = ({
  orgType,
  orgSlug,
  tab,
  className,
  activeClassName,
  showChevron = false,
}) => (
  <>
    {NAV_ENTRIES.map(({ key, label, icon: Icon, target, tone, isActive }) => {
      const active = isActive(tab);
      return (
        <Link
          key={key}
          to={getOrganizationTabPath(orgType, orgSlug, target)}
          state={{ preserveScroll: true }}
          className={`${className} ${tone} ${active ? activeClassName : ""}`}
          aria-current={active ? "page" : undefined}
        >
          <span className={styles.navIcon} aria-hidden="true">
            <span className={styles.navBlob} />
            <Icon size={18} />
          </span>
          <span className={styles.navLabel}>{label}</span>
          {showChevron && <ChevronRight size={16} className={styles.navChevron} aria-hidden="true" />}
        </Link>
      );
    })}
  </>
);

/**
 * Desktop/tablet: a sticky panel with About, Teachers, Learning Resources,
 * Reviews and Posts, in the same language as the exam pages' Important Links
 * panel. Each item is its own route, so refresh and back/forward work.
 */
const SectionSidebar: React.FC<SectionNavProps & { orgName: string }> = ({ orgName, ...props }) => (
  <nav className={styles.sectionSidebar} aria-label="Organisation page sections">
    <div className={styles.navHeader}>
      <h2 className={styles.navTitle}>Explore</h2>
      <p className={styles.navSubtitle}>Everything about {orgName}</p>
    </div>
    <div className={styles.navList}>
      <SectionNavLinks {...props} className={styles.navLink} activeClassName={styles.navLinkActive} showChevron />
    </div>
  </nav>
);

/**
 * Phones: the same sections as one horizontally scrolling row of pills. Keeps
 * the active pill in view without scrolling the page.
 */
const SectionScroller: React.FC<SectionNavProps> = (props) => {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const centreActive = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active || !nav.clientWidth) return;
      const target = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
      nav.scrollTo({ left: Math.max(0, target) });
    };
    centreActive();
    // The row is hidden above the phone breakpoint, so re-centre once it
    // gets a size (rotation, resize).
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(centreActive) : null;
    observer?.observe(nav);
    return () => observer?.disconnect();
  }, [props.tab]);

  return (
    <nav ref={navRef} className={styles.sectionScroller} aria-label="Organisation page sections">
      <SectionNavLinks {...props} className={styles.scrollerLink} activeClassName={styles.scrollerLinkActive} />
    </nav>
  );
};

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// Matches .navColumn's sticky top: the site header plus a small gap.
const SECTION_TOP_OFFSET_REM = 5.5;

/**
 * Section and resource-tab links change the route but this view stays
 * mounted (OrganizationProfileLayout). They pass state.preserveScroll so the
 * app's ScrollToTop leaves the page alone; the position is then made
 * intentional: kept as is while the reader is above the content, otherwise
 * aligned to the top of the sidebar and content. It is applied on the next
 * frame because the Floot editor preview runs its own scroll-to-top after
 * every route change.
 */
const useKeepSectionScroll = (tab: OrganizationTabValue, shellRef: React.RefObject<HTMLDivElement | null>) => {
  const renderedTab = useRef(tab);

  useIsomorphicLayoutEffect(() => {
    if (renderedTab.current === tab) return;
    renderedTab.current = tab;
    const shell = shellRef.current;
    if (!shell) return;
    const startY = window.scrollY;
    const offset = parseFloat(getComputedStyle(document.documentElement).fontSize) * SECTION_TOP_OFFSET_REM;
    const contentTop = Math.max(0, shell.getBoundingClientRect().top + window.scrollY - offset);
    const target = Math.min(startY, contentTop);
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: target, behavior: "instant" as ScrollBehavior });
    });
    return () => cancelAnimationFrame(frame);
  }, [tab]);
};

export const OrganizationProfileView: React.FC<OrganizationProfileViewProps> = ({ data, orgSlug, tab = "about" }) => {
  const { organization, teachers, catalogue, posts, followerCount, isFollowing, reviewCount, averageRating } = data;
  const shellRef = useRef<HTMLDivElement>(null);
  const { authState } = useAuth();
  const isSignedIn = authState.type === "authenticated";

  useKeepSectionScroll(tab, shellRef);

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

  // Type and location are already in the profile header, so the About info
  // row only carries the remaining details.
  const infoItems = [
    organization.foundedYear && {
      key: "founded",
      icon: CalendarDays,
      tone: styles.infoIconLavender,
      label: "Founded",
      content: String(organization.foundedYear),
    },
    organization.affiliatedUniversity && {
      key: "affiliatedUniversity",
      icon: GraduationCap,
      tone: styles.infoIconLavender,
      label: "Affiliated University",
      content: organization.affiliatedUniversity.name,
      href: getOrganizationProfilePath("university", organization.affiliatedUniversity.slug),
    },
    organization.instituteSize && {
      key: "size",
      icon: Users,
      tone: styles.infoIconMint,
      label: "Size",
      content: INSTITUTE_SIZE_LABELS[organization.instituteSize] ?? organization.instituteSize,
    },
    isSignedIn && organization.websiteUrl && {
      key: "website",
      icon: Globe,
      tone: styles.infoIconSky,
      label: "Website",
      content: organization.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      href: organization.websiteUrl,
    },
    isSignedIn && organization.phoneNumber && {
      key: "phone",
      icon: Phone,
      tone: styles.infoIconPeach,
      label: "Phone",
      content: organization.phoneNumber,
      href: `tel:${organization.phoneNumber}`,
    },
  ].filter(Boolean) as { key: string; icon: typeof Building2; tone: string; label: string; content: string; href?: string }[];

  const hasAbout = !!organization.description || organization.specialties.length > 0;

  return (
    <div className={styles.page}>
      <header className={`${styles.profileHeader} ${organization.coverImageUrl ? styles.profileHeaderWithCover : ""}`}>
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
          <ClaimOrganizationButton
            organizationId={organization.id}
            orgSlug={orgSlug}
            claimStatus={organization.claimStatus}
          />
        </div>
      </header>

      <div ref={shellRef} className={styles.shell}>
        <aside className={styles.navColumn}>
          <SectionSidebar orgType={organization.orgType} orgSlug={orgSlug} tab={tab} orgName={organization.name} />
        </aside>
        <SectionScroller orgType={organization.orgType} orgSlug={orgSlug} tab={tab} />

        <div className={styles.main}>
          {tab === "about" && (
            <div className={styles.aboutStack}>
              <section className={`${styles.panel} ${styles.aboutPanel}`}>
                <h2 className={styles.sectionTitle}>
                  <span className={`${styles.titleIcon} ${styles.titleIconPeach}`}>
                    <Info size={16} aria-hidden="true" />
                  </span>
                  About {organization.name}
                </h2>
                {organization.description ? (
                  <div
                    className={styles.orgDescription}
                    dangerouslySetInnerHTML={{
                      __html: wrapContentTables(sanitizeHtml(organization.description)),
                    }}
                  />
                ) : (
                  !hasAbout && <p className={styles.emptyNote}>This institute has not added a description yet.</p>
                )}
                {organization.specialties.length > 0 && (
                  <div className={styles.specialtyBlock}>
                    <span className={styles.specialtyLabel}>Specialties</span>
                    <div className={styles.specialtyRow}>
                      {organization.specialties.map((specialty) => (
                        <span key={specialty} className={styles.specialtyChip}>
                          {specialty}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {(infoItems.length > 0 || socialLinkItems.length > 0) && (
                  <div className={styles.aboutInfo}>
                    {infoItems.length > 0 && (
                      <dl className={styles.aboutInfoList}>
                        {infoItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <div key={item.key} className={styles.aboutInfoItem}>
                              <span className={`${styles.aboutInfoIcon} ${item.tone}`} aria-hidden="true">
                                <Icon size={15} />
                              </span>
                              <div className={styles.aboutInfoText}>
                                <dt className={styles.aboutInfoLabel}>{item.label}</dt>
                                <dd className={styles.aboutInfoValue}>
                                  {item.href ? (
                                    item.href.startsWith("/") ? (
                                      <Link to={item.href}>{item.content}</Link>
                                    ) : (
                                      <a
                                        href={item.href}
                                        target={item.href.startsWith("tel:") ? undefined : "_blank"}
                                        rel="noreferrer"
                                      >
                                        {item.content}
                                      </a>
                                    )
                                  ) : (
                                    item.content
                                  )}
                                </dd>
                              </div>
                            </div>
                          );
                        })}
                      </dl>
                    )}

                    {socialLinkItems.length > 0 && (
                      <div className={styles.aboutSocial}>
                        <span className={styles.aboutInfoLabel}>Follow</span>
                        <div className={styles.socialRow}>
                          {socialLinkItems.map(({ key, href, label, Icon }) => (
                            <a key={key} href={href} target="_blank" rel="noreferrer" aria-label={label} className={styles.socialLink}>
                              <Icon size={16} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {(data.gallery?.length ?? 0) > 0 && (
                <div className={styles.aboutGallery}>
                  <GallerySection items={data.gallery} />
                </div>
              )}
            </div>
          )}

          {tab === "teachers" && (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>
                  <span className={`${styles.titleIcon} ${styles.titleIconSage}`}>
                    <GraduationCap size={16} aria-hidden="true" />
                  </span>
                  Teachers
                </h2>
                {teachers.length > 0 && (
                  <span className={styles.catalogueCount}>
                    {teachers.length} {teachers.length === 1 ? "teacher" : "teachers"}
                  </span>
                )}
              </div>
              {teachers.length > 0 ? (
                <div className={styles.teacherGrid}>
                  {teachers.map((teacher) => (
                    <Link
                      key={teacher.id}
                      to={teacher.slug ? `/expert/${teacher.slug}` : "#"}
                      className={styles.teacherCard}
                    >
                      <span className={styles.teacherBand} aria-hidden="true">
                        <span className={styles.teacherBlob} />
                        <span className={styles.teacherDot} />
                      </span>
                      <div className={styles.teacherBody}>
                        <Avatar className={styles.teacherAvatar}>
                          <AvatarImage src={teacher.avatarUrl ?? undefined} alt="" />
                          <AvatarFallback>{teacher.displayName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className={styles.teacherMeta}>
                          <span className={styles.teacherNameRow}>
                            <span className={styles.teacherName}>{teacher.displayName}</span>
                            <VerifiedBadge isVerified={teacher.isVerified} size="sm" />
                          </span>
                          {teacher.tagline && (
                            <span className={styles.teacherTagline} title={teacher.tagline}>
                              {teacher.tagline}
                            </span>
                          )}
                        </div>
                        {teacher.subjects.length > 0 && (
                          <div className={styles.teacherSubjects}>
                            {teacher.subjects.slice(0, 4).map((subject) => (
                              <span key={subject} className={styles.teacherSubject}>
                                {subject}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className={styles.teacherFooter}>
                        <span className={styles.teacherStats}>
                          {teacher.rating !== null ? (
                            <>
                              <span className={styles.teacherRating}>
                                <Star size={14} fill="currentColor" aria-hidden="true" />
                                {teacher.rating.toFixed(1)}
                              </span>
                              <span className={styles.teacherRatingCount}>
                                {teacher.ratingCount} {teacher.ratingCount === 1 ? "review" : "reviews"}
                              </span>
                            </>
                          ) : (
                            <span className={styles.teacherRatingCount}>No ratings yet</span>
                          )}
                          {!!teacher.yearsOfExperience && (
                            <span className={styles.teacherRatingCount}>
                              {teacher.yearsOfExperience}+ yrs experience
                            </span>
                          )}
                        </span>
                        {teacher.slug && (
                          <span className={styles.teacherCta}>
                            View profile <ArrowRight size={14} aria-hidden="true" />
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyPanel}>
                  <GraduationCap size={22} aria-hidden="true" />
                  <p className={styles.emptyNote}>No teachers are associated with this page yet.</p>
                </div>
              )}
            </section>
          )}

          {isResourceTab(tab) && (
            <LearningResourcesSection
              tab={tab}
              orgType={organization.orgType}
              orgSlug={orgSlug}
              lists={{
                courses: coursesCatalogue,
                "mock-tests": mockTestsCatalogue,
                "study-resources": studyResourcesCatalogue,
              }}
            />
          )}

          {tab === "reviews" && (
            <ReviewsSection organizationId={organization.id} reviewCount={reviewCount} averageRating={averageRating} />
          )}

          {tab === "posts" && (
            <CommunityPostsSection posts={posts} orgSlug={orgSlug} orgName={organization.name} />
          )}
        </div>
      </div>
    </div>
  );
};
