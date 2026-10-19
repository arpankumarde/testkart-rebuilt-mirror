import React, { useEffect, useState } from "react";
import { z } from "zod";
import { Selectable } from "kysely";
import { PromoCodes } from "../helpers/schema";
import {
  useAdminPromoCodesQuery,
  useUpsertPromoCodeMutation,
  useTogglePromoCodeMutation,
} from "../helpers/useAdminPromoCodes";
import { useAdminPlansQuery } from "../helpers/useAdminSubscriptionPlans";
import { AdminPromoCodeRow } from "../endpoints/admin/promo-codes/list_GET.schema";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Switch } from "./Switch";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Checkbox } from "./Checkbox";
import { Skeleton } from "./Skeleton";
import { Dialog } from "./Dialog";
import {
  ConsoleDialogContent,
  ConsoleDialogHeader,
  ConsoleDialogBody,
  ConsoleDialogFooter,
} from "./ConsoleDialog";
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
  useForm,
} from "./Form";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "./Select";
import { Plus, Edit2, Tag } from "lucide-react";
import styles from "./AdminSubscriptionPlansManager.module.css";

const promoFormSchema = z.object({
  id: z.number().optional(),
  code: z
    .string()
    .trim()
    .min(3, "Code must be at least 3 characters")
    .regex(/^[A-Za-z0-9_-]+$/, "Only letters, numbers, hyphens and underscores"),
  description: z.string().optional(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Must be a positive number"),
  maxDiscountAmount: z.string().optional(),
  recurringScope: z.enum(["first_month", "every_month"]),
  planIds: z.array(z.number()),
  usageLimit: z.string().optional(),
  perUserLimit: z.string().optional(),
  validUntil: z.string().optional(),
  isActive: z.boolean(),
});

type PromoFormData = z.infer<typeof promoFormSchema>;

export const AdminPromoCodesManager: React.FC = () => {
  const { data: codes, isFetching } = useAdminPromoCodesQuery();
  const toggleMutation = useTogglePromoCodeMutation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<AdminPromoCodeRow | null>(null);

  const handleCreate = () => {
    setEditingCode(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (code: AdminPromoCodeRow) => {
    setEditingCode(code);
    setIsDialogOpen(true);
  };

  const renderDiscount = (code: Selectable<PromoCodes>) =>
    code.discountType === "percentage" ? `${code.discountValue}%` : `₹${code.discountValue}`;

  const renderUsage = (code: AdminPromoCodeRow) =>
    code.usageLimit !== null ? `${code.usedCount} / ${code.usageLimit}` : `${code.usedCount}`;

  const renderScope = (code: Selectable<PromoCodes>) =>
    code.recurringScope === "every_month" ? "Every month" : "First month only";

  const renderList = () => {
    if (isFetching && !codes) {
      return (
        <div className={styles.tableContainer} style={{ display: "block" }}>
          <table className={styles.table}>
            <tbody>
              {Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  <td><Skeleton style={{ height: "0.875rem", width: "60%" }} /></td>
                  <td><Skeleton style={{ height: "0.875rem", width: "40%" }} /></td>
                  <td><Skeleton style={{ height: "0.875rem", width: "50%" }} /></td>
                  <td><Skeleton style={{ height: "1.5rem", width: "4.5rem", marginLeft: "auto" }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (!codes || codes.length === 0) {
      return <p className={styles.emptyState}>No promo codes yet.</p>;
    }

    return (
      <div className={styles.tableContainer} style={{ display: "block" }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Applies to</th>
              <th>Scope</th>
              <th className={styles.num}>Used</th>
              <th><span className={styles.srOnly}>Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {codes.map((code) => (
              <tr key={code.id}>
                <td>
                  <div className={styles.stack}>
                    <span className={styles.primaryLine}>
                      <span className={styles.truncate} title={code.code}>{code.code}</span>
                      {!code.isActive && <Badge variant="secondary" className={styles.flag}>Inactive</Badge>}
                    </span>
                    {code.description && (
                      <span className={styles.secondaryLine} title={code.description}>{code.description}</span>
                    )}
                  </div>
                </td>
                <td>{renderDiscount(code)}</td>
                <td>{code.planNames ? code.planNames.join(", ") : "All plans"}</td>
                <td>{renderScope(code)}</td>
                <td className={styles.num}>{renderUsage(code)}</td>
                <td>
                  <div className={styles.rowActions}>
                    <Button
                      variant="ghost"
                      size="icon-md"
                      className={styles.iconButton}
                      onClick={() => handleEdit(code)}
                      aria-label={`Edit promo code ${code.code}`}
                    >
                      <Edit2 />
                    </Button>
                    <div className={styles.toggle}>
                      <Switch
                        checked={code.isActive}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ promoCodeId: code.id, isActive: checked })
                        }
                        disabled={toggleMutation.isPending}
                        aria-label={`${code.isActive ? "Deactivate" : "Activate"} ${code.code}`}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>Promo codes</h2>
          <p className={styles.panelDescription}>
            Create codes teachers can apply at checkout to discount a subscription plan.
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus size={16} /> Create promo code
        </Button>
      </div>

      <div className={styles.results}>{renderList()}</div>

      <PromoCodeEditorDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} code={editingCode} />
    </div>
  );
};

interface PromoCodeEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: AdminPromoCodeRow | null;
}

const toDateInputValue = (date: Date | string | null): string => {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
};

const PromoCodeEditorDialog: React.FC<PromoCodeEditorDialogProps> = ({ open, onOpenChange, code }) => {
  const upsertMutation = useUpsertPromoCodeMutation();
  const { data: plans } = useAdminPlansQuery();

  const defaultValues: PromoFormData = {
    id: code?.id,
    code: code?.code || "",
    description: code?.description || "",
    discountType: (code?.discountType as "percentage" | "fixed") || "percentage",
    discountValue: code?.discountValue || "10",
    maxDiscountAmount: code?.maxDiscountAmount || "",
    recurringScope: (code?.recurringScope as "first_month" | "every_month") || "first_month",
    planIds: code?.targetItemIds || [],
    usageLimit: code?.usageLimit != null ? String(code.usageLimit) : "",
    perUserLimit: code?.perUserLimit != null ? String(code.perUserLimit) : "",
    validUntil: toDateInputValue(code?.validUntil ?? null),
    isActive: code?.isActive ?? true,
  };

  const form = useForm<typeof promoFormSchema>({ schema: promoFormSchema, defaultValues });

  useEffect(() => {
    if (open) {
      form.setValues(defaultValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, code]);

  const handleSubmit = (data: PromoFormData) => {
    upsertMutation.mutate(
      {
        id: data.id,
        code: data.code,
        description: data.description || null,
        discountType: data.discountType,
        discountValue: parseFloat(data.discountValue),
        maxDiscountAmount: data.maxDiscountAmount ? parseFloat(data.maxDiscountAmount) : null,
        recurringScope: data.recurringScope,
        planIds: data.planIds.length > 0 ? data.planIds : null,
        usageLimit: data.usageLimit ? parseInt(data.usageLimit, 10) : null,
        perUserLimit: data.perUserLimit ? parseInt(data.perUserLimit, 10) : null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        isActive: data.isActive,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const togglePlan = (planId: number, checked: boolean) => {
    form.setValues((prev) => ({
      ...prev,
      planIds: checked ? [...prev.planIds, planId] : prev.planIds.filter((id) => id !== planId),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="lg">
        <ConsoleDialogHeader
          title={code ? "Edit promo code" : "Create promo code"}
          description={
            code
              ? "Change how this code discounts a subscription."
              : "Teachers enter this code at checkout to get a discount on a subscription plan."
          }
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <ConsoleDialogBody>
              <FormItem name="code">
                <FormLabel>Code</FormLabel>
                <FormControl>
                  <Input
                    value={form.values.code}
                    onChange={(e) => form.setValues((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g. WELCOME50"
                    style={{ textTransform: "uppercase" }}
                  />
                </FormControl>
                <FormDescription>Teachers type this exactly. Case does not matter.</FormDescription>
                <FormMessage />
              </FormItem>

              <FormItem name="description">
                <FormLabel>Internal note</FormLabel>
                <FormControl>
                  <Input
                    value={form.values.description || ""}
                    onChange={(e) => form.setValues((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Not shown to teachers"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <div className={styles.formRow}>
                <FormItem name="discountType" className={styles.flex1}>
                  <FormLabel>Discount type</FormLabel>
                  <FormControl>
                    <Select
                      value={form.values.discountType}
                      onValueChange={(val: any) => form.setValues((prev) => ({ ...prev, discountType: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="percentage">Percentage off</SelectItem>
                          <SelectItem value="fixed">Fixed amount off</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="discountValue" className={styles.flex1}>
                  <FormLabel>
                    {form.values.discountType === "percentage" ? "Discount (%)" : "Discount (₹)"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.values.discountValue}
                      onChange={(e) => form.setValues((prev) => ({ ...prev, discountValue: e.target.value }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </div>

              {form.values.discountType === "percentage" && (
                <FormItem name="maxDiscountAmount">
                  <FormLabel>Maximum discount (₹, optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="No cap"
                      value={form.values.maxDiscountAmount || ""}
                      onChange={(e) => form.setValues((prev) => ({ ...prev, maxDiscountAmount: e.target.value }))}
                    />
                  </FormControl>
                  <FormDescription>Caps how much a percentage discount can be worth in rupees.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}

              <FormItem name="recurringScope">
                <FormLabel>When does the discount apply?</FormLabel>
                <FormControl>
                  <Select
                    value={form.values.recurringScope}
                    onValueChange={(val: any) => form.setValues((prev) => ({ ...prev, recurringScope: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="first_month">First month / cycle only</SelectItem>
                        <SelectItem value="every_month">Every renewal (recurring)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  "Every renewal" keeps discounting autopay charges for as long as the teacher stays subscribed.
                </FormDescription>
                <FormMessage />
              </FormItem>

              <FormItem name="planIds">
                <FormLabel>Applicable plans</FormLabel>
                <FormControl>
                  <div className={styles.radioGroup} style={{ flexDirection: "column" }}>
                    {(plans || []).map((plan) => (
                      <label key={plan.id} className={styles.switchRow} style={{ cursor: "pointer" }}>
                        <span className={styles.radioLabel}>
                          {plan.name} — ₹{plan.price}/{plan.billingCycle}
                        </span>
                        <Checkbox
                          checked={form.values.planIds.includes(plan.id)}
                          onChange={(e) => togglePlan(plan.id, e.target.checked)}
                        />
                      </label>
                    ))}
                  </div>
                </FormControl>
                <FormDescription>Leave all unchecked to apply this code to every plan.</FormDescription>
                <FormMessage />
              </FormItem>

              <div className={styles.formRow}>
                <FormItem name="usageLimit" className={styles.flex1}>
                  <FormLabel>Total uses (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Unlimited"
                      value={form.values.usageLimit || ""}
                      onChange={(e) => form.setValues((prev) => ({ ...prev, usageLimit: e.target.value }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="perUserLimit" className={styles.flex1}>
                  <FormLabel>Uses per teacher (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Unlimited"
                      value={form.values.perUserLimit || ""}
                      onChange={(e) => form.setValues((prev) => ({ ...prev, perUserLimit: e.target.value }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </div>

              <FormItem name="validUntil">
                <FormLabel>Expires on (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={form.values.validUntil || ""}
                    onChange={(e) => form.setValues((prev) => ({ ...prev, validUntil: e.target.value }))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="isActive">
                <div className={styles.switchRow}>
                  <div>
                    <FormLabel>Active status</FormLabel>
                    <FormDescription>Can teachers redeem this code right now?</FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={form.values.isActive}
                      onCheckedChange={(val) => form.setValues((prev) => ({ ...prev, isActive: val }))}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            </ConsoleDialogBody>

            <ConsoleDialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Saving..." : code ? "Save code" : "Create code"}
              </Button>
            </ConsoleDialogFooter>
          </form>
        </Form>
      </ConsoleDialogContent>
    </Dialog>
  );
};
