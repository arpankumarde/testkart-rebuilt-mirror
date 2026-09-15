import React, { useEffect, useState, useMemo } from 'react';
import { z } from 'zod';
import { Selectable } from 'kysely';
import { PromoCodes, DiscountTypeArrayValues, PromoCodeAppliesToArrayValues } from '../helpers/schema';
import { useForm, Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from './Form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './Dialog';
import { Input } from './Input';
import { Button } from './Button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './Select';
import { DatePicker } from './DatePicker';
import { Checkbox } from './Checkbox';
import { Popover, PopoverTrigger, PopoverContent } from './Popover';
import { useCreatePromoCodeMutation, useUpdatePromoCodeMutation } from '../helpers/usePromoCodeMutations';
import { useTeacherCoursesQuery } from '../helpers/useTeacherCoursesQuery';
import { useTeacherTestsQuery } from '../helpers/useTeacherTestsQuery';
import { useTeacherLiveTestsQuery } from '../helpers/useTeacherLiveTestsQuery';
import { useTeacherBundlesQuery } from '../helpers/useTeacherBundlesQuery';
import { useTeacherProductsQuery } from '../helpers/useTeacherProductsQuery';
import { ChevronDown, Check, Search } from 'lucide-react';
import styles from './PromoCodeFormDialog.module.css';

interface PromoCodeFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  promoCode?: Selectable<PromoCodes> | null;
}

const formSchema = z.object({
  code: z.string().min(3, "Code must be at least 3 characters").max(50, "Code cannot exceed 50 characters").toUpperCase(),
  discountType: z.enum(DiscountTypeArrayValues),
  discountValue: z.number().positive("Discount value must be positive"),
  appliesTo: z.enum(PromoCodeAppliesToArrayValues),
  targetItemIds: z.array(z.number().int().positive()).optional(),
  minPurchaseAmount: z.number().nonnegative().optional().nullable(),
  maxDiscountAmount: z.number().positive().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().optional().nullable(),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional(),
}).refine(data => {
  if (data.discountType === 'percentage') {
    return data.discountValue <= 100;
  }
  return true;
}, {
  message: "Percentage discount cannot exceed 100",
  path: ["discountValue"],
}).refine(data => {
  if (data.validUntil && data.validFrom) {
    return data.validUntil > data.validFrom;
  }
  return true;
}, {
  message: "End date must be after start date",
  path: ["validUntil"],
});

type FormValues = z.infer<typeof formSchema>;

