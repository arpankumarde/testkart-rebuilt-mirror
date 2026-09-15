import React from "react";
import { Input } from "./Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { Button } from "./Button";
import { Search, X } from "lucide-react";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { OrderStatus, OrderStatusArrayValues } from "../helpers/schema";
import styles from "./AdminTransactionsTableFilter.module.css";

export interface FilterState {
  search: string;
  status: OrderStatus | "__all";
  dateFrom: string;
  dateTo: string;
  paymentMethod: string;
}

const LIST_FILTERS = ["stale-pending"] as const;
export type TransactionsListFilter = (typeof LIST_FILTERS)[number];

/*
 * Status and the dashboard-only filter live in the URL, so a dashboard tile
 * lands on exactly the orders it counted. Absent status means all statuses.
 */
export const useTransactionsListParams = () => {
  const { read, write } = useListUrlParams();
  const status = read<OrderStatus | "__all">("status", OrderStatusArrayValues, "__all");
  const listFilter = read<TransactionsListFilter | "">("filter", LIST_FILTERS, "");
  return { status, listFilter, write };
};

export const FilterSection: React.FC<{
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClearFilters: () => void;
  hasListFilter: boolean;
  knownPaymentMethods: { value: string; label: string }[];
  dynamicPaymentMethods: string[];
}> = ({ filters, onFilterChange, onClearFilters, hasListFilter, knownPaymentMethods, dynamicPaymentMethods }) => {
  const hasActiveFilters = 
    filters.search || 
    filters.status !== "__all" || 
    filters.dateFrom || 
    filters.dateTo || 
    filters.paymentMethod !== "__all" ||
    hasListFilter;

  return (
    <div className={styles.filterSection}>
      <div className={styles.filterGrid}>
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Search</label>
          <div className={styles.searchInputWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <Input
              type="search"
              placeholder="Student name, email or phone..."
              value={filters.search}
              onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Status</label>
          <Select
            value={filters.status}
            onValueChange={(value) => onFilterChange({ ...filters, status: value as FilterState["status"] })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Payment Method</label>
          <Select
            value={filters.paymentMethod}
            onValueChange={(value) => onFilterChange({ ...filters, paymentMethod: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All methods" />
            </SelectTrigger>
          <SelectContent>
              <SelectItem value="__all">All Methods</SelectItem>
              {knownPaymentMethods.map((method) => (
                <SelectItem key={method.value} value={method.value}>
                  {method.label}
                </SelectItem>
              ))}
              {dynamicPaymentMethods.map((method) => (
                <SelectItem key={method} value={method}>
                  {method.charAt(0).toUpperCase() + method.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>From Date</label>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onFilterChange({ ...filters, dateFrom: e.target.value })}
          />
        </div>

        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>To Date</label>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onFilterChange({ ...filters, dateTo: e.target.value })}
          />
        </div>

        <div className={styles.filterItemButton}>
          <Button
            variant="outline"
            onClick={onClearFilters}
            disabled={!hasActiveFilters}
          >
            <X size={16} />
            Clear Filters
          </Button>
        </div>
      </div>
    </div>
  );
};