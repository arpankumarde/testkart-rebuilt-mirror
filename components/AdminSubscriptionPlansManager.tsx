import React, { useState, useEffect } from "react";
import { z } from "zod";
import {
  useAdminPlansQuery,
  useUpsertPlanMutation,
  useTogglePlanMutation,
  useSubscriptionPaymentModeQuery,
  useUpdatePaymentModeMutation
} from "../helpers/useAdminSubscriptionPlans";
import { Selectable } from "kysely";
import { SubscriptionPlans } from "../helpers/schema";
import { useTableSort, SortAccessors } from "../helpers/useTableSort";
import { SortableTh } from "./SortableTh";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Switch } from "./Switch";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Skeleton } from "./Skeleton";
import { Dialog } from "./Dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
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
import { AlertCircle, Plus, Edit2 } from "lucide-react";
import styles from "./AdminSubscriptionPlansManager.module.css";

// Form schema for plan (UI specific, maps to endpoint schema on submit)
const planFormSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Price must be a valid number >= 0"),
  durationDays: z.number().int().min(1, "Duration must be at least 1 day"),
  billingCycle: z.enum(["monthly", "yearly", "none"]),
  platformFeePercentage: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 100;
  }, "Platform fee must be between 0 and 100"),
  featuresText: z.string().optional(),
  isActive: z.boolean(),
});

type PlanFormData = z.infer<typeof planFormSchema>;

export const AdminSubscriptionPlansManager: React.FC = () => {
  return (
    <div className={styles.container}>
      <PaymentModeSection />
      <PlansListSection />
    </div>
  );
};

const PaymentModeSection: React.FC = () => {
  const { data, isFetching } = useSubscriptionPaymentModeQuery();
  const updateMutation = useUpdatePaymentModeMutation();
  const [selectedMode, setSelectedMode] = useState<"normal" | "recurring">("normal");

  useEffect(() => {
    if (data?.paymentMode) {
      setSelectedMode(data.paymentMode);
    }
  }, [data]);

  const handleSave = () => {
    updateMutation.mutate({ paymentMode: selectedMode });
  };

  if (isFetching && !data) {
    return <Skeleton className={styles.sectionSkeleton} />;
  }

  const isDirty = data?.paymentMode !== selectedMode;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>Payment mode</h2>
          <p className={styles.panelDescription}>Choose how teachers pay for subscriptions</p>
        </div>
        <Badge variant={data?.paymentMode === "recurring" ? "success" : "default"}>
          Current: {data?.paymentMode === "recurring" ? "Recurring" : "Normal"}
        </Badge>
      </div>

      <div className={styles.radioGroup}>
        <div
          className={`${styles.radioOption} ${selectedMode === "normal" ? styles.radioOptionActive : ""}`}
          onClick={() => setSelectedMode("normal")}
        >
          <div className={styles.radioOptionHeader}>
            <div className={styles.radioCircle}>
              {selectedMode === "normal" && <div className={styles.radioCircleInner} />}
            </div>
            <span className={styles.radioLabel}>Normal payment</span>
          </div>
          <p className={styles.radioDesc}>Teachers pay via PayU or wallet balance. Manual renewal required.</p>
        </div>

        <div
          className={`${styles.radioOption} ${selectedMode === "recurring" ? styles.radioOptionActive : ""}`}
          onClick={() => setSelectedMode("recurring")}
        >
          <div className={styles.radioOptionHeader}>
            <div className={styles.radioCircle}>
              {selectedMode === "recurring" && <div className={styles.radioCircleInner} />}
            </div>
            <span className={styles.radioLabel}>Recurring (UPI Autopay)</span>
          </div>
          <p className={styles.radioDesc}>Teachers set up UPI mandate for auto-renewal. Requires PayU SI activation.</p>
        </div>
      </div>

      {selectedMode === "recurring" && (
        <div className={styles.warningAlert}>
          <AlertCircle size={16} />
          <span>Make sure PayU Standing Instructions (SI) is activated by your payment provider before enabling this.</span>
        </div>
      )}

      <div className={styles.panelFooter}>
        <Button
          onClick={handleSave}
          disabled={!isDirty || updateMutation.isPending}
        >
          {updateMutation.isPending ? "Saving..." : "Save payment mode"}
        </Button>
      </div>
    </div>
  );
};

const PLAN_SORT_ACCESSORS: SortAccessors<Selectable<SubscriptionPlans>, "name" | "price" | "billing" | "fee"> = {
  name: (p) => p.name,
  price: (p) => (p.price === null ? null : Number(p.price)),
  billing: (p) => p.billingCycle,
  fee: (p) => (p.platformFeePercentage === null ? null : Number(p.platformFeePercentage)),
};

/* Shared by the loading and loaded tables so the columns do not jump. */
const PlanTableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colPrice} />
    <col className={styles.colBilling} />
    <col className={styles.colFee} />
    <col className={styles.colActions} />
  </colgroup>
);

