import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, Eye, HardDrive, Files as FilesIcon } from 'lucide-react';
import { Badge } from './Badge';
import { Button } from './Button';
import type { StudyNoteFileSummary } from '../endpoints/shop/details_GET.schema';
import styles from './StudyNotesFileList.module.css';

interface StudyNotesFileListProps {
  className?: string;
  files: StudyNoteFileSummary[];
  onPreview: (file: StudyNoteFileSummary) => void;
}

const pagesLabel = (count: number) => `${count} ${count === 1 ? 'page' : 'pages'}`;

// Public study notes equivalent of TestItemsList - same expandable-card
// pattern (icon + title header, metadata row, chevron) so a multi-file
// study notes product reads the same way a multi-test mock test package
// does. Each file shows a preview only when the teacher turned one on for it.
export const StudyNotesFileList: React.FC<StudyNotesFileListProps> = ({ className, files, onPreview }) => {
  const [expandedId, setExpandedId] = useState<number | null>(files.length === 1 ? files[0].id : null);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return null;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {files.map((file, index) => {
        const isExpanded = expandedId === file.id;
        const sizeLabel = formatSize(file.fileSizeBytes);
        const previewPages = file.previewPages ?? 0;
        const canPreview = previewPages > 0;

        return (
          <div key={file.id} className={styles.item}>
            <div
              className={styles.itemHeader}
              onClick={() => toggleExpand(file.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleExpand(file.id);
                }
              }}
            >
              <div className={styles.itemHeaderTop}>
                <FileText size={20} className={styles.icon} />
                <h3 className={styles.itemTitle}>{file.title || `File ${index + 1}`}</h3>
                {canPreview && (
                  <Badge variant="success" className={styles.freeBadge}>
                    Free preview
                  </Badge>
                )}
              </div>

              <div className={styles.itemHeaderBottom}>
                <div className={styles.metadata}>
                  <div className={styles.metadataItem}>
                    <FilesIcon size={16} />
                    <span>{file.pageCount ? pagesLabel(file.pageCount) : 'Page count unavailable'}</span>
                  </div>
                  {canPreview && (
                    <div className={styles.metadataItem}>
                      <Eye size={16} />
                      <span>{pagesLabel(previewPages)} free</span>
                    </div>
                  )}
                  {sizeLabel && (
                    <div className={styles.metadataItem}>
                      <HardDrive size={16} />
                      <span>{sizeLabel}</span>
                    </div>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp size={20} className={styles.chevron} />
                ) : (
                  <ChevronDown size={20} className={styles.chevron} />
                )}
              </div>
            </div>

            {isExpanded && (
              <div className={styles.itemContent}>
                <div className={styles.actions}>
                  {canPreview ? (
                    <Button size="lg" onClick={() => onPreview(file)}>
                      <Eye size={16} /> Preview {pagesLabel(previewPages)}
                    </Button>
                  ) : (
                    <p className={styles.noPreviewNote}>
                      No free preview for this file. Purchase this product to access the full file.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
