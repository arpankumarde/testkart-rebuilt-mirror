import React, { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import {
  useBillingDetailsQuery,
  useUpdateBillingDetailsMutation,
} from "../helpers/useBillingDetails";
import styles from "./BillingDetailsSection.module.css";

interface FormState {
  name: string;
  email: string;
  phone: string;
  address: string;
  gstin: string;
}

const emptyState: FormState = {
  name: "",
  email: "",
  phone: "",
  address: "",
  gstin: "",
};

const GSTIN_REGEX = /^[0-9A-Z]{15}$/;

/**
 * Private billing information used only to populate the "Billed To" section
 * of GST tax invoices (order/subscription PDFs). Shown on both the student
 * and teacher profile pages. Not part of the public profile.
 */
export const BillingDetailsSection: React.FC = () => {
  const { data, isFetching } = useBillingDetailsQuery();
  const updateMutation = useUpdateBillingDetailsMutation();

  const [form, setForm] = useState<FormState>(emptyState);
  const [gstinError, setGstinError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    if (data && !hasLoadedOnce) {
      const details = data.billingDetails;
      setForm({
        name: details?.name ?? "",
        email: details?.email ?? "",
        phone: details?.phone ?? "",
        address: details?.address ?? "",
        gstin: details?.gstin ?? "",
      });
      setHasLoadedOnce(true);
    }
  }, [data, hasLoadedOnce]);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "gstin") setGstinError(null);
  };

  const handleSave = () => {
    const trimmedGstin = form.gstin.trim().toUpperCase();
    if (trimmedGstin && !GSTIN_REGEX.test(trimmedGstin)) {
      setGstinError("GSTIN must be 15 characters (numbers and uppercase letters).");
      return;
    }

    toast.promise(
      updateMutation.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        gstin: trimmedGstin || "",
      }),
      {
        loading: "Saving billing details...",
        success: "Billing details saved.",
        error: (err) => (err instanceof Error ? err.message : "Failed to save billing details."),
      }
    );
  };

  if (isFetching && !hasLoadedOnce) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardIconWrapper}>
            <Receipt size={20} />
          </div>
          <div>
            <h2 className={styles.cardTitle}>Billing Details</h2>
            <p className={styles.cardDescription}>Used only to generate your invoices</p>
          </div>
        </div>
        <div className={styles.cardContent}>
          <Skeleton style={{ height: "2.5rem", width: "100%" }} />
          <Skeleton style={{ height: "2.5rem", width: "100%" }} />
          <Skeleton style={{ height: "5rem", width: "100%" }} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardIconWrapper}>
          <Receipt size={20} />
        </div>
        <div>
          <h2 className={styles.cardTitle}>Billing Details</h2>
          <p className={styles.cardDescription}>
            Private information used only to fill the "Billed To" section of your invoices — not shown anywhere on your public profile.
          </p>
        </div>
      </div>
      <div className={styles.cardContent}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Full Name</label>
            <Input
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Name as it should appear on invoices"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="billing@example.com"
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Phone</label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="10-digit mobile number"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              GSTIN <span className={styles.optionalTag}>(optional)</span>
            </label>
            <Input
              value={form.gstin}
              onChange={(e) => handleChange("gstin", e.target.value.toUpperCase())}
              placeholder="15-character GSTIN"
              maxLength={15}
            />
            {gstinError && <p className={styles.errorText}>{gstinError}</p>}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Billing Address</label>
          <Textarea
            value={form.address}
            onChange={(e) => handleChange("address", e.target.value)}
            placeholder="Street, city, state, PIN code"
            rows={3}
          />
          <p className={styles.helpText}>Full address to be printed on your invoices.</p>
        </div>
      </div>
      <div className={styles.footer}>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "Saving..." : "Save Billing Details"}
        </Button>
      </div>
    </div>
  );
};
