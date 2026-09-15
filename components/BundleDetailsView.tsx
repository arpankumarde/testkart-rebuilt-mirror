import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import {
  BookCopy,
  BookOpen,
  User,
  Tag,
  CheckCircle,
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
} from 'lucide-react';
import { useBundleDetailsQuery } from '../helpers/useBundlesQuery';
import { usePurchaseBundleMutation } from '../helpers/useStudentBundles';
import { useAuth } from '../helpers/useAuth';
import { Skeleton } from './Skeleton';
import { Button } from './Button';
import { Badge } from './Badge';
import { PromoCodeInput } from './PromoCodeInput';
import { Placeholder } from '../helpers/placeholderImages';
import { wrapContentTables } from '../helpers/contentTables';
import DOMPurify from 'dompurify';
import { getBundleRedirectUrl } from '../endpoints/payment/payu/bundle-redirect_GET.schema';
import { MobileStickyPurchaseBar } from './MobileStickyPurchaseBar';
import styles from './BundleDetailsView.module.css';

interface BundleDetailsViewProps {
  slug: string;
  className?: string;
}

const levelDisplay: Record<string, { text: string; icon: React.ReactNode }> = {
  beginner: { text: 'Beginner', icon: <BarChart3 size={12} /> },
  intermediate: { text: 'Intermediate', icon: <BarChart3 size={12} /> },
  advanced: { text: 'Advanced', icon: <BarChart3 size={12} /> },
};

const stripHtml = (html: string | undefined | null) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

