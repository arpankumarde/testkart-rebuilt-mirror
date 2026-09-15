import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Star, IndianRupee, User, Eye, FileText, Files } from 'lucide-react';
import type { ShopProductListItem } from '../endpoints/shop/list_GET.schema';
import { Badge } from './Badge';
import { VerifiedBadge } from './VerifiedBadge';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: ShopProductListItem;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, className }) => {
  const detailsUrl = `/study-notes/${product.slug}`;
  const isFree = product.price === 0;
  
  const formattedPrice = isFree
    ? 'Free'
    : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
      }).format(product.price);

  const hasRating = product.rating !== null && product.rating !== undefined;
  const ratingValue = hasRating ? Number(product.rating).toFixed(1) : null;

  return (
    <Link to={detailsUrl} className={`${styles.cardLink} ${className || ''}`}>
      <div className={styles.card}>
        <div className={styles.cardContent}>
          <div className={styles.topRow}>
            <FileText size={16} className={styles.productIcon} />
            {product.category && (
              <Badge variant="default" className={styles.badge}>{product.category}</Badge>
            )}
            {product.examName && (
              <Badge variant="secondary" className={styles.badge}>{product.examName}</Badge>
            )}
          </div>
          <h3 className={styles.title}>{product.title}</h3>
          
          <div className={styles.metaRow}>
            <Link 
              to={`/expert/${product.teacherSlug}`} 
              className={styles.teacherInfo}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.avatarPlaceholder}>
                <User size={12} />
              </div>
              <span className={styles.teacherName}>{product.teacherName}</span>
              <VerifiedBadge isVerified={product.teacherIsVerified} size="sm" />
            </Link>
            
            {hasRating && (
              <div className={styles.rating}>
                <Star size={14} fill="currentColor" className={styles.starIcon} />
                <span>{ratingValue}</span>
              </div>
            )}
          </div>

          <div className={styles.cardFooter}>
            <div className={styles.statsGroup}>
                            {/* Purchases count - hidden for now */}
              {false && <div className={styles.purchases}>
                <ShoppingBag size={14} />
                <span>{product.totalPurchases} sold</span>
              </div>}
              <div className={styles.purchases}>
                <Eye size={14} />
                <span>{product.views ?? 0} views</span>
              </div>
              {product.pageCount ? (
                <div className={styles.purchases}>
                  <FileText size={14} />
                  <span>{product.pageCount} pages</span>
                </div>
              ) : null}
              {product.fileCount > 1 && (
                <div className={styles.purchases}>
                  <Files size={14} />
                  <span>{product.fileCount} files</span>
                </div>
              )}
            </div>
            
            <div className={`${styles.price} ${isFree ? styles.freePrice : ''}`}>
              {!isFree && <IndianRupee size={16} />}
              <span>{isFree ? 'Free' : formattedPrice.replace('₹', '')}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};