import React, { useState } from "react";
import { Search, PackageSearch } from "lucide-react";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "./ConsoleDialog";
import { Input } from "./Input";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { Tabs, TabsList, TabsTrigger } from "./Tabs";
import { Skeleton } from "./Skeleton";
import { useAdminBlogProductSearchQuery } from "../helpers/useAdminBlog";
import { ProductEmbedType, ProductSearchItem } from "../endpoints/admin/blog/product-search_GET.schema";
import { PRODUCT_EMBED_TYPE_LABELS, formatEmbedPrice } from "../helpers/blogProductEmbed";
import styles from "./ProductEmbedPickerDialog.module.css";

interface ProductEmbedPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (items: ProductSearchItem[]) => void;
}

const TYPE_TABS: { value: ProductEmbedType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mock_test", label: PRODUCT_EMBED_TYPE_LABELS.mock_test },
  { value: "digital_product", label: PRODUCT_EMBED_TYPE_LABELS.digital_product },
  { value: "course", label: PRODUCT_EMBED_TYPE_LABELS.course },
  { value: "bundle", label: PRODUCT_EMBED_TYPE_LABELS.bundle },
];

const itemKey = (item: ProductSearchItem) => `${item.type}:${item.id}`;

export const ProductEmbedPickerDialog: React.FC<ProductEmbedPickerDialogProps> = ({
  open,
  onOpenChange,
  onInsert,
}) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [typeTab, setTypeTab] = useState<ProductEmbedType | "all">("all");
  const [selected, setSelected] = useState<Map<string, ProductSearchItem>>(new Map());

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isFetching } = useAdminBlogProductSearchQuery(
    {
      query: debouncedQuery || undefined,
      type: typeTab === "all" ? undefined : typeTab,
    },
    open
  );

  const items = data?.items ?? [];

  const handleToggle = (item: ProductSearchItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const key = itemKey(item);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, item);
      }
      return next;
    });
  };

  const handleInsert = () => {
    onInsert(Array.from(selected.values()));
    setSelected(new Map());
    setQuery("");
    setTypeTab("all");
    onOpenChange(false);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelected(new Map());
      setQuery("");
      setTypeTab("all");
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <ConsoleDialogContent size="md">
        <ConsoleDialogHeader
          title="Insert products"
          description="Feature mock tests, study notes, courses, or bundles inline in this post. Select one or more, then insert."
        />

        <ConsoleDialogBody>
          <div className={styles.searchRow}>
            <Search size={16} className={styles.searchIcon} aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title..."
              aria-label="Search products by title"
              className={styles.searchInput}
            />
          </div>

          <Tabs value={typeTab} onValueChange={(v) => setTypeTab(v as ProductEmbedType | "all")}>
            <TabsList aria-label="Product type">
              {TYPE_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className={styles.resultsList} aria-busy={isFetching}>
            {isFetching && items.length === 0 && (
              <div className={styles.skeletonList}>
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className={styles.skeletonRow} />
                ))}
              </div>
            )}

            {!isFetching && items.length === 0 && (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon} aria-hidden="true">
                  <PackageSearch size={20} />
                </span>
                <p>No published products found.</p>
              </div>
            )}

            {items.map((item) => {
              const key = itemKey(item);
              const isChecked = selected.has(key);
              return (
                <label key={key} className={`${styles.resultRow} ${isChecked ? styles.resultRowChecked : ""}`}>
                  <Checkbox checked={isChecked} onChange={() => handleToggle(item)} />
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" className={styles.resultThumb} />
                  ) : (
                    <div className={styles.resultThumbPlaceholder} />
                  )}
                  <div className={styles.resultInfo}>
                    <span className={styles.resultTitle}>{item.title}</span>
                    <span className={styles.resultMeta}>
                      {PRODUCT_EMBED_TYPE_LABELS[item.type].replace(/s$/, "")}
                      {item.teacherName ? ` · ${item.teacherName}` : ""}
                    </span>
                  </div>
                  <span className={styles.resultPrice}>
                    {item.isFree ? "Free" : formatEmbedPrice(item.price)}
                  </span>
                </label>
              );
            })}
          </div>
        </ConsoleDialogBody>

        <ConsoleDialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleInsert} disabled={selected.size === 0}>
            {selected.size === 0
              ? "Insert products"
              : `Insert ${selected.size} ${selected.size === 1 ? "product" : "products"}`}
          </Button>
        </ConsoleDialogFooter>
      </ConsoleDialogContent>
    </Dialog>
  );
};