const renderMarkdown = (text: string) => {
  if (!text) return '';

  let html = text
    .replace(/^#\s+(.*)$/gm, '<h2>$1</h2>')
    .replace(/^##\s+(.*)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  html = html.replace(/(?:^[*-]\s+.*(?:\n|$))+/gm, (match) => {
    const items = match.trim().split('\n').map(line => `<li>${line.replace(/^[*-]\s+/, '')}</li>`).join('');
    return `<ul>${items}</ul>\n`;
  });

  const blocks = html.split(/\n\n+/);
  const wrapped = blocks.map(block => {
    if (block.trim().startsWith('<h') || block.trim().startsWith('<ul')) {
      return block.trim();
    }
    return `<p>${block.trim().replace(/\n/g, '<br>')}</p>`;
  });

  return wrapped.join('\n');
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

  if (isFetching) {
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

  const renderItemPrice = (price: number) => {
    if (price === 0) {
      return <span className={styles.itemPriceFree}>Free</span>;
    }
    return <span className={styles.itemPriceStrikethrough}>₹{new Intl.NumberFormat('en-IN').format(price)}</span>;
  };

  const courseCount = bundle.items.filter(item => item.type === 'course').length;
  const testCount = bundle.items.filter(item => item.type === 'test').length;
  const productCount = bundle.items.filter(item => item.type === 'digital_product').length;

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

    return <Package size={64} className={styles.bundleIcon} />;
  };

  return (
    <>
      <Helmet>
        <title>{`${bundle.title} | Testkart`}</title>
        <meta name="description" content={bundle.description || `Learn more about the ${bundle.title} course bundle.`} />
      </Helmet>
      <div className={`${styles.container} ${className || ''}`}>
        <h1 className={styles.title}>{bundle.title}</h1>
        
        <div className={styles.mediaContainer}>
          {renderMedia()}
        </div>

        <div className={styles.sectionCard}>
          <h2 className={styles.sectionHeading}>What's Included</h2>
          <div className={styles.itemsList}>
            {bundle.items.map((item) => {
              const description = stripHtml(item.description);
              if (item.type === 'course') {
                const levelInfo = levelDisplay[item.level] || { text: item.level, icon: <BarChart3 size={12} /> };
                return (
                  <Link to={`/course/${item.slug}`} key={`course-${item.id}`} className={styles.itemCard}>
                    <img
                      src={item.thumbnailUrl || Placeholder.COURSE}
                      alt={item.title}
                      className={styles.itemThumbnail}
                    />
                    <div className={styles.itemCardContent}>
                      <div className={styles.itemTypeTag}>
                        <GraduationCap size={12} />
                        <span>Course</span>
                      </div>
                      <h4 className={styles.itemTitle}>{item.title}</h4>
                      <p className={styles.itemDescription}>{description}</p>
                      <div className={styles.itemMeta}>
                        <span title="Level"><div className={styles.metaIcon}>{levelInfo.icon}</div> {levelInfo.text}</span>
                        {item.language && <span title="Language"><div className={styles.metaIcon}><Languages size={12} /></div> {item.language}</span>}
                      </div>
                    </div>
                    <div className={styles.itemPriceContainer}>
                      {renderItemPrice(item.price)}
                    </div>
                  </Link>
                );
              } else if (item.type === 'digital_product') {
                return (
                  <Link to={`/study-notes/${item.slug}`} key={`product-${item.id}`} className={styles.itemCard}>
                    <div className={styles.itemIconPlaceholder}>
                      <FileText size={24} />
                    </div>
                    <div className={styles.itemCardContent}>
                      <div className={styles.itemTypeTag}>
                        <BookOpen size={12} />
                        <span>Study Notes</span>
                      </div>
                      <h4 className={styles.itemTitle}>{item.title}</h4>
                      <p className={styles.itemDescription}>{description}</p>
                      <div className={styles.itemMeta}>
                        {item.pageCount && <span title="Pages"><div className={styles.metaIcon}><BookOpen size={12} /></div> {item.pageCount} pages</span>}
                        {item.language && <span title="Language"><div className={styles.metaIcon}><Languages size={12} /></div> {item.language}</span>}
                      </div>
                    </div>
                    <div className={styles.itemPriceContainer}>
                      {renderItemPrice(item.price)}
                    </div>
                  </Link>
                );
              } else {
                return (
                  <Link to={`/mock-test/${item.slug}`} key={`test-${item.id}`} className={styles.itemCard}>
                    <img
                      src={item.thumbnailUrl || Placeholder.TEST}
                      alt={item.title}
                      className={styles.itemThumbnail}
                    />
                    <div className={styles.itemCardContent}>
                      <div className={styles.itemTypeTag}>
                        <FileText size={12} />
                        <span>Test Series</span>
                      </div>
                      <h4 className={styles.itemTitle}>{item.title}</h4>
                      <p className={styles.itemDescription}>{description}</p>
                      <div className={styles.itemMeta}>
                        <span title="Duration"><div className={styles.metaIcon}><Clock size={12} /></div> {item.durationMinutes} mins</span>
                        <span title="Questions"><div className={styles.metaIcon}><HelpCircle size={12} /></div> {item.totalQuestions} questions</span>
                        {item.language && <span title="Language"><div className={styles.metaIcon}><Languages size={12} /></div> {item.language}</span>}
                      </div>
                    </div>
                    <div className={styles.itemPriceContainer}>
                      {renderItemPrice(item.price)}
                    </div>
                  </Link>
                );
              }
            })}
          </div>
          
        </div>

        <div className={styles.pricingCard} ref={pricingRef}>
          <div className={styles.bundleSummaryBadges}>
            {courseCount > 0 && (
              <Badge variant="secondary" className={styles.summaryBadge}>
                <GraduationCap size={14} className={styles.badgeIcon} /> {courseCount} {courseCount === 1 ? 'Course' : 'Courses'}
              </Badge>
            )}
            {testCount > 0 && (
              <Badge variant="secondary" className={styles.summaryBadge}>
                <FileText size={14} className={styles.badgeIcon} /> {testCount} {testCount === 1 ? 'Test Series' : 'Test Series'}
              </Badge>
            )}
            {productCount > 0 && (
              <Badge variant="secondary" className={styles.summaryBadge}>
                <BookOpen size={14} className={styles.badgeIcon} /> {productCount} {productCount === 1 ? 'Study Note' : 'Study Notes'}
              </Badge>
            )}
            <Badge variant="outline" className={styles.summaryBadge}>
              <BookCopy size={14} className={styles.badgeIcon} /> Lifetime access
            </Badge>
          </div>

          <div className={styles.priceBox}>
            <div className={styles.priceDisplay}>
              <span className={styles.finalPrice}>
                ₹{new Intl.NumberFormat('en-IN').format(finalPrice)}
              </span>
              {hasDiscount && (
                <span className={styles.originalPrice}>
                  ₹{new Intl.NumberFormat('en-IN').format(totalItemsValue)}
                </span>
              )}
            </div>
            {totalSavings > 0 && (
              <div className={styles.savings}>
                <Tag size={16} /> You save ₹{new Intl.NumberFormat('en-IN').format(totalSavings)}
              </div>
            )}
          </div>

          {isTeacher ? (
            <div className={styles.teacherInfo}>
              <div className={styles.teacherInfoIcon}>
                <Info size={24} />
              </div>
              <div className={styles.teacherInfoContent}>
                <h3 className={styles.teacherInfoTitle}>For Students Only</h3>
                <p className={styles.teacherInfoText}>
                  This bundle is designed for students. Teachers cannot purchase bundles.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.actionButtons}>
                {bundle.isEnrolled ? (
                  <Button size="lg" disabled>
                    <CheckCircle size={20} /> Enrolled
                  </Button>
                ) : (
                  <Button size="lg" onClick={handlePurchase} disabled={purchaseMutation.isPending}>
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

              {!bundle.isEnrolled && bundle.price > 0 && (
                <>
                  <div className={styles.divider}></div>
                  <PromoCodeInput
                    items={[{ id: bundle.id, type: 'bundle' as const, price: bundle.price }]}
                    totalAmount={bundle.price}
                    onApply={(id, amount, code, eligibleItemIds, ineligibleItemIds) => {
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
                </>
              )}
            </>
          )}
        </div>

        <div className={styles.teacherInfo}>
          <img
            src={bundle.teacher.profilePicture || `https://api.dicebear.com/8.x/initials/svg?seed=${bundle.teacher.displayName}`}
            alt={bundle.teacher.displayName}
            className={styles.teacherAvatar}
          />
          <span>Created by <strong>{bundle.teacher.displayName}</strong></span>
        </div>
        <div 
          className={styles.description} 
          dangerouslySetInnerHTML={{ __html: wrapContentTables(DOMPurify.sanitize(renderMarkdown(bundle.description || ''))) }} 
        />
        {bundle.disclaimer && (
          <div className={styles.disclaimerSection} style={{ whiteSpace: 'pre-wrap' }}>
            {bundle.disclaimer}
          </div>
        )}
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
    <Skeleton className={styles.title} style={{ height: '3.5rem', width: '70%' }} />
    <Skeleton className={styles.mediaContainer} style={{ height: 'auto', aspectRatio: '16/9' }} />
    
    <div className={styles.sectionCard}>
      <Skeleton style={{ height: '1.5rem', width: '150px', marginBottom: '1rem' }} />
      <div className={styles.itemsList}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.itemCard}>
            <Skeleton className={styles.itemThumbnail} />
            <div className={styles.itemCardContent}>
              <Skeleton style={{ height: '1rem', width: '80%', marginBottom: '0.5rem' }} />
              <Skeleton style={{ height: '0.75rem', width: '100%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
    
    <div className={styles.pricingCard}>
      <div className={styles.bundleSummaryBadges}>
         <Skeleton style={{ height: '1.5rem', width: '80px', borderRadius: '9999px' }} />
         <Skeleton style={{ height: '1.5rem', width: '100px', borderRadius: '9999px' }} />
      </div>
      <Skeleton style={{ height: '3rem', width: '50%' }} />
      <Skeleton style={{ height: '3rem', width: '100%' }} />
    </div>

    <div className={styles.teacherInfo}>
      <Skeleton style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
      <Skeleton style={{ height: '1.25rem', width: '200px' }} />
    </div>
    <Skeleton style={{ height: '1rem', width: '100%' }} />
    <Skeleton style={{ height: '1rem', width: '90%' }} />
    <Skeleton style={{ height: '1rem', width: '95%' }} />
  </div>
);