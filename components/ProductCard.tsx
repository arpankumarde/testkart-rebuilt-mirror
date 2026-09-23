import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import type { ShopProductListItem } from '../endpoints/shop/list_GET.schema';
import { Avatar, AvatarImage, AvatarFallback } from './Avatar';
import { VerifiedBadge } from './VerifiedBadge';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: ShopProductListItem;
  className?: string;
}

const formatCount = (count: number, singular: string, plural: string) =>
  `${count.toLocaleString('en-IN')} ${count === 1 ? singular : plural}`;

export const ProductCard: React.FC<ProductCardProps> = ({ product, className }) => {
  const navigate = useNavigate();
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
  const hasExam = !!product.examName && product.examName !== 'Unspecified';

  // The whole card is already a link, so the teacher name is a link-role span
  // that navigates itself - an <a> inside an <a> is invalid HTML.
  const openTeacher = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/expert/${product.teacherSlug}`);
  };

  return (
    <Link to={detailsUrl} className={`${styles.cardLink} ${className || ''}`}>
      <div className={styles.card}>
        <h3 className={styles.title}>{product.title}</h3>

        <div className={styles.metaRow}>
          <span
            role="link"
            tabIndex={0}
            className={styles.teacher}
            onClick={openTeacher}
            onKeyDown={(e) => {
              if (e.key === 'Enter') openTeacher(e);
            }}
          >
            <Avatar className={styles.avatar}>
              {product.teacherAvatar && <AvatarImage src={product.teacherAvatar} alt="" />}
              <AvatarFallback className={styles.avatarFallback}>
                {Array.from(product.teacherName.trim())[0] ?? ''}
              </AvatarFallback>
            </Avatar>
            <span className={styles.nameGroup}>
              <span className={styles.teacherName}>{product.teacherName}</span>
              <VerifiedBadge isVerified={product.teacherIsVerified} size="sm" />
            </span>
          </span>

          {hasRating && (
            <span className={styles.rating}>
              <Star size={14} fill="currentColor" className={styles.starIcon} />
              {Number(product.rating).toFixed(1)}
            </span>
          )}
        </div>

        {hasExam && (
          <p className={styles.exam} title={product.examName ?? undefined}>
            {product.examName}
          </p>
        )}

        <div className={styles.footer}>
          <p className={styles.stats}>
            <span>{formatCount(product.views ?? 0, 'view', 'views')}</span>
            {product.pageCount ? (
              <span>{formatCount(product.pageCount, 'page', 'pages')}</span>
            ) : null}
            {product.fileCount > 1 && (
              <span>{formatCount(product.fileCount, 'file', 'files')}</span>
            )}
          </p>
          <span className={`${styles.price} ${isFree ? styles.freePrice : ''}`}>
            {formattedPrice}
          </span>
        </div>
      </div>
    </Link>
  );
};
