import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { z } from "zod";
import { 
  useAdminBlogCategoriesQuery, 
  useUpsertBlogCategoryMutation, 
  useDeleteBlogCategoryMutation 
} from "../helpers/useAdminBlog";
import { CategoryWithCount } from "../endpoints/admin/blog/categories/list_GET.schema";
import { useTableSort, SortAccessors } from "../helpers/useTableSort";
import { SortableTh } from "../components/SortableTh";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/Select";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import { Dialog } from "../components/Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "../components/ConsoleDialog";
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from "../components/Form";
import { DeleteConfirmationDialog } from "../components/DeleteConfirmationDialog";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ArrowLeft, Edit, Trash2, Plus, FolderTree, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import styles from "./admin.blog.category.module.css";

const categoryFormSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1, "Name is required"),
  slug: z.string().optional(),
  type: z.enum(["blog", "knowledge_base", "both"]),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

const generateSlug = (text: string) => {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
};

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colType} />
    <col className={styles.colCount} />
    <col className={styles.colCount} />
    <col className={styles.colActions} />
  </colgroup>
);

const CategoryRowSkeleton = () => (
  <tr>
    <td>
      <div className={styles.stack}>
        <Skeleton style={{ height: "0.875rem", width: "40%" }} />
        <Skeleton style={{ height: "0.75rem", width: "75%" }} />
      </div>
    </td>
    <td><Skeleton style={{ height: "1.125rem", width: "3.5rem" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "1rem", marginLeft: "auto" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "1.25rem", marginLeft: "auto" }} /></td>
    <td><Skeleton style={{ height: "1.5rem", width: "3.5rem", marginLeft: "auto" }} /></td>
  </tr>
);

const CategoryCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "9rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "7rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "4rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

const renderTypeFlag = (category: CategoryWithCount) => (
  <Badge variant={category.type === "blog" ? "default" : "secondary"} className={styles.flag}>
    {category.type === "blog" ? "Blog" : "Help pages"}
  </Badge>
);

const SORT_ACCESSORS: SortAccessors<CategoryWithCount, "name" | "type" | "sortOrder" | "postCount"> = {
  name: (c) => c.name,
  type: (c) => c.type,
  sortOrder: (c) => c.sortOrder,
  postCount: (c) => c.postCount,
};

