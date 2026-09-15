import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './Dialog';
import { Badge } from './Badge';
import { FileText, Globe, GraduationCap, BookOpen } from 'lucide-react';
import { wrapContentTables } from '../helpers/contentTables';
import { sanitizeHtml } from '../helpers/sanitizeHtml';
import styles from './ProductPreviewDialog.module.css';

interface ProductPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  shortDescription?: string | null;
  description: string;
  price: number;
  category?: string | null;
  language?: string | null;
  examName?: string | null;
  pageCount?: number | null;
  fileCount: number;
}

// A lightweight, honest approximation of how this listing will look to a
// student — not a pixel-perfect clone of the live study-notes page (that
// needs a published, saved record with real stats/reviews). This just lets
// a teacher sanity-check title/price/description formatting before hitting
// Publish, without requiring a real save first.
export const ProductPreviewDialog: React.FC<ProductPreviewDialogProps> = ({
  open,
  onOpenChange,
  title,
  shortDescription,
  description,
  price,
  category,
  language,
  examName,
  pageCount,
  fileCount,
}) => {
  const hasTitle = title && title.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>Preview as Student</DialogTitle>
          <DialogDescription>
            A rough approximation of how this listing will appear once published. Live stats (rating, purchases) aren't shown here.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.previewBody}>
          <div className={styles.card}>
            <div className={styles.cardIcon}>
              <FileText size={28} />
            </div>
            <div className={styles.cardContent}>
              {category && <Badge variant="secondary" className={styles.cardBadge}>{category}</Badge>}
              <h3 className={styles.cardTitle}>{hasTitle ? title : 'Untitled product'}</h3>
              {shortDescription && <p className={styles.cardSubtitle}>{shortDescription}</p>}
              <div className={styles.cardMeta}>
                {examName && (
                  <span><GraduationCap size={14} /> {examName}</span>
                )}
                {language && (
                  <span><Globe size={14} /> {language}</span>
                )}
                <span><BookOpen size={14} /> {pageCount ? `${pageCount} pages` : `${fileCount} file${fileCount === 1 ? '' : 's'}`}</span>
              </div>
              <div className={styles.cardPrice}>
                {price === 0 ? (
                  <span className={styles.freeTag}>Free</span>
                ) : (
                  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price)
                )}
              </div>
            </div>
          </div>

          <div className={styles.detailSection}>
            <h4>Full description</h4>
            {description && description.trim().length > 0 ? (
              <div className={styles.descriptionHtml} dangerouslySetInnerHTML={{ __html: wrapContentTables(sanitizeHtml(description)) }} />
            ) : (
              <p className={styles.emptyHint}>No description added yet.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
