import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import {
  BookOpen,
  CheckCircle,
  ChevronDown,
  Info,
  ArrowRight,
  Loader,
  GraduationCap,
  Languages,
  BarChart3,
  FileText,
  Clock,
  HelpCircle,
  Package,
  Infinity as InfinityIcon,
  ListChecks,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import { useBundleDetailsQuery } from '../helpers/useBundlesQuery';
import { usePurchaseBundleMutation } from '../helpers/useStudentBundles';
import { useAuth } from '../helpers/useAuth';
import { Skeleton } from './Skeleton';
import { Button } from './Button';
import { Avatar, AvatarFallback, AvatarImage } from './Avatar';
import { PromoCodeInput } from './PromoCodeInput';
import { VerifiedBadge } from './VerifiedBadge';
import { Placeholder } from '../helpers/placeholderImages';
import { wrapContentTables } from '../helpers/contentTables';
import { sanitizeHtml } from '../helpers/sanitizeHtml';
import { bundleDescriptionToHtml, bundleDescriptionToPlainText } from '../helpers/bundleDescription';
import { getBundleRedirectUrl } from '../endpoints/payment/payu/bundle-redirect_GET.schema';
import type { OutputType as BundleDetails } from '../endpoints/bundles/details_GET.schema';
import { MobileStickyPurchaseBar } from './MobileStickyPurchaseBar';
import { AssetTopRow } from './AssetTopRow';
import { PublicCouponsCard } from './PublicCouponsCard';
import styles from './BundleDetailsView.module.css';

interface BundleDetailsViewProps {
  slug: string;
  className?: string;
}

type BundleItem = BundleDetails['items'][number];
type ItemType = BundleItem['type'];
type BundleTeacher = BundleDetails['teacher'];

const ITEM_TYPES: ItemType[] = ['course', 'test', 'digital_product'];

/** Rows shown before "Show all", so a large bundle does not run for pages. */
const INITIAL_VISIBLE_ITEMS = 8;

const levelLabel: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

const itemTypeConfig: Record<
  ItemType,
  {
    label: string;
    singular: string;
    plural: string;
    icon: React.ElementType;
    tone: string;
    fallbackImage: string;
    path: string;
  }
> = {
  course: {
    label: 'Course',
    singular: 'Course',
    plural: 'Courses',
    icon: GraduationCap,
    tone: styles.tonePeach,
    fallbackImage: Placeholder.COURSE,
    path: '/course',
  },
  test: {
    label: 'Test Series',
    singular: 'Test Series',
    plural: 'Test Series',
    icon: FileText,
    tone: styles.toneBlue,
    fallbackImage: Placeholder.TEST,
    path: '/mock-test',
  },
  digital_product: {
    label: 'Study Notes',
    singular: 'Study Note',
    plural: 'Study Notes',
    icon: BookOpen,
    tone: styles.toneLavender,
    fallbackImage: Placeholder.NOTE,
    path: '/study-notes',
  },
};

const formatInr = (amount: number) => `₹${new Intl.NumberFormat('en-IN').format(amount)}`;

const htmlEntities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

const decodeEntity = (entity: string, name: string) => {
  if (name[0] === '#') {
    const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
  }
  return htmlEntities[name] ?? entity;
};

const stripHtml = (html: string | undefined | null) => {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, decodeEntity)
    .replace(/\s+/g, ' ')
    .trim();
};

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'T';

const plural = (count: number, singular: string, pluralForm: string) => (count === 1 ? singular : pluralForm);

