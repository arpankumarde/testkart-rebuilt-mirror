import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Edit, Trash2, Copy, MoreVertical, AlertTriangle, Tag } from 'lucide-react';
import { Selectable } from 'kysely';
import { PromoCodes } from '../helpers/schema';
import { useTeacherPromoCodesQuery } from '../helpers/useTeacherPromoCodes';
import { useDeletePromoCodeMutation } from '../helpers/usePromoCodeMutations';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { Badge } from './Badge';
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

const getPromoCodeStatus = (promoCode: Selectable<PromoCodes>): PromoStatus => {
  const now = new Date();
  const validFrom = new Date(promoCode.validFrom);
  const validUntil = promoCode.validUntil ? new Date(promoCode.validUntil) : null;

  if (!promoCode.isActive) return 'expired';
  if (validUntil && now > validUntil) return 'expired';
  if (promoCode.usageLimit && promoCode.usageCount >= promoCode.usageLimit) return 'expired';
  if (now < validFrom) return 'scheduled';

  return 'active';
};

const HEADER_CELLS = ['Code', 'Discount', 'Applies to', 'Usage', 'Expires', 'Status', 'Actions'];

const PromoCodeManagerSkeleton: React.FC = () => (
  <div className={styles.panel}>
    <div className={styles.tableContainer}>
      <div className={styles.table}>
        <div className={styles.tableHeader}>
          {HEADER_CELLS.map((label) => (
            <div className={styles.headerCell} key={label}>
              {label}
            </div>
          ))}
        </div>
        <div className={styles.tableBody}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div className={styles.tableRow} key={i}>
              <div className={styles.cell}><Skeleton style={{ height: '1rem', width: '80px' }} /></div>
              <div className={styles.cell}><Skeleton style={{ height: '1rem', width: '60px' }} /></div>
              <div className={styles.cell}><Skeleton style={{ height: '1rem', width: '70px' }} /></div>
              <div className={styles.cell}><Skeleton style={{ height: '1rem', width: '40px' }} /></div>
              <div className={styles.cell}><Skeleton style={{ height: '1rem', width: '100px' }} /></div>
              <div className={styles.cell}><Skeleton style={{ height: '1.5rem', width: '70px', borderRadius: 'var(--radius-full)' }} /></div>
              <div className={styles.cell}><Skeleton style={{ height: '2rem', width: '80px' }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const PromoCodeManager: React.FC<{ className?: string }> = ({ className }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPromoCode, setEditingPromoCode] = useState<Selectable<PromoCodes> | null>(null);
  const [deletingPromoCodeId, setDeletingPromoCodeId] = useState<number | null>(null);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const statusFilter = searchParams.get('status') as PromoStatus | null;

  const { data, isFetching, error } = useTeacherPromoCodesQuery({
    page,
    limit: 10,
    status: statusFilter,
  });

  const promoCodesWithStatus = useMemo(() => {
    return data?.promoCodes.map(pc => ({
      ...pc,
      status: getPromoCodeStatus(pc),
    })) ?? [];
  }, [data?.promoCodes]);

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

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 10)) : 1;

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
          description="Promo codes let you discount a test series, course or your whole catalogue for a set period."
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
          <div className={styles.tableContainer}>
            <div className={styles.table}>
              <div className={styles.tableHeader}>
                {HEADER_CELLS.map((label) => (
                  <div className={styles.headerCell} key={label}>
                    {label}
                  </div>
                ))}
              </div>
              <div className={styles.tableBody}>
                {promoCodesWithStatus.map((pc) => (
                  <div className={styles.tableRow} key={pc.id}>
                    <div className={styles.cell} data-label="Code">
                      <span className={styles.codeText}>{pc.code}</span>
                    </div>
                    <div className={styles.cell} data-label="Discount">
                      {pc.discountType === 'percentage'
                        ? `${pc.discountValue}%`
                        : `₹${pc.discountValue}`}
                    </div>
                    <div className={styles.cell} data-label="Applies to">
                      {pc.appliesTo.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    <div className={styles.cell} data-label="Usage">
                      {pc.usageCount} / {pc.usageLimit ?? '∞'}
                    </div>
                    <div className={styles.cell} data-label="Expires">
                      {pc.validUntil ? new Date(pc.validUntil).toLocaleDateString() : 'Never'}
                    </div>
                    <div className={styles.cell} data-label="Status">
                      <Badge variant={pc.status === 'active' ? 'success' : pc.status === 'scheduled' ? 'warning' : 'secondary'}>
                        {pc.status.charAt(0).toUpperCase() + pc.status.slice(1)}
                      </Badge>
                    </div>
                    <div className={`${styles.cell} ${styles.actionsCell}`} data-label="Actions">
                      <div className={styles.desktopActions}>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(pc)}>Edit</Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={styles.deleteButton}
                          onClick={() => setDeletingPromoCodeId(pc.id)}
                        >
                          Deactivate
                        </Button>
                      </div>
                      <div className={styles.mobileActions}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${pc.code}`}>
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className={styles.menuItem} onClick={() => handleCopy(pc.code)}>
                              <Copy size={14} /> Copy code
                            </DropdownMenuItem>
                            <DropdownMenuItem className={styles.menuItem} onClick={() => handleEdit(pc)}>
                              <Edit size={14} /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className={`${styles.menuItem} ${styles.destructive}`}
                              onClick={() => setDeletingPromoCodeId(pc.id)}
                            >
                              <Trash2 size={14} /> Deactivate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {data.total > 10 && (
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
      />

      {renderContent()}

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
