import React, { useState } from 'react';
import { Award, Download, FileText, Loader, Star } from 'lucide-react';
import { useDownloadCertificate, useGenerateCertificate } from '../helpers/useCertificateQueries';
import type { CertificateListItem } from '../endpoints/student/certificates/list_GET.schema';
import { Button } from './Button';
import { Badge } from './Badge';
import { toast } from 'sonner';
import { ShareButton } from './ShareButton';
import { CERTIFICATE_SHARE_CAMPAIGN } from '../helpers/shareLinks';
import styles from './CertificateCard.module.css';

interface CertificateCardProps {
  certificate: CertificateListItem;
  className?: string;
}

export const CertificateCard: React.FC<CertificateCardProps> = ({ certificate, className }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadMutation = useDownloadCertificate();

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await downloadMutation.mutateAsync({ certificateId: certificate.id });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Testkart_Certificate_${certificate.certificateNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Certificate downloaded successfully!');
    } catch (error) {
      console.error('Download failed', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast.error(`Download failed: ${errorMessage}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(certificate.completionDate));

  const isCourse = certificate.certificateType === 'course_completion';

  return (
    <div className={`${styles.card} ${className || ''}`}>
      <div className={styles.cardHeader}>
        <div className={styles.iconWrapper}>
          <Award size={24} />
        </div>
        <Badge variant={isCourse ? 'secondary' : 'default'}>
          {isCourse ? 'Course Completion' : 'Test Completion'}
        </Badge>
      </div>
      <div className={styles.cardContent}>
        <h3 className={styles.itemName}>{certificate.itemName}</h3>
        <p className={styles.meta}>Completed on {formattedDate}</p>
        {certificate.scorePercentage !== null && (
          <p className={styles.score}>
            Score: <span>{parseFloat(certificate.scorePercentage).toFixed(2)}%</span>
          </p>
        )}
      </div>
      <div className={styles.cardFooter}>
        <p className={styles.certNumber}>
          <FileText size={14} />
          <span>{certificate.certificateNumber}</span>
        </p>
        <div className={styles.buttonGroup}>
          <ShareButton
            kind="certificate"
            handle={certificate.certificateNumber}
            title={certificate.itemName}
            campaign={CERTIFICATE_SHARE_CAMPAIGN}
            sharer="owner"
            variant="secondary"
            size="sm"
          />
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>
                <Loader size={16} className={styles.spinner} />
                Downloading...
              </>
            ) : (
              <>
                <Download size={16} />
                Download PDF
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

interface EligibleCertificateCardProps {
  item: {
    id: number;
    name: string;
    type: 'course_completion' | 'test_completion';
    completedAt: Date;
    score?: number | null;
  };
  className?: string;
}

export const EligibleCertificateCard: React.FC<EligibleCertificateCardProps> = ({ item, className }) => {
  const generateMutation = useGenerateCertificate();

  const handleGenerate = async () => {
    const promise = generateMutation.mutateAsync({
      itemId: item.id,
      certificateType: item.type,
    });

    toast.promise(promise, {
      loading: 'Generating your certificate...',
      success: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Testkart_Certificate_For_${item.name.replace(/\s/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        return 'Certificate generated and downloaded!';
      },
      error: (error) => {
        console.error('Generation failed', error);
        return error instanceof Error ? error.message : 'An unknown error occurred.';
      },
    });
  };

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(item.completedAt));

  const isCourse = item.type === 'course_completion';

  return (
    <div className={`${styles.card} ${styles.eligibleCard} ${className || ''}`}>
      <div className={styles.cardHeader}>
        <div className={styles.iconWrapper}>
          <Star size={24} />
        </div>
        <Badge variant={isCourse ? 'secondary' : 'default'}>
          {isCourse ? 'Course Complete' : 'Test Complete'}
        </Badge>
      </div>
      <div className={styles.cardContent}>
        <h3 className={styles.itemName}>{item.name}</h3>
        <p className={styles.meta}>Completed on {formattedDate}</p>
        {item.score !== null && typeof item.score !== 'undefined' && (
          <p className={styles.score}>
            Score: <span>{item.score.toFixed(2)}%</span>
          </p>
        )}
      </div>
      <div className={styles.cardFooter}>
        <p className={styles.certNumber}>Ready to generate</p>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <>
              <Loader size={16} className={styles.spinner} />
              Generating...
            </>
          ) : (
            <>
              <Award size={16} />
              Generate
            </>
          )}
        </Button>
      </div>
    </div>
  );
};