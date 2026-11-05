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
import { AlertTriangle, ChevronRight, Download, ShoppingBag } from "lucide-react";
import styles from "./student.orders.module.css";

type OrderStatus = "pending" | "completed" | "failed" | "cancelled" | "refunded";

const STATUS: Record<OrderStatus, { label: string; variant: "warning" | "success" | "destructive" | "outline" }> = {
  completed: { label: "Completed", variant: "success" },
  pending: { label: "Payment pending", variant: "warning" },
  failed: { label: "Payment failed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "outline" },
  refunded: { label: "Refunded", variant: "outline" },
};

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

/*
 * One list, newest first. A row reads the way a student thinks of it: what was
 * bought, when, what it cost and whether it went through. The order number is
 * kept small for support conversations.
 */
const StudentOrdersPage: React.FC = () => {
  const { data, isFetching, error, refetch } = useStudentOrdersQuery();
  const [downloadingOrderId, setDownloadingOrderId] = useState<number | null>(null);

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
    if (isFetching && !data) {
      return (
        <div className={styles.list}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.row}>
              <Skeleton className={styles.rowSkeleton} />
            </div>
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
          description="Check your connection and try again."
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
          description="Your purchases and invoices show up here."
        >
          <Button asChild>
            <Link to="/mock-test">Browse tests</Link>
          </Button>
        </ConsoleListEmpty>
      );
    }

    return (
      <ul className={styles.list}>
        {data.orders.map((order) => {
          const status = STATUS[order.status as OrderStatus] ?? { label: order.status, variant: "outline" as const };
          const amount = Number(order.totalAmount);
          const hasInvoice = order.status === "completed" && amount > 0;

          return (
            <li key={order.id} className={styles.row}>
              <div className={styles.main}>
                <h2 className={styles.title}>
                  <Link to={`/order/${order.id}`} className={styles.titleLink}>
                    {order.title}
                  </Link>
                </h2>
                <p className={styles.meta}>
                  {order.createdAt ? shortDate.format(new Date(order.createdAt)) : "Date unavailable"}
                  <span aria-hidden="true"> &middot; </span>
                  Order #{order.id}
                </p>
              </div>

              <span className={styles.amount}>{amount > 0 ? rupees.format(amount) : "Free"}</span>

              <span className={styles.status}>
                <Badge variant={status.variant}>{status.label}</Badge>
              </span>

              <div className={styles.actions}>
                {hasInvoice && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadInvoice(order.id)}
                    disabled={downloadingOrderId === order.id}
                  >
                    <Download size={15} />
                    {downloadingOrderId === order.id ? "Downloading..." : "Invoice"}
                  </Button>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link to={`/order/${order.id}`}>
                    View <ChevronRight size={15} />
                  </Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
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
