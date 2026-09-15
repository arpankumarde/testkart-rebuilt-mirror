import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { useStudentOrdersQuery } from "../helpers/useStudentOrdersQuery";
import { getStudentOrdersInvoice } from "../endpoints/student/orders/invoice_GET.schema";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { toast } from "sonner";
import {
  AlertTriangle,
  ShoppingBag,
  FileText,
  Calendar,
  Hash,
  IndianRupee,
  Download,
} from "lucide-react";
import styles from "./student.orders.module.css";

const StudentOrdersPage: React.FC = () => {
  const { data, isFetching, error, refetch } = useStudentOrdersQuery();
  const [downloadingOrderId, setDownloadingOrderId] = useState<number | null>(null);

  const getStatusVariant = (
    status: "pending" | "completed" | "failed" | "cancelled" | "refunded"
  ): "warning" | "success" | "destructive" | "outline" => {
    switch (status) {
      case "completed":
        return "success";
      case "pending":
        return "warning";
      case "failed":
        return "destructive";
      case "cancelled":
      case "refunded":
        return "outline";
      default:
        return "outline";
    }
  };

  const handleDownloadInvoice = async (orderId: number) => {
    setDownloadingOrderId(orderId);
    try {
      const blob = await getStudentOrdersInvoice({ orderId });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-order-${orderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not download the invoice. Try again.");
    } finally {
      setDownloadingOrderId(null);
    }
  };

  const renderContent = () => {
    if (isFetching) {
      return (
        <div className={styles.ordersGrid}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className={styles.cardSkeleton} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertTriangle size={24} />}
          title="Could not load your orders"
          description="The request did not come back. Check your connection and try again."
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (!data || data.orders.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<ShoppingBag size={24} />}
          title="No orders yet"
          description="Every purchase you make lands here with its invoice and status."
        >
          <Button asChild>
            <Link to="/mock-test">Browse tests</Link>
          </Button>
        </ConsoleListEmpty>
      );
    }

    return (
      <div className={styles.ordersGrid}>
        {data.orders.map((order) => (
          <div key={order.id} className={styles.orderCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.orderId}>Order #{order.id}</h2>
              <Badge variant={getStatusVariant(order.status)}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </Badge>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.infoItem}>
                <Calendar size={16} />
                <span className={styles.infoValue}>
                  {order.createdAt
                    ? new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "Date unavailable"}
                </span>
              </div>
              <div className={styles.infoItem}>
                <IndianRupee size={16} />
                <span className={styles.infoValue}>
                  {new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                  }).format(Number(order.totalAmount))}
                </span>
              </div>
              <div className={styles.infoItem}>
                <Hash size={16} />
                <span className={styles.infoValue}>
                  {order.itemCount} item{order.itemCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <div className={styles.cardFooter}>
              <Button asChild variant="outline" size="sm">
                <Link to={`/order/${order.id}`}>
                  <FileText size={16} />
                  View order
                </Link>
              </Button>
              {order.status === "completed" && Number(order.totalAmount) > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadInvoice(order.id)}
                  disabled={downloadingOrderId === order.id}
                >
                  <Download size={16} />
                  {downloadingOrderId === order.id ? "Downloading..." : "Download invoice"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Orders | Testkart</title>
        <meta
          name="description"
          content="View your complete order history on Testkart."
        />
      </Helmet>

      <ConsolePageHeader title="Orders" />

      {renderContent()}
    </div>
  );
};

export default StudentOrdersPage;