const StackSkeleton = ({ top, bottom }: { top: string; bottom: string }) => (
  <div className={styles.stack}>
    <Skeleton style={{ height: "0.875rem", width: top }} />
    <Skeleton style={{ height: "0.75rem", width: bottom }} />
  </div>
);

const PlanRowSkeleton = () => (
  <tr>
    <td><StackSkeleton top="40%" bottom="65%" /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "3.5rem", marginLeft: "auto" }} /></td>
    <td><StackSkeleton top="70%" bottom="55%" /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "2.5rem", marginLeft: "auto" }} /></td>
    <td><Skeleton style={{ height: "1.5rem", width: "4.5rem", marginLeft: "auto" }} /></td>
  </tr>
);

const PlanCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "8rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "12rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "5rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

const PlansListSection: React.FC = () => {
  const { data: plans, isFetching } = useAdminPlansQuery();
  const { sorted: sortedPlans, ...sort } = useTableSort(plans, PLAN_SORT_ACCESSORS);
  const toggleMutation = useTogglePlanMutation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Selectable<SubscriptionPlans> | null>(null);

  const handleCreate = () => {
    setEditingPlan(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (plan: Selectable<SubscriptionPlans>) => {
    setEditingPlan(plan);
    setIsDialogOpen(true);
  };

  const handleToggle = (plan: Selectable<SubscriptionPlans>) => {
    toggleMutation.mutate({ planId: plan.id, isActive: !plan.isActive });
  };

  const renderIdentity = (plan: Selectable<SubscriptionPlans>) => (
    <div className={styles.stack}>
      <span className={styles.primaryLine}>
        <span className={styles.truncate} title={plan.name}>{plan.name}</span>
        {!plan.isActive && (
          <Badge variant="secondary" className={styles.flag}>Inactive</Badge>
        )}
      </span>
      {plan.description && (
        <span className={styles.secondaryLine} title={plan.description}>{plan.description}</span>
      )}
    </div>
  );

  const renderActions = (plan: Selectable<SubscriptionPlans>) => {
    const isFreePlan = parseFloat(plan.price) === 0 || plan.name.toLowerCase().includes("free");
    return (
      <div className={styles.rowActions}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={styles.iconButton}
              onClick={() => handleEdit(plan)}
              aria-label={`Edit plan ${plan.name}`}
            >
              <Edit2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit plan</TooltipContent>
        </Tooltip>
        <div className={styles.toggle} title={isFreePlan ? "Free plan cannot be deactivated" : undefined}>
          <Switch
            checked={plan.isActive ?? false}
            onCheckedChange={() => handleToggle(plan)}
            disabled={isFreePlan || toggleMutation.isPending}
            aria-label={`${plan.isActive ? "Deactivate" : "Activate"} ${plan.name}`}
          />
        </div>
      </div>
    );
  };

  const renderList = () => {
    if (isFetching && !plans) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <PlanTableColumns />
              <tbody>
                {Array.from({ length: 3 }).map((_, i) => <PlanRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 2 }).map((_, i) => <PlanCardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (!plans || plans.length === 0) {
      return <p className={styles.emptyState}>No subscription plans found.</p>;
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <PlanTableColumns />
            <thead>
              <tr>
                <SortableTh column="name" sort={sort}>Plan</SortableTh>
                <SortableTh column="price" sort={sort} className={styles.num}>Price</SortableTh>
                <SortableTh column="billing" sort={sort}>Billing</SortableTh>
                <SortableTh column="fee" sort={sort} className={styles.num}>Fee</SortableTh>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sortedPlans.map((plan) => (
                <tr key={plan.id}>
                  <td>{renderIdentity(plan)}</td>
                  <td className={styles.num}>₹{plan.price}</td>
                  <td>
                    <div className={styles.stack}>
                      <span className={`${styles.valueLine} ${styles.capitalize}`}>{plan.billingCycle}</span>
                      <span className={styles.secondaryLine}>{plan.durationDays} days</span>
                    </div>
                  </td>
                  <td className={styles.num}>{plan.platformFeePercentage}%</td>
                  <td>{renderActions(plan)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {sortedPlans.map((plan) => (
            <article key={plan.id} className={styles.card}>
              <div className={styles.cardHeader}>
                {renderIdentity(plan)}
                {renderActions(plan)}
              </div>
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <dt>Price</dt>
                  <dd>₹{plan.price}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Cycle</dt>
                  <dd className={styles.capitalize}>{plan.billingCycle}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Duration</dt>
                  <dd>{plan.durationDays} days</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Fee</dt>
                  <dd>{plan.platformFeePercentage}%</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>Subscription plans</h2>
          <p className={styles.panelDescription}>Manage the plans available to teachers</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus size={16} /> Create plan
        </Button>
      </div>

      <div className={styles.results}>{renderList()}</div>

      <PlanEditorDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        plan={editingPlan}
      />
    </div>
  );
};

interface PlanEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Selectable<SubscriptionPlans> | null;
}

const PlanEditorDialog: React.FC<PlanEditorDialogProps> = ({ open, onOpenChange, plan }) => {
  const upsertMutation = useUpsertPlanMutation();
  const isFreePlan = plan ? (parseFloat(plan.price) === 0 || plan.name.toLowerCase().includes("free")) : false;

  const form = useForm<typeof planFormSchema>({
    schema: planFormSchema,
    defaultValues: {
      id: plan?.id,
      name: plan?.name || "",
      description: plan?.description || "",
      price: plan?.price || "0.00",
      durationDays: plan?.durationDays || 30,
      billingCycle: (plan?.billingCycle as any) || "monthly",
      platformFeePercentage: plan?.platformFeePercentage || "0.00",
      featuresText: plan?.features ? (plan.features as string[]).join("\n") : "",
      isActive: plan?.isActive ?? true,
    },
  });

  // Reset form when plan changes
  useEffect(() => {
    if (open) {
      form.setValues({
        id: plan?.id,
        name: plan?.name || "",
        description: plan?.description || "",
        price: plan?.price || "0.00",
        durationDays: plan?.durationDays || 30,
        billingCycle: (plan?.billingCycle as any) || "monthly",
        platformFeePercentage: plan?.platformFeePercentage || "0.00",
        featuresText: plan?.features ? (plan.features as string[]).join("\n") : "",
        isActive: plan?.isActive ?? true,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan]);

  const handleSubmit = (data: PlanFormData) => {
    const features = data.featuresText
      ? data.featuresText.split("\n").map(s => s.trim()).filter(Boolean)
      : [];

    upsertMutation.mutate({
      id: data.id,
      name: data.name,
      description: data.description || null,
      price: isFreePlan ? "0.00" : data.price,
      durationDays: data.durationDays,
      billingCycle: data.billingCycle,
      platformFeePercentage: data.platformFeePercentage,
      features: features.length > 0 ? features : null,
      isActive: data.isActive,
    }, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="lg">
        <ConsoleDialogHeader
          title={plan ? "Edit subscription plan" : "Create subscription plan"}
          description={plan ? "Modify the details of this subscription plan." : "Add a new subscription plan for teachers."}
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <ConsoleDialogBody>
              <FormItem name="name">
                <FormLabel>Plan name</FormLabel>
                <FormControl>
                  <Input
                    value={form.values.name}
                    onChange={(e) => form.setValues(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Starter Plan"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="description">
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input
                    value={form.values.description || ""}
                    onChange={(e) => form.setValues(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Short description for display"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <div className={styles.formRow}>
                <FormItem name="price" className={styles.flex1}>
                  <FormLabel>Price (₹)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={isFreePlan}
                      value={form.values.price}
                      onChange={(e) => form.setValues(prev => ({ ...prev, price: e.target.value }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="durationDays" className={styles.flex1}>
                  <FormLabel>Duration (days)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      value={form.values.durationDays}
                      onChange={(e) => form.setValues(prev => ({ ...prev, durationDays: parseInt(e.target.value) || 0 }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </div>

              <div className={styles.formRow}>
                <FormItem name="billingCycle" className={styles.flex1}>
                  <FormLabel>Billing cycle</FormLabel>
                  <FormControl>
                    <Select
                      value={form.values.billingCycle}
                      onValueChange={(val: any) => form.setValues(prev => ({ ...prev, billingCycle: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select cycle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                          <SelectItem value="none">None (one-time)</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="platformFeePercentage" className={styles.flex1}>
                  <FormLabel>Platform fee (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={form.values.platformFeePercentage}
                      onChange={(e) => form.setValues(prev => ({ ...prev, platformFeePercentage: e.target.value }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </div>

              <FormItem name="featuresText">
                <FormLabel>Features</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder="Enter one feature per line..."
                    value={form.values.featuresText || ""}
                    onChange={(e) => form.setValues(prev => ({ ...prev, featuresText: e.target.value }))}
                  />
                </FormControl>
                <FormDescription>These will be displayed as bullet points on the pricing page.</FormDescription>
                <FormMessage />
              </FormItem>

              <FormItem name="isActive">
                <div className={styles.switchRow}>
                  <div>
                    <FormLabel>Active status</FormLabel>
                    <FormDescription>Can teachers purchase this plan?</FormDescription>
                  </div>
                  <FormControl>
                    <div title={isFreePlan ? "Free plan cannot be deactivated" : undefined}>
                      <Switch
                        checked={form.values.isActive}
                        onCheckedChange={(val) => form.setValues(prev => ({ ...prev, isActive: val }))}
                        disabled={isFreePlan}
                      />
                    </div>
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
                {upsertMutation.isPending ? "Saving..." : plan ? "Save plan" : "Create plan"}
              </Button>
            </ConsoleDialogFooter>
          </form>
        </Form>
      </ConsoleDialogContent>
    </Dialog>
  );
};