const ItemMeta: React.FC<{ item: BundleItem }> = ({ item }) => {
  const entries: { key: string; icon: React.ReactNode; text: string; title: string }[] = [];

  if (item.type === 'course') {
    entries.push({ key: 'level', icon: <BarChart3 size={12} />, text: levelLabel[item.level] || item.level, title: 'Level' });
  } else if (item.type === 'test') {
    entries.push({ key: 'duration', icon: <Clock size={12} />, text: `${item.durationMinutes} mins`, title: 'Duration' });
    entries.push({ key: 'questions', icon: <HelpCircle size={12} />, text: `${item.totalQuestions} questions`, title: 'Questions' });
  } else if (item.pageCount) {
    entries.push({ key: 'pages', icon: <BookOpen size={12} />, text: `${item.pageCount} ${plural(item.pageCount, 'page', 'pages')}`, title: 'Pages' });
  }

  if (item.language) {
    entries.push({ key: 'language', icon: <Languages size={12} />, text: item.language, title: 'Language' });
  }

  if (entries.length === 0) return null;

  return (
    <div className={styles.itemMeta}>
      {entries.map((entry) => (
        <span key={entry.key} title={entry.title}>
          <span className={styles.metaIcon}>{entry.icon}</span>
          {entry.text}
        </span>
      ))}
    </div>
  );
};

