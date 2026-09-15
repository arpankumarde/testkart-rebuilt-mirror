import React, { useState, useMemo, useRef, useEffect } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet";
import { 
  ShoppingCart, 
  Star, 
  FileText, 
  Globe, 
  User, 
  BookOpen, 
  HardDrive, 
  Share2, 
  CheckCircle,
  AlertCircle,
  Eye,
  ChevronRight,
  Files,
  Info
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useShopProductDetails, useRelatedProductsQuery, SHOP_PRODUCT_DETAILS_QUERY_KEY } from "../helpers/useShopQuery";
import type { StudyNoteFileSummary } from "../endpoints/shop/details_GET.schema";
import { StudyNotesFileList } from "../components/StudyNotesFileList";
import { useCartItemsQuery, useAddToCartMutation, CART_QUERY_KEY } from "../helpers/useCartQuery";
import { postShopEnrollFree } from "../endpoints/shop/enroll-free_POST.schema";
import { useAuth } from "../helpers/useAuth";
import { Placeholder } from "../helpers/placeholderImages";
import { wrapContentTables } from "../helpers/contentTables";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
 import { ProductCard } from "../components/ProductCard";
import { BundleSuggestions } from "../components/BundleSuggestions";
import { TeacherCtaBanner } from "../components/TeacherCtaBanner";
 import { SEOHead } from "../components/SEOHead";
import { Avatar, AvatarImage, AvatarFallback } from "../components/Avatar";
import { ReviewDialog } from "../components/ReviewDialog";
import { VerifiedBadge } from "../components/VerifiedBadge";

const ProductPDFPreview = React.lazy(() => import("../components/ProductPDFPreview").then(m => ({ default: m.ProductPDFPreview })));
import { MobileStickyPurchaseBar } from "../components/MobileStickyPurchaseBar";
import { toast } from "sonner";
import { ShareAssetDialog } from "../components/ShareAssetDialog";
import { PUBLIC_PAGE_SHARE_CAMPAIGN } from "../helpers/shareLinks";
import styles from "./study-notes.$noteSlug.module.css";