const AdminBlogCategoriesPage = () => {
  const { data, isFetching, error, refetch } = useAdminBlogCategoriesQuery();
  const { sorted: sortedCategories, ...sort } = useTableSort(data?.categories, SORT_ACCESSORS);
  const upsertMutation = useUpsertBlogCategoryMutation();
  const deleteMutation = useDeleteBlogCategoryMutation();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: number; name: string } | null>(null);

  const form = useForm({
    schema: categoryFormSchema,
    defaultValues: {
      name: "",
      slug: "",
      type: "both",
      description: "",
      icon: "",
      sortOrder: 0
    }
  });

  const handleAdd = () => {
    form.setValues({
      name: "",
      slug: "",
      type: "both",
      description: "",
      icon: "",
      sortOrder: 0
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (category: CategoryWithCount) => {
    form.setValues({
      id: category.id,
      name: category.name,
      slug: category.slug,
      type: category.type,
      description: category.description || "",
      icon: category.icon || "",
      sortOrder: category.sortOrder
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: z.infer<typeof categoryFormSchema>) => {
    try {
      if (values.type === "both") {
        const { id, type, ...rest } = values;
        await upsertMutation.mutateAsync({ ...rest, type: "blog" });
        await upsertMutation.mutateAsync({ ...rest, type: "knowledge_base" });
        toast.success("Category added to the blog and the help pages.");
        setIsDialogOpen(false);
      } else {
        upsertMutation.mutate({ ...values, type: values.type }, {
          onSuccess: () => {
            setIsDialogOpen(false);
          }
        });
      }
    } catch (e) {
      // Error toast is already handled by useAdminBlog's useMutation
    }
  };

  const renderActions = (cat: CategoryWithCount) => (
    <div className={styles.rowActions}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.iconButton}
            onClick={() => handleEdit(cat)}
            aria-label={`Edit ${cat.name}`}
          >
            <Edit />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Edit</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={`${styles.iconButton} ${styles.iconButtonDanger}`}
            onClick={() => setCategoryToDelete({ id: cat.id, name: cat.name })}
            aria-label={`Delete ${cat.name}`}
          >
            <Trash2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>
    </div>
  );

  const renderContent = () => {
    if (isFetching && !data) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => <CategoryRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <CategoryCardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (error) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the categories"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (!data || data.categories.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<FolderTree size={24} />}
          title="No categories yet"
          description="Categories group blog posts and help page articles."
        >
          <Button onClick={handleAdd}><Plus size={16} /> Add a category</Button>
        </ConsoleListEmpty>
      );
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                <SortableTh column="name" sort={sort}>Category</SortableTh>
                <SortableTh column="type" sort={sort}>Type</SortableTh>
                <SortableTh column="sortOrder" sort={sort} className={styles.num}>Order</SortableTh>
                <SortableTh column="postCount" sort={sort} className={styles.num}>Posts</SortableTh>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sortedCategories.map(cat => (
                <tr key={cat.id}>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.primaryLine}>
                        <span className={styles.name} title={cat.name}>{cat.name}</span>
                        <span className={styles.slug} title={`/${cat.slug}`}>/{cat.slug}</span>
                      </span>
                      {cat.description && (
                        <span className={styles.secondaryLine} title={cat.description}>{cat.description}</span>
                      )}
                    </div>
                  </td>
                  <td>{renderTypeFlag(cat)}</td>
                  <td className={styles.num}>{cat.sortOrder}</td>
                  <td className={`${styles.num} ${cat.postCount === 0 ? styles.zero : ""}`}>{cat.postCount}</td>
                  <td>{renderActions(cat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.cardsContainer}>
          {sortedCategories.map(cat => (
            <article key={cat.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.stack}>
                  <span className={styles.cardTitleLine}>
                    <span className={styles.truncate} title={cat.name}>{cat.name}</span>
                    {renderTypeFlag(cat)}
                  </span>
                  <span className={styles.secondaryLine} title={`/${cat.slug}`}>/{cat.slug}</span>
                </div>
                {renderActions(cat)}
              </div>
              {cat.description && <p className={styles.cardText}>{cat.description}</p>}
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <dt>Order</dt>
                  <dd>{cat.sortOrder}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Posts</dt>
                  <dd className={cat.postCount === 0 ? styles.zero : undefined}>{cat.postCount}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </>
    );
  };

  return (
    <>
      <Helmet>
        <title>Categories - Testkart Admin</title>
      </Helmet>
      
      <div className={styles.page}>
        <Button variant="ghost" size="sm" asChild className={styles.backLink}>
          <Link to="/admin/blog">
            <ArrowLeft size={14} /> Blog posts
          </Link>
        </Button>

        <ConsolePageHeader title="Categories">
          <Button onClick={handleAdd}>
            <Plus size={16} /> Add a category
          </Button>
        </ConsolePageHeader>

        <div className={styles.results}>{renderContent()}</div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <ConsoleDialogContent size="md">
          <ConsoleDialogHeader
            title={form.values.id ? "Edit category" : "New category"}
            description="Categories group posts so readers can browse by subject."
          />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <ConsoleDialogBody>
                <FormItem name="name">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. Test Strategies" 
                      value={form.values.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        form.setValues(prev => {
                          let slug = prev.slug;
                          if (!prev.id && (!slug || slug === generateSlug(prev.name))) {
                            slug = generateSlug(val);
                          }
                          return { ...prev, name: val, slug };
                        });
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="slug">
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. test-strategies" 
                      value={form.values.slug}
                      onChange={(e) => form.setValues(prev => ({ ...prev, slug: e.target.value }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="type">
                  <FormLabel>Shows in</FormLabel>
                  <Select 
                    value={form.values.type} 
                    onValueChange={(val) => form.setValues(prev => ({ ...prev, type: val as any }))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="blog">Blog</SelectItem>
                      <SelectItem value="knowledge_base">Help pages</SelectItem>
                      {!form.values.id && (
                        <SelectItem value="both">Both</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>

                <FormItem name="description">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="What belongs in this category" 
                      value={form.values.description || ""}
                      onChange={(e) => form.setValues(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <div className={styles.formRow}>
                  <FormItem name="icon">
                    <FormLabel>Icon name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. FileText" 
                        value={form.values.icon || ""}
                        onChange={(e) => form.setValues(prev => ({ ...prev, icon: e.target.value }))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>

                  <FormItem name="sortOrder">
                    <FormLabel>Sort order</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        placeholder="0" 
                        value={form.values.sortOrder}
                        onChange={(e) => form.setValues(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </div>
              </ConsoleDialogBody>

              <ConsoleDialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={upsertMutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending ? "Saving..." : "Save category"}
                </Button>
              </ConsoleDialogFooter>
            </form>
          </Form>
        </ConsoleDialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={() => {
          if (categoryToDelete) {
            deleteMutation.mutate({ id: categoryToDelete.id }, {
              onSuccess: () => setCategoryToDelete(null)
            });
          }
        }}
        isPending={deleteMutation.isPending}
        itemName={categoryToDelete?.name}
        itemType="category"
      />
    </>
  );
};

export default AdminBlogCategoriesPage;
