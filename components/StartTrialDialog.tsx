import React, { useState, useRef, useEffect } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Search, Loader2 } from "lucide-react";
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
  FormDescription,
  FormMessage,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { Textarea } from "./Textarea";
import { Switch } from "./Switch";
import { Badge } from "./Badge";
import { DatePicker } from "./DatePicker";
import {
  useAdminSearchTeachers,
  useAdminStartTrial,
} from "../helpers/adminSubscriptionsHooks";
import { useAdminTeacherOrders } from "../helpers/useAdminTeacherOrders";
import { useDebounce } from "../helpers/useDebounce";
import styles from "./StartTrialDialog.module.css";

const formSchema = z.object({
  teacherId: z.number({ required_error: "Please select a teacher from the list" }).positive("Please select a valid teacher"),
  platformFeePercentage: z.number().min(0).max(100),
  durationDays: z.number().int().min(1).max(365),
  note: z.string().optional(),
  retroactiveFromOrderItemId: z.number().positive().optional(),
  retroactiveFromDate: z.string().optional(),
});

const formatDate = (date: Date | null | string) => {
  if (!date) return "Unknown date";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(date));
};

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(price);
};

const formatProductType = (type: string) => {
  const label = type.replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
};

interface StartTrialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StartTrialDialog({ open, onOpenChange }: StartTrialDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const { data: searchResults, isFetching } = useAdminSearchTeachers(debouncedSearch);
  const [isRetroactive, setIsRetroactive] = useState(false);
  const [retroactiveMode, setRetroactiveMode] = useState<"orders" | "date">("orders");

  const startTrial = useAdminStartTrial();

  const form = useForm({
    defaultValues: {
      platformFeePercentage: 30,
      durationDays: 30,
      note: "",
      retroactiveFromOrderItemId: undefined,
    },
    schema: formSchema,
  });

  const teacherId = form.values.teacherId;
  const { data: teacherOrdersData, isFetching: isFetchingOrders } = useAdminTeacherOrders(
    teacherId || 0,
    isRetroactive
  );

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.setValues({
        teacherId: undefined as any,
        platformFeePercentage: 30,
        durationDays: 30,
        note: "",
        retroactiveFromOrderItemId: undefined,
        retroactiveFromDate: undefined,
      });
      setSearchQuery("");
      setIsDropdownOpen(false);
      setIsRetroactive(false);
      setRetroactiveMode("orders");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (isRetroactive) {
      if (retroactiveMode === "orders" && !values.retroactiveFromOrderItemId) {
        form.setFieldError("retroactiveFromOrderItemId", "Please select a transaction to start retroactive changes from");
        return;
      }
      if (retroactiveMode === "date" && !values.retroactiveFromDate) {
        form.setFieldError("retroactiveFromDate", "Please select a date to start retroactive changes from");
        return;
      }
    }

    startTrial.mutate(
      {
        teacherId: values.teacherId,
        platformFeePercentage: values.platformFeePercentage,
        durationDays: values.durationDays,
        note: values.note || undefined,
        retroactiveFromOrderItemId: isRetroactive && retroactiveMode === "orders" ? values.retroactiveFromOrderItemId : undefined,
        retroactiveFromDate: isRetroactive && retroactiveMode === "date" ? values.retroactiveFromDate : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Trial started successfully");
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to start trial");
        },
      }
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!startTrial.isPending) {
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <ConsoleDialogContent size="lg">
        <ConsoleDialogHeader
          title="Start custom commission trial"
          description="Override the platform fee for a specific teacher for a limited duration."
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ConsoleDialogBody>
              <FormItem name="teacherId" className={styles.relativeItem}>
                <FormLabel>Teacher</FormLabel>
                <div className={styles.searchContainer} ref={searchContainerRef}>
                  <Search className={styles.searchIcon} />
                  <FormControl>
                    <Input
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setIsDropdownOpen(true);
                        form.setValues((prev) => ({
                          ...prev,
                          teacherId: undefined as any,
                          retroactiveFromOrderItemId: undefined
                        }));
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      className={styles.searchInput}
                      autoComplete="off"
                    />
                  </FormControl>

                  {isDropdownOpen && debouncedSearch.length >= 2 && (
                    <div className={styles.dropdown}>
                      {isFetching ? (
                        <div className={styles.dropdownLoading}>
                          <Loader2 className={styles.spinner} />
                          <span>Searching...</span>
                        </div>
                      ) : searchResults?.teachers && searchResults.teachers.length > 0 ? (
                        <ul className={styles.dropdownList}>
                          {searchResults.teachers.map((teacher) => (
                            <li
                              key={teacher.id}
                              className={styles.dropdownItem}
                              onClick={() => {
                                form.setValues((prev) => ({
                                  ...prev,
                                  teacherId: teacher.id,
                                  retroactiveFromOrderItemId: undefined
                                }));
                                setSearchQuery(teacher.displayName);
                                setIsDropdownOpen(false);
                                form.validateField("teacherId");
                              }}
                            >
                              <span className={styles.teacherName}>{teacher.displayName}</span>
                              {teacher.email && (
                                <span className={styles.teacherEmail}>{teacher.email}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className={styles.dropdownEmpty}>No teachers found.</div>
                      )}
                    </div>
                  )}
                </div>
                <FormMessage />
              </FormItem>

              <div className={styles.row}>
                <FormItem name="platformFeePercentage" className={styles.flex1}>
                  <FormLabel>Platform fee %</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={form.values.platformFeePercentage}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        form.setValues((prev) => ({
                          ...prev,
                          platformFeePercentage: isNaN(val) ? 0 : val,
                        }));
                      }}
                    />
                  </FormControl>
                  <FormDescription>Default is 30%.</FormDescription>
                  <FormMessage />
                </FormItem>

                <FormItem name="durationDays" className={styles.flex1}>
                  <FormLabel>Duration (days)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="365"
                      value={form.values.durationDays}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        form.setValues((prev) => ({
                          ...prev,
                          durationDays: isNaN(val) ? 0 : val,
                        }));
                      }}
                    />
                  </FormControl>
                  <div className={styles.presets}>
                    {[30, 60, 90, 180].map((days) => (
                      <Button
                        key={days}
                        type="button"
                        variant="outline"
                        size="sm"
                        className={styles.presetButton}
                        onClick={() => {
                          form.setValues((prev) => ({ ...prev, durationDays: days }));
                          form.validateField("durationDays");
                        }}
                      >
                        {days}d
                      </Button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              </div>

              <FormItem name="note">
                <FormLabel>Note (optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="e.g. Onboarding promotion, special deal..."
                    value={form.values.note}
                    onChange={(e) =>
                      form.setValues((prev) => ({ ...prev, note: e.target.value }))
                    }
                    rows={2}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="retroactiveFromOrderItemId" className={styles.switchField}>
                <div className={styles.switchHeader}>
                  <div className={styles.switchControl}>
                    <Switch
                      checked={isRetroactive}
                      onCheckedChange={(checked) => {
                        setIsRetroactive(checked);
                        if (!checked) {
                          form.setValues((prev) => ({
                            ...prev,
                            retroactiveFromOrderItemId: undefined,
                            retroactiveFromDate: undefined
                          }));
                          form.validateField("retroactiveFromOrderItemId", { shallow: true });
                          form.validateField("retroactiveFromDate", { shallow: true });
                        }
                      }}
                    />
                  </div>
                  <div className={styles.switchLabels}>
                    <FormLabel className={styles.switchLabel} onClick={() => setIsRetroactive(!isRetroactive)}>
                      Apply retroactively to past orders
                    </FormLabel>
                    <FormDescription>
                      Updates commission on all past completed orders for this teacher.
                    </FormDescription>
                  </div>
                </div>

                {isRetroactive && (
                  <div className={styles.retroactiveContent}>
                    <div className={styles.modeToggle}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={retroactiveMode === "orders" ? styles.modeActive : undefined}
                        aria-pressed={retroactiveMode === "orders"}
                        onClick={() => {
                          setRetroactiveMode("orders");
                          form.setValues(prev => ({ ...prev, retroactiveFromDate: undefined }));
                          form.validateField("retroactiveFromDate", { shallow: true });
                        }}
                      >
                        Select from orders
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={retroactiveMode === "date" ? styles.modeActive : undefined}
                        aria-pressed={retroactiveMode === "date"}
                        onClick={() => {
                          setRetroactiveMode("date");
                          form.setValues(prev => ({ ...prev, retroactiveFromOrderItemId: undefined }));
                          form.validateField("retroactiveFromOrderItemId", { shallow: true });
                        }}
                      >
                        Select by date
                      </Button>
                    </div>

                    {retroactiveMode === "orders" ? (
                      !form.values.teacherId ? (
                        <div className={styles.emptyState}>Please select a teacher to view past orders.</div>
                      ) : isFetchingOrders ? (
                        <div className={styles.loadingState}>
                          <Loader2 className={styles.spinner} />
                          Loading past orders...
                        </div>
                      ) : !teacherOrdersData?.orderItems || teacherOrdersData.orderItems.length === 0 ? (
                        <div className={styles.emptyState}>No past orders found for this teacher.</div>
                      ) : (
                        <>
                          <div className={styles.orderListContainer}>
                            {teacherOrdersData.orderItems.map((order) => {
                              const isSelected = form.values.retroactiveFromOrderItemId === order.orderItemId;
                              return (
                                <div
                                  key={order.orderItemId}
                                  className={`${styles.orderItem} ${isSelected ? styles.orderItemSelected : ""}`}
                                  onClick={() => {
                                    form.setValues((prev) => ({ ...prev, retroactiveFromOrderItemId: order.orderItemId }));
                                    form.validateField("retroactiveFromOrderItemId", { shallow: true });
                                  }}
                                >
                                  <div className={styles.orderHeader}>
                                    <span className={styles.orderTitle}>{order.productName}</span>
                                    <span className={styles.orderDate}>{formatDate(order.orderDate)}</span>
                                  </div>
                                  <div className={styles.orderMeta}>
                                    <div className={styles.orderMetaLeft}>
                                      <Badge variant="outline" className={styles.typeBadge}>
                                        {formatProductType(order.productType)}
                                      </Badge>
                                      <span>{order.studentName}</span>
                                    </div>
                                    <div className={styles.orderMetaRight}>
                                      <span>{formatPrice(order.priceAtPurchase)}</span>
                                      <span className={styles.feeText}>{order.currentPlatformFee}% fee</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <FormDescription>
                            Commission will be updated for this and all newer transactions.
                          </FormDescription>
                          <FormMessage />
                        </>
                      )
                    ) : (
                      <FormItem name="retroactiveFromDate">
                        <FormControl>
                          <DatePicker
                            value={form.values.retroactiveFromDate ? new Date(form.values.retroactiveFromDate) : undefined}
                            onChange={(date) => {
                              form.setValues((prev) => ({
                                ...prev,
                                retroactiveFromDate: date ? date.toISOString() : undefined
                              }));
                              form.validateField("retroactiveFromDate", { shallow: true });
                            }}
                            showTime={false}
                          />
                        </FormControl>
                        <FormDescription>
                          Commission will be updated for all transactions from this date onwards.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  </div>
                )}
              </FormItem>
            </ConsoleDialogBody>

            <ConsoleDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={startTrial.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={startTrial.isPending}>
                {startTrial.isPending ? (
                  <>
                    <Loader2 className={`${styles.spinner} ${styles.mr2}`} />
                    Starting trial...
                  </>
                ) : (
                  "Start trial"
                )}
              </Button>
            </ConsoleDialogFooter>
          </form>
        </Form>
      </ConsoleDialogContent>
    </Dialog>
  );
}