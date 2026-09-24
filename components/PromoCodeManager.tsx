import React, { useState, useMemo, useId } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Power,
  Copy,
  MoreHorizontal,
  AlertTriangle,
  Tag,
  CheckCircle2,
  Clock,
  CircleSlash,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Selectable } from 'kysely';
import { PromoCodes, PromoCodeAppliesTo } from '../helpers/schema';
import { useTeacherPromoCodesQuery } from '../helpers/useTeacherPromoCodes';
import { useDeletePromoCodeMutation } from '../helpers/usePromoCodeMutations';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { PromoCodeFormDialog } from './PromoCodeFormDialog';
import { TeacherPageHeader } from './TeacherPageHeader';
import { TeacherListToolbar, type TeacherListTab } from './TeacherListToolbar';
import { TeacherListEmpty } from './TeacherListEmpty';
import { TeacherListPagination } from './TeacherListPagination';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './DropdownMenu';
import { toast } from 'sonner';
import styles from './PromoCodeManager.module.css';

type PromoStatus = 'active' | 'scheduled' | 'expired';

const STATUS_TABS: TeacherListTab[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'expired', label: 'Expired' },
];

const STATUS_VALUES: PromoStatus[] = ['active', 'scheduled', 'expired'];

const PAGE_SIZE = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

type PromoCode = Selectable<PromoCodes>;

/* Finer than the tabs: Expired, Used up and Deactivated all sit under the
   Expired tab, but the row says which one it is. The list endpoint filters
   by the same rules. */
type RowState = 'active' | 'scheduled' | 'ended' | 'usedUp' | 'off';

const rowStateOf = (pc: PromoCode, now: Date): RowState => {
  if (!pc.isActive) return 'off';
  if (pc.validUntil && now > new Date(pc.validUntil)) return 'ended';
  if (pc.usageLimit !== null && pc.usageCount >= pc.usageLimit) return 'usedUp';
  if (now < new Date(pc.validFrom)) return 'scheduled';
  return 'active';
};

// Every state is a word with its own icon, never colour alone.
const STATE_META: Record<RowState, { label: string; icon: React.ElementType; className: string }> = {
  active: { label: 'Active', icon: CheckCircle2, className: styles.stateActive },
  scheduled: { label: 'Scheduled', icon: Clock, className: styles.stateScheduled },
  ended: { label: 'Expired', icon: CircleSlash, className: styles.stateEnded },
  usedUp: { label: 'Used up', icon: CircleSlash, className: styles.stateEnded },
  off: { label: 'Deactivated', icon: Power, className: styles.stateEnded },
};

const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });

const describeState = (pc: PromoCode, state: RowState, now: Date): string => {
  switch (state) {
    case 'active': {
      if (!pc.validUntil) return 'No end date';
      const until = new Date(pc.validUntil);
      const left = until.getTime() - now.getTime();
      if (left < DAY_MS) return `Ends at ${timeFormat.format(until)}`;
      const days = Math.ceil(left / DAY_MS);
      return days <= 14 ? `Ends in ${days} days` : `Ends ${dateFormat.format(until)}`;
    }
    case 'scheduled':
      return `Starts ${dateFormat.format(new Date(pc.validFrom))}`;
    case 'ended':
      return `Ended ${dateFormat.format(new Date(pc.validUntil!))}`;
    case 'usedUp':
      return `All ${pc.usageLimit} uses taken`;
    case 'off':
      return 'No longer accepted at checkout';
  }
};

const KIND_LABELS: Record<Exclude<PromoCodeAppliesTo, 'all'>, [string, string]> = {
  courses: ['course', 'courses'],
  tests: ['test series', 'test series'],
  live_tests: ['live test', 'live tests'],
  bundles: ['bundle', 'bundles'],
  digital_products: ['note or PDF', 'notes and PDFs'],
};

/* What a student needs to know before the code works for them, in the order
   they would hit it: what it covers, the minimum order, the cap, how often. */
const describeTerms = (pc: PromoCode): string => {
  const parts: string[] = [];
  if (pc.appliesTo === 'all') {
    parts.push('Everything you sell');
  } else {
    const [one, many] = KIND_LABELS[pc.appliesTo];
    const picked = pc.targetItemIds?.length ?? 0;
    parts.push(picked > 0 ? `${picked} selected ${picked === 1 ? one : many}` : `All ${many}`);
  }
  const minOrder = Number(pc.minPurchaseAmount ?? 0);
  if (minOrder > 0) parts.push(`orders of ${rupees.format(minOrder)} or more`);
  const cap = Number(pc.maxDiscountAmount ?? 0);
  if (pc.discountType === 'percentage' && cap > 0) parts.push(`up to ${rupees.format(cap)} off`);
  if (pc.perUserLimit) {
    parts.push(pc.perUserLimit === 1 ? 'once per student' : `${pc.perUserLimit} times per student`);
  }
  return parts.join(', ');
};

