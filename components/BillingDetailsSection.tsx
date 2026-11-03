import React, { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./Select";
import {
  useBillingDetailsQuery,
  useUpdateBillingDetailsMutation,
} from "../helpers/useBillingDetails";
import { INDIAN_STATES, isIndianState, stateForGstin } from "../helpers/indianLocationsData";
import styles from "./BillingDetailsSection.module.css";

interface FormState {
  name: string;
  email: string;
  phone: string;
  address: string;
  state: string;
  gstin: string;
}

const emptyState: FormState = {
  name: "",
  email: "",
  phone: "",
  address: "",
  state: "",
  gstin: "",
};

const GSTIN_REGEX = /^[0-9A-Z]{15}$/;

type FieldErrors = Partial<Record<"name" | "address" | "state" | "gstin", string>>;

/**
 * Private billing information used only to populate the "Billed To" section
 * of GST tax invoices (order/subscription PDFs). Shown on both the student
 * and teacher profile pages. Not part of the public profile. The state is
 * required and stored as one of INDIAN_STATES, separate from the address text.
 */
export const BillingDetailsSection: React.FC = () => {
  const { data, isFetching } = useBillingDetailsQuery();
  const updateMutation = useUpdateBillingDetailsMutation();

  const [form, setForm] = useState<FormState>(emptyState);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    if (data && !hasLoadedOnce) {
      const details = data.billingDetails;
      setForm({
        name: details?.name ?? "",
        email: details?.email ?? "",
        phone: details?.phone ?? "",
        address: details?.address ?? "",
        state: isIndianState(details?.state) ? details.state : "",
        gstin: details?.gstin ?? "",
      });
      setHasLoadedOnce(true);
    }
  }, [data, hasLoadedOnce]);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "name" || field === "address" || field === "state" || field === "gstin") {
      setErrors((prev) => ({ ...prev, [field]: undefined, ...(field === "state" ? { gstin: undefined } : {}) }));
    }
  };

  const handleSave = () => {
    const name = form.name.trim();
    const address = form.address.trim();
    const trimmedGstin = form.gstin.trim().toUpperCase();
    const nextErrors: FieldErrors = {};
    if (name.length < 2) nextErrors.name = "Please enter the name for your invoices.";
    if (address.length < 5) nextErrors.address = "Please enter your full address.";
    if (!isIndianState(form.state)) nextErrors.state = "Please select your state.";
    if (trimmedGstin && !GSTIN_REGEX.test(trimmedGstin)) {
      nextErrors.gstin = "GSTIN must be 15 characters (numbers and uppercase letters).";
    } else if (trimmedGstin && isIndianState(form.state)) {
      const gstinState = stateForGstin(trimmedGstin);
      if (gstinState !== form.state) {
        nextErrors.gstin = gstinState
          ? `This GSTIN is registered in ${gstinState}. Select that state or check the GSTIN.`
          : "This GSTIN does not start with a valid state code.";
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !isIndianState(form.state)) return;

    toast.promise(
      updateMutation.mutateAsync({
        name,
        email: form.email.trim(),
        phone: form.phone.trim(),
        address,
        state: form.state,
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
            Private information used only to fill the "Billed To" section of your invoices - not shown anywhere on your public profile.
          </p>
        </div>
      </div>
      <div className={styles.cardContent}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="billing-name">
              Full name <span className={styles.requiredTag} aria-hidden="true">*</span>
            </label>
            <Input
              id="billing-name"
              aria-required="true"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "billing-name-error" : undefined}
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Name as it should appear on invoices"
            />
            {errors.name && <p id="billing-name-error" className={styles.errorText}>{errors.name}</p>}
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="billing-email">Email</label>
            <Input
              id="billing-email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="billing@example.com"
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="billing-phone">Phone</label>
            <Input
              id="billing-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="10-digit mobile number"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="billing-gstin">
              GST number <span className={styles.optionalTag}>(optional)</span>
            </label>
            <Input
              id="billing-gstin"
              aria-invalid={errors.gstin ? true : undefined}
              aria-describedby={errors.gstin ? "billing-gstin-error" : "billing-gstin-help"}
              value={form.gstin}
              onChange={(e) => handleChange("gstin", e.target.value.toUpperCase())}
              placeholder="15-character GSTIN"
              maxLength={15}
            />
            {errors.gstin ? (
              <p id="billing-gstin-error" className={styles.errorText}>{errors.gstin}</p>
            ) : (
              <p id="billing-gstin-help" className={styles.helpText}>Only if your business is registered for GST.</p>
            )}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="billing-address">
            Billing address <span className={styles.requiredTag} aria-hidden="true">*</span>
          </label>
          <Textarea
            id="billing-address"
            aria-required="true"
            aria-invalid={errors.address ? true : undefined}
            aria-describedby="billing-address-note"
            value={form.address}
            onChange={(e) => handleChange("address", e.target.value)}
            placeholder="House or street, area, city, PIN code"
            rows={3}
          />
          {errors.address ? (
            <p id="billing-address-note" className={styles.errorText}>{errors.address}</p>
          ) : (
            <p id="billing-address-note" className={styles.helpText}>Full address to be printed on your invoices.</p>
          )}
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} id="billing-state-label">
              State <span className={styles.requiredTag} aria-hidden="true">*</span>
            </label>
            <Select value={form.state || undefined} onValueChange={(next) => handleChange("state", next)}>
              <SelectTrigger
                aria-labelledby="billing-state-label"
                aria-required="true"
                aria-invalid={errors.state ? true : undefined}
              >
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.state && <p className={styles.errorText}>{errors.state}</p>}
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="billing-country">Country</label>
            <Input id="billing-country" value="India" readOnly disabled />
          </div>
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