const MultiSelectPopover: React.FC<{
  label: string;
  options: { id: number; title: string }[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  isLoading: boolean;
}> = ({ label, options, selectedIds, onSelectionChange, isLoading }) => {
  const [search, setSearch] = useState('');
  const filteredOptions = useMemo(() => 
    options.filter(opt => opt.title.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  const handleToggle = (id: number) => {
    const newSelection = selectedIds.includes(id)
      ? selectedIds.filter(sid => sid !== id)
      : [...selectedIds, id];
    onSelectionChange(newSelection);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={styles.popoverTrigger}>
          <span>{selectedIds.length > 0 ? `${selectedIds.length} selected` : `Select ${label}`}</span>
          <ChevronDown size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent className={styles.popoverContent} sideOffset={5}>
        <div className={styles.searchContainer}>
          <Search size={16} className={styles.searchIcon} />
          <Input 
            placeholder={`Search ${label}...`} 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.optionsList}>
          {isLoading ? (
            <div className={styles.loadingText}>Loading...</div>
          ) : filteredOptions.length > 0 ? (
            filteredOptions.map(opt => (
              <button key={opt.id} type="button" className={styles.optionItem} onClick={() => handleToggle(opt.id)}>
                <Checkbox checked={selectedIds.includes(opt.id)} readOnly />
                <span className={styles.optionLabel}>{opt.title}</span>
              </button>
            ))
          ) : (
            <div className={styles.loadingText}>No {label} found.</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const PromoCodeFormDialog: React.FC<PromoCodeFormDialogProps> = ({ isOpen, onOpenChange, promoCode }) => {
  const isEditMode = !!promoCode;
  const { mutate: createPromoCode, isPending: isCreating } = useCreatePromoCodeMutation();
  const { mutate: updatePromoCode, isPending: isUpdating } = useUpdatePromoCodeMutation();

  const { data: coursesData, isFetching: coursesLoading } = useTeacherCoursesQuery();
  const { data: testsData, isFetching: testsLoading } = useTeacherTestsQuery();
  // The picker lists every live test; the endpoint's default page holds only 10.
  const { data: liveTestsData, isFetching: liveTestsLoading } = useTeacherLiveTestsQuery({ limit: 1000 });
  const { data: bundlesData, isFetching: bundlesLoading } = useTeacherBundlesQuery({ page: "1", limit: "100" });
  const { data: productsData, isFetching: productsLoading } = useTeacherProductsQuery({ page: 1, limit: 100 });

  const form = useForm({
    schema: formSchema,
    defaultValues: {
      code: '',
      discountType: 'percentage' as const,
      discountValue: 10,
      appliesTo: 'all' as const,
      targetItemIds: [],
      minPurchaseAmount: null,
      maxDiscountAmount: null,
      usageLimit: null,
      perUserLimit: null,
      validFrom: new Date(),
      validUntil: null,
    },
  });

  useEffect(() => {
    if (promoCode) {
      form.setValues({
        code: promoCode.code,
        discountType: promoCode.discountType,
        discountValue: Number(promoCode.discountValue),
        appliesTo: promoCode.appliesTo,
        targetItemIds: promoCode.targetItemIds || [],
        minPurchaseAmount: promoCode.minPurchaseAmount ? Number(promoCode.minPurchaseAmount) : null,
        maxDiscountAmount: promoCode.maxDiscountAmount ? Number(promoCode.maxDiscountAmount) : null,
        usageLimit: promoCode.usageLimit,
        perUserLimit: promoCode.perUserLimit,
        validFrom: new Date(promoCode.validFrom),
        validUntil: promoCode.validUntil ? new Date(promoCode.validUntil) : null,
        isActive: promoCode.isActive,
      });
    } else {
      form.setValues({
        code: '',
        discountType: 'percentage' as const,
        discountValue: 10,
        appliesTo: 'all' as const,
        targetItemIds: [],
        minPurchaseAmount: null,
        maxDiscountAmount: null,
        usageLimit: null,
        perUserLimit: null,
        validFrom: new Date(),
        validUntil: null,
      });
    }
  }, [promoCode, form.setValues]);

  const onSubmit = (values: FormValues) => {
    const mutationOptions = {
      onSuccess: () => {
        onOpenChange(false);
      },
    };

    const payload = {
      ...values,
      targetItemIds: values.appliesTo === 'all' ? [] : values.targetItemIds,
    };

    if (isEditMode && promoCode) {
      updatePromoCode({ ...payload, promoCodeId: promoCode.id }, mutationOptions);
    } else {
      createPromoCode(payload, mutationOptions);
    }
  };

  const isSubmitting = isCreating || isUpdating;

  const itemOptions = useMemo(() => {
    switch (form.values.appliesTo) {
      case 'courses': return coursesData?.map(c => ({ id: c.id, title: c.title })) ?? [];
      case 'tests': return testsData?.map(t => ({ id: t.id, title: t.title })) ?? [];
      case 'live_tests': return liveTestsData?.tests.map(lt => ({ id: lt.id, title: lt.title })) ?? [];
      case 'bundles': return bundlesData?.bundles.map(b => ({ id: b.id, title: b.title })) ?? [];
      case 'digital_products': return productsData?.products.map(p => ({ id: p.id, title: p.title })) ?? [];
      default: return [];
    }
  }, [form.values.appliesTo, coursesData, testsData, liveTestsData, bundlesData, productsData]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Promo Code' : 'Create New Promo Code'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update the details of your existing promo code.' : 'Create a new promo code to offer discounts to your students.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
            <div className={styles.grid}>
              <FormItem name="code">
                <FormLabel>Promo Code</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., LAUNCH20"
                    value={form.values.code}
                    onChange={(e) => form.setValues((p: FormValues) => ({ ...p, code: e.target.value.toUpperCase() }))}
                    disabled={isEditMode}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              <div className={styles.discountFields}>
                <FormItem name="discountType" className={styles.flexItem}>
                  <FormLabel>Discount Type</FormLabel>
                  <FormControl>
                    <Select
                      value={form.values.discountType}
                      onValueChange={(v) => form.setValues((p: FormValues) => ({ ...p, discountType: v as FormValues['discountType'] }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DiscountTypeArrayValues.map(dt => (
                          <SelectItem key={dt} value={dt}>{dt.charAt(0).toUpperCase() + dt.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <FormItem name="discountValue" className={styles.flexItem}>
                  <FormLabel>Value</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g., 10 or 100"
                      value={form.values.discountValue || ''}
                      onChange={(e) => form.setValues((p: FormValues) => ({ ...p, discountValue: parseFloat(e.target.value) || 0 }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </div>
            </div>

            <div className={styles.grid}>
              <FormItem name="appliesTo">
                <FormLabel>Applies To</FormLabel>
                <FormControl>
                  <Select
                    value={form.values.appliesTo}
                    onValueChange={(v) => form.setValues((p: FormValues) => ({ ...p, appliesTo: v as FormValues['appliesTo'], targetItemIds: [] }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PromoCodeAppliesToArrayValues.map(at => (
                        <SelectItem key={at} value={at}>{at.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
              {form.values.appliesTo !== 'all' && (
                <FormItem name="targetItemIds">
                  <FormLabel>Specific Items</FormLabel>
                  <FormControl>
                    <MultiSelectPopover
                      label={form.values.appliesTo.replace('_', ' ')}
                      options={itemOptions}
                      selectedIds={form.values.targetItemIds || []}
                      onSelectionChange={(ids) => form.setValues((p: FormValues) => ({ ...p, targetItemIds: ids }))}
                      isLoading={coursesLoading || testsLoading || liveTestsLoading || bundlesLoading || productsLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            </div>

            <div className={styles.grid}>
              <FormItem name="minPurchaseAmount">
                <FormLabel>Min Purchase (₹)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Optional"
                    value={form.values.minPurchaseAmount || ''}
                    onChange={(e) => form.setValues((p: FormValues) => ({ ...p, minPurchaseAmount: e.target.value ? parseFloat(e.target.value) : null }))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              {form.values.discountType === 'percentage' && (
                <FormItem name="maxDiscountAmount">
                  <FormLabel>Max Discount (₹)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Optional"
                      value={form.values.maxDiscountAmount || ''}
                      onChange={(e) => form.setValues((p: FormValues) => ({ ...p, maxDiscountAmount: e.target.value ? parseFloat(e.target.value) : null }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            </div>

            <div className={styles.grid}>
              <FormItem name="usageLimit">
                <FormLabel>Total Usage Limit</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Optional (e.g., 100)"
                    value={form.values.usageLimit || ''}
                    onChange={(e) => form.setValues((p: FormValues) => ({ ...p, usageLimit: e.target.value ? parseInt(e.target.value, 10) : null }))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              <FormItem name="perUserLimit">
                <FormLabel>Limit Per User</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Optional (e.g., 1)"
                    value={form.values.perUserLimit || ''}
                    onChange={(e) => form.setValues((p: FormValues) => ({ ...p, perUserLimit: e.target.value ? parseInt(e.target.value, 10) : null }))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </div>

            <div className={styles.grid}>
              <FormItem name="validFrom">
                <FormLabel>Starts On</FormLabel>
                <FormControl>
                  <DatePicker
                    value={form.values.validFrom}
                    onChange={(date) => form.setValues((p: FormValues) => ({ ...p, validFrom: date || new Date() }))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              <FormItem name="validUntil">
                <FormLabel>Expires On</FormLabel>
                <FormControl>
                  <DatePicker
                    value={form.values.validUntil || undefined}
                    onChange={(date) => form.setValues((p: FormValues) => ({ ...p, validUntil: date || null }))}
                  />
                </FormControl>
                <FormDescription>Leave blank for no expiry.</FormDescription>
                <FormMessage />
              </FormItem>
            </div>

            <div className={styles.formActions}>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Create Code')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};