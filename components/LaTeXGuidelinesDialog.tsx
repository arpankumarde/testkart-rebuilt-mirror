import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./Dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";
import { Input } from "./Input";
import { Button } from "./Button";
import { Search, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import katex from "katex";
import { latexData, FormulaItem } from "../helpers/latexData";
import "katex/dist/katex.min.css";
import styles from "./LaTeXGuidelinesDialog.module.css";

interface LaTeXGuidelinesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LatexPreview = ({ latex }: { latex: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(latex, containerRef.current, {
          throwOnError: false,
          displayMode: false,
        });
      } catch (e) {
        console.error("KaTeX render error:", e);
      }
    }
  }, [latex]);

  return <div ref={containerRef} className={styles.latexPreview} />;
};

const FormulaCard = ({ item }: { item: FormulaItem }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(item.latex);
    setCopied(true);
    toast.success("LaTeX code copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.formulaCard}>
      <div className={styles.formulaHeader}>
        <span className={styles.formulaLabel}>{item.label}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          className={styles.copyButton}
          title="Copy LaTeX"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </Button>
      </div>
      <div className={styles.formulaPreviewContainer}>
        <LatexPreview latex={item.latex} />
      </div>
      <div className={styles.formulaCode}>
        <code>{item.latex}</code>
      </div>
    </div>
  );
};

export const LaTeXGuidelinesDialog = ({
  open,
  onOpenChange,
}: LaTeXGuidelinesDialogProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("basic");

  // Filter logic
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return latexData;

    const query = searchQuery.toLowerCase();
    return latexData
      .map((category) => {
        // Filter direct items
        const filteredItems = category.items.filter(
          (item) =>
            item.label.toLowerCase().includes(query) ||
            item.latex.toLowerCase().includes(query)
        );

        // Filter subsections
        const filteredSubsections = category.subsections
          ?.map((sub) => ({
            ...sub,
            items: sub.items.filter(
              (item) =>
                item.label.toLowerCase().includes(query) ||
                item.latex.toLowerCase().includes(query)
            ),
          }))
          .filter((sub) => sub.items.length > 0);

        // Return category if it has matching items or subsections
        if (
          filteredItems.length > 0 ||
          (filteredSubsections && filteredSubsections.length > 0)
        ) {
          return {
            ...category,
            items: filteredItems,
            subsections: filteredSubsections,
          };
        }
        return null;
      })
      .filter(Boolean) as typeof latexData;
  }, [searchQuery]);

  // If searching, we might want to show all results in a flat list or keep tabs.
  // Keeping tabs is cleaner but if a tab is empty it might be confusing.
  // For simplicity, we'll stick to the tab structure but maybe switch to the first tab with results if the current one is empty.
  useEffect(() => {
    if (searchQuery && filteredData.length > 0) {
      const currentTabHasData = filteredData.find(
        (c) => c.id === activeTab
      );
      if (!currentTabHasData) {
        setActiveTab(filteredData[0].id);
      }
    }
  }, [searchQuery, filteredData, activeTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>LaTeX Formula Reference</DialogTitle>
          <DialogDescription>
            Use these codes to insert mathematical formulas into your questions.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.searchContainer}>
          <Search className={styles.searchIcon} size={16} />
          <Input
            placeholder="Search formulas (e.g., 'fraction', 'integral', 'pi')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className={styles.tabs}
        >
          <TabsList className={styles.tabsList}>
            {latexData.map((category) => (
              <TabsTrigger
                key={category.id}
                value={category.id}
                disabled={
                  searchQuery.length > 0 &&
                  !filteredData.find((c) => c.id === category.id)
                }
              >
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className={styles.scrollArea}>
            {filteredData.map((category) => (
              <TabsContent
                key={category.id}
                value={category.id}
                className={styles.tabContent}
              >
                {/* Direct Items */}
                {category.items.length > 0 && (
                  <div className={styles.grid}>
                    {category.items.map((item, idx) => (
                      <FormulaCard key={`${item.label}-${idx}`} item={item} />
                    ))}
                  </div>
                )}

                {/* Subsections */}
                {category.subsections?.map((sub) => (
                  <div key={sub.label} className={styles.subsection}>
                    <h3 className={styles.subsectionTitle}>{sub.label}</h3>
                    <div className={styles.grid}>
                      {sub.items.map((item, idx) => (
                        <FormulaCard key={`${item.label}-${idx}`} item={item} />
                      ))}
                    </div>
                  </div>
                ))}

                {category.items.length === 0 &&
                  (!category.subsections ||
                    category.subsections.length === 0) && (
                    <div className={styles.emptyState}>
                      No matching formulas found in this category.
                    </div>
                  )}
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};