// Every item in a bundle belongs to the bundle's teacher (bundles can only be
// built from the teacher's own products), so the bundle teacher is the educator.
const BundleItemCard: React.FC<{ item: BundleItem; teacher: BundleTeacher }> = ({ item, teacher }) => {
  const navigate = useNavigate();
  const config = itemTypeConfig[item.type];
  const TypeIcon = config.icon;

  // The card is itself a link, so the name cannot be a nested <a>. It navigates
  // on its own and stops the card's click, as TeacherProductCard's teacher row does.
  const openProfile = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/expert/${teacher.slug}`);
  };

  return (
    <Link
      to={`${config.path}/${item.slug}`}
      className={`${styles.itemCard} ${config.tone}`}
      title={item.title}
    >
      <div className={styles.itemThumb}>
        <img
          src={item.thumbnailUrl || config.fallbackImage}
          alt=""
          loading="lazy"
          className={styles.itemThumbImage}
        />
        <span className={styles.typePill}>
          <TypeIcon size={12} aria-hidden="true" />
          {config.label}
        </span>
      </div>
      <div className={styles.itemBody}>
        <h3 className={styles.itemTitle}>{item.title}</h3>
        <div className={styles.itemEducator}>
          <Avatar className={styles.itemEducatorAvatar}>
            <AvatarImage src={teacher.profilePicture || undefined} alt="" />
            <AvatarFallback>{initials(teacher.displayName)}</AvatarFallback>
          </Avatar>
          {teacher.slug ? (
            <span
              className={`${styles.itemEducatorName} ${styles.educatorLink}`}
              role="link"
              tabIndex={0}
              onClick={openProfile}
              onKeyDown={(e) => {
                if (e.key === 'Enter') openProfile(e);
              }}
            >
              {teacher.displayName}
            </span>
          ) : (
            <span className={styles.itemEducatorName}>{teacher.displayName}</span>
          )}
          <VerifiedBadge isVerified={!!teacher.isVerified} size="sm" />
        </div>
        <ItemMeta item={item} />
        <div className={styles.itemFooter}>
          {item.price === 0 ? (
            <span className={styles.itemPriceFree}>Free</span>
          ) : (
            <span className={styles.itemPriceGroup}>
              <span className={styles.itemPriceLabel}>Worth</span>
              <span className={styles.itemPriceStrike}>{formatInr(item.price)}</span>
            </span>
          )}
          <span className={styles.itemArrow} aria-hidden="true">
            <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
};

const IncludedItems: React.FC<{ items: BundleItem[]; teacher: BundleTeacher }> = ({ items, teacher }) => {
  const [filter, setFilter] = useState<ItemType | 'all'>('all');
  const [isExpanded, setIsExpanded] = useState(false);

  const presentTypes = ITEM_TYPES.filter((type) => items.some((item) => item.type === type));
  const filtered = filter === 'all' ? items : items.filter((item) => item.type === filter);
  const visible = isExpanded ? filtered : filtered.slice(0, INITIAL_VISIBLE_ITEMS);
  const canToggle = filtered.length > INITIAL_VISIBLE_ITEMS;

  const selectFilter = (next: ItemType | 'all') => {
    setFilter(next);
    setIsExpanded(false);
  };

  return (
    <>
      {presentTypes.length > 1 && (
        <div className={styles.filterTabs} role="group" aria-label="Filter included items">
          <button
            type="button"
            className={`${styles.filterTab} ${styles.filterTabPlain} ${styles.toneNeutral}`}
            aria-pressed={filter === 'all'}
            onClick={() => selectFilter('all')}
          >
            All
          </button>
          {presentTypes.map((type) => {
            const config = itemTypeConfig[type];
            const TypeIcon = config.icon;
            const count = items.filter((item) => item.type === type).length;
            return (
              <button
                key={type}
                type="button"
                className={`${styles.filterTab} ${config.tone}`}
                aria-pressed={filter === type}
                onClick={() => selectFilter(type)}
              >
                <TypeIcon size={14} aria-hidden="true" />
                {config.plural}
                <span className={styles.filterCount}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.itemsList}>
        {visible.map((item) => (
          <BundleItemCard key={`${item.type}-${item.id}`} item={item} teacher={teacher} />
        ))}
      </div>

      {canToggle && (
        <button
          type="button"
          className={styles.showMore}
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((value) => !value)}
        >
          {isExpanded ? 'Show fewer' : `Show all ${filtered.length} items`}
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={isExpanded ? styles.chevronUp : undefined}
          />
        </button>
      )}
    </>
  );
};

export const BundleDetailsView: React.FC<BundleDetailsViewProps> = ({ slug, className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { authState } = useAuth();
  const isTeacher = authState.type === 'authenticated' && authState.user.role === 'teacher';
  const { data: bundle, isFetching, error } = useBundleDetailsQuery(slug);
  const purchaseMutation = usePurchaseBundleMutation();

  const [promoCodeId, setPromoCodeId] = useState<number | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isStickyBarVisible, setIsStickyBarVisible] = useState(false);
  const pricingRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  // The sticky card's offset is clamped against its own height in CSS, so a card
  // taller than a short laptop screen sticks by its bottom edge (Buy Now in view)
  // instead of being cut off.
  useEffect(() => {
    const aside = asideRef.current;
    if (!aside || typeof ResizeObserver === 'undefined') return;
    const sync = () => aside.style.setProperty('--bd-aside-height', `${aside.offsetHeight}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(aside);
    return () => observer.disconnect();
  }, [bundle]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsStickyBarVisible(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    if (pricingRef.current) {
      observer.observe(pricingRef.current);
    }

    return () => observer.disconnect();
  }, [bundle]);

  const handlePurchase = () => {
    if (authState.type !== 'authenticated') {
      navigate(`/login?redirectTo=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (!bundle) return;

    if (bundle.price === 0) {
      purchaseMutation.mutate(
        { bundleId: bundle.id, promoCode: promoCodeId?.toString() },
        {
          onSuccess: (data) => {
            if (data.isFree) {
              toast.success('Successfully enrolled in the bundle!');
              queryClient.invalidateQueries({ queryKey: ['public', 'bundles', 'details', slug] });
            }
          },
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'An unknown error occurred.');
          },
        }
      );
    } else {
      toast.loading('Redirecting to payment gateway...');
      // @ts-ignore
      window.location.href = getBundleRedirectUrl(bundle.id, promoCodeId);
    }
  };

  // Only before the first load; the refetch after a free enrollment keeps the page in place.
  if (isFetching && !bundle) {
    return <BundleDetailsSkeleton />;
  }

  if (error || !bundle) {
    return (
      <div className={styles.errorState}>
        <Info size={48} />
        <h2>Bundle Not Found</h2>
        <p>The bundle you are looking for does not exist or may have been removed.</p>
        <Button asChild>
          <Link to="/bundles">Browse Bundles</Link>
        </Button>
      </div>
    );
  }

  const finalPrice = Math.max(0, bundle.price - discountAmount);
  const totalItemsValue = bundle.items.reduce((sum, item) => sum + item.price, 0);
  const hasDiscount = totalItemsValue > finalPrice;
  const totalSavings = totalItemsValue - finalPrice;
  const savingsPercent = hasDiscount && totalItemsValue > 0 ? Math.round((totalSavings / totalItemsValue) * 100) : 0;
  const itemCount = bundle.items.length;

  const descriptionHtml = wrapContentTables(sanitizeHtml(bundleDescriptionToHtml(bundle.description)));
  const hasDescription = stripHtml(descriptionHtml).length > 0;

  const renderMedia = () => {
    if (bundle.introVideoUrl) {
      try {
        const isYouTube = bundle.introVideoUrl.includes('youtube.com') || bundle.introVideoUrl.includes('youtu.be');
        if (isYouTube) {
          const urlObj = new URL(bundle.introVideoUrl);
          const videoId = urlObj.hostname.includes('youtube.com')
            ? urlObj.searchParams.get('v')
            : urlObj.pathname.slice(1);
          const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : bundle.introVideoUrl;

          return (
            <iframe
              src={embedUrl}
              className={styles.mediaEmbed}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={`${bundle.title} Intro Video`}
            />
          );
        }
      } catch (e) {
        // Fallback to normal video if URL parsing fails
      }
      return (
        <video
          src={bundle.introVideoUrl}
          controls
          className={styles.mediaEmbed}
          poster={bundle.thumbnailUrl || undefined}
        />
      );
    }

    if (bundle.thumbnailUrl) {
      return (
        <img
          src={bundle.thumbnailUrl}
          alt={bundle.title}
          className={styles.mediaEmbed}
        />
      );
    }

    return <Package size={56} className={styles.bundleIcon} />;
  };

  const includeChips = [
    ...ITEM_TYPES.map((type) => {
      const count = bundle.items.filter((item) => item.type === type).length;
      if (count === 0) return null;
      const config = itemTypeConfig[type];
      const TypeIcon = config.icon;
      return {
        key: type,
        tone: config.tone,
        icon: <TypeIcon size={14} aria-hidden="true" />,
        text: `${count} ${plural(count, config.singular, config.plural)}`,
      };
    }),
    { key: 'lifetime', tone: styles.toneMint, icon: <InfinityIcon size={14} aria-hidden="true" />, text: 'Lifetime access' },
  ].filter(Boolean) as { key: string; tone: string; icon: React.ReactNode; text: string }[];

  // Cached payloads from before teacher.slug existed have none; those render the name as plain text.
  const profilePath = bundle.teacher.slug ? `/expert/${bundle.teacher.slug}` : null;

  const teacherAvatar = (className: string) => (
    <Avatar className={className}>
      <AvatarImage src={bundle.teacher.profilePicture || undefined} alt="" />
      <AvatarFallback>{initials(bundle.teacher.displayName)}</AvatarFallback>
    </Avatar>
  );

  return (
    <>
      <Helmet>
        <title>{`${bundle.title} | Testkart`}</title>
        <meta name="description" content={bundleDescriptionToPlainText(bundle.description) || `Learn more about the ${bundle.title} course bundle.`} />
      </Helmet>
      <div className={`${styles.container} ${className || ''}`}>
        <header className={styles.header}>
          <AssetTopRow
            leading="breadcrumb"
            kind="bundle"
            handle={slug}
            title={bundle.title}
            className={styles.topRow}
          >
            <div className={styles.titleBlock}>
              <span className={`${styles.eyebrow} ${styles.tonePeach}`}>
                <Package size={13} aria-hidden="true" />
                Bundle
              </span>
              <h1 className={styles.title}>{bundle.title}</h1>
            </div>
          </AssetTopRow>
          <div className={styles.byline}>
            {teacherAvatar(styles.bylineAvatar)}
            <span className={styles.bylineName}>
              by{' '}
              {profilePath ? (
                <Link to={profilePath} className={styles.educatorLink}>
                  <strong>{bundle.teacher.displayName}</strong>
                </Link>
              ) : (
                <strong>{bundle.teacher.displayName}</strong>
              )}
              <VerifiedBadge isVerified={!!bundle.teacher.isVerified} size="sm" />
            </span>
          </div>
        </header>

        <aside ref={asideRef} className={styles.aside} aria-label="Bundle summary">
          <div className={styles.previewCard}>
            <div className={styles.media}>{renderMedia()}</div>

            <div className={styles.cardBody}>
              <div className={styles.creatorRow}>
                {teacherAvatar(styles.creatorAvatar)}
                <div className={styles.creatorText}>
                  <span className={styles.creatorLabel}>Created by</span>
                  <span className={styles.creatorNameRow}>
                    {profilePath ? (
                      <Link to={profilePath} className={`${styles.creatorName} ${styles.educatorLink}`}>
                        {bundle.teacher.displayName}
                      </Link>
                    ) : (
                      <span className={styles.creatorName}>{bundle.teacher.displayName}</span>
                    )}
                    <VerifiedBadge isVerified={!!bundle.teacher.isVerified} size="sm" />
                  </span>
                </div>
              </div>

              <ul className={styles.includeChips} aria-label="This bundle includes">
                {includeChips.map((chip) => (
                  <li key={chip.key} className={`${styles.includeChip} ${chip.tone}`}>
                    {chip.icon}
                    {chip.text}
                  </li>
                ))}
              </ul>

              <div className={styles.purchaseBlock} ref={pricingRef}>
                <div className={styles.priceRow}>
                  <span className={styles.finalPrice}>
                    {bundle.price === 0 ? 'Free' : formatInr(finalPrice)}
                  </span>
                  {hasDiscount && (
                    <span className={styles.originalPrice}>{formatInr(totalItemsValue)}</span>
                  )}
                  {savingsPercent > 0 && (
                    <span className={`${styles.offPill} ${styles.toneButter}`}>{savingsPercent}% off</span>
                  )}
                </div>
                {totalSavings > 0 && (
                  <div className={styles.savings}>
                    <Sparkles size={15} aria-hidden="true" />
                    <span>
                      You save <strong>{formatInr(totalSavings)}</strong> on this bundle
                    </span>
                  </div>
                )}

                {isTeacher ? (
                  <div className={styles.notice}>
                    <Info size={20} className={styles.noticeIcon} aria-hidden="true" />
                    <div>
                      <h3 className={styles.noticeTitle}>For Students Only</h3>
                      <p className={styles.noticeText}>
                        This bundle is designed for students. Teachers cannot purchase bundles.
                      </p>
                    </div>
                  </div>
                ) : bundle.isEnrolled ? (
                  <div className={styles.enrolledBanner} role="status">
                    <CheckCircle size={20} aria-hidden="true" />
                    <span>You're enrolled in this bundle</span>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    className={styles.ctaButton}
                    onClick={handlePurchase}
                    disabled={purchaseMutation.isPending}
                  >
                    {purchaseMutation.isPending ? (
                      <Loader size={20} className={styles.spinner} />
                    ) : (
                      <>
                        {bundle.price === 0 ? 'Enroll for Free' : 'Buy Now'}
                        <ArrowRight size={20} />
                      </>
                    )}
                  </Button>
                )}
              </div>

              {!isTeacher && !bundle.isEnrolled && bundle.price > 0 && (
                <PromoCodeInput
                  items={[{ id: bundle.id, type: 'bundle' as const, price: bundle.price }]}
                  totalAmount={bundle.price}
                  onApply={(id, amount) => {
                    setPromoCodeId(id);
                    setDiscountAmount(amount);
                    toast.success(`Promo code applied! You saved ₹${amount}.`);
                  }}
                  onRemove={() => {
                    setPromoCodeId(null);
                    setDiscountAmount(0);
                    toast.info('Promo code removed.');
                  }}
                />
              )}
            </div>
          </div>
        </aside>

        <div className={styles.main}>
          {!bundle.isEnrolled && bundle.price > 0 && (
            <PublicCouponsCard itemType="bundle" itemId={bundle.id} spaced={false} />
          )}

          {itemCount > 0 && (
            <section className={styles.section} aria-labelledby="bundle-included-heading">
              <div className={styles.sectionHeader}>
                <span className={`${styles.sectionIcon} ${styles.toneButter}`}>
                  <ListChecks size={18} aria-hidden="true" />
                </span>
                <h2 id="bundle-included-heading" className={styles.sectionTitle}>What's Included</h2>
                <span className={styles.sectionCount}>
                  {itemCount} {plural(itemCount, 'item', 'items')}
                </span>
              </div>
              <IncludedItems items={bundle.items} teacher={bundle.teacher} />
            </section>
          )}

          {/* One continuous block in the teacher's own order, beside the purchase card. */}
          {hasDescription && (
            <section className={styles.section} aria-labelledby="bundle-about-heading">
              <div className={styles.sectionHeader}>
                <span className={`${styles.sectionIcon} ${styles.toneSage}`}>
                  <ScrollText size={18} aria-hidden="true" />
                </span>
                <h2 id="bundle-about-heading" className={styles.sectionTitle}>About this Bundle</h2>
              </div>
              <div
                className={styles.description}
                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
              />
            </section>
          )}

          {bundle.disclaimer && (
            <div className={styles.disclaimerSection}>
              {bundle.disclaimer}
            </div>
          )}
        </div>
      </div>
      <MobileStickyPurchaseBar
        product={{
          type: 'bundle',
          id: bundle.id,
          price: bundle.price,
          originalPrice: bundle.originalPrice,
          isEnrolled: bundle.isEnrolled,
        }}
        isVisible={isStickyBarVisible}
      />
    </>
  );
};

const BundleDetailsSkeleton: React.FC = () => (
  <div className={styles.container}>
    <div className={styles.header}>
      <Skeleton style={{ height: '1.375rem', width: '84px', borderRadius: '9999px' }} />
      <Skeleton style={{ height: '2.25rem', width: '80%' }} />
      <Skeleton style={{ height: '1.25rem', width: '45%' }} />
    </div>

    <div className={styles.aside}>
      <div className={styles.previewCard}>
        <Skeleton className={styles.media} style={{ borderRadius: 0 }} />
        <div className={styles.cardBody}>
          <Skeleton style={{ height: '2.25rem', width: '60%' }} />
          <div className={styles.includeChips}>
            <Skeleton style={{ height: '1.75rem', width: '90px', borderRadius: '9999px' }} />
            <Skeleton style={{ height: '1.75rem', width: '110px', borderRadius: '9999px' }} />
          </div>
          <Skeleton style={{ height: '2.25rem', width: '55%' }} />
          <Skeleton style={{ height: '3rem', width: '100%', borderRadius: '9999px' }} />
        </div>
      </div>
    </div>

    <div className={styles.main}>
      <div className={styles.section}>
        <Skeleton style={{ height: '1.5rem', width: '180px', marginBottom: '1rem' }} />
        <div className={styles.itemsList}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.itemCard}>
              <Skeleton className={styles.itemThumb} />
              <div className={styles.itemBody}>
                <Skeleton style={{ height: '1rem', width: '80%', marginBottom: '0.5rem' }} />
                <Skeleton style={{ height: '0.75rem', width: '60%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
