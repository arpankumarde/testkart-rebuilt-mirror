import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ShoppingBag, AlertTriangle } from 'lucide-react';
import { useStudentPurchasesQuery } from '../helpers/useShopQuery';
import { StudentProductCard } from '../components/StudentProductCard';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { ConsolePageHeader } from '../components/ConsolePageHeader';
import { ConsoleListEmpty } from '../components/ConsoleListEmpty';
import styles from './student.shop.module.css';

const StudentShopPage: React.FC = () => {
  const { data, isLoading, isError, refetch } = useStudentPurchasesQuery();

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className={styles.grid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={styles.cardSkeleton} />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertTriangle size={24} />}
          title="Could not load your purchases"
          description="The request did not come back. Check your connection and try again."
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (!data || data.purchases.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<ShoppingBag size={24} />}
          title="No purchases yet"
          description="Study notes you buy open here, readable any time inside Testkart."
        >
          <Button asChild>
            <Link to="/study-notes">Browse study notes</Link>
          </Button>
        </ConsoleListEmpty>
      );
    }

    return (
      <div className={styles.grid}>
        {data.purchases.map((purchase) => (
          <StudentProductCard key={purchase.purchaseId} purchase={purchase} />
        ))}
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Study notes | Testkart</title>
        <meta name="description" content="Access your purchased study notes and digital products." />
      </Helmet>

      <div className={styles.page}>
        <ConsolePageHeader title="Study notes">
          <Button asChild variant="outline">
            <Link to="/study-notes">Browse study notes</Link>
          </Button>
        </ConsolePageHeader>

        {renderContent()}
      </div>
    </>
  );
};

export default StudentShopPage;