const stubValueOf = (pc: PromoCode) =>
  pc.discountType === 'percentage'
    ? `${Number(pc.discountValue)}%`
    : rupees.format(Number(pc.discountValue));

const STUB_CLASS: Record<RowState, string> = {
  active: styles.stubActive,
  scheduled: styles.stubScheduled,
  ended: styles.stubMuted,
  usedUp: styles.stubMuted,
  off: styles.stubMuted,
};

interface PromoRowProps {
  promoCode: PromoCode;
  now: Date;
  onCopy: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
}

const PromoRow: React.FC<PromoRowProps> = ({ promoCode: pc, now, onCopy, onEdit, onDeactivate }) => {
  const state = rowStateOf(pc, now);
  const meta = STATE_META[state];
  const StateIcon = meta.icon;
  const used = pc.usageCount;
  const limit = pc.usageLimit;
  const usedShare = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const canDeactivate = state === 'active' || state === 'scheduled';
  const stubValue = stubValueOf(pc);

  return (
    <li className={styles.row}>
      <div className={`${styles.stub} ${STUB_CLASS[state]}`}>
        <span className={`${styles.stubValue} ${stubValue.length > 5 ? styles.stubLong : ''}`}>{stubValue}</span>
        <span className={styles.stubUnit}>off</span>
      </div>

      <div className={styles.codeCell}>
        <div className={styles.codeLine}>
          <span className={styles.code}>{pc.code}</span>
          <button
            type="button"
            className={styles.copyButton}
            onClick={onCopy}
            aria-label={`Copy ${pc.code}`}
            title="Copy code"
          >
            <Copy size={15} aria-hidden="true" />
          </button>
        </div>
        <span className={styles.terms}>{describeTerms(pc)}</span>
        <span className={styles.visibility}>
          {pc.isPublic ? (
            <>
              <Eye size={14} aria-hidden="true" /> Shown on product pages
            </>
          ) : (
            <>
              <EyeOff size={14} aria-hidden="true" /> Private, you share it
            </>
          )}
        </span>
      </div>

      <div className={styles.usageCell}>
        <span className={styles.usageText}>
          <strong>{used}</strong>
          {limit ? ` of ${limit} used` : ` ${used === 1 ? 'use' : 'uses'}`}
        </span>
        {limit ? (
          <span className={styles.meter} aria-hidden="true">
            <span className={styles.meterFill} style={{ width: `${usedShare}%` }} />
          </span>
        ) : (
          <span className={styles.usageNote}>No limit</span>
        )}
      </div>

      <div className={styles.statusCell}>
        <span className={`${styles.state} ${meta.className}`}>
          <StateIcon size={15} aria-hidden="true" />
          {meta.label}
        </span>
        <span className={styles.stateDetail}>{describeState(pc, state, now)}</span>
      </div>

      <div className={styles.actionsCell}>
        <button type="button" className={styles.rowButton} onClick={onEdit} aria-label={`Edit ${pc.code}`}>
          <Pencil size={15} aria-hidden="true" />
          Edit
        </button>
        {/* Non-modal so the dialog it opens does not inherit its pointer lock. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button type="button" className={styles.iconButton} aria-label={`More actions for ${pc.code}`}>
              <MoreHorizontal size={18} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onCopy} className={styles.menuItem}>
              <Copy size={16} aria-hidden="true" />
              Copy code
            </DropdownMenuItem>
            {canDeactivate && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onDeactivate} className={`${styles.menuItem} ${styles.menuDanger}`}>
                  <Power size={16} aria-hidden="true" />
                  Deactivate
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
};

const PromoListHead: React.FC = () => (
  <div className={styles.listHead} aria-hidden="true">
    <span>Discount</span>
    <span>Code and terms</span>
    <span>Uses</span>
    <span>Status</span>
    <span />
  </div>
);

const PromoCodeManagerSkeleton: React.FC = () => (
  <div className={styles.panel} aria-busy="true" aria-label="Loading promo codes">
    <PromoListHead />
    {Array.from({ length: 4 }).map((_, i) => (
      <div className={styles.skeletonRow} key={i}>
        <Skeleton className={styles.skeletonStub} />
        <div className={styles.skeletonText}>
          <Skeleton className={styles.skeletonCode} />
          <Skeleton className={styles.skeletonMeta} />
        </div>
      </div>
    ))}
  </div>
);

export const PromoCodeManager: React.FC<{ className?: string }> = ({ className }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPromoCode, setEditingPromoCode] = useState<Selectable<PromoCodes> | null>(null);
  const [deletingPromoCodeId, setDeletingPromoCodeId] = useState<number | null>(null);

  const panelId = useId();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const statusParam = searchParams.get('status');
  const statusFilter = STATUS_VALUES.includes(statusParam as PromoStatus) ? (statusParam as PromoStatus) : null;

  const { data, isFetching, error } = useTeacherPromoCodesQuery({
    page,
    limit: PAGE_SIZE,
    status: statusFilter,
  });

  // One clock per fetch, so every row is judged against the same moment.
  const now = useMemo(() => new Date(), [data]);

  const handleSetFilter = (newStatus: string) => {
    setSearchParams(prev => {
      if (newStatus === 'all') {
        prev.delete('status');
      } else {
        prev.set('status', newStatus);
      }
      prev.set('page', '1');
      return prev;
    });
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams(prev => {
      prev.set('page', String(newPage));
      return prev;
    });
  };

  const handleCreate = () => {
    setEditingPromoCode(null);
    setIsFormOpen(true);
  };

  const handleEdit = (promoCode: Selectable<PromoCodes>) => {
    setEditingPromoCode(promoCode);
    setIsFormOpen(true);
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code)
      .then(() => toast.success(`Copied "${code}" to clipboard.`))
      .catch(() => toast.error('Could not copy the code. Select it and copy manually.'));
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const renderContent = () => {
    if (isFetching && !data) {
      return <PromoCodeManagerSkeleton />;
    }

    if (error) {
      return (
        <TeacherListEmpty
          tone="error"
          icon={<AlertTriangle size={26} />}
          title="Could not load your promo codes"
          description={error instanceof Error ? error.message : 'Something went wrong on our side.'}
        />
      );
    }

    if (!data || data.promoCodes.length === 0) {
      return statusFilter ? (
        <TeacherListEmpty
          icon={<Tag size={26} />}
          title={`No ${statusFilter} promo codes`}
          description="Try another status, or create a code to start discounting."
        >
          <Button variant="outline" onClick={() => handleSetFilter('all')}>
            Show all codes
          </Button>
          <Button onClick={handleCreate}>
            <Plus size={16} /> Create promo code
          </Button>
        </TeacherListEmpty>
      ) : (
        <TeacherListEmpty
          icon={<Tag size={26} />}
          title="No promo codes yet"
          description="A promo code takes money off at checkout. Students type it in, or copy it from your product pages if you choose to show it there."
        >
          <Button onClick={handleCreate}>
            <Plus size={16} /> Create promo code
          </Button>
        </TeacherListEmpty>
      );
    }

    return (
      <>
        <div className={styles.panel}>
          <PromoListHead />
          <ul className={styles.list} aria-label="Promo codes">
            {data.promoCodes.map((pc) => (
              <PromoRow
                key={pc.id}
                promoCode={pc}
                now={now}
                onCopy={() => handleCopy(pc.code)}
                onEdit={() => handleEdit(pc)}
                onDeactivate={() => setDeletingPromoCodeId(pc.id)}
              />
            ))}
          </ul>
        </div>
        {data.total > PAGE_SIZE && (
          <TeacherListPagination
            page={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </>
    );
  };

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <TeacherPageHeader title="Promo Codes">
        <Button onClick={handleCreate}>
          <Plus size={16} /> Create promo code
        </Button>
      </TeacherPageHeader>

      <TeacherListToolbar
        tabs={STATUS_TABS}
        value={statusFilter ?? 'all'}
        onValueChange={handleSetFilter}
        tabsLabel="Filter promo codes by status"
        panelId={panelId}
      />

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${panelId}-tab-${statusFilter ?? 'all'}`}
        className={styles.content}
      >
        {renderContent()}
      </div>

      <PromoCodeFormDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        promoCode={editingPromoCode}
      />

      <DeactivateDialog
        promoCodeId={deletingPromoCodeId}
        onClose={() => setDeletingPromoCodeId(null)}
      />
    </div>
  );
};

/*
 * One controlled dialog for the whole list. It used to be a DialogTrigger per
 * row, and the row menu's trigger sat outside its Dialog entirely - so
 * Deactivate from the phone menu did nothing.
 */
const DeactivateDialog: React.FC<{ promoCodeId: number | null; onClose: () => void }> = ({
  promoCodeId,
  onClose,
}) => {
  const { mutate: deletePromoCode, isPending } = useDeletePromoCodeMutation();

  const handleDelete = () => {
    if (promoCodeId === null) return;
    deletePromoCode({ promoCodeId }, { onSuccess: onClose });
  };

  return (
    <Dialog open={promoCodeId !== null} onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <span className={styles.dialogTitleContainer}>
              <AlertTriangle size={20} className={styles.warningIcon} />
              Deactivate this promo code?
            </span>
          </DialogTitle>
          <DialogDescription>
            Students will no longer be able to apply it at checkout. Orders already placed with it
            are unaffected. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? 'Deactivating...' : 'Deactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
