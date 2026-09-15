import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getCertificatePublic } from '../endpoints/certificate/public_GET.schema';
import { postCertificatePublicDownload } from '../endpoints/certificate/public-download_POST.schema';
import { SEOHead } from '../components/SEOHead';
import { Skeleton } from '../components/Skeleton';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { ShareButton } from '../components/ShareButton';
import { CERTIFICATE_SHARE_CAMPAIGN } from '../helpers/shareLinks';
import { Award, Download, Loader, FileWarning, ServerCrash } from 'lucide-react';
import { toast } from 'sonner';
import styles from './certificates.$certificateId.module.css';

const CertificatePageSkeleton = () =>
<div className={styles.container}>
    <div className={styles.certificateWrapper}>
      <div className={styles.header}>
        <Skeleton style={{ height: '40px', width: '180px' }} />
        <Skeleton style={{ height: '40px', width: '40px', borderRadius: 'var(--radius-full)' }} />
      </div>
      <div className={styles.content}>
        <Skeleton style={{ height: '24px', width: '200px', margin: '0 auto var(--spacing-2)' }} />
        <Skeleton style={{ height: '48px', width: '80%', margin: '0 auto var(--spacing-4)' }} />
        <Skeleton style={{ height: '20px', width: '300px', margin: 'var(--spacing-8) auto 0' }} />
        <Skeleton style={{ height: '20px', width: '250px', margin: 'var(--spacing-2) auto 0' }} />
      </div>
      <div className={styles.footer}>
        <Skeleton style={{ height: '20px', width: '200px' }} />
        <Skeleton style={{ height: '20px', width: '300px' }} />
      </div>
    </div>
    <div className={styles.actions}>
      <Skeleton style={{ height: '40px', width: '180px' }} />
    </div>
  </div>;


const CertificateNotFound = () =>
<div className={styles.centeredMessage}>
    <FileWarning size={48} className={styles.icon} />
    <h2 className={styles.messageTitle}>Certificate Not Found</h2>
    <p className={styles.messageText}>The certificate you are looking for does not exist or may have been removed.</p>
  </div>;


const CertificateError = ({ message }: {message: string;}) =>
<div className={styles.centeredMessage}>
    <ServerCrash size={48} className={styles.icon} />
    <h2 className={styles.messageTitle}>An Error Occurred</h2>
    <p className={styles.messageText}>{message}</p>
  </div>;


const CertificatePage = () => {
  const { certificateId } = useParams<{certificateId: string;}>();

  const { data, isFetching, error } = useQuery({
    queryKey: ['publicCertificate', certificateId],
    queryFn: () => getCertificatePublic({ certificateId: certificateId! }),
    enabled: !!certificateId,
    retry: (failureCount, error: any) => {
      if (error?.message?.includes('404')) return false;
      return failureCount < 2;
    }
  });

  const downloadMutation = useMutation({
    mutationFn: postCertificatePublicDownload
  });

  const handleDownload = () => {
    if (!data) return;
    const promise = downloadMutation.mutateAsync({ certificateId: data.certificateNumber });

    toast.promise(promise, {
      loading: 'Preparing your download...',
      success: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Testkart_Certificate_${data.certificateNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        return 'Certificate download started!';
      },
      error: (err) => {
        return err instanceof Error ? `Download failed: ${err.message}` : 'An unknown error occurred.';
      }
    });
  };

  if (isFetching) {
    return <CertificatePageSkeleton />;
  }

  if (error) {
    if (error.message.includes('404')) {
      return <CertificateNotFound />;
    }
    return <CertificateError message={error.message} />;
  }

  if (!data) {
    return <CertificateNotFound />;
  }

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date(data.completionDate));

  const isCourse = data.certificateType === 'course_completion';

  return (
    <>
      <SEOHead
        title={`Certificate for ${data.itemName}`}
        description={`Certificate of completion awarded to ${data.studentName} for successfully completing ${data.itemName} on Testkart.`}
        url={`${window.location.origin}/certificates/${data.id}`}
        type="profile" />

      <div className={styles.container}>
        <div className={styles.certificateWrapper}>
          <div className={styles.header}>
            <h1 className={styles.brand}>Testkart</h1>
            <Award size={40} className={styles.awardIcon} />
          </div>
          <div className={styles.content}>
            <p className={styles.certifyText}>This is to certify that</p>
            <h2 className={styles.studentName}>{data.studentName}</h2>
            <p className={styles.completionText}>has successfully completed the</p>
            <h3 className={styles.itemName}>{data.itemName}</h3>
            <div className={styles.badgeWrapper}>
              <Badge variant={isCourse ? 'secondary' : 'default'}>
                {isCourse ? 'Course Completion' : 'Test Completion'}
              </Badge>
              {data.scorePercentage &&
              <Badge variant="success">
                  Score: {parseFloat(data.scorePercentage).toFixed(2)}%
                </Badge>
              }
            </div>
            <p className={styles.dateText}>on {formattedDate}</p>
          </div>
          <div className={styles.footer}>
            <p className={styles.issuedBy}>Issued by: {data.issuedBy}</p>
            <p className={styles.certNumber}>Certificate No: {data.certificateNumber}</p>
          </div>
        </div>
        <div className={styles.actions}>
          <Button
            size="lg"
            onClick={handleDownload}
            disabled={downloadMutation.isPending}>

            {downloadMutation.isPending ?
            <>
                <Loader size={20} className={styles.spinner} />
                Downloading...
              </> :

            <>
                <Download size={20} />
                Download PDF
              </>
            }
          </Button>
          <ShareButton
            kind="certificate"
            handle={data.certificateNumber}
            title={data.itemName}
            campaign={CERTIFICATE_SHARE_CAMPAIGN}
            size="lg"
          />
        </div>
      </div>
    </>);

};

export default CertificatePage;