const ProductDetailsPage: React.FC = () => {
  // 1. useState hooks
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  // Which file within the product is currently being previewed — null means
  // "the product's main file" (the sidebar Preview button's behavior).
  // Clicking Preview on a specific row in the Files list sets this so the
  // dialog fetches and shows that file instead.
  const [previewFile, setPreviewFile] = useState<StudyNoteFileSummary | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isStickyBarVisible, setIsStickyBarVisible] = useState(false);
  const [isShareOpen, setShareOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // 2. Navigation and Auth hooks
  const { noteSlug } = useParams<{ noteSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { authState } = useAuth();
  const isTeacher = authState.type === 'authenticated' && authState.user.role === 'teacher';
  
  // 3. Query hooks
  const { data, isLoading, isError } = useShopProductDetails(noteSlug || null);
  const { data: cartData } = useCartItemsQuery();
  const addToCartMutation = useAddToCartMutation();
  const queryClient = useQueryClient();

  const enrollFreeMutation = useMutation({
    mutationFn: postShopEnrollFree,
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      if (noteSlug) {
        queryClient.invalidateQueries({ queryKey: SHOP_PRODUCT_DETAILS_QUERY_KEY(noteSlug) });
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to enroll in free product");
    },
  });

  const product = data?.product;
  const reviews = data?.reviews || [];

  // Intersection observer for mobile sticky bar
  useEffect(() => {
    if (!sidebarRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsStickyBarVisible(!entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0,
        rootMargin: '0px',
      }
    );

    observer.observe(sidebarRef.current);

    return () => {
      observer.disconnect();
    };
  }, [data]);

  // Fetch related products based on category if product data is available
  const { data: relatedData } = useRelatedProductsQuery(product?.id ?? null, 4);

  // 4. useMemo hooks
  
  // Check if current user has purchased this product
  const hasPurchased = data?.product?.isPurchased ?? false;

  // Check if current user has already reviewed
  const hasReviewed = useMemo(() => {
    if (authState.type !== "authenticated" || !reviews.length) return false;
    return reviews.some(r => r.userId === authState.user.id);
  }, [authState, reviews]);

  // Calculate rating breakdown
  const ratingCounts = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) {
        counts[Math.floor(r.rating) as keyof typeof counts]++;
      }
    });
    return counts;
  }, [reviews]);

  // Generate JSON-LD structured data
  const productJsonLd = useMemo(() => {
    if (!product) return null;
    
    const escapeHtml = (text: string) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return text.replace(/[&<>"']/g, (m) => map[m] || m);
    };

    const productData = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": escapeHtml(product.title),
      "description": escapeHtml(product.shortDescription || product.description?.replace(/<[^>]*>/g, '').slice(0, 200) || ""),
      "brand": {
        "@type": "Brand",
        "name": escapeHtml(product.teacherName),
      },
      "offers": {
        "@type": "Offer",
        "price": product.price,
        "priceCurrency": "INR",
        "availability": "https://schema.org/InStock",
      },
    };

    if (product.rating !== null && product.reviewsCount > 0) {
      (productData as any).aggregateRating = {
        "@type": "AggregateRating",
        "ratingValue": Number(product.rating).toFixed(1),
        "reviewCount": product.reviewsCount,
      };
    }

    return productData;
  }, [product]);

  const breadcrumbJsonLd = useMemo(() => {
    if (!product) return null;
    
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Study Notes",
          "item": `${window.location.origin}/study-notes`,
        },
        ...(product.category ? [{
          "@type": "ListItem",
          "position": 2,
          "name": product.category,
          "item": `${window.location.origin}/study-notes?category=${encodeURIComponent(product.category)}`,
        }] : []),
        {
          "@type": "ListItem",
          "position": product.category ? 3 : 2,
          "name": product.title,
          "item": window.location.href,
        },
      ],
    };
  }, [product]);

  // 5. Derived values and handlers
  
  // Filter out current product from related items
  const relatedProducts = relatedData?.products || [];

  // Determine if user can write a review
  const canReview = authState.type === "authenticated" && hasPurchased && !hasReviewed;

  const isInCart = cartData?.items.some(item => 
    item.type === 'digitalProduct' && item.digitalProductId === product?.id
  );

  const handleAddToCart = () => {
    if (authState.type !== "authenticated") {
      navigate(`/login?redirectTo=${encodeURIComponent(location.pathname)}`);
      return;
    }

    if (product) {
      if (product.price === 0) {
        enrollFreeMutation.mutate({ digitalProductId: product.id });
      } else {
        addToCartMutation.mutate({ digitalProductId: product.id });
      }
    }
  };

  const handlePreviewMain = () => {
    setPreviewFile(null);
    setIsPreviewOpen(true);
  };

  const handlePreviewFile = (file: StudyNoteFileSummary) => {
    setPreviewFile(file);
    setIsPreviewOpen(true);
  };

  const handleScrollToReviews = () => {
    document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleScrollToAuthor = () => {
    document.getElementById('author')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 6. Early returns for Loading state
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.layoutGrid}>
          <div className={styles.titleSection}>
            <Skeleton style={{ width: "60%", height: "40px", borderRadius: "var(--radius)" }} />
            <Skeleton style={{ width: "80%", height: "24px", borderRadius: "var(--radius)", marginTop: "var(--spacing-3)" }} />
          </div>
          <div className={styles.mainContent}>
            <Skeleton style={{ width: "100%", height: "400px", borderRadius: "var(--radius-lg)" }} />
          </div>
          <div className={styles.sidebarColumn}>
            <Skeleton style={{ width: "100%", height: "300px", borderRadius: "var(--radius-lg)" }} />
          </div>
        </div>
      </div>
    );
  }

  // 7. Early returns for Error/Not Found state
  if (isError || !product) {
    return (
      <div className={styles.errorContainer}>
        <AlertCircle size={48} className={styles.errorIcon} />
        <h1>Product Not Found</h1>
        <p>The product you are looking for does not exist or has been removed.</p>
        <Button asChild variant="outline" style={{ marginTop: "1rem" }}>
          <Link to="/study-notes">Back to Shop</Link>
        </Button>
      </div>
    );
  }

  // 8. Variables that depend on product being defined (after early returns)
  const isFree = product.price === 0;
  const formattedPrice = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(product.price);

  // Falls back to a content-derived description instead of an empty
  // <meta name="description"> when the teacher never wrote a short/long
  // description for this product.
  const metaDescription =
    product.shortDescription ||
    (product.description ? product.description.slice(0, 160) : "") ||
    `${product.title} by ${product.teacherName || "a Testkart educator"}${product.examName ? ` for ${product.examName}` : ""} - ${isFree ? "Free" : formattedPrice} study material on Testkart`;

  return (
    <>
      <SEOHead
        title={product.title}
        description={metaDescription}
        image={product.thumbnailUrl || "https://assets.floot.app/0a7f01ed-7b95-4c38-9275-16e713383937/54922abf-b666-4d9f-9732-aec0c03c9254.png"}
        noIndex={!product.seo.indexable}
      />
      
      {/* JSON-LD Structured Data */}
      {productJsonLd && (
        <Helmet>
          <script type="application/ld+json">
            {JSON.stringify(productJsonLd)}
          </script>
        </Helmet>
      )}
      {breadcrumbJsonLd && (
        <Helmet>
          <script type="application/ld+json">
            {JSON.stringify(breadcrumbJsonLd)}
          </script>
        </Helmet>
      )}

      <div className={styles.container}>
        <nav className={styles.breadcrumb}>
          <Link to="/study-notes">Study Notes</Link>
          <ChevronRight size={14} />
          <span>{product.title}</span>
        </nav>

        <div className={styles.layoutGrid}>
          <div className={styles.titleSection}>
            <div className={styles.badgesRow}>
              {product.category && (
                <Badge variant="secondary" className={styles.categoryBadge}>{product.category}</Badge>
              )}
              {product.examName && (
                <Badge variant="default" className={styles.categoryBadge}>{product.examName}</Badge>
              )}
            </div>
            <h1 className={styles.title}>{product.title}</h1>
            {product.shortDescription && (
              <p className={styles.shortDesc}>{product.shortDescription}</p>
            )}

            <div className={styles.heroMeta}>
              {product.rating != null && (
                <div className={styles.heroRating}>
                  <span className={styles.heroRatingNumber}>{Number(product.rating).toFixed(1)}</span>
                  <div className={styles.heroStars}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={16}
                        fill={i < Math.round(Number(product.rating)) ? "currentColor" : "none"}
                        className={i < Math.round(Number(product.rating)) ? styles.starIcon : styles.starEmpty}
                      />
                    ))}
                  </div>
                  <button type="button" onClick={handleScrollToReviews} className={styles.heroScrollLink}>
                    ({product.reviewsCount.toLocaleString()} reviews)
                  </button>
                </div>
              )}
              <div className={styles.heroMetaItem}>
                <FileText size={16} />
                <span>{product.pageCount ? `${product.pageCount} pages` : 'Page count unavailable'}</span>
              </div>
              {product.fileCount > 1 && (
                <div className={styles.heroMetaItem}>
                  <Files size={16} />
                  <span>{product.fileCount} files</span>
                </div>
              )}
              <div className={styles.heroMetaItem}>
                <span>By</span>
                <button type="button" onClick={handleScrollToAuthor} className={styles.heroScrollLink}>
                  {product.teacherName}
                </button>
              </div>
            </div>
          </div>

          <div className={styles.mainContent}>
            <div className={styles.contentSections}>
              {product.files && product.files.length > 0 && (
                <div className={styles.section}>
                  <h2>{product.files.length > 1 ? `Files (${product.files.length})` : 'File'}</h2>
                  <StudyNotesFileList
                    files={product.files}
                    previewPages={product.previewPages}
                    onPreview={handlePreviewFile}
                  />
                </div>
              )}

              <div className={styles.section}>
                <h2>Description</h2>
                <div className={styles.description} dangerouslySetInnerHTML={{ __html: wrapContentTables(product.description || "") }} />
              </div>

          {product.tags && product.tags.length > 0 && (
            <div className={styles.section}>
              <h2>Tags</h2>
              <div className={styles.tags}>
                {product.tags.map(tag => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Reviews Section */}
          <div id="reviews" className={styles.section}>
            <div className={styles.reviewsHeader}>
              <h2>Student Reviews</h2>
            </div>
            
            <div className={styles.reviewsContainer}>
               <div className={styles.ratingSummary}>
                  <div className={styles.averageRating}>
                     <span className={styles.bigRating}>{product.rating ? Number(product.rating).toFixed(1) : "0"}</span>
                     <div className={styles.averageStars}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star 
                            key={i} 
                            size={20} 
                            fill={product.rating && i < Math.round(Number(product.rating)) ? "currentColor" : "none"} 
                            className={product.rating && i < Math.round(Number(product.rating)) ? styles.starIcon : styles.starEmpty} 
                          />
                        ))}
                     </div>
                     <span className={styles.totalReviews}>{product.reviewsCount} reviews</span>
                     {canReview && (
                        <Button
                          size="sm"
                          onClick={() => setIsReviewDialogOpen(true)}
                          className={styles.writeReviewButton}
                        >
                          Write a Review
                        </Button>
                      )}
                  </div>
                  <div className={styles.ratingBars}>
                     {[5, 4, 3, 2, 1].map(stars => {
                        const count = ratingCounts[stars as keyof typeof ratingCounts];
                        const percentage = reviews.length ? (count / reviews.length) * 100 : 0;
                        return (
                          <div key={stars} className={styles.ratingBarRow}>
                             <span className={styles.starLabel}>{stars} <Star size={12} fill="currentColor" className={styles.starIcon} /></span>
                             <div className={styles.barContainer}>
                                <div className={styles.barFill} style={{ width: `${percentage}%` }}></div>
                             </div>
                             <span className={styles.barCount}>{count}</span>
                          </div>
                        );
                     })}
                  </div>
               </div>

              {reviews.length > 0 ? (
                <div className={styles.reviewsList}>
                  {reviews.map(review => (
                    <div key={review.id} className={styles.reviewCard}>
                      <div className={styles.reviewHeader}>
                        <Avatar className={styles.reviewerAvatar}>
                          <AvatarFallback>{review.reviewerName.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className={styles.reviewerInfo}>
                          <span className={styles.reviewerName}>{review.reviewerName}</span>
                          <span className={styles.reviewDate}>
                            {review.createdAt && new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className={styles.reviewRating}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star 
                              key={i} 
                              size={14} 
                              fill={i < review.rating ? "currentColor" : "none"} 
                              className={i < review.rating ? styles.starIcon : styles.starEmpty} 
                            />
                          ))}
                        </div>
                      </div>
                      {review.reviewText && <p className={styles.reviewText}>{review.reviewText}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.noReviews}>No reviews yet.</p>
              )}
            </div>
          </div>

          {/* Author Section */}
          <div id="author" className={styles.section}>
            <h2>About the Author</h2>
            <div className={styles.authorCard}>
              <Avatar className={styles.authorAvatar}>
                {product.teacherAvatar && (
                  <AvatarImage
                    src={product.teacherAvatar || undefined}
                  />
                )}
                <AvatarFallback>
                  <User size={24} />
                </AvatarFallback>
              </Avatar>
              <div className={styles.authorInfo}>
                <Link
                  to={`/expert/${product.teacherSlug}`}
                  className={styles.authorName}
                >
                  {product.teacherName}
                </Link>
                {product.teacherBio && (
                  <p className={styles.authorBio}>{product.teacherBio}</p>
                )}
              </div>
              <Button asChild variant="outline" size="sm" className={styles.authorProfileButton}>
                <Link to={`/expert/${product.teacherSlug}`}>
                  View Profile
                </Link>
              </Button>
            </div>
          </div>

          {/* Related Study Notes - the data for this was already being
              fetched (useRelatedProductsQuery below) but never rendered,
              so this page had no internal cross-links to related content. */}
          {relatedProducts.length > 0 && (
            <div className={styles.section}>
              <h2>Related Study Notes</h2>
              <div className={styles.relatedGrid}>
                {relatedProducts.map((relatedProduct) => (
                  <ProductCard key={relatedProduct.id} product={relatedProduct} />
                ))}
              </div>
            </div>
          )}

              {product.disclaimer && (
                <div className={styles.disclaimerSection} style={{ whiteSpace: 'pre-wrap' }}>
                  {product.disclaimer}
                </div>
              )}
            </div>
          </div>

          <div ref={sidebarRef} className={styles.sidebarColumn}>
            <div className={styles.sidebarCard}>
              <Link to={`/expert/${product.teacherSlug}`} className={styles.teacherBlock}>
                <Avatar className={styles.teacherBlockAvatar}>
                  {product.teacherAvatar && <AvatarImage src={product.teacherAvatar || undefined} />}
                  <AvatarFallback><User size={20} /></AvatarFallback>
                </Avatar>
                <div className={styles.teacherBlockInfo}>
                  <span className={styles.teacherBlockName}>
                    {product.teacherName}
                    <VerifiedBadge isVerified={!!(product as any).teacherIsVerified} size="sm" className={styles.verifiedBadge} />
                  </span>
                </div>
              </Link>

              <div className={styles.statsRow}>
                <div className={styles.rating}>
                  <Star size={16} fill="currentColor" className={styles.starIcon} />
                  <span>{product.rating ? Number(product.rating).toFixed(1) : "New"}</span>
                  <span className={styles.reviewCount}>({product.reviewsCount})</span>
                </div>

                <div className={styles.metaDivider}>•</div>

                <div className={styles.purchaseCount}>
                   <ShoppingCart size={16} />
                   <span>{product.totalPurchases} purchases</span>
                </div>
              </div>

              <div className={styles.priceSection}>
                <span className={`${styles.price} ${isFree ? styles.freePrice : ''}`}>
                  {isFree ? 'Free' : formattedPrice}
                </span>
              </div>

              <div className={styles.actions}>
                {isTeacher ? (
                  <div className={styles.teacherInfo}>
                    <div className={styles.teacherInfoIcon}>
                      <Info size={24} />
                    </div>
                    <div className={styles.teacherInfoContent}>
                      <h3 className={styles.teacherInfoTitle}>For Students Only</h3>
                      <p className={styles.teacherInfoText}>
                        Study notes are designed for students. Teachers cannot purchase study notes.
                      </p>
                    </div>
                  </div>
                ) : hasPurchased ? (
                  <Button asChild className={styles.actionButton} variant="secondary">
                    <Link to="/student/shop">
                      <CheckCircle size={18} /> Go to Dashboard
                    </Link>
                  </Button>
                ) : isFree ? (
                  <Button 
                    className={styles.actionButton} 
                    onClick={handleAddToCart}
                    disabled={enrollFreeMutation.isPending}
                  >
                    {enrollFreeMutation.isPending ? (
                      "Processing..."
                    ) : (
                      <>
                        <BookOpen size={18} /> Get for Free
                      </>
                    )}
                  </Button>
                ) : isInCart ? (
                  <Button asChild className={styles.actionButton} variant="secondary">
                    <Link to="/cart">
                      <CheckCircle size={18} /> Go to Cart
                    </Link>
                  </Button>
                ) : (
                  <Button 
                    className={styles.actionButton} 
                    onClick={handleAddToCart}
                    disabled={addToCartMutation.isPending}
                  >
                    {addToCartMutation.isPending ? (
                      "Adding..."
                    ) : (
                      <>
                        <ShoppingCart size={18} /> Add to Cart
                      </>
                    )}
                  </Button>
                )}

                {product.previewPages != null && product.previewPages > 0 && (
                  <Button 
                    variant="outline" 
                    className={styles.previewButton} 
                    onClick={handlePreviewMain}
                  >
                    <Eye size={18} /> Preview
                  </Button>
                )}
                
                <Button variant="outline" className={styles.shareButton} onClick={() => setShareOpen(true)}>
                  <Share2 size={18} /> Share
                </Button>
              </div>

              <div className={styles.features}>
                {product.fileCount != null && product.fileCount > 1 && (
                  <div className={styles.featurePill}>
                    <Files size={16} />
                    <span>{product.fileCount} Files</span>
                  </div>
                )}
                <div className={styles.featurePill}>
                  <FileText size={16} />
                  <span>{product.pageCount || "?"} Pages</span>
                </div>
                {product.fileSizeBytes && (
                  <div className={styles.featurePill}>
                    <HardDrive size={16} />
                    <span>{(product.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB PDF</span>
                  </div>
                )}
                {product.language && (
                  <div className={styles.featurePill}>
                    <Globe size={16} />
                    <span>{product.language}</span>
                  </div>
                )}
              </div>

              {product.previewPages != null && product.previewPages > 0 && (
                <div className={styles.previewNote}>
                  <CheckCircle size={14} />
                  <span>Includes {product.previewPages} preview pages</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className={styles.relatedSection}>
            <h2>Related Products</h2>
            <div className={styles.relatedGrid}>
              {relatedProducts.map(p => (
                <ProductCard key={p.id} product={p} />
         ))} 
        </div>
       </div>
     )}

        <BundleSuggestions teacherId={product.teacherId} title="Save with Bundles" />

        <TeacherCtaBanner className={styles.teacherCta} />

        {product && (
          <>
            <React.Suspense fallback={null}>
              <ProductPDFPreview 
                product={product} 
                isOpen={isPreviewOpen} 
                onClose={() => { setIsPreviewOpen(false); setPreviewFile(null); }}
                fileId={previewFile && previewFile.id > 0 ? previewFile.id : undefined}
                previewTitle={previewFile?.title}
              />
            </React.Suspense>
            
            {canReview && (
              <ReviewDialog
                isOpen={isReviewDialogOpen}
                onClose={() => setIsReviewDialogOpen(false)}
                digitalProductId={product.id}
                productSlug={product.slug}
                testPackageTitle={product.title}
              />
            )}
          </>
        )}

        {product && (
          <MobileStickyPurchaseBar
            product={{
              type: 'digitalProduct',
              id: product.id,
              price: product.price,
              isEnrolled: hasPurchased,
            }}
            isVisible={isStickyBarVisible}
          />
        )}

        <ShareAssetDialog
          open={isShareOpen}
          onOpenChange={setShareOpen}
          kind="study-note"
          handle={product.slug}
          title={product.title}
          campaign={PUBLIC_PAGE_SHARE_CAMPAIGN}
        />
      </div>
    </>
  );
};

export default ProductDetailsPage;