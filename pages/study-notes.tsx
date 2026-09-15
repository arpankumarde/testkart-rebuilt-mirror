import React, { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { useSearchParams } from "react-router-dom";
import { useShopProductsQuery } from "../helpers/useShopQuery";
import { Button } from "../components/Button";
import { Search } from "lucide-react";
import { Input } from "../components/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { useDebounce } from "../helpers/useDebounce";
import { Skeleton } from "../components/Skeleton";
import { SEOHead } from "../components/SEOHead";
import { TeacherProductCard } from "../components/HomepageContentSection";
import { Placeholder } from "../helpers/placeholderImages";
import { formatItemPrice } from "../helpers/homepageItemUtils";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../components/Pagination";
import styles from "./study-notes.module.css";

const ShopPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [sort, setSort] = useState<"newest" | "popular" | "price_asc" | "price_desc">((searchParams.get("sort") as any) || "popular");
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const debouncedSearch = useDebounce(search, 300);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (sort !== "popular") params.set("sort", sort);
    if (page > 1) params.set("page", page.toString());
    if (debouncedSearch) params.set("search", debouncedSearch);
    
    setSearchParams(params, { replace: true });
  }, [sort, page, debouncedSearch, setSearchParams]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const getPageNumbers = useCallback((currentPage: number, totalPages: number) => {
    const delta = 1;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    range.push(1);
    for (let i = currentPage - delta; i <= currentPage + delta; i++) {
      if (i < totalPages && i > 1) {
        range.push(i);
      }
    }
    range.push(totalPages);

    for (const i of range) {
      if (l !== undefined) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push("...");
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  }, []);

  const { data, isLoading, isError } = useShopProductsQuery({
    sort,
    page,
    limit: 50,
    search: debouncedSearch || undefined,
  });

  return (
    <>
      <SEOHead
        title="Shop - Study Materials & PDFs"
        description="Browse and buy high-quality study materials, notes, question banks, and eBooks created by expert teachers."
      />
      
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Buy Study Notes Online</h1>
            <p className={styles.subtitle}>
              Premium study resources, notes, and eBooks for your exam preparation.
            </p>
          </div>
        </header>

        <div className={styles.layout}>
          {/* Main Content */}
          <main className={styles.main}>
            <div className={styles.resultsHeader}>
              <p className={styles.resultsCount}>
                {isLoading ? (
                  <Skeleton style={{ width: "100px", height: "20px" }} />
                ) : (
              <>Found <strong>{data?.totalCount || 0}</strong> products</>
                )}
              </p>

              <div className={styles.searchContainer}>
                <Search className={styles.searchIcon} size={18} />
                <Input
                  type="search"
                  placeholder="Search notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              
              <div className={styles.sortContainer}>
                <span className={styles.sortLabel}>Sort by:</span>
                <Select 
                  value={sort} 
                  onValueChange={(val: any) => setSort(val)}
                >
                  <SelectTrigger className={styles.sortSelect}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest Arrivals</SelectItem>
                    <SelectItem value="popular">Most Popular</SelectItem>
                    <SelectItem value="price_asc">Price: Low to High</SelectItem>
                    <SelectItem value="price_desc">Price: High to Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading ? (
              <div className={styles.grid}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "var(--spacing-4)", backgroundColor: "var(--surface)" }}>
                    <div style={{ display: "flex", gap: "var(--spacing-3)", alignItems: "center" }}>
                      <Skeleton style={{ width: 36, height: 36, borderRadius: "50%" }} />
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-1)", flex: 1 }}>
                        <Skeleton style={{ height: 14, width: 100 }} />
                        <Skeleton style={{ height: 12, width: 150 }} />
                      </div>
                    </div>
                    <Skeleton style={{ height: 20, width: "100%", marginTop: "var(--spacing-2)" }} />
                    <Skeleton style={{ width: "100%", aspectRatio: "16/9", borderRadius: "var(--radius)" }} />
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div className={styles.errorState}>
                <h3>Something went wrong</h3>
                <p>Failed to load products. Please try again later.</p>
                <Button onClick={() => window.location.reload()}>Retry</Button>
              </div>
            ) : data?.products.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🔍</div>
                <h3>No products found</h3>
                <p>Check back later for new study notes.</p>
              </div>
            ) : (
              <>
                <div className={styles.grid}>
                  {data?.products.map((product) => (
                                        <TeacherProductCard
                      key={product.id}
                      link={"/study-notes/" + product.slug}
                      teacherName={product.teacherName}
                      teacherAvatarUrl={product.teacherAvatar}
                      teacherTagline={product.teacherTagline}
                      teacherYearsOfExperience={product.teacherYearsOfExperience}
                      teacherSlug={product.teacherSlug}
                      teacherIsVerified={product.teacherIsVerified}
                      productTitle={product.title}
                      examName={product.examName}
                      stats={[
                        `${product.views.toLocaleString('en-IN')} views`,
                        product.pageCount ? `${product.pageCount} pages` : null,
                        product.fileCount > 1 ? `${product.fileCount} files` : null,
                      ].filter(Boolean).join(' · ')}
                      priceLabel={formatItemPrice(product.price)}
                      isFree={product.price === 0}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {data && data.totalPages > 1 && (
                  <div className={styles.paginationContainer}>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => { e.preventDefault(); if (page > 1) setPage(p => p - 1); }}
                            className={page <= 1 ? styles.disabledLink : ""}
                          />
                        </PaginationItem>

                        {getPageNumbers(page, data.totalPages).map((pageNum, index) => (
                          <PaginationItem key={index}>
                            {pageNum === "..." ? (
                              <PaginationEllipsis />
                            ) : (
                              <PaginationLink
                                href="#"
                                isActive={page === pageNum}
                                onClick={(e) => { e.preventDefault(); setPage(pageNum as number); }}
                              >
                                {pageNum}
                              </PaginationLink>
                            )}
                          </PaginationItem>
                        ))}

                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => { e.preventDefault(); if (page < data.totalPages) setPage(p => p + 1); }}
                            className={page >= data.totalPages ? styles.disabledLink : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                    <div className={styles.paginationInfo}>
                      Page {page} of {data.totalPages} &mdash; {data.totalCount} products
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </>
  );
};

export default ShopPage;